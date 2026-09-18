"use client";

import { useState } from "react";
import { Box } from "@chakra-ui/react";
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  History as HistoryIcon,
  Plus,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import { ActionButton, Modal } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { dateTime, proposalStatus } from "@/lib/format";
import type { Line, Proposal, Role } from "@/lib/types";
import { DecisionForm } from "@/features/proposals/decision-form";
import { ProposalEditor } from "@/features/proposals/proposal-editor";
import { EvidenceForm } from "@/features/proposals/evidence-form";
import { ProposalCard, type ProposalAction } from "@/features/proposals/proposal-card";
import { DocumentView } from "./document";
import { History } from "./history";

import type { Tab } from "./types";
import { Sidebar, Topbar } from "./shell";
import { VehicleSummary, FinancialSummary } from "./summary";
import { orderId, useWorkOrder } from "./use-work-order";
type Dialog = "create" | "help" | Exclude<ProposalAction, "release"> | "stock";
const tabLabels: Record<Tab, string> = {
  proposals: "Дополнительные работы",
  history: "История изменений",
  document: "Документы",
};
const dialogTitles: Record<Dialog, string> = {
  create: "Новое предложение",
  edit: "Редактирование черновика",
  decision: "Решение клиента",
  submit: "Передача предложения клиенту",
  cancel: "Отмена предложения",
  revise: "Новая редакция предложения",
  note: "Запись в истории",
  stock: "Поступление запчасти",
  help: "Как проверить демо",
};
const dialogDescriptions: Partial<Record<Dialog, string>> = {
  create: "Опишите неисправность и добавьте необходимые работы и запчасти.",
  decision: "Выберите согласованные позиции и сохраните подтверждение.",
  cancel: "Предложение будет отозвано, его сумма исключена из расчёта. История сохранится.",
  revise:
    "Текущая редакция будет отозвана. Новая станет черновиком и потребует повторного согласования всех позиций.",
};

