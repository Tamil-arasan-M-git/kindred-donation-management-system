from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

CATEGORIES = {"clothing", "food", "books", "electronics", "furniture", "utensils"}
STATUSES = {"submitted", "matched", "packaging_notified", "pickup_scheduled", "collected", "delivered", "acknowledged", "cancelled"}

class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    role: Literal["donor", "ngo", "admin"]

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    email: EmailStr
    role: str
    is_active: bool

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

class VerificationRequest(BaseModel):
    verified: bool

class DemandCreate(BaseModel):
    class_name: str
    quantity_needed: int = Field(ge=0)
    priority: int = Field(ge=1, le=5)
    expiry_date: date | None = None
    @model_validator(mode="after")
    def validate_category(self):
        if self.class_name not in CATEGORIES:
            raise ValueError("Unsupported item category")
        return self

class DemandResponse(DemandCreate):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    ngo_id: UUID
    created_at: datetime | None = None

class DonationItemRequest(BaseModel):
    class_name: str
    quantity: int = Field(ge=0)
    confidence: float | None = Field(default=None, ge=0, le=1)
    @model_validator(mode="after")
    def validate_category(self):
        if self.class_name not in CATEGORIES:
            raise ValueError("Unsupported item category")
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