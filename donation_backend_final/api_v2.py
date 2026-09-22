import logging
import math
from datetime import date, datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from db import DemandRecord, DonationMatch, Donor, ItemSubmission, ItemSubmissionLine, NGO, NGOStaff, Notification, OperationAssignment, StatusHistory, User, get_db
from notification_service import EVENTS, notify_users
from packaging_service import get_packaging_checklist
from schemas import DemandCreate, DemandResponse, DonationCreate, DonorResponse, DonorUpdate, NGOCreate, NGOResponse, NGOUpdate, LoginRequest, OperationCreate, OperationUpdate, PickupScheduleRequest, StaffCreate, StaffResponse, StaffUpdate, StatusUpdate, TokenResponse, UserRegister, UserResponse, VerificationRequest, CATEGORIES
from taxonomy import subcategories_compatible
from security import create_access_token, get_current_user, hash_password, require_roles, verify_password
from status_service import STATUS_TRANSITIONS, validate_status_action, validate_transition

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["Milestone 2"])
TRANSITIONS = STATUS_TRANSITIONS


def validate_pagination(limit: int, offset: int, max_limit: int = 100):
    if limit <= 0:
        raise HTTPException(status_code=400, detail="limit must be greater than 0")
    if offset < 0:
        raise HTTPException(status_code=400, detail="offset must be greater than or equal to 0")
    if limit > max_limit:
        raise HTTPException(status_code=400, detail=f"limit cannot exceed {max_limit}")
    return limit, offset

def require_owner(user: User, ngo_id: UUID | None = None, donor_id: UUID | None = None):
    if user.role == "admin":
        return
    if user.role == "ngo" and ngo_id and user.ngo_id == ngo_id:
        return
    if user.role == "donor" and donor_id and user.donor_id == donor_id:
        return
    raise HTTPException(status_code=403, detail="You do not own this resource")


def require_admin(user: User):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


def require_ngo_or_admin(user: User, ngo_id: UUID | None):
    if user.role == "admin":
        return
    if user.role == "ngo" and ngo_id and user.ngo_id == ngo_id:
        return
    raise HTTPException(status_code=403, detail="You do not have access to this NGO resource")


def require_match_action_permission(user: User, match_ngo_id: UUID | None):
    if user.role == "admin":
        return
    if user.role != "ngo":
        raise HTTPException(status_code=403, detail="Only the assigned NGO or admin can perform this action")
    if match_ngo_id is None or user.ngo_id != match_ngo_id:
        raise HTTPException(status_code=403, detail="You cannot perform this action for another NGO")


def require_donor_profile(user: User):
    if user.role != "donor":
        raise HTTPException(status_code=403, detail="Donor access required")
    if not user.donor_id:
        raise HTTPException(status_code=403, detail="This donor account is not linked to a donor profile")


def require_ngo_profile(user: User):
    if user.role != "ngo" or not user.ngo_id:
        raise HTTPException(status_code=403, detail="NGO access required")


def require_operation_ngo_access(user: User, donation: ItemSubmission):
    if not donation.ngo_id:
        raise HTTPException(status_code=409, detail="Donation has not been assigned to an NGO")
    if user.role == "admin":
        return donation.ngo_id
    if user.role == "ngo" and user.ngo_id == donation.ngo_id:
        return donation.ngo_id
    raise HTTPException(status_code=403, detail="Only the assigned NGO or admin can manage operations")


def staff_view(staff: NGOStaff):
    return {
        "id": str(staff.id),
        "ngo_id": str(staff.ngo_id),
        "name": staff.name,
        "phone": staff.phone,
        "email": staff.email,
        "role": staff.role,
        "is_active": staff.is_active,
        "created_at": staff.created_at.isoformat() if staff.created_at else None,
        "updated_at": staff.updated_at.isoformat() if staff.updated_at else None,
    }


def operation_view(operation: OperationAssignment):
    # Acknowledged donations are fully completed from the
    # business/lifecycle perspective, so their NGO operation
    # should also be displayed as completed.
    display_status = (
        "completed"
        if operation.donation and operation.donation.status == "acknowledged"
        else operation.status
    )
    return {
        "id": str(operation.id),
        "donation_id": str(operation.donation_id),
        "ngo_id": str(operation.ngo_id),
        "staff": staff_view(operation.staff),
        "task_type": operation.task_type,
        "scheduled_at": operation.scheduled_at.isoformat() if operation.scheduled_at else None,
        "status": display_status,
        "operation_status": operation.status,
        "donation_status": operation.donation.status if operation.donation else None,
        "notes": operation.notes,
        "created_at": operation.created_at.isoformat() if operation.created_at else None,
        "updated_at": operation.updated_at.isoformat() if operation.updated_at else None,
    }

def validate_staff_for_task(db: Session, staff_id: UUID, ngo_id: UUID, task_type: str, require_active: bool = True):
    staff = db.get(NGOStaff, staff_id)
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")
    if staff.ngo_id != ngo_id:
        raise HTTPException(status_code=403, detail="Staff member belongs to another NGO")
    if require_active and not staff.is_active:
        raise HTTPException(status_code=409, detail="Inactive staff cannot receive new assignments")
    if staff.role != task_type:
        raise HTTPException(status_code=409, detail=f"Staff role {staff.role} cannot perform {task_type} operations")
    return staff


def validate_pickup_operation_schedule(donation: ItemSubmission, scheduled_at: datetime):
    if donation.status != "pickup_scheduled" or not donation.pickup_scheduled_at:
        raise HTTPException(status_code=409, detail="Pickup operations require a scheduled donation pickup")
    if scheduled_at != donation.pickup_scheduled_at:
        raise HTTPException(status_code=409, detail="Pickup assignment time must match the donation pickup time")


