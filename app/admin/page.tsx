"use client";

import { HandCoins, ChevronDown, Copy, FileText, KeyRound, Search, Trash2, UserCheck, UserX } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Stat } from "@/components/dashboard/stat-card";
import { AppShell, PageHeading } from "@/components/layout/app-shell";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { IconChip } from "@/components/ui/icon-chip";
import { Notice } from "@/components/ui/notice";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import { memberStatusLabel, paymentMethodLabel, transactionTypeLabel } from "@/lib/labels";
import { downloadGlobalReport, downloadMemberStatement, type GlobalReport, type MemberStatement } from "@/lib/pdf-export";

type MemberStatus = "ACTIVE" | "INACTIVE" | "ON_HOLD";

type AdminMember = {
  id: string;
  firstName: string;
  lastName: string;
  penaltyDebt: number;
  totalPaid: number;
  outstandingDebt: number;
  unpaidDays: number;
  status: MemberStatus;
  avatarUrl: string | null;
};

type AdminTransaction = {
  id: string;
  memberName: string;
  amount: number;
  type: string;
  method: string;
  createdAt: string;
};

type Feedback = { tone: "success" | "error"; text: string } | null;

export default function AdminPage() {
  return (
    <AppShell access="admin">
      <AdminDashboard />
    </AppShell>
  );
}

