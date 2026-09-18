from copy import deepcopy
from datetime import datetime
from uuid import uuid4

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.domain import DomainError, now_iso, snapshot
from app.models import AuditEvent, Proposal, WorkOrder
from app.schemas import (
    Actor,
    DecisionInput,
    DeliveryInput,
    EditInput,
    LineInput,
    ProposalInput,
    ReasonInput,
    StockInput,
    VersionInput,
)


def authorize(actor: Actor, *roles: str):
    if actor.role not in roles:
        raise DomainError("У выбранной роли нет прав на это действие", 403)


def get_order(db: Session, order_id: str) -> WorkOrder:
    order = db.get(WorkOrder, order_id)
    if order is None:
        raise DomainError("Заказ-наряд не найден", 404)
    return order


def record(db: Session, proposal: Proposal, actor: Actor, action: str, note: str, before=None):
    db.add(
        AuditEvent(
            order_id=proposal.order_id,
            proposal_id=proposal.id,
            actor_id=actor.id,
            actor_name=actor.name,
            role=actor.role,
            action=action,
            note=note,
            created_at=now_iso(),
            before=before,
            after=deepcopy(snapshot(proposal)),
        )
    )


def acquire(db: Session, proposal_id: str, version: int) -> tuple[Proposal, dict]:
    """Compare-and-swap serializes every mutation of the aggregate, including execution."""
    proposal = db.get(Proposal, proposal_id)
    if proposal is None:
        raise DomainError("Предложение не найдено", 404)
    before = deepcopy(snapshot(proposal))
    result = db.execute(
        update(Proposal)
        .where(Proposal.id == proposal_id, Proposal.version == version)
        .values(version=Proposal.version + 1, updated_at=now_iso())
        .execution_options(synchronize_session=False)
    )
    if result.rowcount != 1:
        raise DomainError("Предложение уже изменено другим сотрудником. Обновите страницу.")
    db.refresh(proposal)
    return proposal, before


def new_lines(items: list[LineInput]) -> list[dict]:
    return [dict(item.model_dump(), decision="pending", execution="idle") for item in items]


def ensure_unstarted(proposal: Proposal):
    if any(item["execution"] != "idle" for item in proposal.items):
        raise DomainError(
            "Работы уже начаты или запчасти выданы. Нужны остановка и отдельное урегулирование; "
            "согласованную историю нельзя переписать."
        )


