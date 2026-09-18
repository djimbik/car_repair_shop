from collections.abc import Generator
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Header, Request
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.domain import DomainError, proposal_view, totals
from app.models import AuditEvent
from app.schemas import (
    ACTORS,
    Actor,
    DecisionInput,
    DeliveryInput,
    EditInput,
    ProposalInput,
    ReasonInput,
    StockInput,
    VersionInput,
)
from app.services import ProposalService, get_order, list_proposals

router = APIRouter(prefix="/api")


def session(request: Request) -> Generator[Session, None, None]:
    with request.app.state.sessions() as db:
        with db.begin():
            yield db


def actor(x_demo_actor: Annotated[str, Header()] = "advisor") -> Actor:
    if x_demo_actor not in ACTORS:
        raise DomainError("Неизвестный участник демо", 400)
    return ACTORS[x_demo_actor]


Db = Annotated[Session, Depends(session)]
User = Annotated[Actor, Depends(actor)]


def service(db: Db, user: User) -> ProposalService:
    return ProposalService(db, user)


Service = Annotated[ProposalService, Depends(service)]


@router.get("/health")
def health(db: Db):
    db.execute(text("SELECT 1"))
    return {"status": "ok"}


@router.get("/actors")
def actors():
    return list(ACTORS.values())


@router.get("/orders/{order_id}")
def order_detail(order_id: str, db: Db):
    order = get_order(db, order_id)
    proposals = list_proposals(db, order_id)
    return {
        **{
            key: getattr(order, key)
            for key in (
                "id",
                "number",
                "customer",
                "phone",
                "vehicle",
                "plate",
                "mileage",
                "baseline_due_at",
                "baseline_items",
            )
        },
        "proposals": [proposal_view(proposal) for proposal in proposals],
        "totals": totals(order, proposals),
    }


@router.get("/orders/{order_id}/history")
def history(order_id: str, db: Db):
    get_order(db, order_id)
    events = db.scalars(
        select(AuditEvent).where(AuditEvent.order_id == order_id).order_by(AuditEvent.id.desc())
    )
    return [
        {column.name: getattr(event, column.name) for column in AuditEvent.__table__.columns}
        for event in events
    ]


@router.get("/orders/{order_id}/document")
def document(order_id: str, db: Db):
    order = get_order(db, order_id)
    proposals = list_proposals(db, order_id)
    return {
        "number": order.number,
        "customer": order.customer,
        "vehicle": order.vehicle,
        "baseline_items": order.baseline_items,
        "approved_items": [
            dict(line, proposal_id=p.id, revision=p.revision, evidence=p.decision)
            for p in proposals
            if p.status == "decided"
            for line in p.items
            if line["decision"] == "accepted"
        ],
        "totals": totals(order, proposals),
        "notice": "Сводка согласованного заказ-наряда. Не является актом выполненных работ.",
    }


@router.post("/orders/{order_id}/proposals", status_code=201)
def create(order_id: str, data: ProposalInput, svc: Service):
    return proposal_view(svc.create(order_id, data))


@router.put("/proposals/{proposal_id}")
def edit(proposal_id: str, data: EditInput, svc: Service):
    return proposal_view(svc.edit(proposal_id, data))


@router.post("/proposals/{proposal_id}/submit")
def submit(proposal_id: str, data: DeliveryInput, svc: Service):
    return proposal_view(svc.submit(proposal_id, data))


@router.post("/proposals/{proposal_id}/decision")
def decide(proposal_id: str, data: DecisionInput, svc: Service):
    return proposal_view(svc.decide(proposal_id, data))


@router.post("/proposals/{proposal_id}/release")
def release(proposal_id: str, data: VersionInput, svc: Service):
    return proposal_view(svc.release(proposal_id, data))


@router.post("/proposals/{proposal_id}/cancel")
def cancel(proposal_id: str, data: ReasonInput, svc: Service):
    return proposal_view(svc.cancel(proposal_id, data))


@router.post("/proposals/{proposal_id}/revise", status_code=201)
def revise(proposal_id: str, data: ReasonInput, svc: Service):
    return proposal_view(svc.revise(proposal_id, data))


@router.post("/proposals/{proposal_id}/note")
def note(proposal_id: str, data: ReasonInput, svc: Service):
    return proposal_view(svc.note(proposal_id, data))


@router.post("/proposals/{proposal_id}/items/{item_id}/stock")
def stock(proposal_id: str, item_id: str, data: StockInput, svc: Service):
    return proposal_view(svc.stock(proposal_id, item_id, data))


@router.post("/proposals/{proposal_id}/items/{item_id}/{action}")
def execute(
    proposal_id: str,
    item_id: str,
    action: Literal["start", "complete", "issue"],
    data: VersionInput,
    svc: Service,
):
    return proposal_view(svc.execute(proposal_id, item_id, action, data))
