import type { Channel, Proposal, Role } from "./types";

export const money = (kopecks: number) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: kopecks % 100 ? 2 : 0,
  }).format(kopecks / 100);
export const dateTime = (value: string) =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Moscow",
  }).format(new Date(value));
export const roleNames: Record<Role, string> = {
  advisor: "Мастер-приёмщик",
  mechanic: "Механик",
  manager: "Руководитель",
  cashier: "Кассир",
};
export const channels: Record<Channel, string> = {
  phone: "По телефону",
  messenger: "В мессенджере",
  in_person: "Лично",
  email: "По email",
};
export function proposalStatus(p: Proposal): { label: string; tone: string } {
  if (p.status === "draft") return { label: "Черновик", tone: "neutral" };
  if (p.status === "awaiting") return { label: "Ожидает решения", tone: "amber" };
  if (p.status === "cancelled") return { label: "Отменено", tone: "neutral" };
  if (p.outcome === "rejected") return { label: "Отклонено", tone: "red" };
  if (p.released) {
    const accepted = p.items.filter((i) => i.decision === "accepted");
    if (accepted.every((i) => ["completed", "consumed"].includes(i.execution))) {
      return { label: "Выполнено", tone: "green" };
    }
    return { label: "Передано в работу", tone: "blue" };
  }
  return {
    label: p.outcome === "partial" ? "Согласовано частично" : "Согласовано полностью",
    tone: "green",
  };
}
