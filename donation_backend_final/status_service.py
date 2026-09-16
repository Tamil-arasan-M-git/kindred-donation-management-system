"""Authoritative donation status transitions and role permissions."""

from fastapi import HTTPException

STATUS_TRANSITIONS = {
    "submitted": {"matched", "cancelled"},
    "matched": {"packaging_notified", "cancelled"},
    "packaging_notified": {"pickup_scheduled", "cancelled"},
    "pickup_scheduled": {"collected", "cancelled"},
    "collected": {"delivered"},
    "delivered": {"acknowledged"},
    "acknowledged": set(),
    "cancelled": set(),
}

OPERATIONAL_STATUSES = {"collected", "delivered", "acknowledged"}


def validate_transition(current_status: str, next_status: str):
    if next_status not in STATUS_TRANSITIONS.get(current_status, set()):
        raise HTTPException(
            status_code=409,
            detail=f"Donation cannot transition from {current_status} to {next_status}",
        )


def validate_status_action(role: str, current_status: str, next_status: str):
    """Donors may cancel; NGOs manage operational stages; admins may override."""
    if role == "admin":
        return
    if role == "donor" and next_status != "cancelled":
        raise HTTPException(status_code=403, detail="Donors cannot set operational donation statuses")
    if role == "ngo" and next_status == "cancelled":
        return
    if role == "ngo" and next_status in OPERATIONAL_STATUSES | {"packaging_notified"}:
        return
    raise HTTPException(status_code=403, detail="This role cannot perform that status transition")