function AdminDashboard() {
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [settings, setSettings] = useState({ dailyContribution: "50", dailyLatePenalty: "25" });
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<{ name: string; password: string } | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async (withSettings = false) => {
    try {
      const response = await fetch("/api/admin/overview", { cache: "no-store" });
      const result = await response.json() as { error?: string; dailyContribution?: number; dailyLatePenalty?: number; members?: AdminMember[]; transactions?: AdminTransaction[] };
      if (!response.ok) {
        setLoadError(result.error ?? "Impossible de charger les données.");
        return;
      }
      setLoadError("");
      setMembers(result.members ?? []);
      setTransactions(result.transactions ?? []);
      if (withSettings) {
        setSettings({ dailyContribution: String(result.dailyContribution ?? 50), dailyLatePenalty: String(result.dailyLatePenalty ?? 25) });
      }
    } catch {
      setLoadError("Le service est inaccessible. Réessayez plus tard.");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(true), 0);
    const interval = window.setInterval(() => void load(), 30_000);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, [load]);

  const totals = useMemo(() => ({
    collected: members.reduce((sum, member) => sum + member.totalPaid, 0),
    outstanding: members.reduce((sum, member) => sum + member.outstandingDebt, 0),
    upToDate: members.filter((member) => member.unpaidDays === 0).length,
    late: members.filter((member) => member.unpaidDays > 0).length,
  }), [members]);

  const filteredMembers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const sorted = [...members].sort((a, b) => b.outstandingDebt - a.outstandingDebt);
    return needle ? sorted.filter((member) => `${member.firstName} ${member.lastName}`.toLowerCase().includes(needle)) : sorted;
  }, [members, query]);

  async function callApi(url: string, method: string, body?: unknown) {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const result = await response.json() as Record<string, unknown> & { error?: string };
    if (!response.ok) throw new Error(result.error ?? "L’opération a échoué.");
    return result;
  }

  async function run(key: string, action: () => Promise<void>) {
    setBusy(key);
    setFeedback(null);
    try {
      await action();
    } catch (error) {
      setFeedback({ tone: "error", text: error instanceof Error ? error.message : "Le service est inaccessible. Réessayez." });
    } finally {
      setBusy("");
    }
  }

  const exportGlobalReport = () => run("report:global", async () => {
    const response = await fetch("/api/reports?scope=global", { cache: "no-store" });
    const result = await response.json() as GlobalReport & { error?: string };
    if (!response.ok) throw new Error(result.error ?? "Le relevé global n’a pas pu être généré.");
    await downloadGlobalReport(result);
  });

  const exportMemberStatement = (member: AdminMember) => run(`report:${member.id}`, async () => {
    const response = await fetch(`/api/reports?scope=member&memberId=${encodeURIComponent(member.id)}`, { cache: "no-store" });
    const result = await response.json() as MemberStatement & { error?: string };
    if (!response.ok) throw new Error(result.error ?? "Le relevé n’a pas pu être généré.");
    await downloadMemberStatement(result);
  });

  const updateStatus = (member: AdminMember, status: MemberStatus) => {
    if (status === "INACTIVE" && !window.confirm(`Bloquer la connexion de ${member.firstName} ${member.lastName} ? Ses sessions seront fermées.`)) return;
    if (status === "ON_HOLD" && !window.confirm(`Mettre ${member.firstName} ${member.lastName} en pause ? Aucune cotisation ne sera due pendant la pause.`)) return;
    void runStatus(member, status);
  };

  const runStatus = (member: AdminMember, status: MemberStatus) => run(`status:${member.id}`, async () => {
    await callApi("/api/admin/members", "PATCH", { memberId: member.id, status });
    setFeedback({ tone: "success", text: `${member.firstName} ${member.lastName} est maintenant « ${memberStatusLabel(status).toLowerCase()} ».` });
    await load();
  });

  const resetPassword = (member: AdminMember) => {
    if (!window.confirm(`Générer un mot de passe temporaire pour ${member.firstName} ${member.lastName} ? Ses sessions actuelles seront fermées.`)) return;
    void run(`password:${member.id}`, async () => {
      const result = await callApi("/api/admin/members/password", "POST", { memberId: member.id });
      setTemporaryPassword({ name: `${member.firstName} ${member.lastName}`, password: String(result.temporaryPassword) });
    });
  };

  const deleteMember = (member: AdminMember) => {
    if (!window.confirm(`Supprimer définitivement ${member.firstName} ${member.lastName} et tout son historique ? Cette action est irréversible.`)) return;
    void run(`delete:${member.id}`, async () => {
      await callApi("/api/admin/members", "DELETE", { memberId: member.id });
      setFeedback({ tone: "success", text: `Le compte de ${member.firstName} ${member.lastName} a été supprimé.` });
      await load();
    });
  };

  function onPaymentSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    void run("payment", async () => {
      const result = await callApi("/api/admin/payments", "POST", {
        memberId: String(data.get("memberId") ?? ""),
        amount: Number(data.get("amount")),
        method: String(data.get("method") ?? ""),
      });
      const transaction = result.transaction as AdminTransaction;
      setFeedback({ tone: "success", text: `Paiement de ${formatCurrency(transaction.amount)} enregistré pour ${transaction.memberName}.` });
      form.reset();
      await load();
    });
  }

  function onSettingsSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run("settings", async () => {
      const result = await callApi("/api/admin/settings", "PATCH", {
        dailyContribution: Number(settings.dailyContribution),
        dailyLatePenalty: Number(settings.dailyLatePenalty),
      });
      setSettings({ dailyContribution: String(result.dailyContribution), dailyLatePenalty: String(result.dailyLatePenalty) });
      setFeedback({ tone: "success", text: "Tarifs enregistrés. Ils s’appliquent à partir d’aujourd’hui ; les jours passés gardent l’ancien montant." });
      await load();
    });
  }

  if (!loaded) return <p className="py-16 text-center text-muted" aria-busy="true">Chargement...</p>;

  return (
    <div className="space-y-5">
      <PageHeading
        title="Gestion de la tontine"
        description={`${members.length} membre(s), ${formatCurrency(Number(settings.dailyContribution))} par jour.`}
        action={(
          <Button variant="secondary" size="sm" onClick={() => void exportGlobalReport()} disabled={Boolean(busy)}>
            <FileText className="h-4 w-4" /> {busy === "report:global" ? "Préparation..." : "Relevé global"}
          </Button>
        )}
      />

      {loadError ? <Notice tone="error">{loadError}</Notice> : null}
      {feedback ? <Notice tone={feedback.tone}>{feedback.text}</Notice> : null}
      {temporaryPassword ? (
        <Notice
          tone="info"
          action={(
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => void navigator.clipboard?.writeText(temporaryPassword.password)}>
                <Copy className="h-4 w-4" /> Copier
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setTemporaryPassword(null)}>Masquer</Button>
            </div>
          )}
        >
          Mot de passe temporaire de {temporaryPassword.name} :{" "}
          <code className="rounded-md bg-surface-2 px-2 py-0.5 font-mono text-base font-semibold text-ink">{temporaryPassword.password}</code>
          <span className="mt-1 block text-xs text-muted">Il ne sera plus affiché. Transmettez-le au membre, qui le changera dans son profil.</span>
        </Notice>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <section className="brand-card p-5 sm:p-7" aria-label="Caisse de la tontine">
          <p className="brand-muted text-sm">Caisse de la tontine</p>
          <p className="mt-2 font-display text-[2.4rem] leading-none font-bold tabular sm:text-5xl">
            {totals.collected.toLocaleString("fr-FR")}<span className="ml-1.5 text-base font-semibold brand-muted">FCFA</span>
          </p>
          <p className="mt-2.5 text-sm brand-muted">Total des paiements confirmés.</p>
          <div className="mt-6 grid grid-cols-2 gap-3 border-t border-white/15 pt-4">
            <div>
              <p className="text-xs brand-muted">À récupérer</p>
              <p className="mt-1 font-display text-lg font-semibold tabular">{formatCurrency(totals.outstanding)}</p>
            </div>
            <div>
              <p className="text-xs brand-muted">Membres</p>
              <p className="mt-1 font-display text-lg font-semibold tabular">{members.length}</p>
            </div>
          </div>
        </section>
        <div className="grid grid-cols-2 gap-3">
          <Stat icon={UserCheck} label="À jour" value={String(totals.upToDate)} tone="ok" detail="Sans aucun retard" />
          <Stat icon={UserX} label="En retard" value={String(totals.late)} tone={totals.late ? "bad" : "default"} detail="Au moins un jour impayé" />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <Panel title="Membres" description="Triés par montant dû. Touchez un membre pour le gérer." id="membres">
          {members.length > 5 ? (
            <label className="relative mb-4 block">
              <span className="sr-only">Rechercher un membre</span>
              <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un membre" className="field pl-10" />
            </label>
          ) : null}
          {filteredMembers.length ? (
            <ul className="divide-y divide-line">
              {filteredMembers.map((member) => (
                <li key={member.id}>
                  <details className="group py-1">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl py-3 [&::-webkit-details-marker]:hidden">
                      <Avatar
                        src={member.avatarUrl}
                        firstName={member.firstName}
                        lastName={member.lastName}
                        className={member.outstandingDebt ? "bg-bad-soft! text-bad! ring-2 ring-bad/40" : ""}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-ink">{member.firstName} {member.lastName}</p>
                        <p className="mt-0.5 text-xs text-muted">
                          {member.unpaidDays > 0 ? `${member.unpaidDays} jour(s) de retard` : "À jour"}, {formatCurrency(member.totalPaid)} versés
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {member.status !== "ACTIVE" ? <Badge>{memberStatusLabel(member.status)}</Badge> : null}
                        <span className={`font-display text-sm font-semibold tabular ${member.outstandingDebt ? "text-bad" : "text-ok"}`}>
                          {member.outstandingDebt ? formatCurrency(member.outstandingDebt) : "0"}
                        </span>
                        <ChevronDown className="h-4 w-4 text-muted transition-transform group-open:rotate-180" />
                      </div>
                    </summary>
                    <div className="mb-3 space-y-3 rounded-2xl bg-surface-2 p-3.5">
                      <dl className="grid grid-cols-2 gap-3 text-sm">
                        <div><dt className="text-xs text-muted">Dette totale</dt><dd className="tabular text-ink">{formatCurrency(member.outstandingDebt)}</dd></div>
                        <div><dt className="text-xs text-muted">Dont pénalités</dt><dd className="tabular text-ink">{formatCurrency(member.penaltyDebt)}</dd></div>
                      </dl>
                      <label className="block text-sm">
                        <span className="mb-1.5 block text-xs text-muted">Statut du compte</span>
                        <select
                          value={member.status}
                          disabled={busy === `status:${member.id}`}
                          onChange={(event) => void updateStatus(member, event.target.value as MemberStatus)}
                          className="field"
                        >
                          <option value="ACTIVE">Actif : cotisations et pénalités courent</option>
                          <option value="ON_HOLD">En pause : aucune nouvelle échéance</option>
                          <option value="INACTIVE">Inactif : connexion bloquée</option>
                        </select>
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <Button size="sm" variant="secondary" onClick={() => void exportMemberStatement(member)} disabled={Boolean(busy)}>
                          <FileText className="h-4 w-4" /> Relevé
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => resetPassword(member)} disabled={Boolean(busy)}>
                          <KeyRound className="h-4 w-4" /> Mot de passe
                        </Button>
                      </div>
                      <Button size="sm" variant="danger" block onClick={() => deleteMember(member)} disabled={Boolean(busy)}>
                        <Trash2 className="h-4 w-4" /> Supprimer le membre
                      </Button>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
              {members.length ? "Aucun membre ne correspond à cette recherche." : "Aucun membre inscrit. Partagez le lien d’inscription pour commencer."}
            </p>
          )}
        </Panel>

        <div className="space-y-5">
          <Panel title="Enregistrer un paiement reçu" description="Pour un versement en espèces ou hors SasPay.">
            <form onSubmit={onPaymentSubmit} className="space-y-3">
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-ink">Membre</span>
                <select name="memberId" required disabled={!members.length || busy === "payment"} className="field">
                  <option value="">Choisir un membre</option>
                  {members.map((member) => <option key={member.id} value={member.id}>{member.firstName} {member.lastName}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="mb-1.5 block font-medium text-ink">Montant (FCFA)</span>
                  <input name="amount" type="number" inputMode="numeric" min="1" step="1" required disabled={busy === "payment"} className="field tabular" />
                </label>
                <label className="block text-sm">
                  <span className="mb-1.5 block font-medium text-ink">Moyen</span>
                  <select name="method" required disabled={busy === "payment"} className="field">
                    <option value="CASH">Espèces</option>
                    <option value="MOBILE MONEY">Mobile Money</option>
                    <option value="BANK TRANSFER">Virement</option>
                  </select>
                </label>
              </div>
              <Button type="submit" block disabled={!members.length || busy === "payment"}>
                {busy === "payment" ? "Enregistrement..." : "Enregistrer le paiement"}
              </Button>
            </form>
          </Panel>

          <Panel title="Tarifs" description="S’appliquent dès aujourd’hui, sans effet sur les jours passés.">
            <form onSubmit={onSettingsSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="mb-1.5 block font-medium text-ink">Cotisation / jour</span>
                  <input
                    type="number" inputMode="numeric" min="1" max="1000000000" step="1" required
                    value={settings.dailyContribution}
                    onChange={(event) => setSettings((current) => ({ ...current, dailyContribution: event.target.value }))}
                    disabled={busy === "settings"}
                    className="field tabular"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1.5 block font-medium text-ink">Pénalité / jour</span>
                  <input
                    type="number" inputMode="numeric" min="0" max="1000000000" step="1" required
                    value={settings.dailyLatePenalty}
                    onChange={(event) => setSettings((current) => ({ ...current, dailyLatePenalty: event.target.value }))}
                    disabled={busy === "settings"}
                    className="field tabular"
                  />
                </label>
              </div>
              <Button type="submit" variant="secondary" block disabled={busy === "settings"}>
                {busy === "settings" ? "Enregistrement..." : "Enregistrer les tarifs"}
              </Button>
            </form>
          </Panel>

          <Panel title="Paiements récents">
            {transactions.length ? (
              <ul className="divide-y divide-line">
                {transactions.map((transaction) => (
                  <li key={transaction.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <IconChip icon={HandCoins} tone="ok" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink">{transaction.memberName}</p>
                      <p className="text-xs text-muted">{transactionTypeLabel(transaction.type)}, {paymentMethodLabel(transaction.method)}, {formatDateTime(transaction.createdAt)}</p>
                    </div>
                    <p className="shrink-0 font-display font-semibold text-ink tabular">{formatCurrency(transaction.amount)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Aucun paiement confirmé pour l’instant.</p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
