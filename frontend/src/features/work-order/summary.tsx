"use client";
import { CarFront, FileText, Clock3, ShieldCheck, ArrowRight } from "lucide-react";
import { Pill } from "@/components/ui";
import { dateTime, money } from "@/lib/format";
import type { WorkOrder } from "@/lib/types";
import type { Tab } from "./types";
export function VehicleSummary({ order }: { order: WorkOrder }) {
  return (
    <section className="vehicle-card panel no-print">
      <div className="vehicle-icon">
        <CarFront size={37} strokeWidth={1.5} />
      </div>
      <div className="vehicle-main">
        <div>
          <h2>{order.vehicle}</h2>
          <Pill tone="blue">В ремонте</Pill>
        </div>
        <p>
          <span className="license-plate">{order.plate}</span>
          <span>{order.mileage.toLocaleString("ru-RU")} км</span>
        </p>
      </div>
      <div className="vehicle-customer">
        <span>Клиент</span>
        <strong>{order.customer}</strong>
        <a href={`tel:${order.phone.replace(/[^+\d]/g, "")}`}>{order.phone}</a>
      </div>
      <div className="vehicle-advisor">
        <span>Мастер-приёмщик</span>
        <strong>Роман Михайлов</strong>
        <small>Пост № 3 · текущий ремонт</small>
      </div>
    </section>
  );
}
export function FinancialSummary({
  order,
  setTab,
}: {
  order: WorkOrder;
  setTab: (value: Tab) => void;
}) {
  return (
    <aside className="summary-column no-print">
      <section className="panel cost-panel">
        <div className="summary-title">
          <h2>Стоимость ремонта</h2>
          <span className="summary-icon">₽</span>
        </div>
        <div className="cost-row">
          <span>Первоначально</span>
          <strong>{money(order.totals.baseline)}</strong>
        </div>
        <div className="cost-row">
          <span>
            <span className="legend-dot green" />
            Согласованные допработы
          </span>
          <strong className="green-text">+ {money(order.totals.approved_extra)}</strong>
        </div>
        <div className="confirmed-total">
          <span>Согласовано с клиентом</span>
          <strong data-testid="confirmed-total">{money(order.totals.confirmed)}</strong>
          <small>Только подтверждённые позиции</small>
        </div>
        <div className="pending-cost">
          <div>
            <span>
              <span className="legend-dot amber" />
              На согласовании / в черновиках
            </span>
            <strong>+ {money(order.totals.pending_extra)}</strong>
          </div>
          <p>Будет добавлено только после решения клиента.</p>
        </div>
        <button className="summary-link" onClick={() => setTab("document")}>
          <FileText size={16} />
          Посмотреть заказ-наряд
          <ArrowRight size={15} />
        </button>
      </section>
      <section className="panel schedule-panel">
        <div className="summary-title">
          <h2>Срок ремонта</h2>
          <Clock3 size={19} />
        </div>
        <div className="schedule-line">
          <span>Первоначальный</span>
          <strong>{dateTime(order.baseline_due_at)} МСК</strong>
        </div>
        <div className="schedule-line current">
          <span>С учётом согласования</span>
          <strong>{dateTime(order.totals.due_at)} МСК</strong>
        </div>
        <div className="schedule-caption">
          {order.totals.extra_minutes
            ? `+ ${order.totals.extra_minutes} мин работ${order.totals.supply_days ? ` · поставка ${order.totals.supply_days} дн.` : ""}`
            : "Дополнительные работы пока не согласованы"}
        </div>
        <p className="helper">Расчётная оценка без учёта загрузки постов и рабочего календаря.</p>
      </section>
      <div className="principle-card">
        <div className="principle-icon">
          <ShieldCheck size={24} />
        </div>
        <h3>
          Каждое решение —<br />
          часть истории
        </h3>
        <p>Суммы, редакции и подтверждения клиента всегда можно проверить.</p>
        <button onClick={() => setTab("history")}>
          Открыть историю
          <ArrowRight size={15} />
        </button>
      </div>
    </aside>
  );
}
