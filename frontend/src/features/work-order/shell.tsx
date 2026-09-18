"use client";
import Link from "next/link";
import { Flex } from "@chakra-ui/react";
import { useTheme } from "next-themes";
import {
  Wrench,
  ChevronRight,
  ClipboardList,
  History as HistoryIcon,
  FileText,
  LifeBuoy,
  ArrowRight,
  LayoutDashboard,
  Sun,
  Moon,
  UserRound,
} from "lucide-react";
import { roleNames } from "@/lib/format";
import type { Role } from "@/lib/types";
import type { Tab } from "./types";

export function Sidebar({
  tab,
  setTab,
  onHelp,
}: {
  tab: Tab;
  setTab: (value: Tab) => void;
  onHelp: () => void;
}) {
  return (
    <aside className="sidebar no-print">
      <Link className="brand" href="/" aria-label="ServiceFlow — главная">
        <span className="brand-mark">
          <Wrench size={23} strokeWidth={2.4} />
        </span>
        service<span>flow</span>
        <span className="brand-dot">.</span>
      </Link>
      <div className="workshop-switch">
        <div className="workshop-avatar">А</div>
        <div>
          <strong>Автосервис «Точка»</strong>
          <small>Рабочее пространство</small>
        </div>
        <ChevronRight size={16} />
      </div>
      <div className="nav-label">РАБОТА С СЕРВИСОМ</div>
      <nav aria-label="Основная навигация">
        <button
          className={tab === "proposals" ? "nav-item active" : "nav-item"}
          onClick={() => setTab("proposals")}
        >
          <ClipboardList size={19} />
          Заказ-наряд<span className="nav-count">1</span>
        </button>
        <button
          className={tab === "history" ? "nav-item active" : "nav-item"}
          onClick={() => setTab("history")}
        >
          <HistoryIcon size={19} />
          История изменений
        </button>
        <button
          className={tab === "document" ? "nav-item active" : "nav-item"}
          onClick={() => setTab("document")}
        >
          <FileText size={19} />
          Документы
        </button>
      </nav>
      <div className="sidebar-bottom">
        <div className="demo-card">
          <div>
            <span className="live-dot" />
            Демо-пространство
          </div>
          <p>Все изменения сохраняются локально. Попробуйте разные роли.</p>
          <button onClick={onHelp}>
            Как это работает
            <ArrowRight size={14} />
          </button>
        </div>
        <button className="nav-item" onClick={onHelp}>
          <LifeBuoy size={18} />
          Краткая инструкция
        </button>
        <div className="sidebar-version">
          SERVICEFLOW <span>v0.1 · demo</span>
        </div>
      </div>
    </aside>
  );
}
export function Topbar({
  number,
  role,
  busy,
  setRole,
}: {
  number: string;
  role: Role;
  busy: boolean;
  setRole: (value: Role) => void;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <header className="topbar no-print">
      <div className="breadcrumb">
        <LayoutDashboard size={16} />
        <span>Заказ-наряды</span>
        <ChevronRight size={14} />
        <strong>{number}</strong>
      </div>
      <Flex gap="4" align="center">
        <button
          className="icon-button theme-toggle"
          aria-label="Переключить тему"
          title="Переключить тему"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          <Sun size={19} className="sun-icon" />
          <Moon size={19} className="moon-icon" />
        </button>
        <div className="topbar-divider" />
        <div className="role-control">
          <div className="avatar">
            <UserRound size={18} />
          </div>
          <div>
            <span>Смотреть как · демо</span>
            <select
              aria-label="Роль сотрудника"
              value={role}
              disabled={busy}
              onChange={(e) => {
                setRole(e.target.value as Role);
              }}
            >
              {Object.entries(roleNames).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Flex>
    </header>
  );
}
