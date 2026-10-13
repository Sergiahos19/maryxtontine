"use client";

import { CircleCheck, CirclePause } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AppShell, PageHeading } from "@/components/layout/app-shell";
import { Avatar } from "@/components/ui/avatar";
import { Notice } from "@/components/ui/notice";
import { formatCurrency, formatDate } from "@/lib/formatters";

type CircleMember = {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  standing: "ok" | "late" | "paused";
  outstandingDebt: number;
  unpaidDays: number;
  coveredUntil: string | null;
  isMe: boolean;
};

type Filter = "all" | "late" | "ok";

export default function MembersPage() {
  return (
    <AppShell>
      <Circle />
    </AppShell>
  );
}

function standingText(member: CircleMember) {
  if (member.standing === "paused") return "Compte en pause";
  if (member.standing === "late") return `${member.unpaidDays} jour${member.unpaidDays > 1 ? "s" : ""} de retard`;
  return member.coveredUntil ? `Réglé jusqu’au ${formatDate(member.coveredUntil)}` : "À jour de ses cotisations";
}

function Circle() {
  const [members, setMembers] = useState<CircleMember[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    void fetch("/api/members", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as { error?: string; members?: CircleMember[] };
        if (!response.ok) setError(result.error ?? "Impossible de charger les membres.");
        else setMembers(result.members ?? []);
      })
      .catch(() => setError("Le service est inaccessible. Réessayez plus tard."))
      .finally(() => setLoading(false));
  }, []);

  const counts = useMemo(() => ({
    ok: members.filter((member) => member.standing === "ok").length,
    late: members.filter((member) => member.standing === "late").length,
  }), [members]);
  const visible = members.filter((member) => filter === "all" || member.standing === filter);
  const active = counts.ok + counts.late;

  return (
    <>
      <PageHeading
        title="Les membres du cercle"
        description={loading ? "Chargement..." : `${members.length} membre(s) : ${counts.ok} à jour, ${counts.late} en retard.`}
      />

      {error ? <Notice tone="error" className="mb-5">{error}</Notice> : null}

      {active > 0 ? (
        <div className="mb-5" aria-hidden>
          <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-2">
            <span className="bg-ok" style={{ width: `${(counts.ok / active) * 100}%` }} />
            <span className="bg-bad" style={{ width: `${(counts.late / active) * 100}%` }} />
          </div>
        </div>
      ) : null}

      <div className="card mb-5 grid grid-cols-3 rounded-full! p-1" role="tablist" aria-label="Filtrer les membres">
        {([["all", "Tous", members.length], ["late", "En retard", counts.late], ["ok", "À jour", counts.ok]] as const).map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={filter === key}
            onClick={() => setFilter(key)}
            className={`rounded-full py-2.5 text-sm font-medium ${filter === key ? "bg-accent text-accent-ink" : "text-muted hover:text-ink"}`}
          >
            {label} <span className="tabular opacity-70">{count}</span>
          </button>
        ))}
      </div>

      {!loading && !visible.length && !error ? (
        <p className="card px-4 py-12 text-center text-sm text-muted">
          {filter === "late" ? "Personne n’est en retard. Le cercle est à jour." : filter === "ok" ? "Aucun membre n’est à jour pour l’instant." : "Aucun membre inscrit pour l’instant."}
        </p>
      ) : null}

      {visible.length ? (
        <ul className="card divide-y divide-line overflow-hidden">
          {visible.map((member) => (
            <li key={member.id} className={`flex items-center gap-3 px-4 py-3.5 sm:px-5 ${member.isMe ? "bg-accent-soft" : ""}`}>
              <Avatar src={member.avatarUrl} firstName={member.firstName} lastName={member.lastName} size="md" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate font-medium text-ink">
                  <span className="truncate">{member.firstName} {member.lastName}</span>
                  {member.isMe ? <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-ink">Vous</span> : null}
                </p>
                <p className={`truncate text-xs ${member.standing === "late" ? "text-bad" : "text-muted"}`}>{standingText(member)}</p>
              </div>
              {member.standing === "late" ? (
                <div className="shrink-0 text-right">
                  <p className="font-display font-semibold text-bad tabular">{formatCurrency(member.outstandingDebt)}</p>
                  <p className="text-xs text-muted">à régler</p>
                </div>
              ) : member.standing === "paused" ? (
                <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-muted"><CirclePause className="h-4 w-4" /> Pause</span>
              ) : (
                <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-ok"><CircleCheck className="h-4 w-4" /> À jour</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-5 text-xs text-muted">Seuls le nom, la photo et la situation de paiement sont partagés. Les emails et numéros de téléphone restent privés.</p>
    </>
  );
}
