export type Role = "advisor" | "mechanic" | "manager" | "cashier";
export type Channel = "phone" | "messenger" | "in_person" | "email";
export type Decision = "pending" | "accepted" | "declined";
export interface Actor {
  id: Role;
  name: string;
  role: Role;
}

export interface LineInput {
  id: string;
  kind: "work" | "part";
  title: string;
  quantity: number;
  unit_price: number;
  duration_minutes: number;
  lead_days: number;
  in_stock: boolean;
  requires: string[];
}
export interface Line extends LineInput {
  decision: Decision;
  execution: "idle" | "in_progress" | "completed" | "consumed";
}
export interface Evidence {
  channel: Channel;
  contact: string;
  comment: string;
  actor: Actor;
  decided_at?: string;
  sent_at?: string;
  recorded_at?: string;
}
export interface Proposal {
  id: string;
  order_id: string;
  parent_id: string | null;
  title: string;
  reason: string;
  revision: number;
  version: number;
  status: "draft" | "awaiting" | "decided" | "cancelled";
  outcome: "full" | "partial" | "rejected" | null;
  released: boolean;
  items: Line[];
  delivery: Evidence | null;
  decision: Evidence | null;
  total: number;
  approved_total: number;
  created_at: string;
  updated_at: string;
}
export interface Totals {
  baseline: number;
  approved_extra: number;
  confirmed: number;
  pending_extra: number;
  due_at: string;
  extra_minutes: number;
  supply_days: number;
}
export interface BasicLine {
  id: string;
  kind: string;
  title: string;
  quantity: number;
  unit_price: number;
}
export interface WorkOrder {
  id: string;
  number: string;
  customer: string;
  phone: string;
  vehicle: string;
  plate: string;
  mileage: number;
  baseline_due_at: string;
  baseline_items: BasicLine[];
  proposals: Proposal[];
  totals: Totals;
}
export interface AuditEvent {
  id: number;
  proposal_id: string;
  actor_name: string;
  role: Role;
  action: string;
  note: string;
  created_at: string;
  before: Proposal | null;
  after: Proposal;
}
export interface OrderDocument {
  number: string;
  customer: string;
  vehicle: string;
  baseline_items: BasicLine[];
  approved_items: (Line & { proposal_id: string; revision: number; evidence: Evidence })[];
  totals: Totals;
  notice: string;
}
