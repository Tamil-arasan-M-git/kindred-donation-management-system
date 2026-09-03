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

import os
import uuid

from sqlalchemy import (
    create_engine, Column, String, Integer, Boolean, DateTime, ForeignKey,
    Numeric, SmallInteger, Date, CheckConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from sqlalchemy.sql import func

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/donation_platform"
)

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


class ItemSubmission(Base):
    __tablename__ = "item_submissions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    donor_id = Column(UUID(as_uuid=True), ForeignKey("donors.id", ondelete="SET NULL"))
    ngo_id = Column(UUID(as_uuid=True), ForeignKey("ngos.id", ondelete="SET NULL"))
    status = Column(String(30), nullable=False, default="submitted")
    pickup_scheduled_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())

    lines = relationship("ItemSubmissionLine", back_populates="submission", cascade="all, delete-orphan")


class ItemSubmissionLine(Base):
    __tablename__ = "item_submission_lines"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    submission_id = Column(UUID(as_uuid=True), ForeignKey("item_submissions.id", ondelete="CASCADE"), nullable=False)
    class_name = Column(String(50), nullable=False)
    quantity = Column(Integer, nullable=False)
    detection_confidence = Column(Numeric(4, 3))
    was_edited_by_donor = Column(Boolean, nullable=False, default=False)

    __table_args__ = (CheckConstraint("quantity >= 0", name="quantity_non_negative"),)
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

    __table_args__ = (CheckConstraint("quantity_needed >= 0", name="quantity_needed_non_negative"),)


def get_db():
    """FastAPI dependency: yields a session, closes it after the request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
