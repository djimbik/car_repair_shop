"use client";

import { Download, Printer, ShieldCheck } from "lucide-react";
import { ActionButton } from "@/components/ui";
import { channels, dateTime, money } from "@/lib/format";
import type { OrderDocument } from "@/lib/types";

export function DocumentView({ document: doc }: { document: OrderDocument }) {
  function download() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(doc, null, 2)], { type: "application/json;charset=utf-8" }),
    );
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = `serviceflow-${doc.number}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="panel document-panel">
      <div className="section-heading">
        <div>
          <div className="eyebrow">СОГЛАСОВАННЫЙ ОБЪЁМ РЕМОНТА</div>
          <h2>Заказ-наряд {doc.number}</h2>
          <p>
            {doc.customer} · {doc.vehicle}
          </p>
        </div>
        <div className="document-buttons no-print">
          <ActionButton secondary onClick={download}>
            <Download size={15} />
            JSON
          </ActionButton>
          <ActionButton secondary onClick={() => window.print()}>
            <Printer size={15} />
            Печать
          </ActionButton>
        </div>
      </div>
      <div className="inline-notice">
        <ShieldCheck size={18} />В документ включены исходные и только согласованные дополнительные
        позиции.
      </div>
      <h3>Первоначально согласовано</h3>
      <div className="document-lines">
        {doc.baseline_items.map((i) => (
          <div key={i.id}>
            <span>
              {i.title} <small>× {i.quantity}</small>
            </span>
            <strong>{money(i.unit_price * i.quantity)}</strong>
          </div>
        ))}
      </div>
      <h3>Дополнительные работы и запчасти</h3>
      {doc.approved_items.length ? (
        <div className="document-lines">
          {doc.approved_items.map((i) => (
            <div key={`${i.proposal_id}-${i.id}`}>
              <span>
                {i.title} <small>× {i.quantity}</small>
                <small className="document-proof">
                  {channels[i.evidence.channel]} · {i.evidence.contact} ·{" "}
                  {dateTime(i.evidence.decided_at!)} МСК · {i.evidence.actor.name} · ред.{" "}
                  {i.revision}
                </small>
              </span>
              <strong>{money(i.unit_price * i.quantity)}</strong>
            </div>
          ))}
        </div>
      ) : (
        <p className="empty-inline">Дополнительные позиции пока не согласованы.</p>
      )}
      <div className="document-total">
        <span>Итого согласовано</span>
        <strong>{money(doc.totals.confirmed)}</strong>
      </div>
      <p className="document-due">Расчётный срок: {dateTime(doc.totals.due_at)} МСК</p>
      <p className="helper">{doc.notice}</p>
    </section>
  );
}