def donation_view(donation: ItemSubmission, include_history: bool = False):
    result = {
        "id": str(donation.id),
        "donor_id": str(donation.donor_id) if donation.donor_id else None,
        "ngo_id": str(donation.ngo_id) if donation.ngo_id else None,
        "ngo": {"id": str(donation.ngo.id), "name": donation.ngo.name} if donation.ngo else None,
        "status": donation.status,
        "pickup_scheduled_at": donation.pickup_scheduled_at.isoformat() if donation.pickup_scheduled_at else None,
        "created_at": donation.created_at.isoformat() if donation.created_at else None,
        "items": [{"class_name": line.class_name, "subcategory": line.subcategory, "quantity": line.quantity, "confidence": float(line.detection_confidence) if line.detection_confidence is not None else None, "was_edited_by_donor": line.was_edited_by_donor} for line in donation.lines],
        "matches": [{"id": str(match.id), "ngo_id": str(match.ngo_id), "ngo_name": match.ngo.name if match.ngo else None, "score": float(match.score), "status": match.status} for match in sorted(donation.matches, key=lambda item: item.score, reverse=True)],
    }
    if include_history:
        result["status_history"] = [{"old_status": item.old_status, "new_status": item.new_status, "changed_at": item.changed_at.isoformat() if item.changed_at else None, "changed_by_user_id": str(item.changed_by_user_id) if item.changed_by_user_id else None, "notes": item.notes} for item in sorted(donation.status_history, key=lambda item: item.changed_at or datetime.min)]
    return result


def users_for_donation(db: Session, donation: ItemSubmission):
    users = []
    if donation.donor_id:
        users.extend(db.query(User).filter(User.donor_id == donation.donor_id, User.is_active.is_(True)).all())
    if donation.ngo_id:
        users.extend(db.query(User).filter(User.ngo_id == donation.ngo_id, User.is_active.is_(True)).all())
    return users


def notify_donation_users(db: Session, donation: ItemSubmission, event_type: str, changed_user_id=None):
    users = [user for user in users_for_donation(db, donation) if user.id != changed_user_id]
    notify_users(db, users, event_type, donation_id=donation.id)

@router.post("/auth/register", response_model=UserResponse, tags=["Authentication"])
def register(request: UserRegister, db: Session = Depends(get_db)):
    if request.role == "admin":
        raise HTTPException(status_code=403, detail="Admin accounts cannot be created through the public registration endpoint")
    email = request.email.lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=409, detail="Email is already registered")
    if db.query(Donor).filter(Donor.email == email).first() or db.query(NGO).filter(NGO.contact_email == email).first():
        raise HTTPException(status_code=409, detail="Email is already registered")

    try:
        donor_id = None
        ngo_id = None
        if request.role == "donor":
            donor = Donor(
                name=request.name,
                email=email,
                phone=request.phone,
                city=request.city,
                latitude=request.latitude,
                longitude=request.longitude,
            )
            db.add(donor)
            db.flush()
            donor_id = donor.id
        else:
            ngo = NGO(
                name=request.organization_name,
                contact_email=email,
                contact_phone=request.contact_phone,
                address=request.address,
                city=request.city,
                latitude=request.latitude,
                longitude=request.longitude,
                verified=False,
            )
            db.add(ngo)
            db.flush()
            ngo_id = ngo.id

        user = User(
            email=email,
            password_hash=hash_password(request.password),
            role=request.role,
            donor_id=donor_id,
            ngo_id=ngo_id,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        logger.exception("Registration failed for %s", email)
        raise HTTPException(status_code=500, detail="Registration failed")

@router.post("/auth/login", response_model=TokenResponse, tags=["Authentication"])
def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == request.email.lower()).first()
    if not user or not user.is_active or not verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password", headers={"WWW-Authenticate": "Bearer"})
    return {"access_token": create_access_token(user), "token_type": "bearer", "user": user}

@router.get("/auth/me", response_model=UserResponse, tags=["Authentication"])
def me(user: User = Depends(get_current_user)):
    return user


