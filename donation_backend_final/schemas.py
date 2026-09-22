from datetime import date, datetime, timezone
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

from taxonomy import normalize_item

CATEGORIES = {"clothing", "food", "books", "electronics", "furniture", "utensils"}
STATUSES = {"submitted", "matched", "packaging_notified", "pickup_scheduled", "collected", "delivered", "acknowledged", "cancelled"}

class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    role: Literal["donor", "ngo", "admin"]
    name: str | None = Field(default=None, min_length=1, max_length=255)
    phone: str | None = Field(default=None, min_length=1, max_length=50)
    organization_name: str | None = Field(default=None, min_length=1, max_length=255)
    contact_phone: str | None = Field(default=None, min_length=1, max_length=50)
    address: str | None = Field(default=None, min_length=1)
    city: str | None = Field(default=None, min_length=1, max_length=100)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)

    @model_validator(mode="after")
    def validate_role_profile(self):
        if self.role == "admin":
            return self
        required_fields = (
            ("name", "phone", "city")
            if self.role == "donor"
            else ("organization_name", "contact_phone", "address", "city")
        )
        missing = [field for field in required_fields if getattr(self, field) is None]
        if missing:
            raise ValueError(
                f"Missing required {self.role} registration fields: {', '.join(missing)}"
            )
        return self

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    email: EmailStr
    role: str
    is_active: bool
    donor_id: UUID | None = None
    ngo_id: UUID | None = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class NGOCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    contact_email: EmailStr
    contact_phone: str | None = None
    address: str | None = None
    city: str | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)

class NGOUpdate(NGOCreate):
    pass

class NGOResponse(NGOCreate):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    verified: bool
    created_at: datetime | None = None

class DonorResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    city: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    created_at: datetime | None = None

class DonorUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    phone: str | None = None
    city: str | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)

class VerificationRequest(BaseModel):
    verified: bool

class DemandCreate(BaseModel):
    class_name: str
    subcategory: str | None = None
    quantity_needed: int = Field(gt=0)
    priority: int = Field(ge=1, le=5)
    expiry_date: date | None = None
    @model_validator(mode="after")
    def validate_category(self):
        normalized = normalize_item(self.class_name, self.subcategory)
        self.class_name = normalized["category"]
        self.subcategory = normalized["subcategory"]
        return self

class DemandResponse(DemandCreate):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    ngo_id: UUID
    created_at: datetime | None = None

class DonationItemRequest(BaseModel):
    class_name: str
    subcategory: str | None = None
    quantity: int = Field(gt=0)
    confidence: float | None = Field(default=None, ge=0, le=1)
    @model_validator(mode="after")
    def validate_category(self):
        normalized = normalize_item(self.class_name, self.subcategory)
        self.class_name = normalized["category"]
        self.subcategory = normalized["subcategory"]
        return self

class DonationCreate(BaseModel):
    items: list[DonationItemRequest] = Field(min_length=1)

class StatusUpdate(BaseModel):
    status: str
    notes: str | None = None
    @model_validator(mode="after")
    def validate_status(self):
        if self.status not in STATUSES:
            raise ValueError("Unsupported donation status")
        return self

class PickupScheduleRequest(BaseModel):
    scheduled_at: datetime

    @model_validator(mode="after")
    def validate_schedule(self):
        if self.scheduled_at.tzinfo is None or self.scheduled_at.utcoffset() is None:
            raise ValueError("scheduled_at must include a timezone")
        if self.scheduled_at <= datetime.now(timezone.utc):
            raise ValueError("Pickup time must be in the future")
        return self

class StaffCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    phone: str = Field(min_length=1, max_length=50)
    email: EmailStr
    role: Literal["packaging", "pickup", "delivery"]

class StaffUpdate(StaffCreate):
    is_active: bool = True

class StaffResponse(StaffCreate):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    ngo_id: UUID
    is_active: bool
    created_at: datetime | None = None
    updated_at: datetime | None = None

class OperationCreate(BaseModel):
    staff_id: UUID
    task_type: Literal["packaging", "pickup", "delivery"]
    scheduled_at: datetime
    notes: str | None = None

    @model_validator(mode="after")
    def validate_schedule(self):
        if self.scheduled_at.tzinfo is None or self.scheduled_at.utcoffset() is None:
            self.scheduled_at = self.scheduled_at.replace(tzinfo=timezone.utc)
        if self.scheduled_at <= datetime.now(timezone.utc):
            raise ValueError("scheduled_at must be in the future")
        return self

class OperationUpdate(BaseModel):
    staff_id: UUID | None = None
    task_type: Literal["packaging", "pickup", "delivery"] | None = None
    scheduled_at: datetime | None = None
    status: Literal["scheduled", "in_progress", "completed", "cancelled"] | None = None
    notes: str | None = None

    @model_validator(mode="after")
    def validate_schedule(self):
        if self.scheduled_at is not None:
            if self.scheduled_at.tzinfo is None or self.scheduled_at.utcoffset() is None:
                self.scheduled_at = self.scheduled_at.replace(tzinfo=timezone.utc)
            if self.scheduled_at <= datetime.now(timezone.utc):
                raise ValueError("scheduled_at must be in the future")
        return self
