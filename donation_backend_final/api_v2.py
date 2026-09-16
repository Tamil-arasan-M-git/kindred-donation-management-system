import logging
import math
from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from db import DemandRecord, DonationMatch, Donor, ItemSubmission, ItemSubmissionLine, NGO, StatusHistory, User, get_db
from schemas import DemandCreate, DemandResponse, DonationCreate, DonorResponse, NGOCreate, NGOResponse, NGOUpdate, LoginRequest, StatusUpdate, TokenResponse, UserRegister, UserResponse, VerificationRequest, CATEGORIES
from security import create_access_token, get_current_user, hash_password, require_roles, verify_password

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["Milestone 2"])
TRANSITIONS = {"submitted": {"matched", "cancelled"}, "matched": {"packaging_notified", "cancelled"}, "packaging_notified": {"pickup_scheduled", "cancelled"}, "pickup_scheduled": {"collected", "cancelled"}, "collected": {"delivered"}, "delivered": {"acknowledged"}, "acknowledged": set(), "cancelled": set()}


def validate_pagination(limit: int, offset: int, max_limit: int = 100):
    if limit <= 0:
        raise HTTPException(status_code=400, detail="limit must be greater than 0")
    if offset < 0:
        raise HTTPException(status_code=400, detail="offset must be greater than or equal to 0")
    if limit > max_limit:
        raise HTTPException(status_code=400, detail=f"limit cannot exceed {max_limit}")
    return limit, offset

def require_owner(user: User, ngo_id: UUID | None = None, donor_id: UUID | None = None):
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


def donation_view(donation: ItemSubmission):
    return {"id": str(donation.id), "donor_id": str(donation.donor_id) if donation.donor_id else None, "ngo_id": str(donation.ngo_id) if donation.ngo_id else None, "status": donation.status, "created_at": donation.created_at.isoformat() if donation.created_at else None, "items": [{"class_name": line.class_name, "quantity": line.quantity, "confidence": float(line.detection_confidence) if line.detection_confidence is not None else None, "was_edited_by_donor": line.was_edited_by_donor} for line in donation.lines]}

@router.post("/auth/register", response_model=UserResponse, tags=["Authentication"])
def register(request: UserRegister, db: Session = Depends(get_db)):
    if request.role == "admin":
        raise HTTPException(status_code=403, detail="Admin accounts cannot be created through the public registration endpoint")
    if db.query(User).filter(User.email == request.email.lower()).first():
        raise HTTPException(status_code=409, detail="Email is already registered")
    donor_id = None
    ngo_id = None
    if request.role == "donor":
        donor = Donor(email=request.email.lower())
        db.add(donor); db.flush(); donor_id = donor.id
    elif request.role == "ngo":
        ngo = NGO(name=request.email.split("@")[0], contact_email=request.email.lower())
        db.add(ngo); db.flush(); ngo_id = ngo.id
    user = User(email=request.email.lower(), password_hash=hash_password(request.password), role=request.role, donor_id=donor_id, ngo_id=ngo_id)
    db.add(user); db.commit(); db.refresh(user)
    return user

@router.post("/auth/login", response_model=TokenResponse, tags=["Authentication"])
def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == request.email.lower()).first()
    if not user or not user.is_active or not verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password", headers={"WWW-Authenticate": "Bearer"})
    return {"access_token": create_access_token(user), "token_type": "bearer", "user": user}

@router.get("/auth/me", response_model=UserResponse, tags=["Authentication"])
def me(user: User = Depends(get_current_user)):
    return user

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

@router.post("/donations", tags=["Donations"])
def create_donation(request: DonationCreate, db: Session = Depends(get_db), user: User = Depends(require_roles("donor"))):
    if not user.donor_id:
        raise HTTPException(status_code=403, detail="This donor account is not linked to a donor record")
    donation = ItemSubmission(donor_id=user.donor_id, status="submitted"); db.add(donation); db.flush()
    for item in request.items: db.add(ItemSubmissionLine(submission_id=donation.id, class_name=item.class_name, quantity=item.quantity, detection_confidence=item.confidence))
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
    require_owner(user, ngo_id=donation.ngo_id, donor_id=donation.donor_id); return donation_view(donation)

@router.put("/donations/{donation_id}", tags=["Donations"])
def update_donation(donation_id: UUID, request: DonationCreate, db: Session = Depends(get_db), user: User = Depends(require_roles("donor"))):
    donation = db.get(ItemSubmission, donation_id)
    if not donation: raise HTTPException(status_code=404, detail="Donation not found")
    require_owner(user, donor_id=donation.donor_id)
    if donation.status != "submitted": raise HTTPException(status_code=409, detail="Only submitted donations can be edited")
    donation.lines.clear()
    for item in request.items:
        db.add(ItemSubmissionLine(submission_id=donation.id, class_name=item.class_name, quantity=item.quantity, detection_confidence=item.confidence, was_edited_by_donor=True))
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
    require_owner(user, ngo_id=donation.ngo_id, donor_id=donation.donor_id)
    if request.status not in TRANSITIONS.get(donation.status, set()): raise HTTPException(status_code=409, detail=f"Donation cannot transition from {donation.status} to {request.status}")
    old_status = donation.status; donation.status = request.status
    db.add(StatusHistory(submission_id=donation.id, old_status=old_status, new_status=request.status, changed_by_user_id=user.id, notes=request.notes)); db.commit(); db.refresh(donation); return donation_view(donation)

@router.get("/donations/{donation_id}/status-history", tags=["Donation Status"])
def status_history(donation_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    donation = db.get(ItemSubmission, donation_id)
    if not donation: raise HTTPException(status_code=404, detail="Donation not found")
    require_owner(user, ngo_id=donation.ngo_id, donor_id=donation.donor_id)
    return {"history": [{"old_status": item.old_status, "new_status": item.new_status, "changed_at": item.changed_at.isoformat() if item.changed_at else None, "notes": item.notes} for item in sorted(donation.status_history, key=lambda item: item.changed_at or date.min)]}

def haversine(lat1, lon1, lat2, lon2):
    radius = 6371.0; phi1, phi2 = math.radians(float(lat1)), math.radians(float(lat2)); dphi = math.radians(float(lat2 - lat1)); dlambda = math.radians(float(lon2 - lon1)); a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2; return radius * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

@router.post("/donations/{donation_id}/match", tags=["Matching"])
def match_donation(donation_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    donation = db.get(ItemSubmission, donation_id)
    if not donation: raise HTTPException(status_code=404, detail="Donation not found")
    require_owner(user, donor_id=donation.donor_id)
    if donation.status in {"cancelled", "matched", "acknowledged"}:
        raise HTTPException(status_code=409, detail="This donation is no longer eligible for new matching")
    donor = db.get(Donor, donation.donor_id) if donation.donor_id else None
    candidates = []
    for line in donation.lines:
        demands = db.query(DemandRecord).join(NGO).filter(DemandRecord.class_name == line.class_name, DemandRecord.quantity_needed > 0, (DemandRecord.expiry_date.is_(None)) | (DemandRecord.expiry_date >= date.today()), NGO.verified.is_(True)).all()
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
    db.commit(); db.refresh(match); db.refresh(match.submission); return {"match_id": str(match.id), "status": match.status, "donation": donation_view(match.submission)}

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