"use client";

import { Archive, Bell, CheckCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/formatters";

type NotificationRow = {
  id: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
  archivedAt?: string | null;
  severity: "info" | "warning" | "success";
  memberName?: string;
};

type NotificationView = "active" | "archive";

function dateGroup(value: string) {
  const date = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(date);
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [archivedCount, setArchivedCount] = useState(0);
  const [archivedUnreadCount, setArchivedUnreadCount] = useState(0);
  const [role, setRole] = useState("");
  const [view, setView] = useState<NotificationView>("active");

  useEffect(() => {
    let active = true;
    async function loadNotifications() {
      try {
        const response = await fetch(`/api/notifications?view=${view}`, { cache: "no-store" });
        const result = await response.json() as {
          error?: string;
          notifications?: NotificationRow[];
          unreadCount?: number;
          activeCount?: number;
          archivedCount?: number;
          archivedUnreadCount?: number;
          role?: string;
        };
        if (!active) return;
        if (!response.ok) setError(result.error ?? "Impossible de charger les notifications.");
        else {
          setError("");
          setNotifications(result.notifications ?? []);
          setUnreadCount(result.unreadCount ?? 0);
          setActiveCount(result.activeCount ?? 0);
          setArchivedCount(result.archivedCount ?? 0);
          setArchivedUnreadCount(result.archivedUnreadCount ?? 0);
          setRole(result.role ?? "");
        }
      } catch {
        if (active) setError("Le service de données est inaccessible.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadNotifications();
    const interval = window.setInterval(() => void loadNotifications(), 20_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [view]);

  function selectView(nextView: NotificationView) {
    if (nextView !== view) {
      setLoading(true);
      setNotifications([]);
      setView(nextView);
    }
  }

  async function markRead(notificationId?: string) {
    setError("");
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notificationId
          ? { notificationId }
          : { markAll: true, archived: view === "archive" }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Impossible de mettre à jour les notifications.");
        return;
      }
      const readAt = new Date().toISOString();
      setNotifications((current) => current.map((item) => !notificationId || item.id === notificationId ? { ...item, readAt } : item));
      if (view === "active") {
        setUnreadCount((current) => notificationId
          ? Math.max(0, current - (notifications.find((item) => item.id === notificationId && !item.readAt) ? 1 : 0))
          : 0);
      } else {
        setArchivedUnreadCount((current) => notificationId
          ? Math.max(0, current - (notifications.find((item) => item.id === notificationId && !item.readAt) ? 1 : 0))
          : 0);
      }
      window.dispatchEvent(new Event("maryx-notifications-change"));
    } catch {
      setError("Le service de notifications est inaccessible.");
    }
  }

  const groupedNotifications = view === "archive"
    ? notifications.reduce<Array<{ label: string; items: NotificationRow[] }>>((groups, item) => {
        const label = dateGroup(item.createdAt);
        const existing = groups.find((group) => group.label === label);
        if (existing) existing.items.push(item);
        else groups.push({ label, items: [item] });
        return groups;
      }, [])
    : [{ label: "", items: notifications }];
  const currentUnreadCount = view === "archive" ? archivedUnreadCount : unreadCount;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <Header />
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">Notifications</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-3xl font-semibold text-white">Centre de notifications</h1>
            <div className="flex items-center gap-3">
              <Badge tone={currentUnreadCount ? "warning" : "info"}>{currentUnreadCount} non lues</Badge>
              {currentUnreadCount > 0 ? (
                <Button variant="secondary" className="gap-2" onClick={() => void markRead()}>
                  <CheckCheck className="h-4 w-4" /> Tout marquer comme lu
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        {role === "ADMIN" ? (
          <div className="mb-6 flex gap-2 rounded-2xl border border-white/10 bg-slate-900/70 p-2" role="tablist" aria-label="Sections des notifications">
            <button
              type="button"
              role="tab"
              aria-selected={view === "active"}
              onClick={() => selectView("active")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition ${view === "active" ? "bg-cyan-400/15 text-cyan-100" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
            >
              <Bell className="h-4 w-4" /> Actif
              <span className="rounded-full bg-slate-950/70 px-2 py-0.5 text-xs">{activeCount}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === "archive"}
              onClick={() => selectView("archive")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition ${view === "archive" ? "bg-cyan-400/15 text-cyan-100" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
            >
              <Archive className="h-4 w-4" /> Archives
              <span className="rounded-full bg-slate-950/70 px-2 py-0.5 text-xs">{archivedCount}</span>
            </button>
          </div>
        ) : null}

        {error ? <p role="alert" className="mb-4 text-red-300">{error}</p> : null}
        {loading ? <p className="mb-4 text-slate-400">Chargement...</p> : null}
        <div className="space-y-6">
          {groupedNotifications.map((group) => (
            <section key={group.label || "active-notifications"} className="space-y-3">
              {group.label ? <h2 className="sticky top-[4.5rem] z-10 rounded-xl border border-white/10 bg-slate-950/95 px-4 py-2 text-sm font-semibold capitalize text-cyan-200 backdrop-blur">{group.label}</h2> : null}
              {group.items.map((item) => (
                <article key={item.id} className={`rounded-2xl border bg-slate-900/70 p-5 ${item.readAt ? "border-white/10" : "border-cyan-400/30"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-medium text-white">
                        {item.memberName ? `${item.title} · ${item.memberName}` : item.title}
                      </h3>
                      <p className="mt-1 text-sm text-slate-400">{formatDate(item.createdAt)}</p>
                    </div>
                    <Badge tone={item.severity === "warning" ? "warning" : item.severity === "success" ? "success" : "info"}>
                      {item.readAt ? "Lue" : item.severity}
                    </Badge>
                  </div>
                  <p className="mt-3 text-slate-300">{item.message}</p>
                  {!item.readAt ? (
                    <button type="button" className="mt-3 text-sm font-medium text-cyan-300 transition-colors hover:text-cyan-100" onClick={() => void markRead(item.id)}>
                      Marquer comme lue
                    </button>
                  ) : null}
                </article>
              ))}
            </section>
          ))}
        </div>
        {!notifications.length && !loading && !error ? (
          <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-400">
            {view === "archive" ? "Aucune notification archivée pour le moment." : "Aucune notification active."}
          </p>
        ) : null}
      </div>
    </main>
  );
}
