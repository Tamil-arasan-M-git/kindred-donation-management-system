"""
notification_triggers.py

Ready-to-call functions for the exact moments notifications need to fire:
a match is accepted/rejected, packaging/pickup/delivery gets scheduled or
completed, a donation is acknowledged. Each function handles looking up
the right User row(s) internally (the notifications system sends to User
rows, but the matching/operations code naturally works with Donor/NGO/
ItemSubmission/OperationAssignment objects instead) — so your teammates
never need to know how donor_id/ngo_id map to a User row.

======================================================================
HOW YOUR TEAMMATES USE THIS (no other file needs to change)
======================================================================

Matching engine — call this right after a DonationMatch is accepted:

    from notification_triggers import notify_match_accepted
    notify_match_accepted(db, submission)   # submission = the ItemSubmission row

...or rejected:

    from notification_triggers import notify_match_rejected
    notify_match_rejected(db, submission)

Packaging module — call these when packaging is requested/scheduled/done:

    from notification_triggers import (
        notify_packaging_required, notify_packaging_scheduled, notify_packaging_completed,
    )
    notify_packaging_required(db, submission)
    notify_packaging_scheduled(db, submission, operation)   # operation = the OperationAssignment row
    notify_packaging_completed(db, submission, operation)

Pickup/delivery module — same pattern:

    from notification_triggers import (
        notify_pickup_scheduled, notify_pickup_completed,
        notify_delivery_scheduled, notify_delivery_completed,
    )
    notify_pickup_scheduled(db, submission, operation)
    notify_pickup_completed(db, submission, operation)
    notify_delivery_scheduled(db, submission, operation)
    notify_delivery_completed(db, submission, operation)

Or, if a module just updates an OperationAssignment's status and wants
one call to "do the right thing" automatically based on task_type+status:

    from notification_triggers import notify_operation_status_change
    notify_operation_status_change(db, operation)   # after operation.status is set + committed

Donor/NGO final acknowledgement:

    from notification_triggers import notify_donation_acknowledged
    notify_donation_acknowledged(db, submission)

All of these call db.commit() internally (via notify_users) — call them
AFTER your own primary transaction is already committed, so a
notification failure never rolls back the actual status change.
"""

from db import User
from notification_service import notify_users


# ---------------------------------------------------------------------------
# Internal lookups — resolve Donor/NGO objects to the User row(s) that
# actually receive notifications.
# ---------------------------------------------------------------------------

def _donor_user(db, donor_id) -> list:
    if donor_id is None:
        return []
    user = db.query(User).filter(User.donor_id == donor_id).first()
    return [user] if user else []


def _ngo_users(db, ngo_id) -> list:
    """An NGO can have multiple linked User accounts (admin + staff logins).
    All of them get notified — the notifications table has one row per
    user anyway, so this doesn't over-notify a single inbox."""
    if ngo_id is None:
        return []
    return db.query(User).filter(User.ngo_id == ngo_id).all()


# ---------------------------------------------------------------------------
# Matching events
# ---------------------------------------------------------------------------

def notify_match_accepted(db, submission):
    """Call right after a DonationMatch's status is set to 'accepted' and
    submission.ngo_id is set. Notifies the donor; the NGO already knows
    since they're the one who accepted it, but gets a confirmation too."""
    notify_users(db, _donor_user(db, submission.donor_id), "MATCH_ACCEPTED", donation_id=submission.id)
    notify_users(db, _ngo_users(db, submission.ngo_id), "MATCH_ACCEPTED", donation_id=submission.id)


def notify_match_rejected(db, submission, reason: str | None = None):
    """Call when a DonationMatch is rejected by an NGO — notifies the
    donor so the matching engine can look for another NGO."""
    context = {"message": f"An NGO rejected a match for your donation. {reason}".strip()} if reason else None
    notify_users(db, _donor_user(db, submission.donor_id), "MATCH_REJECTED", donation_id=submission.id, context=context)


# ---------------------------------------------------------------------------
# Packaging events
# ---------------------------------------------------------------------------

def notify_packaging_required(db, submission):
    """Call as soon as a match is accepted and the donor needs to package
    the item — typically right alongside notify_match_accepted()."""
    notify_users(db, _donor_user(db, submission.donor_id), "PACKAGING_REQUIRED", donation_id=submission.id)


def notify_packaging_scheduled(db, submission, operation):
    """operation = the OperationAssignment row (task_type='packaging').
    Notifies the donor and the assigned NGO staff member."""
    context = {"message": f"Packaging scheduled for {operation.scheduled_at:%Y-%m-%d %H:%M}."}
    notify_users(db, _donor_user(db, submission.donor_id), "PACKAGING_SCHEDULED",
                 donation_id=submission.id, context=context)
    if operation.staff and (operation.staff.email or operation.staff.phone):
        # Staff members aren't User rows in this schema (ngo_staff is separate
        # from users) — notify them directly rather than through notify_users,
        # which expects User rows. See note at the bottom of this file.
        _notify_staff_directly(operation.staff, "PACKAGING_SCHEDULED", context["message"])


