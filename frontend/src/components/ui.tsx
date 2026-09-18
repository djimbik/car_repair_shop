"use client";

import { Button, Dialog, Portal, Input, Textarea } from "@chakra-ui/react";
import { X } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

export function ActionButton({
  secondary,
  danger,
  ...props
}: ComponentProps<typeof Button> & {
  secondary?: boolean;
  danger?: boolean;
}) {
  return (
    <Button
      className={`action ${secondary ? "secondary" : "primary"} ${danger ? "danger" : ""}`}
      {...props}
    />
  );
}
export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: string }) {
  return (
    <span className={`pill ${tone}`}>
      <span className="pill-dot" />
      {children}
    </span>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function TextInput(props: ComponentProps<typeof Input>) {
  return <Input className="text-input" {...props} />;
}
export function TextArea(props: ComponentProps<typeof Textarea>) {
  return <Textarea className="text-input textarea" {...props} />;
}
export function Modal({
  title,
  description,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <Dialog.Root
      open
      onOpenChange={(e) => {
        if (!e.open) onClose();
      }}
      placement="center"
      size={wide ? "xl" : "lg"}
    >
      <Portal>
        <Dialog.Backdrop className="modal-backdrop" />
        <Dialog.Positioner>
          <Dialog.Content className="modal-content">
            <Dialog.Header className="modal-header">
              <div>
                <Dialog.Title>{title}</Dialog.Title>
                {description && <Dialog.Description>{description}</Dialog.Description>}
              </div>
              <button className="icon-button" aria-label="Закрыть окно" onClick={onClose}>
                <X size={20} />
              </button>
            </Dialog.Header>
            <Dialog.Body className="modal-body">{children}</Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
