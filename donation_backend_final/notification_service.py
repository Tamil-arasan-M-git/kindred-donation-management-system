"""Notification abstraction with in-app persistence and multi-channel delivery.

Sends email (SMTP) and SMS/WhatsApp (Twilio's REST API directly, no extra
package needed) for donation events — matching, packaging, pickup, and
delivery updates for both donors and NGOs.

Public interface (unchanged from before, safe drop-in replacement):

    from notification_service import notify_users
    notify_users(db, users, event_type, context=None, donation_id=None)

`users` = the User rows to notify (a donor's User row for donor-facing
events, an NGO's staff User row(s) for NGO-facing events). Call this
AFTER committing the primary transaction (e.g. right after a
DonationMatch is created, or an OperationAssignment's status changes) so
a notification failure never rolls back the actual business change.
"""

import base64
import logging
from datetime import datetime, timezone
from urllib.parse import quote
from urllib.request import Request, urlopen

from config import (
    EMAIL_FROM,
    EMAIL_HOST,
    EMAIL_PASSWORD,
    EMAIL_PORT,
    EMAIL_USERNAME,
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    TWILIO_SMS_NUMBER,
    TWILIO_WHATSAPP_NUMBER,
    TWILIO_WHATSAPP_CONTENT_SID,
)
from db import Notification
import smtplib
from email.message import EmailMessage

logger = logging.getLogger(__name__)

EVENTS = {
    "MATCH_ACCEPTED": ("Match accepted", "Your donation has been accepted by an NGO."),
    "MATCH_REJECTED": ("Match update", "An NGO rejected a match for your donation."),
    "PACKAGING_REQUIRED": ("Packaging required", "Your donation is ready for packaging."),
    "PICKUP_SCHEDULED": ("Pickup scheduled", "A pickup has been scheduled for your donation."),
    "PICKUP_REMINDER": ("Pickup reminder", "Your donation pickup is coming up."),
    "DONATION_COLLECTED": ("Donation collected", "Your donation has been collected."),
    "DONATION_DELIVERED": ("Donation delivered", "Your donation has been delivered."),
    "DONATION_ACKNOWLEDGED": ("Donation acknowledged", "The NGO acknowledged receipt of your donation."),
    "PACKAGING_SCHEDULED": ("Packaging scheduled", "Packaging has been scheduled for your donation."),
    "PACKAGING_COMPLETED": ("Packaging completed", "Packaging has been completed for your donation."),
    "DELIVERY_SCHEDULED": ("Delivery scheduled", "Delivery has been scheduled for your donation."),
    "PICKUP_COMPLETED": ("Pickup completed", "Pickup has been completed for your donation."),
    "DELIVERY_COMPLETED": ("Delivery completed", "Delivery has been completed for your donation."),
}


def _send_email(recipient: str, title: str, message: str) -> bool:
    if not EMAIL_HOST or not recipient:
        return False
    try:
        email = EmailMessage()
        email["From"] = EMAIL_FROM or EMAIL_USERNAME
        email["To"] = recipient
        email["Subject"] = title
        email.set_content(message)
        with smtplib.SMTP(EMAIL_HOST, EMAIL_PORT or 587, timeout=10) as smtp:
            smtp.starttls()
            if EMAIL_USERNAME:
                smtp.login(EMAIL_USERNAME, EMAIL_PASSWORD)
            smtp.send_message(email)
        return True
    except Exception:
        logger.exception("Email delivery failed for %s", recipient)
        return False


def _send_twilio(to: str, body: str, channel: str) -> bool:
    """channel is 'sms' or 'whatsapp' — picks the right Twilio "from" number
    and, for WhatsApp, prefixes both numbers with 'whatsapp:' as Twilio requires."""
    if not (TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and to):
        return False
    sender = TWILIO_WHATSAPP_NUMBER if channel == "whatsapp" else TWILIO_SMS_NUMBER
    if not sender:
        return False
    try:
        if channel == "whatsapp" and not to.startswith("whatsapp:"):
            to = f"whatsapp:{to}"
        if channel == "whatsapp":
            if not TWILIO_WHATSAPP_CONTENT_SID:
                logger.error("WhatsApp Content SID is not configured")
                return False
            payload = (
                f"To={quote(to)}"
                f"&From={quote(sender)}"
                f"&ContentSid={quote(TWILIO_WHATSAPP_CONTENT_SID)}"
            ).encode()
        else:
            # Twilio trial SMS requires the predefined trial template.
            payload = (
                f"To={quote(to)}"
                f"&From={quote(sender)}"
                f"&Body={quote("sms_event_notifications")}"
            ).encode()
        auth = base64.b64encode(f"{TWILIO_ACCOUNT_SID}:{TWILIO_AUTH_TOKEN}".encode()).decode()
        request = Request(
            f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_ACCOUNT_SID}/Messages.json",
            data=payload,
            headers={"Authorization": f"Basic {auth}"},
            method="POST",
        )
        with urlopen(request, timeout=10):
            return True
    except Exception:
        logger.exception("%s delivery failed for %s", channel, to)
        return False


def _record(db, user_id, donation_id, event_type: str, title: str, message: str,
            channel: str, success: bool):
    """One audit row per delivery attempt on one channel — uses the
    channel/delivery_status columns exactly as the schema intends, so you
    can later query 'did the SMS for this donation actually go out?'."""
    db.add(Notification(
        user_id=user_id,
        donation_id=donation_id,
        type=event_type,
        title=title,
        message=message,
        channel=channel,
        delivery_status="delivered" if success else "failed",
        sent_at=datetime.now(timezone.utc) if success else None,
    ))


def notify_users(db, users, event_type: str, context: dict | None = None, donation_id=None):
    """Persist in-app notifications and best-effort deliver over email,
    SMS, and WhatsApp. Provider errors are isolated per channel and never
    raised to the calling workflow — one channel failing never blocks the
    others or the in-app record.
    """
    title, default_message = EVENTS.get(event_type, (event_type, event_type.replace("_", " ").title()))
    context = context or {}
    message = context.get("message", default_message)

    for user in {user.id: user for user in users if user and user.is_active}.values():
        # In-app notification is always recorded, regardless of external delivery.
        db.add(Notification(
            user_id=user.id,
            donation_id=donation_id,
            type=event_type,
            title=title,
            message=message,
            channel="in_app",
            delivery_status="delivered",
            sent_at=datetime.now(timezone.utc),
        ))

        # A user is either donor-linked or ngo-linked (per the role check
        # constraint) — resolve whichever phone number actually applies.
        phone = None
        if user.donor and user.donor.phone:
            phone = user.donor.phone
        elif user.ngo and user.ngo.contact_phone:
            phone = user.ngo.contact_phone

        if user.email:
            success = _send_email(user.email, title, message)
            _record(db, user.id, donation_id, event_type, title, message, "email", success)

        if phone:
            sms_success = _send_twilio(phone, message, "sms")
            _record(db, user.id, donation_id, event_type, title, message, "sms", sms_success)

            whatsapp_success = _send_twilio(phone, message, "whatsapp")
            _record(db, user.id, donation_id, event_type, title, message, "whatsapp", whatsapp_success)

    try:
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Notification persistence failed")
