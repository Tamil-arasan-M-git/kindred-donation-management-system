"""Notification abstraction with in-app persistence and optional providers."""

import base64
import logging
import smtplib
from datetime import datetime, timezone
from email.message import EmailMessage
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
)
from db import Notification

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
    "DELIVERY_SCHEDULED": ("Delivery scheduled", "Delivery has been scheduled for your donation."),
    "PICKUP_COMPLETED": ("Pickup completed", "Pickup has been completed for your donation."),
    "DELIVERY_COMPLETED": ("Delivery completed", "Delivery has been completed for your donation."),
}


def _send_email(recipient: str, title: str, message: str):
    if not EMAIL_HOST or not recipient:
        return False
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


def _send_twilio(to: str, body: str, channel: str):
    if not (TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and to):
        return False
    sender = TWILIO_WHATSAPP_NUMBER if channel == "whatsapp" else TWILIO_SMS_NUMBER
    if not sender:
        return False
    if channel == "whatsapp" and not to.startswith("whatsapp:"):
        to = f"whatsapp:{to}"
    payload = f"To={quote(to)}&From={quote(sender)}&Body={quote(body)}".encode()
    auth = base64.b64encode(f"{TWILIO_ACCOUNT_SID}:{TWILIO_AUTH_TOKEN}".encode()).decode()
    request = Request(
        f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_ACCOUNT_SID}/Messages.json",
        data=payload,
        headers={"Authorization": f"Basic {auth}"},
        method="POST",
    )
    with urlopen(request, timeout=10):
        return True


def notify_users(db, users, event_type: str, context: dict | None = None, donation_id=None):
    """Persist in-app notifications and best-effort external delivery.

    Provider errors are isolated and never raised to the calling workflow.
    The caller should invoke this after its primary transaction commits.
    """
    title, default_message = EVENTS.get(event_type, (event_type, event_type.replace("_", " ").title()))
    context = context or {}
    message = context.get("message", default_message)
    for user in {user.id: user for user in users if user and user.is_active}.values():
        notification = Notification(
            user_id=user.id,
            donation_id=donation_id,
            type=event_type,
            title=title,
            message=message,
            channel="in_app",
            delivery_status="delivered",
            sent_at=datetime.now(timezone.utc),
        )
        db.add(notification)
        try:
            if user.email:
                _send_email(user.email, title, message)
            if user.donor and user.donor.phone:
                _send_twilio(user.donor.phone, message, "sms")
            if user.ngo and user.ngo.contact_phone:
                _send_twilio(user.ngo.contact_phone, message, "sms")
        except Exception:
            logger.exception("External notification delivery failed for user %s", user.id)
    try:
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("In-app notification persistence failed")
