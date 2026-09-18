from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.models import WorkOrder
from app.schemas import ACTORS, DeliveryInput, ProposalInput
from app.services import ProposalService

DEMO_ORDER_ID = "demo-order"


def seed_demo(db: Session):
    if db.get(WorkOrder, DEMO_ORDER_ID):
        return
    due = (datetime.now(UTC) + timedelta(days=1)).replace(
        hour=12, minute=0, second=0, microsecond=0
    )
    db.add(
        WorkOrder(
            id=DEMO_ORDER_ID,
            number="ЗН-1042",
            customer="Александр Ковалёв",
            phone="+7 (900) 000-00-00",
            vehicle="Toyota Camry · 2018",
            plate="А 248 МР · 77",
            mileage=124850,
            baseline_due_at=due.isoformat(),
            baseline_items=[
                {
                    "id": "base-1",
                    "kind": "work",
                    "title": "Плановое ТО и диагностика",
                    "quantity": 1,
                    "unit_price": 950000,
                },
                {
                    "id": "base-2",
                    "kind": "part",
                    "title": "Масло, фильтры и расходные материалы",
                    "quantity": 1,
                    "unit_price": 900000,
                },
            ],
        )
    )
    db.flush()
    service = ProposalService(db, ACTORS["advisor"])
    proposal = service.create(
        DEMO_ORDER_ID,
        ProposalInput(
            title="Тормозная система и приводной ремень",
            reason="При осмотре обнаружен износ передних колодок до 2 мм "
            "и трещины приводного ремня. "
            "Рекомендуем замену до выдачи автомобиля.",
            items=[
                {
                    "id": "brake-work",
                    "kind": "work",
                    "title": "Замена передних тормозных колодок",
                    "unit_price": 280000,
                    "duration_minutes": 60,
                    "requires": ["brake-part"],
                },
                {
                    "id": "brake-part",
                    "kind": "part",
                    "title": "Колодки передние · Akebono",
                    "unit_price": 640000,
                },
                {
                    "id": "belt-work",
                    "kind": "work",
                    "title": "Замена приводного ремня",
                    "unit_price": 180000,
                    "duration_minutes": 40,
                    "requires": ["belt-part"],
                },
                {
                    "id": "belt-part",
                    "kind": "part",
                    "title": "Ремень приводной · Gates",
                    "unit_price": 240000,
                    "in_stock": False,
                    "lead_days": 1,
                },
            ],
        ),
    )
    service.submit(
        proposal.id,
        DeliveryInput(
            version=proposal.version,
            channel="messenger",
            contact="Александр Ковалёв",
            comment="Предложение передано клиенту в мессенджере. Ожидаем решение по позициям.",
        ),
    )
