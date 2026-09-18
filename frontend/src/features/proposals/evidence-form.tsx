"use client";

import { useState } from "react";
import { ActionButton, Field, TextArea, TextInput } from "@/components/ui";
import { channels } from "@/lib/format";
import type { Channel } from "@/lib/types";

export function EvidenceForm({
  delivery = false,
  customer,
  busy,
  submitLabel,
  onSave,
}: {
  delivery?: boolean;
  customer: string;
  busy: boolean;
  submitLabel: string;
  onSave: (data: { comment: string; channel?: Channel; contact?: string }) => void;
}) {
  const [channel, setChannel] = useState<Channel>("messenger");
  const [contact, setContact] = useState(customer);
  const [comment, setComment] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ comment, ...(delivery ? { channel, contact } : {}) });
      }}
    >
      {delivery && (
        <>
          <div className="inline-notice">
            Передайте предложение клиенту выбранным способом, затем зафиксируйте этот факт. Демо не
            отправляет сообщения автоматически.
          </div>
          <div className="form-grid">
            <Field label="Способ передачи">
              <select value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
                {Object.entries(channels).map(([id, title]) => (
                  <option key={id} value={id}>
                    {title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Получатель">
              <TextInput
                required
                maxLength={200}
                value={contact}
                onChange={(e) => setContact(e.target.value)}
              />
            </Field>
          </div>
        </>
      )}
      <Field label={delivery ? "Комментарий к передаче" : "Причина / комментарий"}>
        <TextArea
          required
          minLength={3}
          maxLength={2000}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Опишите обстоятельства — запись останется в истории"
        />
      </Field>
      <div className="modal-footer">
        <ActionButton type="submit" loading={busy}>
          {submitLabel}
        </ActionButton>
      </div>
    </form>
  );
}