export function Workspace() {
  const { order, events, document, error, setError, loading, reload, refresh } = useWorkOrder();
  const [role, setRole] = useState<Role>("advisor");
  const [tab, setTab] = useState<Tab>("proposals");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [stockItem, setStockItem] = useState<Line | null>(null);
  const [dialogError, setDialogError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const selected = order?.proposals.find((p) => p.id === selectedId) ?? order?.proposals.at(-1);

  function openDialog(value: Dialog) {
    setDialogError("");
    setDialog(value);
  }
  async function mutate(path: string, payload: unknown, success: string, method?: string) {
    if (busy) return;
    setBusy(true);
    setDialogError("");
    setError("");
    setNotice("");
    let saved = false;
    try {
      const result = await api<Proposal>(path, role, payload, method);
      saved = true;
      setSelectedId(result.id);
      setDialog(null);
      await reload();
      setNotice(success);
    } catch (e) {
      if (saved) {
        setError(
          "Изменение сохранено, но обновить экран не удалось. Нажмите «Обновить», чтобы увидеть актуальные данные.",
        );
      } else if (
        e instanceof ApiError &&
        e.status === 409 &&
        e.message.includes("другим сотрудником")
      ) {
        setDialog(null);
        setError(e.message);
        try {
          await reload();
        } catch {
          /* Keep the actionable conflict message. */
        }
      } else if (dialog) setDialogError((e as Error).message);
      else setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function proposalAction(action: ProposalAction) {
    if (!selected) return;
    if (action === "release")
      void mutate(
        `/proposals/${selected.id}/release`,
        { version: selected.version },
        "Согласованные позиции переданы в работу",
      );
    else openDialog(action);
  }
  function itemAction(item: Line, action: "start" | "complete" | "issue" | "stock") {
    if (!selected) return;
    if (action === "stock") {
      setStockItem(item);
      openDialog("stock");
    } else
      void mutate(
        `/proposals/${selected.id}/items/${item.id}/${action}`,
        { version: selected.version },
        action === "start"
          ? "Работа начата"
          : action === "complete"
            ? "Работа завершена"
            : "Запчасть выдана",
      );
  }

  return (
    <Box className="app-shell">
      <Sidebar tab={tab} setTab={setTab} onHelp={() => openDialog("help")} />
      <div className="main-shell">
        <Topbar
          number={order?.number ?? "ЗН-1042"}
          role={role}
          busy={busy}
          setRole={(value) => {
            setRole(value);
            setDialog(null);
            setDialogError("");
          }}
        />
        <main className="workspace">
          <div className="page-heading no-print">
            <div>
              <div className="eyebrow">РЕМОНТ ПОД КОНТРОЛЕМ</div>
              <h1>
                Заказ-наряд <span>{order?.number ?? "ЗН-1042"}</span>
              </h1>
              <p>Согласуйте дополнительные работы и сохраните каждое решение.</p>
            </div>
            <ActionButton
              secondary
              loading={loading}
              disabled={busy}
              onClick={() => void refresh()}
            >
              <RefreshCw size={15} />
              Обновить
            </ActionButton>
          </div>
          {error && (
            <div className="error-banner" role="alert">
              <span>{error}</span>
              <button aria-label="Закрыть ошибку" onClick={() => setError("")}>
                <X size={17} />
              </button>
            </div>
          )}
          {notice && (
            <div className="success-banner no-print" role="status">
              <Check size={17} />
              <span>{notice}</span>
              <button aria-label="Закрыть уведомление" onClick={() => setNotice("")}>
                <X size={17} />
              </button>
            </div>
          )}
          {!order ? (
            <section className="panel loading-panel">
              {loading ? (
                <>
                  <span className="loading-spinner" />
                  <h2>Загружаем заказ-наряд</h2>
                </>
              ) : (
                <>
                  <h2>Сервер пока недоступен</h2>
                  <p>Запустите проект по инструкции README и нажмите «Обновить».</p>
                  <ActionButton onClick={() => void refresh()}>Повторить</ActionButton>
                </>
              )}
            </section>
          ) : (
            <>
              <VehicleSummary order={order} />
              <div className="tabs-row no-print">
                <div className="tabs" role="tablist" aria-label="Разделы заказ-наряда">
                  {Object.entries(tabLabels).map(([id, name]) => (
                    <button
                      role="tab"
                      aria-selected={tab === id}
                      aria-controls={`panel-${id}`}
                      id={`tab-${id}`}
                      key={id}
                      className={tab === id ? "active" : ""}
                      onClick={() => setTab(id as Tab)}
                    >
                      {name}
                      {id === "proposals" && (
                        <span>
                          {order.proposals.filter((p) => p.status !== "cancelled").length}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <span className="autosave">
                  <span className="live-dot" />
                  Изменения сохраняются
                </span>
              </div>
              <div className="content-grid">
                <div
                  className="content-main"
                  role="tabpanel"
                  id={`panel-${tab}`}
                  aria-labelledby={`tab-${tab}`}
                >
                  {tab === "proposals" && (
                    <>
                      <div className="section-heading proposals-toolbar">
                        <div>
                          <h2>Дополнительные работы</h2>
                          <p>От обнаруженной неисправности до разрешения на ремонт</p>
                        </div>
                        {role !== "cashier" && (
                          <ActionButton
                            secondary
                            disabled={busy}
                            onClick={() => openDialog("create")}
                          >
                            <Plus size={17} />
                            Новое предложение
                          </ActionButton>
                        )}
                      </div>
                      {order.proposals.length > 1 && (
                        <div className="proposal-selector" aria-label="Предложения">
                          {order.proposals.map((p, i) => (
                            <button
                              key={p.id}
                              className={selected?.id === p.id ? "active" : ""}
                              onClick={() => setSelectedId(p.id)}
                            >
                              <span>
                                Предложение {i + 1} · ред. {p.revision}
                              </span>
                              <small>{proposalStatus(p).label}</small>
                            </button>
                          ))}
                        </div>
                      )}
                      {selected && (
                        <ProposalCard
                          proposal={selected}
                          role={role}
                          busy={busy}
                          onAction={proposalAction}
                          onItemAction={itemAction}
                        />
                      )}
                      <div className="safety-note">
                        <ShieldCheck size={18} />
                        <p>
                          <strong>Ремонт начинается с согласия.</strong> Несогласованные позиции не
                          увеличивают стоимость и недоступны механику для выполнения.
                        </p>
                      </div>
                      <section className="panel recent-event">
                        <div className="recent-event-icon">
                          <HistoryIcon size={19} />
                        </div>
                        <div>
                          <strong>Последнее изменение</strong>
                          <p>
                            {events[0]?.note ?? "Изменений пока нет"}
                            <span>
                              {events[0] &&
                                `${events[0].actor_name} · ${dateTime(events[0].created_at)} МСК`}
                            </span>
                          </p>
                        </div>
                        <button className="text-button" onClick={() => setTab("history")}>
                          Вся история
                          <ArrowRight size={15} />
                        </button>
                      </section>
                    </>
                  )}
                  {tab === "history" && <History events={events} />}
                  {tab === "document" && document && <DocumentView document={document} />}
                </div>
                <FinancialSummary order={order} setTab={setTab} />
              </div>
              <footer className="workspace-footer no-print">
                <span>ServiceFlow · управление ремонтом</span>
                <span>
                  <ShieldCheck size={13} />
                  Данные хранятся на вашем компьютере
                </span>
              </footer>
            </>
          )}
        </main>
      </div>
      {dialog && (
        <Modal
          title={dialogTitles[dialog]}
          description={dialogDescriptions[dialog]}
          onClose={() => {
            if (!busy) setDialog(null);
          }}
          wide={["create", "edit", "decision"].includes(dialog)}
        >
          {dialogError && (
            <div className="error-banner" role="alert">
              {dialogError}
            </div>
          )}
          {dialog === "help" ? (
            <div className="help-content">
              <ol>
                <li>В роли мастера откройте «Зафиксировать решение».</li>
                <li>
                  Согласуйте замену колодок, а от ремня откажитесь. Связанные запчасти выберутся
                  автоматически.
                </li>
                <li>Проверьте сумму, затем нажмите «Передать в работу».</li>
                <li>
                  Переключитесь на механика в правом верхнем углу. Начните и завершите разрешённую
                  работу.
                </li>
                <li>Откройте историю и документы. Попробуйте создать своё предложение.</li>
              </ol>
              <div className="inline-notice">
                <ArrowDownToLine size={19} />
                Для проверки нового сценария создайте предложение. Чистый сброс базы описан в
                README.
              </div>
              <p>
                Это локальное демо без авторизации. Переключение роли показывает правила доступа;
                данные клиента вымышлены.
              </p>
            </div>
          ) : dialog === "create" || dialog === "edit" ? (
            <ProposalEditor
              proposal={dialog === "edit" ? selected : undefined}
              busy={busy}
              onSave={(data) =>
                void mutate(
                  dialog === "edit" ? `/proposals/${selected!.id}` : `/orders/${orderId}/proposals`,
                  data,
                  "Черновик сохранён",
                  dialog === "edit" ? "PUT" : "POST",
                )
              }
            />
          ) : dialog === "decision" && selected ? (
            <DecisionForm
              proposal={selected}
              customer={order!.customer}
              busy={busy}
              onSave={(data) =>
                void mutate(
                  `/proposals/${selected.id}/decision`,
                  data,
                  "Решение клиента сохранено. Стоимость и срок пересчитаны.",
                )
              }
            />
          ) : (
            selected && (
              <EvidenceForm
                customer={order!.customer}
                busy={busy}
                delivery={dialog === "submit"}
                submitLabel={
                  dialog === "submit"
                    ? "Зафиксировать передачу"
                    : dialog === "cancel"
                      ? "Отменить предложение"
                      : dialog === "revise"
                        ? "Создать редакцию"
                        : "Сохранить запись"
                }
                onSave={(data) => {
                  const path = dialog === "stock" ? `items/${stockItem!.id}/stock` : dialog;
                  void mutate(
                    `/proposals/${selected.id}/${path}`,
                    {
                      ...data,
                      version: selected.version,
                      ...(dialog === "stock" ? { in_stock: true } : {}),
                    },
                    dialog === "revise"
                      ? "Создана новая редакция. Отредактируйте позиции и повторно согласуйте с клиентом."
                      : "Изменение сохранено в истории",
                  );
                }}
              />
            )
          )}
        </Modal>
      )}
    </Box>
  );
}
