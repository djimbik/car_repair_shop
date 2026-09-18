from sqlalchemy import JSON, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class WorkOrder(Base):
    __tablename__ = "work_orders"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    number: Mapped[str] = mapped_column(String(40), unique=True)
    customer: Mapped[str] = mapped_column(String(200))
    phone: Mapped[str] = mapped_column(String(40))
    vehicle: Mapped[str] = mapped_column(String(200))
    plate: Mapped[str] = mapped_column(String(40))
    mileage: Mapped[int] = mapped_column(Integer)
    baseline_due_at: Mapped[str] = mapped_column(String(40))
    baseline_items: Mapped[list] = mapped_column(JSON)


class Proposal(Base):
    """One bounded aggregate; JSON preserves the exact commercial line snapshot."""

    __tablename__ = "proposals"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    order_id: Mapped[str] = mapped_column(ForeignKey("work_orders.id"), index=True)
    parent_id: Mapped[str | None] = mapped_column(ForeignKey("proposals.id"), nullable=True)
    revision: Mapped[int] = mapped_column(Integer, default=1)
    version: Mapped[int] = mapped_column(Integer, default=1)
    title: Mapped[str] = mapped_column(String(200))
    reason: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(30), default="draft")
    released: Mapped[bool] = mapped_column(default=False)
    items: Mapped[list] = mapped_column(JSON)
    delivery: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    decision: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[str] = mapped_column(String(40))
    updated_at: Mapped[str] = mapped_column(String(40))


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    order_id: Mapped[str] = mapped_column(ForeignKey("work_orders.id"), index=True)
    proposal_id: Mapped[str] = mapped_column(ForeignKey("proposals.id"), index=True)
    actor_id: Mapped[str] = mapped_column(String(40))
    actor_name: Mapped[str] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(40))
    action: Mapped[str] = mapped_column(String(40))
    note: Mapped[str] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(String(40))
    before: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    after: Mapped[dict] = mapped_column(JSON)
