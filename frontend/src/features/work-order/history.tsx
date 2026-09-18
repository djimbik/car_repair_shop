import { ArrowUpRight, Clock3 } from "lucide-react";
import { dateTime, money, roleNames } from "@/lib/format";
import type { AuditEvent, Proposal } from "@/lib/types";

const actions: Record<string, string> = {
  created: "Предложение создано",
  edited: "Черновик изменён",
  submitted: "Передано клиенту",
  decided: "Зафиксировано решение клиента",
  released: "Разрешено выполнение",
  cancelled: "Предложение отменено",
  superseded: "Редакция отозвана",
  revised: "Создана новая редакция",
  stock_updated: "Обновлено наличие запчасти",
  start: "Работа начата",
  complete: "Работа завершена",
  issue: "Запчасть выдана",
  note: "Добавлен комментарий",
};
function approved(p: Proposal | null) {
  return p?.status === "decided"
    ? p.items
        .filter((i) => i.decision === "accepted")
        .reduce((s, i) => s + i.quantity * i.unit_price, 0)
    : 0;
}
export function History({ events }: { events: AuditEvent[] }) {
  return (
    <section className="panel history-panel">
      <div className="section-heading">
        <div>
          <h2>История изменений</h2>
          <p>Кто, когда и почему изменил заказ-наряд</p>
        </div>
        <span className="count-badge">{events.length}</span>
      </div>
      <div className="timeline">
        {events.map((event) => {
          const delta = approved(event.after) - approved(event.before);
          return (
            <article className="timeline-item" key={event.id}>
              <div className="timeline-dot">
                <Clock3 size={15} />
              </div>
              <div className="timeline-content">
                <div className="timeline-heading">
                  <strong>{actions[event.action] ?? event.action}</strong>
                  <time>{dateTime(event.created_at)} МСК</time>
                </div>
                <p>{event.note}</p>
                <span className="timeline-actor">
                  {event.actor_name} · {roleNames[event.role]} · ред. {event.after.revision}
                </span>
                {delta !== 0 && (
                  <div className="money-change">
                    <ArrowUpRight size={14} />
                    Изменение согласованной суммы: {delta > 0 ? "+" : ""}
                    {money(delta)}
                  </div>
                )}
                <details className="audit-details">
                  <summary>Что изменилось</summary>
                  <div className="audit-snapshots">
                    <div>
                      <span>До изменения</span>
                      <pre>
                        {JSON.stringify(event.before, null, 2) ?? "Предложение ещё не создано"}
                      </pre>
                    </div>
                    <div>
                      <span>После изменения</span>
                      <pre>{JSON.stringify(event.after, null, 2)}</pre>
                    </div>
                  </div>
                </details>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
