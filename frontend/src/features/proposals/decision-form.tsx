"use client";

import { useState } from "react";
import { Check, Phone, X } from "lucide-react";
import { ActionButton, Field, TextArea, TextInput } from "@/components/ui";
import { channels, money } from "@/lib/format";
import type { Channel, Decision, Proposal } from "@/lib/types";

function localDateTime(now: Date) {
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 19);
}

export function DecisionForm({
  proposal,
  customer,
  busy,
  onSave,
}: {
  proposal: Proposal;
  customer: string;
  busy: boolean;
  onSave: (data: unknown) => void;
}) {
  const [decisions, setDecisions] = useState<Record<string, Decision>>(
    Object.fromEntries(proposal.items.map((i) => [i.id, "pending"])),
  );
  const [channel, setChannel] = useState<Channel>("phone");
  const [contact, setContact] = useState(customer);
  const [comment, setComment] = useState("");
  const [openedAt] = useState(() => new Date());
  const [decidedAt, setDecidedAt] = useState(() => localDateTime(openedAt));
  const [timeEdited, setTimeEdited] = useState(false);
  const accepted = proposal.items.filter((i) => decisions[i.id] === "accepted");
  const total = accepted.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
  const complete = Object.values(decisions).every((d) => d !== "pending");
  function choose(id: string, value: Decision) {
    const next = { ...decisions, [id]: value };
    const item = proposal.items.find((i) => i.id === id)!;
    if (value === "accepted")
      item.requires.forEach((part) => {
        next[part] = "accepted";
      });
    if (value !== "accepted")
      proposal.items
        .filter((i) => i.requires.includes(id))
        .forEach((i) => {
          next[i.id] = value === "declined" ? "declined" : "pending";
        });
    setDecisions(next);
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          version: proposal.version,
          decisions,
          channel,
          contact,
          comment,
          // Preserve milliseconds for the default "now": rounding may predate a just-sent proposal.
          decided_at: timeEdited ? new Date(decidedAt).toISOString() : openedAt.toISOString(),
        });
      }}
    >
      <div className="inline-notice">
        <Phone size={18} />
        Фиксируйте уже полученное решение клиента. Это действие изменит согласованную стоимость.
      </div>
      <div className="selection-toolbar">
        <span>Решение по каждой позиции</span>
        <div>
          <button
            type="button"
            className="text-button"
            onClick={() =>
              setDecisions(Object.fromEntries(proposal.items.map((i) => [i.id, "accepted"])))
            }
          >
            <Check size={14} />
            Согласовать всё
          </button>
          <button
            type="button"
            className="text-button muted"
            onClick={() =>
              setDecisions(Object.fromEntries(proposal.items.map((i) => [i.id, "declined"])))
            }
          >
            <X size={14} />
            Отклонить всё
          </button>
        </div>
      </div>
      <div className="decision-lines">
        {proposal.items.map((item) => (
          <div className={`decision-line ${decisions[item.id]}`} key={item.id}>
            <div>
              <strong>{item.title}</strong>
              <small>
                {item.kind === "work" ? "Работа" : "Запчасть"} ·{" "}
                {money(item.unit_price * item.quantity)}
              </small>
            </div>
            <select
              aria-label={`Решение: ${item.title}`}
              value={decisions[item.id]}
              onChange={(e) => choose(item.id, e.target.value as Decision)}
            >
              <option value="pending">Выберите решение</option>
              <option value="accepted">Согласовано</option>
              <option value="declined">Отказ</option>
            </select>
          </div>
        ))}
      </div>
      <p className="helper">
        При выборе работы автоматически выбираются необходимые запчасти. Отказ от запчасти снимает
        согласование зависимой работы.
      </p>
      <div className="decision-total">
        <span>
          Согласовано {accepted.length} из {proposal.items.length} позиций
        </span>
        <strong>+ {money(total)}</strong>
      </div>
      <div className="form-grid">
        <Field label="Способ согласования">
          <select value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
            {Object.entries(channels).map(([id, title]) => (
              <option key={id} value={id}>
                {title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Дата и время решения">
          <TextInput
            type="datetime-local"
            step="1"
            value={decidedAt}
            onChange={(e) => {
              setDecidedAt(e.target.value);
              setTimeEdited(true);
            }}
            required
          />
        </Field>
      </div>
      <Field label="Кто подтвердил решение">
        <TextInput
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          required
          maxLength={200}
        />
      </Field>
      <Field
        label="Комментарий к решению"
        hint="Укажите содержание разговора или ссылку на переписку. Для отказа — причину, если клиент её сообщил."
      >
        <TextArea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Клиент согласовал замену колодок. От замены ремня отказался…"
          required
          minLength={3}
          maxLength={2000}
        />
      </Field>
      <div className="modal-footer">
        <span className="helper">Решение и сотрудник сохранятся в истории</span>
        <ActionButton type="submit" disabled={!complete} loading={busy}>
          Зафиксировать решение
        </ActionButton>
      </div>
    </form>
  );
}
