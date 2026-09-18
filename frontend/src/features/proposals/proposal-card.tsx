"use client";

import {
  ArrowRight,
  Check,
  CircleCheck,
  Clock3,
  FilePenLine,
  Package,
  Play,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { ActionButton, Pill } from "@/components/ui";
import { channels, dateTime, money, proposalStatus } from "@/lib/format";
import type { Line, Proposal, Role } from "@/lib/types";

export type ProposalAction =
  "decision" | "edit" | "submit" | "release" | "cancel" | "revise" | "note";
export function ProposalCard({
  proposal: p,
  role,
  busy,
  onAction,
  onItemAction,
}: {
  proposal: Proposal;
  role: Role;
  busy: boolean;
  onAction: (action: ProposalAction) => void;
  onItemAction: (item: Line, action: "start" | "complete" | "issue" | "stock") => void;
}) {
  const status = proposalStatus(p);
  const advisor = role === "advisor" || role === "manager";
  const mechanic = role === "mechanic" || role === "manager";
  const unstarted = p.items.every((i) => i.execution === "idle");
  const adjustable = unstarted && (p.status !== "decided" ? advisor : role === "manager");
  return (
    <section className="panel proposal-card">
      <div className="proposal-heading">
        <div className="eyebrow">
          ДОПОЛНИТЕЛЬНОЕ ПРЕДЛОЖЕНИЕ <span>· РЕДАКЦИЯ {p.revision}</span>
        </div>
        <Pill tone={status.tone}>{status.label}</Pill>
      </div>
      <h2>{p.title}</h2>
      <p className="proposal-reason">{p.reason}</p>
      <div className="workflow">
        <div className="done">
          <CircleCheck size={16} />
          Обнаружено
        </div>
        <span />
        <div className={p.status !== "draft" ? "done" : "active"}>
          <FilePenLine size={16} />
          Предложение
        </div>
        <span />
        <div className={p.status === "decided" ? "done" : p.status === "awaiting" ? "active" : ""}>
          <ShieldCheck size={16} />
          Согласование
        </div>
        <span />
        <div className={p.released ? "active" : ""}>
          <Wrench size={16} />
          Выполнение
        </div>
      </div>
      <div className="line-table-wrap">
        <table className="line-table">
          <thead>
            <tr>
              <th>Работы и запчасти</th>
              <th>Кол-во</th>
              <th>Сумма</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {p.items.map((item) => {
              const blocked = item.requires.some(
                (id) => !p.items.find((i) => i.id === id)?.in_stock,
              );
              const canExecute = p.released && item.decision === "accepted" && mechanic;
              return (
                <tr key={item.id} className={item.decision === "declined" ? "declined-row" : ""}>
                  <td>
                    <div className="item-description">
                      <span className={`item-icon ${item.kind}`}>
                        {item.kind === "work" ? <Wrench size={17} /> : <Package size={17} />}
                      </span>
                      <div>
                        <strong>{item.title}</strong>
                        <small>
                          {item.kind === "work"
                            ? `${item.duration_minutes} мин / ед.${item.requires.length ? " · нужны запчасти" : ""}`
                            : item.in_stock
                              ? "На складе"
                              : `Под заказ · ${item.lead_days} дн.`}
                        </small>
                        {item.kind === "part" &&
                          !item.in_stock &&
                          advisor &&
                          p.status !== "cancelled" && (
                            <button
                              className="text-button stock-button"
                              disabled={busy}
                              onClick={() => onItemAction(item, "stock")}
                            >
                              Отметить поступление
                            </button>
                          )}
                        {canExecute &&
                          item.kind === "work" &&
                          item.execution === "idle" &&
                          blocked && <small className="stock-wait">Ожидает запчасть</small>}
                      </div>
                    </div>
                  </td>
                  <td className="quantity">
                    {item.quantity} <small>{item.kind === "work" ? "усл." : "шт."}</small>
                  </td>
                  <td className="line-price">{money(item.unit_price * item.quantity)}</td>
                  <td>
                    <div className="line-state">
                      {item.execution === "completed" || item.execution === "consumed" ? (
                        <span className="decision-status accepted">
                          <Check size={14} />
                          {item.execution === "consumed" ? "Выдано" : "Выполнено"}
                        </span>
                      ) : item.execution === "in_progress" ? (
                        <Pill tone="blue">В работе</Pill>
                      ) : (
                        <span className={`decision-status ${item.decision}`}>
                          {item.decision === "accepted" ? (
                            <>
                              <Check size={14} />
                              Согласовано
                            </>
                          ) : item.decision === "declined" ? (
                            "Отказ"
                          ) : (
                            "Не согласовано"
                          )}
                        </span>
                      )}
                      {canExecute && item.kind === "work" && item.execution === "idle" && (
                        <button
                          disabled={busy || blocked}
                          className="text-button"
                          onClick={() => onItemAction(item, "start")}
                        >
                          <Play size={13} />
                          Начать
                        </button>
                      )}
                      {canExecute && item.execution === "in_progress" && (
                        <button
                          disabled={busy}
                          className="text-button"
                          onClick={() => onItemAction(item, "complete")}
                        >
                          <Check size={13} />
                          Завершить
                        </button>
                      )}
                      {canExecute &&
                        item.kind === "part" &&
                        item.in_stock &&
                        item.execution === "idle" &&
                        !p.items.some((i) => i.requires.includes(item.id)) && (
                          <button
                            disabled={busy}
                            className="text-button"
                            onClick={() => onItemAction(item, "issue")}
                          >
                            Выдать
                          </button>
                        )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="proposal-subtotal">
        <span>
          {p.status === "decided"
            ? `Согласовано ${p.items.filter((i) => i.decision === "accepted").length} из ${p.items.length} позиций`
            : `${p.items.length} позиции · не включены в заказ-наряд`}
        </span>
        <div>
          <span>Сумма предложения</span>
          <strong>{money(p.total)}</strong>
        </div>
      </div>
      {p.decision ? (
        <div className="evidence">
          <ShieldCheck size={19} />
          <div>
            <strong>
              {channels[p.decision.channel]} · {p.decision.contact}
            </strong>
            <p>{p.decision.comment}</p>
            <small>
              {p.decision.actor.name} · {dateTime(p.decision.recorded_at!)} МСК
            </small>
          </div>
        </div>
      ) : (
        p.delivery && (
          <div className="evidence waiting">
            <Clock3 size={19} />
            <div>
              <strong>Предложение передано клиенту</strong>
              <p>
                {channels[p.delivery.channel]} · {dateTime(p.delivery.sent_at!)} МСК. До решения
                клиента работы заблокированы.
              </p>
            </div>
          </div>
        )
      )}
      <div className="proposal-actions">
        <div>
          {role !== "cashier" && (
            <button className="text-button muted" disabled={busy} onClick={() => onAction("note")}>
              Добавить запись
            </button>
          )}
          {adjustable && ["awaiting", "decided"].includes(p.status) && (
            <button
              className="text-button muted"
              disabled={busy}
              onClick={() => onAction("revise")}
            >
              Новая редакция
            </button>
          )}
          {adjustable && p.status !== "cancelled" && (
            <button
              className="text-button muted"
              disabled={busy}
              onClick={() => onAction("cancel")}
            >
              Отменить
            </button>
          )}
        </div>
        <div>
          {p.status === "draft" && role !== "cashier" && (
            <ActionButton secondary disabled={busy} onClick={() => onAction("edit")}>
              Редактировать
            </ActionButton>
          )}
          {p.status === "draft" && advisor && (
            <ActionButton disabled={busy} onClick={() => onAction("submit")}>
              Передано клиенту
              <ArrowRight size={16} />
            </ActionButton>
          )}
          {p.status === "awaiting" && advisor && (
            <ActionButton disabled={busy} onClick={() => onAction("decision")}>
              Зафиксировать решение
              <ArrowRight size={16} />
            </ActionButton>
          )}
          {p.status === "decided" && p.approved_total > 0 && !p.released && advisor && (
            <ActionButton loading={busy} onClick={() => onAction("release")}>
              Передать в работу
              <ArrowRight size={16} />
            </ActionButton>
          )}
        </div>
      </div>
      {role === "cashier" && (
        <p className="read-only-hint">Режим кассира: просмотр согласованных сумм и документов.</p>
      )}
      {role === "mechanic" && !p.released && (
        <p className="read-only-hint">
          Работы станут доступны после решения клиента и разрешения мастера-приёмщика.
        </p>
      )}
    </section>
  );
}
