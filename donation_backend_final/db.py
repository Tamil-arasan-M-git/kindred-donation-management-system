"""
db.py

SQLAlchemy connection + models matching schema.sql. Kept separate from
main.py so the API file doesn't get cluttered with database setup.

Setup:
    1. Create the actual PostgreSQL database first (schema.sql handles
       tables; you still need to create the database itself):
           createdb donation_platform
       or in psql:
           CREATE DATABASE donation_platform;
    2. Run the schema:
           psql -U your_user -d donation_platform -f schema.sql
    3. Set DATABASE_URL as an environment variable, e.g.:
           postgresql://your_user:your_password@localhost:5432/donation_platform
       (Windows PowerShell: $env:DATABASE_URL = "postgresql://...")
"""

import uuid

from sqlalchemy import (
    create_engine, Column, String, Integer, Boolean, DateTime, ForeignKey,
    Numeric, SmallInteger, Date, CheckConstraint, UniqueConstraint, Index, text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from sqlalchemy.sql import func

from config import DATABASE_URL

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


class NGO(Base):
    __tablename__ = "ngos"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    contact_email = Column(String(255), nullable=False, unique=True)
    contact_phone = Column(String(50))
    address = Column(String)
    city = Column(String(100))
    latitude = Column(Numeric)
    longitude = Column(Numeric)
    verified = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    demands = relationship("DemandRecord", back_populates="ngo")
    staff_members = relationship("NGOStaff", back_populates="ngo", cascade="all, delete-orphan")
    operations = relationship("OperationAssignment", back_populates="ngo", cascade="all, delete-orphan")


class Donor(Base):
    __tablename__ = "donors"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255))
    email = Column(String(255), unique=True)
    phone = Column(String(50))
    city = Column(String(100))
    latitude = Column(Numeric)
    longitude = Column(Numeric)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    submissions = relationship("ItemSubmission", back_populates="donor")