class ProposalService:
    def __init__(self, db: Session, actor: Actor):
        self.db, self.actor = db, actor

    def create(self, order_id: str, data: ProposalInput) -> Proposal:
        authorize(self.actor, "advisor", "mechanic", "manager")
        get_order(self.db, order_id)
        timestamp = now_iso()
        proposal = Proposal(
            id=str(uuid4()),
            order_id=order_id,
            parent_id=None,
            revision=1,
            version=1,
            title=data.title,
            reason=data.reason,
            status="draft",
            released=False,
            items=new_lines(data.items),
            delivery=None,
            decision=None,
            created_at=timestamp,
            updated_at=timestamp,
        )
        self.db.add(proposal)
        self.db.flush()
        record(self.db, proposal, self.actor, "created", "Сформировано дополнительное предложение")
        return proposal

    def edit(self, proposal_id: str, data: EditInput) -> Proposal:
        authorize(self.actor, "advisor", "mechanic", "manager")
        proposal, before = acquire(self.db, proposal_id, data.version)
        if proposal.status != "draft":
            raise DomainError("Изменять позиции можно только в черновике. Создайте новую редакцию.")
        proposal.title, proposal.reason = data.title, data.reason
        proposal.items = new_lines(data.items)
        record(self.db, proposal, self.actor, "edited", "Обновлены позиции черновика", before)
        return proposal

    def submit(self, proposal_id: str, data: DeliveryInput) -> Proposal:
        authorize(self.actor, "advisor", "manager")
        proposal, before = acquire(self.db, proposal_id, data.version)
        if proposal.status != "draft":
            raise DomainError("Передать клиенту можно только черновик")
        proposal.status = "awaiting"
        proposal.delivery = dict(
            data.model_dump(exclude={"version"}), sent_at=now_iso(), actor=self.actor.model_dump()
        )
        record(self.db, proposal, self.actor, "submitted", data.comment, before)
        return proposal

    def decide(self, proposal_id: str, data: DecisionInput) -> Proposal:
        authorize(self.actor, "advisor", "manager")
        proposal, before = acquire(self.db, proposal_id, data.version)
        if proposal.status != "awaiting":
            raise DomainError("Решение можно зафиксировать только для ожидающего предложения")
        if set(data.decisions) != {line["id"] for line in proposal.items}:
            raise DomainError("Нужно указать решение по каждой позиции", 422)
        if data.decided_at < datetime.fromisoformat(proposal.delivery["sent_at"]):
            raise DomainError("Решение не может предшествовать передаче предложения клиенту", 422)
        for line in proposal.items:
            if data.decisions[line["id"]] == "accepted":
                if any(data.decisions[part] != "accepted" for part in line["requires"]):
                    raise DomainError(
                        f"Для работы «{line['title']}» согласуйте все необходимые запчасти", 422
                    )
        proposal.items = [
            dict(line, decision=data.decisions[line["id"]]) for line in proposal.items
        ]
        proposal.status = "decided"
        proposal.decision = dict(
            data.model_dump(mode="json", exclude={"version", "decisions"}),
            recorded_at=now_iso(),
            actor=self.actor.model_dump(),
        )
        record(self.db, proposal, self.actor, "decided", data.comment, before)
        return proposal

    def release(self, proposal_id: str, data: VersionInput) -> Proposal:
        authorize(self.actor, "advisor", "manager")
        proposal, before = acquire(self.db, proposal_id, data.version)
        if proposal.status != "decided" or proposal.released:
            raise DomainError("Предложение должно быть согласовано и ещё не передано в работу")
        if not any(line["decision"] == "accepted" for line in proposal.items):
            raise DomainError("Нет согласованных позиций для выполнения")
        proposal.released = True
        record(self.db, proposal, self.actor, "released", "Согласованные позиции разрешены", before)
        return proposal

    def cancel(self, proposal_id: str, data: ReasonInput) -> Proposal:
        authorize(self.actor, "advisor", "manager")
        proposal, before = acquire(self.db, proposal_id, data.version)
        if proposal.status == "cancelled":
            raise DomainError("Предложение уже отменено")
        if proposal.status == "decided":
            authorize(self.actor, "manager")
        ensure_unstarted(proposal)
        proposal.status, proposal.released = "cancelled", False
        record(self.db, proposal, self.actor, "cancelled", data.comment, before)
        return proposal

    def revise(self, proposal_id: str, data: ReasonInput) -> Proposal:
        authorize(self.actor, "advisor", "manager")
        old, before = acquire(self.db, proposal_id, data.version)
        if old.status not in ("awaiting", "decided"):
            raise DomainError("Новая редакция доступна для переданного или решённого предложения")
        if old.status == "decided":
            authorize(self.actor, "manager")
        ensure_unstarted(old)
        old.status, old.released = "cancelled", False
        record(self.db, old, self.actor, "superseded", data.comment, before)
        line_fields = set(LineInput.model_fields)
        content = ProposalInput(
            title=old.title,
            reason=old.reason,
            items=[{k: v for k, v in item.items() if k in line_fields} for item in old.items],
        )
        # Create the new revision and its audit snapshot in the same transaction.
        timestamp = now_iso()
        proposal = Proposal(
            id=str(uuid4()),
            order_id=old.order_id,
            parent_id=old.id,
            revision=old.revision + 1,
            version=1,
            title=content.title,
            reason=content.reason,
            status="draft",
            released=False,
            items=new_lines(content.items),
            delivery=None,
            decision=None,
            created_at=timestamp,
            updated_at=timestamp,
        )
        self.db.add(proposal)
        self.db.flush()
        record(self.db, proposal, self.actor, "revised", data.comment)
        return proposal

    def stock(self, proposal_id: str, item_id: str, data: StockInput) -> Proposal:
        authorize(self.actor, "advisor", "manager")
        proposal, before = acquire(self.db, proposal_id, data.version)
        if proposal.status == "cancelled":
            raise DomainError("Отменённое предложение нельзя изменять")
        lines = deepcopy(proposal.items)
        item = next((line for line in lines if line["id"] == item_id), None)
        if item is None or item["kind"] != "part":
            raise DomainError("Запчасть не найдена", 404)
        if item["execution"] != "idle":
            raise DomainError("Запчасть уже использована")
        if not data.in_stock and not item["lead_days"]:
            raise DomainError("Для новой задержки поставки требуется новая редакция предложения")
        if item["in_stock"] == data.in_stock:
            raise DomainError("Наличие запчасти не изменилось")
        item["in_stock"] = data.in_stock
        proposal.items = lines
        record(self.db, proposal, self.actor, "stock_updated", data.comment, before)
        return proposal

    def execute(self, proposal_id: str, item_id: str, action: str, data: VersionInput) -> Proposal:
        authorize(self.actor, "mechanic", "manager")
        proposal, before = acquire(self.db, proposal_id, data.version)
        if proposal.status != "decided" or not proposal.released:
            raise DomainError("Сначала получите согласование и разрешение мастера на выполнение")
        lines = deepcopy(proposal.items)
        by_id = {line["id"]: line for line in lines}
        item = by_id.get(item_id)
        if item is None:
            raise DomainError("Позиция не найдена", 404)
        if item["decision"] != "accepted":
            raise DomainError("Клиент не согласовал эту позицию")
        if action == "start":
            if item["kind"] != "work" or item["execution"] != "idle":
                raise DomainError("Начать можно только ещё не начатую работу")
            for part_id in item["requires"]:
                part = by_id[part_id]
                if not part["in_stock"] or part["decision"] != "accepted":
                    raise DomainError(f"Ожидается согласованная запчасть «{part['title']}»")
                part["execution"] = "consumed"
            item["execution"] = "in_progress"
        elif action == "complete":
            if item["kind"] != "work" or item["execution"] != "in_progress":
                raise DomainError("Завершить можно только начатую работу")
            item["execution"] = "completed"
        elif action == "issue":
            if item["kind"] != "part" or item["execution"] != "idle" or not item["in_stock"]:
                raise DomainError("Выдать можно только доступную, ещё не выданную запчасть")
            if any(item_id in line["requires"] for line in lines):
                raise DomainError("Связанная запчасть выдаётся при начале соответствующей работы")
            item["execution"] = "consumed"
        proposal.items = lines
        record(self.db, proposal, self.actor, action, item["title"], before)
        return proposal

    def note(self, proposal_id: str, data: ReasonInput) -> Proposal:
        authorize(self.actor, "advisor", "manager", "mechanic")
        proposal, before = acquire(self.db, proposal_id, data.version)
        record(self.db, proposal, self.actor, "note", data.comment, before)
        return proposal


def list_proposals(db: Session, order_id: str) -> list[Proposal]:
    return list(
        db.scalars(
            select(Proposal).where(Proposal.order_id == order_id).order_by(Proposal.created_at)
        )
    )
