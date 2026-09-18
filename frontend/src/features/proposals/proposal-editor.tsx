"use client";

import { useState } from "react";
import { Package, Plus, Trash2, Wrench } from "lucide-react";
import { ActionButton, Field, TextArea, TextInput } from "@/components/ui";
import { money } from "@/lib/format";
import type { LineInput, Proposal } from "@/lib/types";

function emptyLine(kind: "work" | "part"): LineInput {
  return {
    id: crypto.randomUUID(),
    kind,
    title: "",
    quantity: 1,
    unit_price: 0,
    duration_minutes: kind === "work" ? 60 : 0,
    lead_days: 0,
    in_stock: true,
    requires: [],
  };
}

export function ProposalEditor({
  proposal,
  busy,
  onSave,
}: {
  proposal?: Proposal;
  busy: boolean;
  onSave: (data: unknown) => void;
}) {
  const [title, setTitle] = useState(proposal?.title ?? "");
  const [reason, setReason] = useState(proposal?.reason ?? "");
  const [items, setItems] = useState<LineInput[]>(
    () =>
      proposal?.items.map(
        ({
          id,
          kind,
          title,
          quantity,
          unit_price,
          duration_minutes,
          lead_days,
          in_stock,
          requires,
        }) => ({
          id,
          kind,
          title,
          quantity,
          unit_price,
          duration_minutes,
          lead_days,
          in_stock,
          requires,
        }),
      ) ?? [emptyLine("work")],
  );
  const patch = (id: string, update: Partial<LineInput>) =>
    setItems((lines) => lines.map((line) => (line.id === id ? { ...line, ...update } : line)));
  const remove = (id: string) =>
    setItems((lines) =>
      lines
        .filter((i) => i.id !== id)
        .map((i) => ({ ...i, requires: i.requires.filter((p) => p !== id) })),
    );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ title, reason, items, ...(proposal ? { version: proposal.version } : {}) });
      }}
    >
      <Field label="Название предложения">
        <TextInput
          required
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Например, ремонт тормозной системы"
        />
      </Field>
      <Field label="Обнаруженная неисправность">
        <TextArea
          required
          minLength={3}
          maxLength={2000}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Что обнаружено, почему нужна работа, какие есть риски"
        />
      </Field>
      <div className="editor-lines">
        {items.map((item, index) => (
          <div className="editor-line" key={item.id}>
            <div className="editor-line-heading">
              <span>
                {item.kind === "work" ? <Wrench size={15} /> : <Package size={15} />}
                {item.kind === "work" ? "Работа" : "Запчасть"} {index + 1}
              </span>
              <button
                type="button"
                aria-label={`Удалить позицию ${index + 1}`}
                className="icon-button"
                disabled={items.length === 1}
                onClick={() => remove(item.id)}
              >
                <Trash2 size={16} />
              </button>
            </div>
            <Field label={`Наименование позиции ${index + 1}`}>
              <TextInput
                required
                maxLength={200}
                value={item.title}
                onChange={(e) => patch(item.id, { title: e.target.value })}
              />
            </Field>
            <div className="form-grid three">
              <Field label={`Количество ${index + 1}`}>
                <TextInput
                  type="number"
                  required
                  min={1}
                  max={1000}
                  step={1}
                  value={item.quantity || ""}
                  onChange={(e) => patch(item.id, { quantity: Number(e.target.value) })}
                />
              </Field>
              <Field label={`Цена за единицу, ₽ ${index + 1}`}>
                <TextInput
                  type="number"
                  required
                  min={0.01}
                  max={1000000}
                  step={0.01}
                  value={item.unit_price ? item.unit_price / 100 : ""}
                  onChange={(e) =>
                    patch(item.id, { unit_price: Math.round(Number(e.target.value) * 100) })
                  }
                />
              </Field>
              {item.kind === "work" ? (
                <Field label={`Минут на единицу ${index + 1}`}>
                  <TextInput
                    type="number"
                    required
                    min={1}
                    max={4800}
                    value={item.duration_minutes || ""}
                    onChange={(e) => patch(item.id, { duration_minutes: Number(e.target.value) })}
                  />
                </Field>
              ) : (
                <Field label={`Срок поставки, дней ${index + 1}`}>
                  <TextInput
                    type="number"
                    required
                    min={item.in_stock ? 0 : 1}
                    max={90}
                    value={item.lead_days}
                    onChange={(e) => patch(item.id, { lead_days: Number(e.target.value) })}
                  />
                </Field>
              )}
            </div>
            {item.kind === "part" ? (
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={item.in_stock}
                  onChange={(e) =>
                    patch(item.id, {
                      in_stock: e.target.checked,
                      lead_days: e.target.checked ? item.lead_days : Math.max(1, item.lead_days),
                    })
                  }
                />
                Есть на складе
              </label>
            ) : (
              items.some((i) => i.kind === "part") && (
                <div className="dependencies">
                  <span className="helper">Для выполнения нужны:</span>
                  {items
                    .filter((i) => i.kind === "part")
                    .map((part) => (
                      <label className="check-label" key={part.id}>
                        <input
                          type="checkbox"
                          checked={item.requires.includes(part.id)}
                          onChange={(e) =>
                            patch(item.id, {
                              requires: e.target.checked
                                ? [...item.requires, part.id]
                                : item.requires.filter((id) => id !== part.id),
                            })
                          }
                        />
                        {part.title || "Запчасть без названия"}
                      </label>
                    ))}
                </div>
              )
            )}
          </div>
        ))}
      </div>
      <div className="editor-add">
        <ActionButton
          secondary
          type="button"
          disabled={items.length >= 50}
          onClick={() => setItems([...items, emptyLine("work")])}
        >
          <Plus size={16} />
          Работа
        </ActionButton>
        <ActionButton
          secondary
          type="button"
          disabled={items.length >= 50}
          onClick={() => setItems([...items, emptyLine("part")])}
        >
          <Plus size={16} />
          Запчасть
        </ActionButton>
      </div>
      <div className="modal-footer">
        <span className="editor-total">
          Итого:{" "}
          <strong>{money(items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0))}</strong>
        </span>
        <ActionButton type="submit" loading={busy}>
          Сохранить черновик
        </ActionButton>
      </div>
    </form>
  );
}