class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    ngo_id = Column(UUID(as_uuid=True), ForeignKey("ngos.id", ondelete="SET NULL"))
    donor_id = Column(UUID(as_uuid=True), ForeignKey("donors.id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    __table_args__ = (CheckConstraint("role IN ('donor', 'ngo', 'admin')", name="user_role_valid"),)
    ngo = relationship("NGO")
    donor = relationship("Donor")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")


class ItemSubmission(Base):
    __tablename__ = "item_submissions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    donor_id = Column(UUID(as_uuid=True), ForeignKey("donors.id", ondelete="SET NULL"))
    ngo_id = Column(UUID(as_uuid=True), ForeignKey("ngos.id", ondelete="SET NULL"))
    status = Column(String(30), nullable=False, default="submitted")
    pickup_scheduled_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (CheckConstraint("status IN ('submitted', 'matched', 'packaging_notified', 'pickup_scheduled', 'collected', 'delivered', 'acknowledged', 'cancelled')", name="submission_status_valid"),)

    lines = relationship("ItemSubmissionLine", back_populates="submission", cascade="all, delete-orphan")
    donor = relationship("Donor", back_populates="submissions")
    ngo = relationship("NGO")
    status_history = relationship("StatusHistory", back_populates="submission", cascade="all, delete-orphan")
    matches = relationship("DonationMatch", back_populates="submission", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="donation", cascade="all, delete-orphan")
    operations = relationship("OperationAssignment", back_populates="donation", cascade="all, delete-orphan")


class ItemSubmissionLine(Base):
    __tablename__ = "item_submission_lines"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    submission_id = Column(UUID(as_uuid=True), ForeignKey("item_submissions.id", ondelete="CASCADE"), nullable=False)
    class_name = Column(String(50), nullable=False)
    quantity = Column(Integer, nullable=False)
    detection_confidence = Column(Numeric(4, 3))
    was_edited_by_donor = Column(Boolean, nullable=False, default=False)

    __table_args__ = (
        CheckConstraint("quantity >= 1", name="quantity_positive"),
        CheckConstraint("detection_confidence IS NULL OR (detection_confidence >= 0 AND detection_confidence <= 1)", name="confidence_range_valid"),
        CheckConstraint("class_name IN ('clothing', 'food', 'books', 'electronics', 'furniture', 'utensils')", name="submission_category_valid"),
    )
    submission = relationship("ItemSubmission", back_populates="lines")


class DemandRecord(Base):
    __tablename__ = "demand_records"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ngo_id = Column(UUID(as_uuid=True), ForeignKey("ngos.id", ondelete="CASCADE"), nullable=False)
    class_name = Column(String(50), nullable=False)
    quantity_needed = Column(Integer, nullable=False)
    priority = Column(SmallInteger, nullable=False, default=1)
    expiry_date = Column(Date)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        CheckConstraint("quantity_needed >= 1", name="quantity_needed_positive"),
        CheckConstraint("priority BETWEEN 1 AND 5", name="demand_priority_valid"),
        CheckConstraint("class_name IN ('clothing', 'food', 'books', 'electronics', 'furniture', 'utensils')", name="demand_category_valid"),
    )
    ngo = relationship("NGO", back_populates="demands")


class StatusHistory(Base):
    __tablename__ = "status_history"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    submission_id = Column(UUID(as_uuid=True), ForeignKey("item_submissions.id", ondelete="CASCADE"), nullable=False)
    old_status = Column(String(30))
    new_status = Column(String(30), nullable=False)
    changed_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    changed_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    notes = Column(String(1000))

    __table_args__ = (CheckConstraint("new_status IN ('submitted', 'matched', 'packaging_notified', 'pickup_scheduled', 'collected', 'delivered', 'acknowledged', 'cancelled')", name="status_history_status_valid"),)
    submission = relationship("ItemSubmission", back_populates="status_history")


class Notification(Base):
    __tablename__ = "notifications"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    donation_id = Column(UUID(as_uuid=True), ForeignKey("item_submissions.id", ondelete="CASCADE"))
    type = Column(String(50), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(String(2000), nullable=False)
    channel = Column(String(20), nullable=False, default="in_app")
    is_read = Column(Boolean, nullable=False, default=False)
    delivery_status = Column(String(20), nullable=False, default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    sent_at = Column(DateTime(timezone=True))
    user = relationship("User", back_populates="notifications")
    donation = relationship("ItemSubmission", back_populates="notifications")


class NGOStaff(Base):
    __tablename__ = "ngo_staff"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ngo_id = Column(UUID(as_uuid=True), ForeignKey("ngos.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=False)
    email = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    __table_args__ = (
        CheckConstraint("role IN ('packaging', 'pickup', 'delivery')", name="staff_role_valid"),
        UniqueConstraint("ngo_id", "email", name="unique_ngo_staff_email"),
    )
    ngo = relationship("NGO", back_populates="staff_members")
    operations = relationship("OperationAssignment", back_populates="staff")


class OperationAssignment(Base):
    __tablename__ = "operation_assignments"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    donation_id = Column(UUID(as_uuid=True), ForeignKey("item_submissions.id", ondelete="CASCADE"), nullable=False)
    ngo_id = Column(UUID(as_uuid=True), ForeignKey("ngos.id", ondelete="CASCADE"), nullable=False)
    staff_id = Column(UUID(as_uuid=True), ForeignKey("ngo_staff.id", ondelete="RESTRICT"), nullable=False)
    task_type = Column(String(20), nullable=False)
    scheduled_at = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(20), nullable=False, default="scheduled")
    notes = Column(String(2000))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    __table_args__ = (
        CheckConstraint("task_type IN ('packaging', 'pickup', 'delivery')", name="operation_task_type_valid"),
        CheckConstraint("status IN ('scheduled', 'in_progress', 'completed', 'cancelled')", name="operation_status_valid"),
        Index(
            "uq_active_operation_per_donation_task",
            "donation_id",
            "task_type",
            unique=True,
            postgresql_where=text("status IN ('scheduled', 'in_progress')"),
        ),
    )
    donation = relationship("ItemSubmission", back_populates="operations")
    ngo = relationship("NGO", back_populates="operations")
    staff = relationship("NGOStaff", back_populates="operations")


class DonationMatch(Base):
    __tablename__ = "donation_matches"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    submission_id = Column(UUID(as_uuid=True), ForeignKey("item_submissions.id", ondelete="CASCADE"), nullable=False)
    ngo_id = Column(UUID(as_uuid=True), ForeignKey("ngos.id", ondelete="CASCADE"), nullable=False)
    score = Column(Numeric(5, 4), nullable=False)
    item_match_score = Column(Numeric(5, 4), nullable=False)
    quantity_score = Column(Numeric(5, 4), nullable=False)
    distance_score = Column(Numeric(5, 4), nullable=False)
    priority_score = Column(Numeric(5, 4), nullable=False)
    semantic_score = Column(Numeric(5, 4))
    status = Column(String(20), nullable=False, default="candidate")
    rejection_reason = Column(String(1000))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    __table_args__ = (UniqueConstraint("submission_id", "ngo_id", name="unique_submission_ngo_match"), CheckConstraint("status IN ('candidate', 'recommended', 'accepted', 'rejected', 'expired')", name="match_status_valid"))
    submission = relationship("ItemSubmission", back_populates="matches")
    ngo = relationship("NGO")


def get_db():
    """FastAPI dependency: yields a session, closes it after the request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