@router.get("/donors/me", response_model=DonorResponse, tags=["Donor Profile"])
def get_my_donor_profile(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_donor_profile(user)
    donor = db.get(Donor, user.donor_id)
    if not donor:
        raise HTTPException(status_code=404, detail="Donor profile not found")
    return donor


@router.put("/donors/me", response_model=DonorResponse, tags=["Donor Profile"])
def update_my_donor_profile(request: DonorUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_donor_profile(user)
    donor = db.get(Donor, user.donor_id)
    if not donor:
        raise HTTPException(status_code=404, detail="Donor profile not found")
    if donor.email and request.email.lower() != donor.email.lower():
        raise HTTPException(status_code=400, detail="Profile email cannot be changed")

    donor.name = request.name
    donor.phone = request.phone
    donor.city = request.city
    donor.latitude = request.latitude
    donor.longitude = request.longitude
    db.commit()
    db.refresh(donor)
    return donor

@router.post("/ngos", response_model=NGOResponse, tags=["NGOs"])
def create_ngo(request: NGOCreate, db: Session = Depends(get_db), user: User = Depends(require_roles("admin"))):
    if db.query(NGO).filter(NGO.contact_email == request.contact_email).first():
        raise HTTPException(status_code=409, detail="NGO contact email already exists")
    ngo = NGO(**request.model_dump()); db.add(ngo); db.commit(); db.refresh(ngo); return ngo

@router.get("/ngos", response_model=list[NGOResponse], tags=["NGOs"])
def list_ngos(city: str | None = None, verified: bool | None = None, limit: int = 50, offset: int = 0, db: Session = Depends(get_db)):
    limit, offset = validate_pagination(limit, offset)
    query = db.query(NGO)
    if city: query = query.filter(NGO.city == city)
    if verified is not None: query = query.filter(NGO.verified == verified)
    return query.order_by(NGO.created_at.desc()).offset(offset).limit(limit).all()

@router.get("/ngos/{ngo_id}", response_model=NGOResponse, tags=["NGOs"])
def get_ngo(ngo_id: UUID, db: Session = Depends(get_db)):
    ngo = db.get(NGO, ngo_id)
    if not ngo: raise HTTPException(status_code=404, detail="NGO not found")
    return ngo

@router.put("/ngos/{ngo_id}", response_model=NGOResponse, tags=["NGOs"])
def update_ngo(ngo_id: UUID, request: NGOUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ngo = db.get(NGO, ngo_id)
    if not ngo: raise HTTPException(status_code=404, detail="NGO not found")
    require_owner(user, ngo_id=ngo_id)
    for key, value in request.model_dump().items(): setattr(ngo, key, value)
    db.commit(); db.refresh(ngo); return ngo

@router.patch("/ngos/{ngo_id}/verification", response_model=NGOResponse, tags=["NGOs"])
def verify_ngo(ngo_id: UUID, request: VerificationRequest, db: Session = Depends(get_db), user: User = Depends(require_roles("admin"))):
    ngo = db.get(NGO, ngo_id)
    if not ngo: raise HTTPException(status_code=404, detail="NGO not found")
    ngo.verified = request.verified; db.commit(); db.refresh(ngo); return ngo

@router.post("/ngos/{ngo_id}/demands", response_model=DemandResponse, tags=["Demands"])
def create_demand(ngo_id: UUID, request: DemandCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if not db.get(NGO, ngo_id): raise HTTPException(status_code=404, detail="NGO not found")
    require_owner(user, ngo_id=ngo_id)
    demand = DemandRecord(ngo_id=ngo_id, **request.model_dump()); db.add(demand); db.commit(); db.refresh(demand); return demand

@router.get("/ngos/{ngo_id}/demands", response_model=list[DemandResponse], tags=["Demands"])
def list_demands(ngo_id: UUID, active_only: bool = False, class_name: str | None = None, priority: int | None = None, limit: int = 50, offset: int = 0, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ngo = db.get(NGO, ngo_id)
    if not ngo: raise HTTPException(status_code=404, detail="NGO not found")
    limit, offset = validate_pagination(limit, offset)
    require_ngo_or_admin(user, ngo_id)
    query = db.query(DemandRecord).filter(DemandRecord.ngo_id == ngo_id)
    if active_only: query = query.filter(DemandRecord.quantity_needed > 0).filter((DemandRecord.expiry_date.is_(None)) | (DemandRecord.expiry_date >= date.today()))
    if class_name: query = query.filter(DemandRecord.class_name == class_name)
    if priority is not None: query = query.filter(DemandRecord.priority == priority)
    return query.order_by(DemandRecord.priority.desc(), DemandRecord.created_at.desc()).offset(offset).limit(limit).all()

@router.get("/demands/{demand_id}", response_model=DemandResponse, tags=["Demands"])
def get_demand(demand_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    demand = db.get(DemandRecord, demand_id)
    if not demand: raise HTTPException(status_code=404, detail="Demand not found")
    require_owner(user, ngo_id=demand.ngo_id); return demand

@router.put("/demands/{demand_id}", response_model=DemandResponse, tags=["Demands"])
def update_demand(demand_id: UUID, request: DemandCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    demand = db.get(DemandRecord, demand_id)
    if not demand: raise HTTPException(status_code=404, detail="Demand not found")
    require_owner(user, ngo_id=demand.ngo_id)
    for key, value in request.model_dump().items(): setattr(demand, key, value)
    db.commit(); db.refresh(demand); return demand

@router.delete("/demands/{demand_id}", status_code=204, tags=["Demands"])
def delete_demand(demand_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    demand = db.get(DemandRecord, demand_id)
    if not demand: raise HTTPException(status_code=404, detail="Demand not found")
    require_owner(user, ngo_id=demand.ngo_id); db.delete(demand); db.commit()

@router.delete("/ngos/{ngo_id}", status_code=204, tags=["NGOs"])
def deactivate_ngo(ngo_id: UUID, db: Session = Depends(get_db), user: User = Depends(require_roles("admin"))):
    ngo = db.get(NGO, ngo_id)
    if not ngo: raise HTTPException(status_code=404, detail="NGO not found")
    ngo.verified = False
    db.query(User).filter(User.ngo_id == ngo_id).update({User.is_active: False})
    db.commit()


@router.get("/ngos/me/staff", response_model=list[StaffResponse], tags=["NGO Staff"])
def list_my_staff(limit: int = 50, offset: int = 0, active_only: bool = False, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_ngo_profile(user)
    limit, offset = validate_pagination(limit, offset)
    query = db.query(NGOStaff).filter(NGOStaff.ngo_id == user.ngo_id)
    if active_only:
        query = query.filter(NGOStaff.is_active.is_(True))
    return query.order_by(NGOStaff.created_at.desc(), NGOStaff.id.desc()).offset(offset).limit(limit).all()


@router.post("/ngos/me/staff", response_model=StaffResponse, tags=["NGO Staff"])
def create_staff(request: StaffCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_ngo_profile(user)
    if db.query(NGOStaff).filter(NGOStaff.ngo_id == user.ngo_id, NGOStaff.email == request.email.lower()).first():
        raise HTTPException(status_code=409, detail="A staff member with this email already exists in the NGO")
    staff = NGOStaff(ngo_id=user.ngo_id, **request.model_dump())
    staff.email = staff.email.lower()
    db.add(staff)
    db.commit()
    db.refresh(staff)
    return staff


@router.put("/ngos/me/staff/{staff_id}", response_model=StaffResponse, tags=["NGO Staff"])
def update_staff(staff_id: UUID, request: StaffUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_ngo_profile(user)
    staff = db.get(NGOStaff, staff_id)
    if not staff or staff.ngo_id != user.ngo_id:
        raise HTTPException(status_code=404, detail="Staff member not found")
    duplicate = db.query(NGOStaff).filter(NGOStaff.ngo_id == user.ngo_id, NGOStaff.email == request.email.lower(), NGOStaff.id != staff.id).first()
    if duplicate:
        raise HTTPException(status_code=409, detail="A staff member with this email already exists in the NGO")
    for key, value in request.model_dump().items():
        setattr(staff, key, value.lower() if key == "email" else value)
    db.commit()
    db.refresh(staff)
    return staff


@router.delete("/ngos/me/staff/{staff_id}", status_code=204, tags=["NGO Staff"])
def deactivate_staff(staff_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_ngo_profile(user)
    staff = db.get(NGOStaff, staff_id)
    if not staff or staff.ngo_id != user.ngo_id:
        raise HTTPException(status_code=404, detail="Staff member not found")
    staff.is_active = False
    db.commit()


OPERATION_STATUS_TRANSITIONS = {
    "scheduled": {"in_progress", "completed", "cancelled"},
    "in_progress": {"completed", "cancelled"},
    "completed": set(),
    "cancelled": set(),
}


def validate_operation_status(current: str, requested: str):
    if requested not in OPERATION_STATUS_TRANSITIONS.get(current, set()):
        raise HTTPException(status_code=409, detail=f"Operation cannot transition from {current} to {requested}")


def ensure_no_active_operation_for_donation_task(db: Session, donation_id: UUID, task_type: str, exclude_id: UUID | None = None):
    query = db.query(OperationAssignment).filter(
        OperationAssignment.donation_id == donation_id,
        OperationAssignment.task_type == task_type,
        OperationAssignment.status.in_(["scheduled", "in_progress"]),
    )
    if exclude_id:
        query = query.filter(OperationAssignment.id != exclude_id)
    if query.first():
        raise HTTPException(
            status_code=409,
            detail=f"An active {task_type} operation already exists for this donation.",
        )


def notify_operation_event(db: Session, donation: ItemSubmission, task_type: str, status: str, user_id=None):
    event_type = {
        ("packaging", "scheduled"): "PACKAGING_SCHEDULED",
        ("pickup", "scheduled"): "PICKUP_SCHEDULED",
        ("delivery", "scheduled"): "DELIVERY_SCHEDULED",
        ("pickup", "completed"): "PICKUP_COMPLETED",
        ("delivery", "completed"): "DELIVERY_COMPLETED",
    }.get((task_type, status))
    if event_type:
        notify_donation_users(db, donation, event_type, changed_user_id=user_id)


@router.get("/ngos/me/operations", tags=["Operations"])
def list_my_operations(task_type: str | None = None, status: str | None = None, limit: int = 50, offset: int = 0, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_ngo_profile(user)
    limit, offset = validate_pagination(limit, offset)
    query = db.query(OperationAssignment).filter(OperationAssignment.ngo_id == user.ngo_id)
    if task_type:
        if task_type not in {"packaging", "pickup", "delivery"}:
            raise HTTPException(status_code=400, detail="Unsupported task type")
        query = query.filter(OperationAssignment.task_type == task_type)
    if status:
        if status not in OPERATION_STATUS_TRANSITIONS and status not in {"scheduled", "in_progress", "completed", "cancelled"}:
            raise HTTPException(status_code=400, detail="Unsupported operation status")
        query = query.filter(OperationAssignment.status == status)
    operations = query.order_by(OperationAssignment.scheduled_at.asc(), OperationAssignment.id.asc()).offset(offset).limit(limit).all()
    return [operation_view(operation) for operation in operations]


@router.get("/ngos/me/operations/today", tags=["Operations"])
def list_my_operations_today(limit: int = 100, offset: int = 0, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_ngo_profile(user)
    limit, offset = validate_pagination(limit, offset)
    query = db.query(OperationAssignment).filter(OperationAssignment.ngo_id == user.ngo_id, func.date(OperationAssignment.scheduled_at) == date.today())
    operations = query.order_by(OperationAssignment.scheduled_at.asc(), OperationAssignment.id.asc()).offset(offset).limit(limit).all()
    return [operation_view(operation) for operation in operations]


@router.post("/donations/{donation_id}/operations", tags=["Operations"])
def create_operation(donation_id: UUID, request: OperationCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    donation = db.get(ItemSubmission, donation_id)
    if not donation:
        raise HTTPException(status_code=404, detail="Donation not found")
    ngo_id = require_operation_ngo_access(user, donation)
    staff = validate_staff_for_task(db, request.staff_id, ngo_id, request.task_type)
    if request.task_type == "packaging" and donation.status not in {"matched", "packaging_notified"}:
        raise HTTPException(status_code=409, detail="Packaging operations require a matched donation")
    if request.task_type == "pickup":
        validate_pickup_operation_schedule(donation, request.scheduled_at)
    if request.task_type == "delivery" and donation.status not in {"collected", "delivered"}:
        raise HTTPException(status_code=409, detail="Delivery operations require a collected donation")
    ensure_no_active_operation_for_donation_task(db, donation.id, request.task_type)
    overlap = db.query(OperationAssignment).filter(OperationAssignment.staff_id == staff.id, OperationAssignment.scheduled_at == request.scheduled_at, OperationAssignment.status.in_(["scheduled", "in_progress"])).first()
    if overlap:
        raise HTTPException(status_code=409, detail="Staff member already has an active assignment at this time")
    operation_data = request.model_dump()
    operation_data.pop("staff_id", None)
    operation = OperationAssignment(donation_id=donation.id, ngo_id=ngo_id, staff_id=staff.id, **operation_data)
    db.add(operation)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        logger.warning("Active operation conflict while creating assignment for donation %s: %s", donation.id, exc)
        raise HTTPException(status_code=409, detail=f"An active {request.task_type} operation already exists for this donation.")
    db.refresh(operation)
    notify_operation_event(db, donation, operation.task_type, operation.status, user.id)
    return operation_view(operation)


@router.get("/donations/{donation_id}/operations", tags=["Operations"])
def list_donation_operations(donation_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    donation = db.get(ItemSubmission, donation_id)
    if not donation:
        raise HTTPException(status_code=404, detail="Donation not found")
    require_donation_access(user, donation)
    return [operation_view(operation) for operation in sorted(donation.operations, key=lambda item: item.scheduled_at)]


@router.put("/donations/{donation_id}/operations/{assignment_id}", tags=["Operations"])
def update_operation(donation_id: UUID, assignment_id: UUID, request: OperationUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    donation = db.get(ItemSubmission, donation_id)
    if not donation:
        raise HTTPException(status_code=404, detail="Donation not found")
    ngo_id = require_operation_ngo_access(user, donation)
    operation = db.get(OperationAssignment, assignment_id)
    if not operation or operation.donation_id != donation.id or operation.ngo_id != ngo_id:
        raise HTTPException(status_code=404, detail="Operation assignment not found")
    values = request.model_dump(exclude_unset=True)
    task_type = values.get("task_type", operation.task_type)
    staff_id = values.get("staff_id", operation.staff_id)
    staff = validate_staff_for_task(db, staff_id, ngo_id, task_type, require_active="staff_id" in values)
    scheduled_at = values.get("scheduled_at", operation.scheduled_at)
    if task_type == "pickup":
        validate_pickup_operation_schedule(donation, scheduled_at)
    if "status" in values:
        validate_operation_status(operation.status, values["status"])
    requested_status = values.get("status", operation.status)
    if requested_status in {"scheduled", "in_progress"}:
        ensure_no_active_operation_for_donation_task(db, donation.id, task_type, exclude_id=operation.id)
    overlap = db.query(OperationAssignment).filter(OperationAssignment.staff_id == staff.id, OperationAssignment.scheduled_at == scheduled_at, OperationAssignment.status.in_(["scheduled", "in_progress"]), OperationAssignment.id != operation.id).first()
    if overlap:
        raise HTTPException(status_code=409, detail="Staff member already has an active assignment at this time")
    for key, value in values.items():
        setattr(operation, key, value)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        logger.warning("Active operation conflict while updating assignment %s: %s", assignment_id, exc)
        raise HTTPException(status_code=409, detail=f"An active {task_type} operation already exists for this donation.")
    db.refresh(operation)
    notify_operation_event(db, donation, operation.task_type, operation.status, user.id)
    return operation_view(operation)

@router.post("/donations", tags=["Donations"])
def create_donation(request: DonationCreate, db: Session = Depends(get_db), user: User = Depends(require_roles("donor"))):
    if not user.donor_id:
        raise HTTPException(status_code=403, detail="This donor account is not linked to a donor record")
    donation = ItemSubmission(donor_id=user.donor_id, status="submitted"); db.add(donation); db.flush()
    for item in request.items: db.add(ItemSubmissionLine(submission_id=donation.id, class_name=item.class_name, subcategory=item.subcategory, quantity=item.quantity, detection_confidence=item.confidence))
    db.add(StatusHistory(submission_id=donation.id, new_status="submitted", changed_by_user_id=user.id, notes="Donation created")); db.commit(); db.refresh(donation); return donation_view(donation)

@router.get("/donations", tags=["Donations"])
def list_donations(status: str | None = None, limit: int = 50, offset: int = 0, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    limit, offset = validate_pagination(limit, offset)
    query = db.query(ItemSubmission)
    if user.role == "donor": query = query.filter(ItemSubmission.donor_id == user.donor_id)
    if user.role == "ngo": query = query.filter(ItemSubmission.ngo_id == user.ngo_id)
    if status: query = query.filter(ItemSubmission.status == status)
    return [donation_view(item) for item in query.order_by(ItemSubmission.created_at.desc(), ItemSubmission.id.desc()).offset(offset).limit(limit).all()]

@router.get("/donations/{donation_id}", tags=["Donations"])
def get_donation(donation_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    donation = db.get(ItemSubmission, donation_id)
    if not donation: raise HTTPException(status_code=404, detail="Donation not found")
    require_owner(user, ngo_id=donation.ngo_id, donor_id=donation.donor_id); return donation_view(donation, include_history=True)

@router.put("/donations/{donation_id}", tags=["Donations"])
def update_donation(donation_id: UUID, request: DonationCreate, db: Session = Depends(get_db), user: User = Depends(require_roles("donor"))):
    donation = db.get(ItemSubmission, donation_id)
    if not donation: raise HTTPException(status_code=404, detail="Donation not found")
    require_owner(user, donor_id=donation.donor_id)
    if donation.status != "submitted": raise HTTPException(status_code=409, detail="Only submitted donations can be edited")
    donation.lines.clear()
    for item in request.items:
        db.add(ItemSubmissionLine(submission_id=donation.id, class_name=item.class_name, subcategory=item.subcategory, quantity=item.quantity, detection_confidence=item.confidence, was_edited_by_donor=True))
    db.commit(); db.refresh(donation); return donation_view(donation)

@router.post("/donations/{donation_id}/cancel", tags=["Donation Status"])
def cancel_donation(donation_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return change_status(donation_id, StatusUpdate(status="cancelled"), db, user)

@router.patch("/donations/{donation_id}/status", tags=["Donation Status"])
def update_status(donation_id: UUID, request: StatusUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return change_status(donation_id, request, db, user)

def change_status(donation_id: UUID, request: StatusUpdate, db: Session, user: User):
    donation = db.get(ItemSubmission, donation_id)
    if not donation: raise HTTPException(status_code=404, detail="Donation not found")
    if user.role == "donor":
        require_owner(user, donor_id=donation.donor_id)
    else:
        require_owner(user, ngo_id=donation.ngo_id, donor_id=donation.donor_id)
    validate_status_action(user.role, donation.status, request.status)
    validate_transition(donation.status, request.status)
    old_status = donation.status; donation.status = request.status
    db.add(StatusHistory(submission_id=donation.id, old_status=old_status, new_status=request.status, changed_by_user_id=user.id, notes=request.notes)); db.commit(); db.refresh(donation)
    event_type = {
        "packaging_notified": "PACKAGING_REQUIRED",
        "collected": "DONATION_COLLECTED",
        "delivered": "DONATION_DELIVERED",
        "acknowledged": "DONATION_ACKNOWLEDGED",
    }.get(request.status)
    if event_type:
        notify_donation_users(db, donation, event_type, changed_user_id=user.id)
    return donation_view(donation, include_history=True)

@router.get("/donations/{donation_id}/status-history", tags=["Donation Status"])
def status_history(donation_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    donation = db.get(ItemSubmission, donation_id)
    if not donation: raise HTTPException(status_code=404, detail="Donation not found")
    require_owner(user, ngo_id=donation.ngo_id, donor_id=donation.donor_id)
    return {"history": [{"old_status": item.old_status, "new_status": item.new_status, "changed_at": item.changed_at.isoformat() if item.changed_at else None, "notes": item.notes} for item in sorted(donation.status_history, key=lambda item: item.changed_at or datetime.min.replace(tzinfo=timezone.utc))]}


def require_donation_access(user: User, donation: ItemSubmission):
    require_owner(user, ngo_id=donation.ngo_id, donor_id=donation.donor_id)


def pickup_view(donation: ItemSubmission):
    return {
        "donation_id": str(donation.id),
        "status": donation.status,
        "pickup_scheduled_at": donation.pickup_scheduled_at.isoformat() if donation.pickup_scheduled_at else None,
        "ngo": {"id": str(donation.ngo.id), "name": donation.ngo.name} if donation.ngo else None,
    }


@router.post("/donations/{donation_id}/packaging-notify", tags=["Packaging"])
def notify_packaging(donation_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    donation = db.get(ItemSubmission, donation_id)
    if not donation:
        raise HTTPException(status_code=404, detail="Donation not found")
    if user.role == "ngo":
        require_owner(user, ngo_id=donation.ngo_id)
    elif user.role == "admin":
        pass
    else:
        raise HTTPException(status_code=403, detail="Only the assigned NGO or admin can notify packaging")
    result = change_status(donation_id, StatusUpdate(status="packaging_notified"), db, user)
    return result


@router.get("/donations/{donation_id}/packaging-checklist", tags=["Packaging"])
def packaging_checklist(donation_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    donation = db.get(ItemSubmission, donation_id)
    if not donation:
        raise HTTPException(status_code=404, detail="Donation not found")
    require_donation_access(user, donation)
    return {"donation_id": str(donation.id), **get_packaging_checklist(donation.lines)}


def save_pickup_schedule(donation: ItemSubmission, scheduled_at: datetime, db: Session, user: User, reschedule: bool = False):
    if reschedule:
        if donation.status != "pickup_scheduled":
            raise HTTPException(status_code=409, detail="Only scheduled pickups can be rescheduled")
        note = "Pickup rescheduled"
    else:
        validate_transition(donation.status, "pickup_scheduled")
        note = "Pickup scheduled"
    donation.pickup_scheduled_at = scheduled_at
    if not reschedule:
        old_status = donation.status
        donation.status = "pickup_scheduled"
        db.add(StatusHistory(submission_id=donation.id, old_status=old_status, new_status="pickup_scheduled", changed_by_user_id=user.id, notes=note))
    else:
        db.add(StatusHistory(submission_id=donation.id, old_status="pickup_scheduled", new_status="pickup_scheduled", changed_by_user_id=user.id, notes=note))
    db.commit()
    db.refresh(donation)
    notify_donation_users(db, donation, "PICKUP_SCHEDULED", changed_user_id=user.id)
    return pickup_view(donation)


@router.get("/donations/{donation_id}/pickup", tags=["Pickup"])
def get_pickup(donation_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    donation = db.get(ItemSubmission, donation_id)
    if not donation:
        raise HTTPException(status_code=404, detail="Donation not found")
    require_donation_access(user, donation)
    return pickup_view(donation)


@router.post("/donations/{donation_id}/pickup/schedule", tags=["Pickup"])
def schedule_pickup(donation_id: UUID, request: PickupScheduleRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    donation = db.get(ItemSubmission, donation_id)
    if not donation:
        raise HTTPException(status_code=404, detail="Donation not found")
    require_donation_access(user, donation)
    if user.role not in {"donor", "ngo", "admin"}:
        raise HTTPException(status_code=403, detail="Pickup scheduling is not available for this role")
    return save_pickup_schedule(donation, request.scheduled_at, db, user)


@router.put("/donations/{donation_id}/pickup", tags=["Pickup"])
@router.post("/donations/{donation_id}/pickup/reschedule", tags=["Pickup"], deprecated=True)
def reschedule_pickup(donation_id: UUID, request: PickupScheduleRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    donation = db.get(ItemSubmission, donation_id)
    if not donation:
        raise HTTPException(status_code=404, detail="Donation not found")
    require_donation_access(user, donation)
    return save_pickup_schedule(donation, request.scheduled_at, db, user, reschedule=True)


@router.get("/notifications", tags=["Notifications"])
def list_notifications(unread_only: bool = False, limit: int = 50, offset: int = 0, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    limit, offset = validate_pagination(limit, offset)
    query = db.query(Notification).filter(Notification.user_id == user.id)
    if unread_only:
        query = query.filter(Notification.is_read.is_(False))
    notifications = query.order_by(Notification.created_at.desc(), Notification.id.desc()).offset(offset).limit(limit).all()
    return [{"id": str(item.id), "donation_id": str(item.donation_id) if item.donation_id else None, "type": item.type, "title": item.title, "message": item.message, "channel": item.channel, "is_read": item.is_read, "delivery_status": item.delivery_status, "created_at": item.created_at.isoformat() if item.created_at else None, "sent_at": item.sent_at.isoformat() if item.sent_at else None} for item in notifications]


@router.patch("/notifications/{notification_id}/read", tags=["Notifications"])
def mark_notification_read(notification_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    notification = db.query(Notification).filter(Notification.id == notification_id, Notification.user_id == user.id).first()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    notification.is_read = True
    db.commit()
    return {"id": str(notification.id), "is_read": notification.is_read}


@router.patch("/notifications/read-all", tags=["Notifications"])
def mark_all_notifications_read(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    updated = db.query(Notification).filter(Notification.user_id == user.id, Notification.is_read.is_(False)).update({Notification.is_read: True}, synchronize_session=False)
    db.commit()
    return {"updated": updated}


def recent_activity(query, limit: int = 10):
    return [{"donation_id": str(item.submission_id), "old_status": item.old_status, "new_status": item.new_status, "changed_at": item.changed_at.isoformat() if item.changed_at else None, "notes": item.notes} for item in query.order_by(StatusHistory.changed_at.desc(), StatusHistory.id.desc()).limit(limit).all()]


@router.get("/donors/me/dashboard", tags=["Dashboards"])
def donor_dashboard(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_donor_profile(user)
    donor_id = user.donor_id
    donations = db.query(ItemSubmission).filter(ItemSubmission.donor_id == donor_id)
    total_donations = donations.count()
    completed_donations = donations.filter(ItemSubmission.status == "acknowledged").count()
    pickup_due = donations.filter(ItemSubmission.status == "pickup_scheduled").count()
    active_matches = db.query(DonationMatch).join(ItemSubmission).filter(ItemSubmission.donor_id == donor_id, DonationMatch.status.in_(["candidate", "recommended", "accepted"])).count()
    items_donated = db.query(func.coalesce(func.sum(ItemSubmissionLine.quantity), 0)).join(ItemSubmission).filter(ItemSubmission.donor_id == donor_id).scalar()
    activity = recent_activity(db.query(StatusHistory).join(ItemSubmission).filter(ItemSubmission.donor_id == donor_id))
    return {"total_donations": total_donations, "active_matches": active_matches, "pickup_due": pickup_due, "completed_donations": completed_donations, "recent_activity": activity, "impact": {"items_donated": int(items_donated or 0), "completed_donations": completed_donations}}


@router.get("/ngos/me/dashboard", tags=["Dashboards"])
def ngo_dashboard(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_ngo_or_admin(user, user.ngo_id)
    if not user.ngo_id:
        raise HTTPException(status_code=403, detail="This account is not linked to an NGO")
    ngo_id = user.ngo_id
    active_demands_query = db.query(DemandRecord).filter(DemandRecord.ngo_id == ngo_id, DemandRecord.quantity_needed > 0, (DemandRecord.expiry_date.is_(None)) | (DemandRecord.expiry_date >= date.today()))
    matches = db.query(DonationMatch).filter(DonationMatch.ngo_id == ngo_id)
    active_donations = db.query(ItemSubmission).filter(ItemSubmission.ngo_id == ngo_id, ItemSubmission.status.notin_(["delivered", "acknowledged", "cancelled"])).count()
    today = date.today()
    operations = db.query(OperationAssignment).filter(OperationAssignment.ngo_id == ngo_id)
    today_pickups = operations.filter(OperationAssignment.task_type == "pickup", func.date(OperationAssignment.scheduled_at) == today, OperationAssignment.status.in_(["scheduled", "in_progress"])).count()
    pending_packaging = operations.filter(OperationAssignment.task_type == "packaging", OperationAssignment.status.in_(["scheduled", "in_progress"])).count()
    pending_deliveries = operations.filter(OperationAssignment.task_type == "delivery", OperationAssignment.status.in_(["scheduled", "in_progress"])).count()
    unassigned_tasks = db.query(ItemSubmission).filter(ItemSubmission.ngo_id == ngo_id, ItemSubmission.status.in_(["matched", "packaging_notified", "pickup_scheduled", "collected"])).filter(~ItemSubmission.operations.any(OperationAssignment.status.in_(["scheduled", "in_progress"]))).count()
    completed_operations = operations.join(ItemSubmission).filter(
    (OperationAssignment.status == "completed")
    | (ItemSubmission.status == "acknowledged")
).count()
    activity = recent_activity(db.query(StatusHistory).join(ItemSubmission).filter(ItemSubmission.ngo_id == ngo_id))
    return {"active_demands": active_demands_query.count(), "incoming_matches": matches.filter(DonationMatch.status.in_(["candidate", "recommended"])).count(), "accepted_matches": matches.filter(DonationMatch.status == "accepted").count(), "pending_matches": matches.filter(DonationMatch.status.in_(["candidate", "recommended"])).count(), "active_donations": active_donations, "pending_packaging": pending_packaging, "todays_pickups": today_pickups, "pending_deliveries": pending_deliveries, "unassigned_tasks": unassigned_tasks, "completed_operations": completed_operations, "recent_activity": activity, "demand_summary": [{"class_name": demand.class_name, "quantity_needed": demand.quantity_needed} for demand in active_demands_query.order_by(DemandRecord.priority.desc(), DemandRecord.created_at.desc()).all()]}

def haversine(lat1, lon1, lat2, lon2):
    radius = 6371.0; phi1, phi2 = math.radians(float(lat1)), math.radians(float(lat2)); dphi = math.radians(float(lat2 - lat1)); dlambda = math.radians(float(lon2 - lon1)); a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2; return radius * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

@router.post("/donations/{donation_id}/match", tags=["Matching"])
def match_donation(donation_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    donation = db.get(ItemSubmission, donation_id)
    if not donation: raise HTTPException(status_code=404, detail="Donation not found")
    require_owner(user, donor_id=donation.donor_id)
    if donation.status != "submitted":
        raise HTTPException(status_code=409, detail="Only submitted donations are eligible for new matching")
    donor = db.get(Donor, donation.donor_id) if donation.donor_id else None
    candidates = []
    for line in donation.lines:
        demands = db.query(DemandRecord).join(NGO).filter(DemandRecord.class_name == line.class_name, DemandRecord.quantity_needed > 0, (DemandRecord.expiry_date.is_(None)) | (DemandRecord.expiry_date >= date.today()), NGO.verified.is_(True)).all()
        demands = [demand for demand in demands if subcategories_compatible(line.subcategory, demand.subcategory)]
        for demand in demands:
            distance_score = 0.5; distance_text = "Location data unavailable"
            if donor and donor.latitude is not None and donor.longitude is not None and demand.ngo.latitude is not None and demand.ngo.longitude is not None:
                distance = haversine(donor.latitude, donor.longitude, demand.ngo.latitude, demand.ngo.longitude); distance_score = 1 / (1 + distance / 10); distance_text = f"approximately {distance:.1f} km away"
            quantity_score = min(line.quantity / demand.quantity_needed, 1.0) if demand.quantity_needed else 0.0; priority_score = demand.priority / 5; score = .4 + .25 * quantity_score + .2 * distance_score + .15 * priority_score
            match = db.query(DonationMatch).filter_by(submission_id=donation.id, ngo_id=demand.ngo_id).first()
            if not match: match = DonationMatch(submission_id=donation.id, ngo_id=demand.ngo_id); db.add(match)
            match.score, match.item_match_score, match.quantity_score, match.distance_score, match.priority_score = score, 1, quantity_score, distance_score, priority_score; match.status = "recommended"; candidates.append((score, match, line, demand, distance_text))
    db.commit(); candidates.sort(key=lambda item: item[0], reverse=True)
    return {"donation_id": str(donation.id), "matches": [{"id": str(match.id), "ngo_id": str(match.ngo_id), "ngo_name": demand.ngo.name, "score": round(score, 4), "item_match_score": 1, "quantity_score": round(match.quantity_score, 4), "distance_score": round(match.distance_score, 4), "priority_score": round(match.priority_score, 4), "semantic_score": None, "status": match.status, "explanation": [f"Exact item match: {line.class_name}", f"NGO needs {demand.quantity_needed} items and donation provides {line.quantity}", f"NGO priority: {demand.priority}/5", f"NGO is {distance_text}"]} for score, match, line, demand, distance_text in candidates]}

@router.get("/donations/{donation_id}/matches", tags=["Matching"])
def get_matches(donation_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    donation = db.get(ItemSubmission, donation_id)
    if not donation: raise HTTPException(status_code=404, detail="Donation not found")
    require_owner(user, ngo_id=donation.ngo_id, donor_id=donation.donor_id)
    return {"donation_id": str(donation.id), "matches": [{"id": str(match.id), "ngo_id": str(match.ngo_id), "ngo_name": match.ngo.name, "score": float(match.score), "item_match_score": float(match.item_match_score), "quantity_score": float(match.quantity_score), "distance_score": float(match.distance_score), "priority_score": float(match.priority_score), "semantic_score": None, "status": match.status, "explanation": ["Stored rule-based match; semantic similarity was not used"]} for match in sorted(donation.matches, key=lambda item: item.score, reverse=True)]}

@router.post("/matches/{match_id}/accept", tags=["Matching"])
def accept_match(match_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    match = db.get(DonationMatch, match_id)
    if not match: raise HTTPException(status_code=404, detail="Match not found")
    require_match_action_permission(user, match.ngo_id)
    if match.submission.status == "cancelled": raise HTTPException(status_code=409, detail="Cancelled donations cannot accept new matches")
    existing_accepted = db.query(DonationMatch).filter(DonationMatch.submission_id == match.submission_id, DonationMatch.status == "accepted", DonationMatch.id != match.id).first()
    if existing_accepted:
        raise HTTPException(status_code=409, detail="Another NGO has already accepted this donation")
    if match.status not in {"candidate", "recommended"}: raise HTTPException(status_code=409, detail="Match is no longer available")
    for competing in match.submission.matches:
        if competing.id != match.id and competing.status in {"candidate", "recommended"}: competing.status = "rejected"
    match.status = "accepted"; match.submission.ngo_id = match.ngo_id
    if match.submission.status == "submitted":
        match.submission.status = "matched"
        db.add(StatusHistory(submission_id=match.submission.id, old_status="submitted", new_status="matched", changed_by_user_id=user.id, notes="Match accepted"))
    db.commit(); db.refresh(match); db.refresh(match.submission)
    notify_donation_users(db, match.submission, "MATCH_ACCEPTED", changed_user_id=user.id)
    return {"match_id": str(match.id), "status": match.status, "donation": donation_view(match.submission, include_history=True)}

@router.get("/matches/{match_id}", tags=["Matching"])
def get_match(match_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    match = db.get(DonationMatch, match_id)
    if not match: raise HTTPException(status_code=404, detail="Match not found")
    require_owner(user, donor_id=match.submission.donor_id, ngo_id=match.ngo_id)
    return {"id": str(match.id), "ngo_id": str(match.ngo_id), "ngo_name": match.ngo.name, "donation_id": str(match.submission_id), "score": float(match.score), "item_match_score": float(match.item_match_score), "quantity_score": float(match.quantity_score), "distance_score": float(match.distance_score), "priority_score": float(match.priority_score), "semantic_score": None, "status": match.status, "rejection_reason": match.rejection_reason}

@router.post("/matches/{match_id}/reject", tags=["Matching"])
def reject_match(match_id: UUID, reason: str | None = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    match = db.get(DonationMatch, match_id)
    if not match: raise HTTPException(status_code=404, detail="Match not found")
    require_match_action_permission(user, match.ngo_id)
    if match.submission.status == "cancelled": raise HTTPException(status_code=409, detail="Cancelled donations cannot reject matches")
    if match.status in {"accepted", "rejected"}: raise HTTPException(status_code=409, detail="This match is no longer changeable")
    match.status = "rejected"; match.rejection_reason = reason; db.commit()
    notify_donation_users(db, match.submission, "MATCH_REJECTED", changed_user_id=user.id)
    return {"match_id": str(match.id), "status": match.status, "reason": match.rejection_reason}

@router.get("/ngos/{ngo_id}/matches", tags=["Matching"])
def list_ngo_matches(ngo_id: UUID, status: str | None = None, limit: int = 50, offset: int = 0, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ngo = db.get(NGO, ngo_id)
    if not ngo: raise HTTPException(status_code=404, detail="NGO not found")
    limit, offset = validate_pagination(limit, offset)
    require_ngo_or_admin(user, ngo_id)
    query = db.query(DonationMatch).filter(DonationMatch.ngo_id == ngo_id)
    if status: query = query.filter(DonationMatch.status == status)
    matches = query.order_by(DonationMatch.created_at.desc(), DonationMatch.id.desc()).offset(offset).limit(limit).all()
    return [{"id": str(match.id), "donation": donation_view(match.submission), "score": float(match.score), "status": match.status, "created_at": match.created_at.isoformat() if match.created_at else None} for match in matches]

@router.get("/admin/donors", response_model=list[DonorResponse], tags=["Admin"])
def list_admin_donors(limit: int = 50, offset: int = 0, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_admin(user)
    limit, offset = validate_pagination(limit, offset)
    donors = db.query(Donor).order_by(Donor.id).offset(offset).limit(limit).all()
    return donors