def notify_packaging_completed(db, submission, operation):
    notify_users(db, _donor_user(db, submission.donor_id), "PACKAGING_COMPLETED", donation_id=submission.id)
    notify_users(db, _ngo_users(db, submission.ngo_id), "PACKAGING_COMPLETED", donation_id=submission.id)


# ---------------------------------------------------------------------------
# Pickup events
# ---------------------------------------------------------------------------

def notify_pickup_scheduled(db, submission, operation):
    context = {"message": f"Pickup scheduled for {operation.scheduled_at:%Y-%m-%d %H:%M}."}
    notify_users(db, _donor_user(db, submission.donor_id), "PICKUP_SCHEDULED",
                 donation_id=submission.id, context=context)
    if operation.staff:
        _notify_staff_directly(operation.staff, "PICKUP_SCHEDULED", context["message"])


def notify_pickup_reminder(db, submission, operation):
    """Call from a scheduled job shortly before operation.scheduled_at."""
    context = {"message": f"Reminder: pickup scheduled for {operation.scheduled_at:%Y-%m-%d %H:%M}."}
    notify_users(db, _donor_user(db, submission.donor_id), "PICKUP_REMINDER",
                 donation_id=submission.id, context=context)


def notify_pickup_completed(db, submission, operation):
    """Donor sees donor-friendly phrasing ('your donation was collected');
    NGO sees ops phrasing ('pickup completed')."""
    notify_users(db, _donor_user(db, submission.donor_id), "DONATION_COLLECTED", donation_id=submission.id)
    notify_users(db, _ngo_users(db, submission.ngo_id), "PICKUP_COMPLETED", donation_id=submission.id)
    if operation.staff:
        _notify_staff_directly(operation.staff, "PICKUP_COMPLETED", "Pickup marked completed.")


# ---------------------------------------------------------------------------
# Delivery events
# ---------------------------------------------------------------------------

def notify_delivery_scheduled(db, submission, operation):
    context = {"message": f"Delivery scheduled for {operation.scheduled_at:%Y-%m-%d %H:%M}."}
    notify_users(db, _ngo_users(db, submission.ngo_id), "DELIVERY_SCHEDULED",
                 donation_id=submission.id, context=context)
    if operation.staff:
        _notify_staff_directly(operation.staff, "DELIVERY_SCHEDULED", context["message"])


def notify_delivery_completed(db, submission, operation):
    """Donor sees donor-friendly phrasing ('your donation has arrived');
    NGO sees ops phrasing ('delivery completed')."""
    notify_users(db, _donor_user(db, submission.donor_id), "DONATION_DELIVERED", donation_id=submission.id)
    notify_users(db, _ngo_users(db, submission.ngo_id), "DELIVERY_COMPLETED", donation_id=submission.id)
    if operation.staff:
        _notify_staff_directly(operation.staff, "DELIVERY_COMPLETED", "Delivery marked completed.")


def notify_donation_acknowledged(db, submission):
    """Call when the NGO confirms final receipt of the donation."""
    notify_users(db, _donor_user(db, submission.donor_id), "DONATION_ACKNOWLEDGED", donation_id=submission.id)


# ---------------------------------------------------------------------------
# Generic dispatcher — if the operations module just wants to call ONE
# function after updating operation.status, this figures out the right
# event(s) from task_type + status automatically.
# ---------------------------------------------------------------------------

_STATUS_DISPATCH = {
    ("packaging", "scheduled"): notify_packaging_scheduled,
    ("packaging", "completed"): notify_packaging_completed,
    ("pickup", "scheduled"): notify_pickup_scheduled,
    ("pickup", "completed"): notify_pickup_completed,
    ("delivery", "scheduled"): notify_delivery_scheduled,
    ("delivery", "completed"): notify_delivery_completed,
}


def notify_operation_status_change(db, operation):
    """operation = an OperationAssignment row, AFTER operation.status has
    been set and committed. Looks up the matching ItemSubmission itself,
    so callers just need the operation row."""
    from db import ItemSubmission
    handler = _STATUS_DISPATCH.get((operation.task_type, operation.status))
    if handler is None:
        return  # e.g. 'in_progress' or 'cancelled' — no notification defined for these
    submission = db.query(ItemSubmission).filter(ItemSubmission.id == operation.donation_id).first()
    if submission is None:
        return
    handler(db, submission, operation)


# ---------------------------------------------------------------------------
# NOTE on ngo_staff: NGOStaff rows are NOT User rows in this schema (they
# don't log in — they're just contact records for pickup/packaging/delivery
# assignment). notify_users() only works with User rows, so a staff member
# assigned to an OperationAssignment gets a direct, un-logged email/SMS
# here instead of going through the notifications table. If staff should
# also see notifications in-app later, they'd need their own User row
# (via users.ngo_id), at which point this can call notify_users() too.
# ---------------------------------------------------------------------------

def _notify_staff_directly(staff, event_type: str, message: str):
    from notification_service import EVENTS, _send_email, _send_twilio
    title, _ = EVENTS.get(event_type, (event_type, event_type))
    if staff.email:
        _send_email(staff.email, title, message)
    if staff.phone:
        _send_twilio(staff.phone, message, "sms")
