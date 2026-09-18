"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { AuditEvent, OrderDocument, WorkOrder } from "@/lib/types";

export const orderId = "demo-order";

async function readOrder() {
  const [order, events, document] = await Promise.all([
    api<WorkOrder>(`/orders/${orderId}`),
    api<AuditEvent[]>(`/orders/${orderId}/history`),
    api<OrderDocument>(`/orders/${orderId}/document`),
  ]);
  return { order, events, document };
}

export function useWorkOrder() {
  const [data, setData] = useState<Awaited<ReturnType<typeof readOrder>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const reload = useCallback(async () => setData(await readOrder()), []);

  useEffect(() => {
    let active = true;
    readOrder()
      .then((result) => {
        if (active) setData(result);
      })
      .catch((error: Error) => {
        if (active) setError(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await reload();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [reload]);

  return {
    order: data?.order ?? null,
    events: data?.events ?? [],
    document: data?.document ?? null,
    loading,
    error,
    setError,
    refresh,
    reload,
  };
}
