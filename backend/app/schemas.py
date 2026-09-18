from datetime import UTC, datetime
from typing import Annotated, Literal
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Role = Literal["advisor", "mechanic", "manager", "cashier"]
Channel = Literal["phone", "messenger", "in_person", "email"]
ShortText = Annotated[str, Field(min_length=1, max_length=200)]
Note = Annotated[str, Field(min_length=3, max_length=2000)]


class InputModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Actor(BaseModel):
    id: str
    name: str
    role: Role


ACTORS = {
    "advisor": Actor(id="advisor", name="Роман Михайлов", role="advisor"),
    "mechanic": Actor(id="mechanic", name="Денис Волков", role="mechanic"),
    "manager": Actor(id="manager", name="Анна Соколова", role="manager"),
    "cashier": Actor(id="cashier", name="Мария Орлова", role="cashier"),
}


class LineInput(InputModel):
    id: str = Field(default_factory=lambda: str(uuid4()), min_length=1, max_length=60)
    kind: Literal["work", "part"]
    title: ShortText
    quantity: int = Field(default=1, ge=1, le=1000, strict=True)
    unit_price: int = Field(ge=1, le=100_000_000, strict=True)  # kopecks
    duration_minutes: int = Field(default=0, ge=0, le=4800, strict=True)
    lead_days: int = Field(default=0, ge=0, le=90, strict=True)
    in_stock: bool = True
    requires: list[str] = Field(default_factory=list, max_length=50)

    @model_validator(mode="after")
    def validate_kind(self):
        if self.kind == "work" and (self.lead_days or not self.in_stock):
            raise ValueError("Наличие и срок поставки задаются только для запчастей")
        if self.kind == "part" and (self.duration_minutes or self.requires):
            raise ValueError("Трудоёмкость и зависимости задаются только для работ")
        if self.kind == "work" and self.duration_minutes == 0:
            raise ValueError("Укажите продолжительность работы")
        if self.kind == "part" and not self.in_stock and self.lead_days == 0:
            raise ValueError("Укажите срок поставки отсутствующей запчасти")
        if len(set(self.requires)) != len(self.requires):
            raise ValueError("Зависимости не должны повторяться")
        return self


class ProposalInput(InputModel):
    title: ShortText
    reason: Note
    items: list[LineInput] = Field(min_length=1, max_length=50)

    @model_validator(mode="after")
    def validate_dependencies(self):
        items = {item.id: item for item in self.items}
        if len(items) != len(self.items):
            raise ValueError("Идентификаторы позиций должны быть уникальными")
        used_parts: set[str] = set()
        for item in self.items:
            for dependency in item.requires:
                if dependency not in items or items[dependency].kind != "part":
                    raise ValueError("Работа может зависеть только от запчастей этого предложения")
                if dependency in used_parts:
                    raise ValueError("Для разных работ добавьте отдельные количества запчастей")
                used_parts.add(dependency)
        return self


class VersionInput(InputModel):
    version: int = Field(ge=1, strict=True)


class EditInput(ProposalInput, VersionInput):
    pass


class DeliveryInput(VersionInput):
    channel: Channel
    contact: ShortText
    comment: Note


class DecisionInput(DeliveryInput):
    decided_at: datetime
    decisions: dict[str, Literal["accepted", "declined"]]

    @field_validator("decided_at")
    @classmethod
    def validate_time(cls, value: datetime):
        if value.tzinfo is None:
            raise ValueError("Время решения должно содержать часовой пояс")
        if value > datetime.now(UTC):
            raise ValueError("Время решения не может быть в будущем")
        return value


class ReasonInput(VersionInput):
    comment: Note


class StockInput(VersionInput):
    in_stock: bool
    comment: Note
