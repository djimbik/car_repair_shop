from datetime import UTC, datetime, timedelta

from app.models import Proposal, WorkOrder


class DomainError(Exception):
    def __init__(self, message: str, status_code: int = 409):
        self.message = message
        self.status_code = status_code


def now_iso() -> str:
    return datetime.now(UTC).isoformat()


def line_total(item: dict) -> int:
    return item["quantity"] * item["unit_price"]


def snapshot(proposal: Proposal) -> dict:
    fields = (
        "id",
        "order_id",
        "parent_id",
        "revision",
        "version",
        "title",
        "reason",
        "status",
        "released",
        "items",
        "delivery",
        "decision",
        "created_at",
        "updated_at",
    )
    return {field: getattr(proposal, field) for field in fields}


def proposal_view(proposal: Proposal) -> dict:
    data = snapshot(proposal)
    accepted = [line for line in proposal.items if line["decision"] == "accepted"]
    data["total"] = sum(map(line_total, proposal.items))
    data["approved_total"] = sum(map(line_total, accepted)) if proposal.status == "decided" else 0
    if proposal.status == "decided":
        data["outcome"] = (
            "full"
            if len(accepted) == len(proposal.items)
            else "partial"
            if accepted
            else "rejected"
        )
    else:
        data["outcome"] = None
    return data


def totals(order: WorkOrder, proposals: list[Proposal]) -> dict:
    accepted = [
        line
        for proposal in proposals
        if proposal.status == "decided"
        for line in proposal.items
        if line["decision"] == "accepted"
    ]
    pending = [
        line
        for proposal in proposals
        if proposal.status in ("draft", "awaiting")
        for line in proposal.items
    ]
    baseline = sum(map(line_total, order.baseline_items))
    extra = sum(map(line_total, accepted))
    minutes = sum(line["duration_minutes"] * line["quantity"] for line in accepted)
    supply_days = max((line["lead_days"] for line in accepted if not line["in_stock"]), default=0)
    # Demo schedule: sequential work, calendar supply days, no workshop resource calendar.
    due = datetime.fromisoformat(order.baseline_due_at) + timedelta(
        minutes=minutes, days=supply_days
    )
    return {
        "baseline": baseline,
        "approved_extra": extra,
        "confirmed": baseline + extra,
        "pending_extra": sum(map(line_total, pending)),
        "due_at": due.isoformat(),
        "extra_minutes": minutes,
        "supply_days": supply_days,
    }
