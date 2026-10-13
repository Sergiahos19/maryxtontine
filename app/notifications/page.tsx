"use client";

import { CheckCheck, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";

import { AppShell, PageHeading, useSessionUser } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { IconChip } from "@/components/ui/icon-chip";
import { Notice } from "@/components/ui/notice";
import { formatTime, parseDate } from "@/lib/formatters";

type NotificationRow = {
  id: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
  severity: "info" | "warning" | "success";
  memberName?: string;
};

type View = "active" | "archive";

const severityChip = {
  info: { icon: Info, tone: "accent" },
  warning: { icon: TriangleAlert, tone: "warn" },
  success: { icon: CircleCheck, tone: "ok" },
} as const;

function dayLabel(value: string) {
  const date = parseDate(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(date);
}

export default function NotificationsPage() {
  return (
    <AppShell>
      <Notifications />
    </AppShell>
  );
}

function Notifications() {
  const user = useSessionUser();
  const [view, setView] = useState<View>("active");
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [counts, setCounts] = useState({ unread: 0, active: 0, archived: 0, archivedUnread: 0 });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const isAdmin = user.role === "ADMIN";

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch(`/api/notifications?view=${view}`, { cache: "no-store" });
        const result = await response.json() as {
          error?: string;
          notifications?: NotificationRow[];
          unreadCount?: number;
          activeCount?: number;
          archivedCount?: number;
          archivedUnreadCount?: number;
        };
        if (!active) return;
        if (!response.ok) {
          setError(result.error ?? "Impossible de charger les alertes.");
          return;
        }
        setError("");
        setNotifications(result.notifications ?? []);
        setCounts({
          unread: result.unreadCount ?? 0,
          active: result.activeCount ?? 0,
          archived: result.archivedCount ?? 0,
          archivedUnread: result.archivedUnreadCount ?? 0,
        });
      } catch {
        if (active) setError("Le service est inaccessible.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    const interval = window.setInterval(() => void load(), 30_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [view]);

  function selectView(next: View) {
    if (next === view) return;
    setLoading(true);
    setNotifications([]);
    setView(next);
  }

  async function markRead(notificationId?: string) {
    setError("");
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notificationId ? { notificationId } : { markAll: true, archived: view === "archive" }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Impossible de mettre à jour les alertes.");
        return;
      }
      const readAt = new Date().toISOString();
      const wasUnread = notificationId ? notifications.some((item) => item.id === notificationId && !item.readAt) : false;
      setNotifications((current) => current.map((item) => (!notificationId || item.id === notificationId ? { ...item, readAt: item.readAt ?? readAt } : item)));
      setCounts((current) => {
        const key = view === "archive" ? "archivedUnread" : "unread";
        return { ...current, [key]: notificationId ? Math.max(0, current[key] - (wasUnread ? 1 : 0)) : 0 };
      });
      window.dispatchEvent(new Event("maryx-notifications-change"));
    } catch {
      setError("Le service est inaccessible.");
    }
  }

  const unread = view === "archive" ? counts.archivedUnread : counts.unread;
  const groups = notifications.reduce<{ label: string; items: NotificationRow[] }[]>((list, item) => {
    const label = dayLabel(item.createdAt);
    const group = list.find((entry) => entry.label === label);
    if (group) group.items.push(item);
    else list.push({ label, items: [item] });
    return list;
  }, []);

  return (
    <>
      <PageHeading
        title="Alertes"
        description={unread ? `${unread} non lue(s).` : "Tout est lu."}
        action={unread ? (
          <Button size="sm" variant="secondary" onClick={() => void markRead()}>
            <CheckCheck className="h-4 w-4" /> Tout marquer comme lu
          </Button>
        ) : undefined}
      />

      {isAdmin ? (
        <div className="card mb-5 grid grid-cols-2 rounded-full! p-1" role="tablist" aria-label="Type d’alertes">
          {([["active", "Récentes", counts.active], ["archive", "Archives", counts.archived]] as const).map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={view === key}
              onClick={() => selectView(key)}
              className={`rounded-full py-2.5 text-sm font-medium ${view === key ? "bg-accent text-accent-ink" : "text-muted hover:text-ink"}`}
            >
              {label} <span className="tabular opacity-70">{count}</span>
            </button>
          ))}
        </div>
      ) : null}

      {error ? <Notice tone="error" className="mb-5">{error}</Notice> : null}
      {loading ? <p className="py-10 text-center text-muted">Chargement...</p> : null}

      {!loading && !notifications.length && !error ? (
        <p className="card px-4 py-12 text-center text-sm text-muted">
          {view === "archive" ? "Aucune alerte archivée." : "Aucune alerte pour le moment. Les paiements et retards apparaîtront ici."}
        </p>
      ) : null}

      <div className="space-y-6">
        {groups.map((group) => (
          <section key={group.label}>
            <h2 className="mb-2 text-sm font-medium text-muted first-letter:uppercase">{group.label}</h2>
            <ul className="card divide-y divide-line overflow-hidden">
              {group.items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => (!item.readAt ? void markRead(item.id) : undefined)}
                    className={`flex w-full gap-3 px-4 py-4 text-left sm:px-5 ${item.readAt ? "cursor-default" : "hover:bg-surface-2"}`}
                    aria-label={item.readAt ? undefined : `${item.title}, non lue. Marquer comme lue.`}
                  >
                    <span className="relative">
                      <IconChip icon={severityChip[item.severity].icon} tone={item.readAt ? "neutral" : severityChip[item.severity].tone} />
                      {!item.readAt ? <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-bad" aria-hidden /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className={`truncate ${item.readAt ? "text-muted" : "font-semibold text-ink"}`}>
                          {item.title}
                        </span>
                        <span className="shrink-0 text-xs text-muted tabular">{formatTime(item.createdAt)}</span>
                      </span>
                      {item.memberName ? <span className="mt-0.5 block text-sm font-medium text-accent">{item.memberName}</span> : null}
                      <span className="mt-1 block text-sm leading-relaxed text-muted">{item.message}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
