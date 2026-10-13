"use client";

import { Activity, CreditCard, Download, FileText, Landmark, Trash2, TrendingUp, Users } from "lucide-react";
import { useEffect, useState } from "react";

import { Header } from "@/components/layout/header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { downloadGlobalReport, downloadMemberStatement, type GlobalReport, type MemberStatement } from "@/lib/pdf-export";

type AdminMember = {
  id: string;
  firstName: string;
  lastName: string;
  dailyContribution: number;
  penaltyDebt: number;
  totalPaid: number;
  outstandingDebt: number;
  unpaidDays: number;
  status: "ACTIVE" | "INACTIVE" | "ON_HOLD";
};

type AdminTransaction = {
  id: string;
  memberName: string;
  amount: number;
  method: string;
  createdAt: string;
};

export default function AdminPage() {
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [paymentSuccess, setPaymentSuccess] = useState("");
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [dailyContribution, setDailyContribution] = useState("50");
  const [dailyLatePenalty, setDailyLatePenalty] = useState("25");
  const [settingsError, setSettingsError] = useState("");
  const [settingsSuccess, setSettingsSuccess] = useState("");
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [memberActionBusy, setMemberActionBusy] = useState("");
  const [reportBusy, setReportBusy] = useState("");
  const [reportError, setReportError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadOverview() {
      try {
        const response = await fetch("/api/admin/overview", { cache: "no-store" });
        const result = await response.json() as { error?: string; dailyContribution?: number; dailyLatePenalty?: number; members?: AdminMember[]; transactions?: AdminTransaction[] };
        if (!response.ok) {
          if (active) setError(result.error ?? "Impossible de charger les données administratives.");
          return;
        }
        if (!active) return;
        setError("");
        setDailyContribution(String(result.dailyContribution ?? 50));
        setDailyLatePenalty(String(result.dailyLatePenalty ?? 25));
        setMembers(result.members ?? []);
        setTransactions(result.transactions ?? []);
      } catch {
        if (active) setError("Le service de données est inaccessible. Réessayez plus tard.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadOverview();
    const interval = window.setInterval(() => void loadOverview(), 20_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const totalCollected = members.reduce((sum, member) => sum + member.totalPaid, 0);
  const totalOutstanding = members.reduce((sum, member) => sum + member.outstandingDebt, 0);
  const membersUpToDate = members.filter((member) => member.unpaidDays === 0).length;
  const membersLate = members.filter((member) => member.unpaidDays > 0).length;

  async function exportGlobalReport() {
    setReportError("");
    setReportBusy("global");
    try {
      const response = await fetch("/api/reports?scope=global", { cache: "no-store" });
      const result = await response.json() as GlobalReport & { error?: string };
      if (!response.ok) {
        setReportError(result.error ?? "Le relevé global n’a pas pu être généré.");
        return;
      }
      await downloadGlobalReport(result);
    } catch {
      setReportError("Le relevé global n’a pas pu être téléchargé. Réessayez.");
    } finally {
      setReportBusy("");
    }
  }

  async function exportMemberStatement(memberId: string) {
    setReportError("");
    setReportBusy(memberId);
    try {
      const response = await fetch(`/api/reports?scope=member&memberId=${encodeURIComponent(memberId)}`, { cache: "no-store" });
      const result = await response.json() as MemberStatement & { error?: string };
      if (!response.ok) {
        setReportError(result.error ?? "Le relevé du membre n’a pas pu être généré.");
        return;
      }
      await downloadMemberStatement(result);
    } catch {
      setReportError("Le relevé du membre n’a pas pu être téléchargé. Réessayez.");
    } finally {
      setReportBusy("");
    }
  }

  async function onContributionSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSettingsError("");
    setSettingsSuccess("");
    setSettingsBusy(true);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyContribution: Number(dailyContribution), dailyLatePenalty: Number(dailyLatePenalty) }),
      });
      const result = await response.json() as { error?: string; dailyContribution?: number; dailyLatePenalty?: number };
      if (!response.ok || !result.dailyContribution) {
        setSettingsError(result.error ?? "Le montant n’a pas pu être enregistré.");
        return;
      }
      setDailyContribution(String(result.dailyContribution));
      setDailyLatePenalty(String(result.dailyLatePenalty ?? dailyLatePenalty));
      setMembers((current) => current.map((member) => ({ ...member, dailyContribution: result.dailyContribution! })));
      setSettingsSuccess("Le montant de cotisation a été mis à jour.");
    } catch {
      setSettingsError("Le service de données est inaccessible. Réessayez.");
    } finally {
      setSettingsBusy(false);
    }
  }

  async function updateMemberStatus(memberId: string, status: AdminMember["status"]) {
    setError("");
    try {
      const response = await fetch("/api/admin/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, status }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Le statut n’a pas pu être modifié.");
        return;
      }
      setMembers((current) => current.map((member) => member.id === memberId ? { ...member, status } : member));
    } catch {
      setError("Le service de données est inaccessible. Réessayez.");
    }
  }

  async function deleteMember(member: AdminMember) {
    const fullName = `${member.firstName} ${member.lastName}`;
    if (!window.confirm(`Supprimer définitivement le compte de ${fullName} et son historique de paiements ?`)) return;

    setMemberActionBusy(member.id);
    setError("");
    try {
      const response = await fetch("/api/admin/members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: member.id }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Le compte membre n’a pas pu être supprimé.");
        return;
      }
      setMembers((current) => current.filter((item) => item.id !== member.id));
      setTransactions((current) => current.filter((transaction) => transaction.memberName !== fullName));
    } catch {
      setError("Le service de données est inaccessible. Réessayez.");
    } finally {
      setMemberActionBusy("");
    }
  }

  async function onPaymentSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const memberId = String(formData.get("memberId") ?? "");
    const amount = Number(formData.get("amount"));
    const method = String(formData.get("method") ?? "");
    setPaymentError("");
    setPaymentSuccess("");
    setPaymentBusy(true);

    try {
      const response = await fetch("/api/admin/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, amount, method }),
      });
      const result = await response.json() as {
        error?: string;
        transaction?: AdminTransaction & { memberId: string };
      };
      const transaction = result.transaction;
      if (!response.ok || !transaction) {
        setPaymentError(result.error ?? "Le paiement n’a pas pu être enregistré.");
        return;
      }

      setMembers((current) => current.map((member) => member.id === transaction.memberId
        ? {
            ...member,
            totalPaid: member.totalPaid + transaction.amount,
            outstandingDebt: Math.max(0, member.outstandingDebt - transaction.amount),
            unpaidDays: member.outstandingDebt <= transaction.amount ? 0 : member.unpaidDays,
          }
        : member));
      setTransactions((current) => [transaction, ...current].slice(0, 10));
      setPaymentSuccess(`Paiement confirmé (${formatCurrency(transaction.amount)}).`);
      form.reset();
    } catch {
      setPaymentError("Le service de données est inaccessible. Réessayez.");
    } finally {
      setPaymentBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <Header />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">Administration</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Tableau de bord administrateur</h1>
          </div>
          <Button variant="primary" className="gap-2" onClick={() => void exportGlobalReport()} disabled={loading || Boolean(error) || Boolean(reportBusy)}>
            <Download className="h-4 w-4" /> {reportBusy === "global" ? "Préparation..." : "Relevé global"}
          </Button>
        </div>

        {error ? <p role="alert" className="mb-5 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-red-200">{error}</p> : null}
        {reportError ? <p role="alert" className="mb-5 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-red-200">{reportError}</p> : null}
        {loading ? <p className="mb-5 text-slate-400">Chargement des données...</p> : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Membres" value={String(members.length)} detail="Dossiers enregistrés" accent="cyan" icon={<Users className="h-5 w-5 text-cyan-300" />} />
          <StatCard label="Collecté" value={formatCurrency(totalCollected)} detail="Transactions confirmées" accent="emerald" icon={<TrendingUp className="h-5 w-5 text-emerald-300" />} />
          <StatCard label="À récupérer" value={formatCurrency(totalOutstanding)} detail="Cotisations non réglées" accent="amber" icon={<Landmark className="h-5 w-5 text-amber-300" />} />
          <StatCard label="À jour" value={String(membersUpToDate)} detail="Selon les cotisations enregistrées" accent="emerald" icon={<Activity className="h-5 w-5 text-emerald-300" />} />
          <StatCard label="En retard" value={String(membersLate)} detail="Selon les cotisations enregistrées" accent="rose" icon={<CreditCard className="h-5 w-5 text-rose-300" />} />
        </section>

        <section className="mt-8 rounded-2xl border border-white/10 bg-slate-900/70 p-5">
          <h2 className="text-xl font-semibold text-white">Montant de la cotisation journalière</h2>
          <p className="mt-1 text-sm text-slate-400">La nouvelle valeur sera affichée dans le tableau de bord de chaque membre.</p>
          <form onSubmit={onContributionSubmit} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="space-y-2 text-sm text-slate-300">
              <span>Montant en FCFA</span>
              <input
                name="dailyContribution"
                type="number"
                min="1"
                max="1000000000"
                step="1"
                required
                value={dailyContribution}
                onChange={(event) => setDailyContribution(event.target.value)}
                disabled={settingsBusy}
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-slate-100 sm:w-56"
              />
            </label>
            <label className="space-y-2 text-sm text-slate-300">
              <span>Pénalité par jour de retard (FCFA)</span>
              <input
                name="dailyLatePenalty"
                type="number"
                min="0"
                max="1000000000"
                step="1"
                required
                value={dailyLatePenalty}
                onChange={(event) => setDailyLatePenalty(event.target.value)}
                disabled={settingsBusy}
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-slate-100 sm:w-56"
              />
            </label>
            <Button variant="primary" type="submit" disabled={settingsBusy}>
              {settingsBusy ? "Enregistrement..." : "Enregistrer le montant"}
            </Button>
          </form>
          {settingsError ? <p role="alert" className="mt-3 text-sm text-red-300">{settingsError}</p> : null}
          {settingsSuccess ? <p role="status" className="mt-3 text-sm text-emerald-300">{settingsSuccess}</p> : null}
        </section>

        <section className="mt-8 rounded-2xl border border-white/10 bg-slate-900/70 p-5">
          <h2 className="text-xl font-semibold text-white">Enregistrer un paiement reçu</h2>
          <p className="mt-1 text-sm text-slate-400">Cette saisie confirme un paiement déjà reçu. Elle ne déclenche pas un paiement mobile.</p>
          <form onSubmit={onPaymentSubmit} className="mt-4 grid gap-4 md:grid-cols-4">
            <label className="space-y-2 text-sm text-slate-300">
              <span>Membre</span>
              <select name="memberId" required disabled={!members.length || paymentBusy} className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-slate-100">
                <option value="">Sélectionner</option>
                {members.map((member) => <option key={member.id} value={member.id}>{member.firstName} {member.lastName}</option>)}
              </select>
            </label>
            <label className="space-y-2 text-sm text-slate-300">
              <span>Montant (FCFA)</span>
              <input name="amount" type="number" min="1" step="1" required disabled={paymentBusy} className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-slate-100" />
            </label>
            <label className="space-y-2 text-sm text-slate-300">
              <span>Mode de réception</span>
              <select name="method" required disabled={paymentBusy} className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-slate-100">
                <option value="CASH">Espèces</option>
                <option value="MOBILE MONEY">Mobile Money</option>
                <option value="BANK TRANSFER">Virement bancaire</option>
              </select>
            </label>
            <div className="flex items-end">
              <Button className="w-full" variant="primary" type="submit" disabled={!members.length || paymentBusy}>
                {paymentBusy ? "Enregistrement..." : "Confirmer le paiement"}
              </Button>
            </div>
          </form>
          {paymentError ? <p role="alert" className="mt-3 text-sm text-red-300">{paymentError}</p> : null}
          {paymentSuccess ? <p role="status" className="mt-3 text-sm text-emerald-300">{paymentSuccess}</p> : null}
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Membres</h2>
              <Badge tone="info">Cotisation : {formatCurrency(Number(dailyContribution))} / jour</Badge>
            </div>
            <Table
              headers={["Membre", "Versé", "Retard", "Dette", "Pénalités", "Statut", "Relevé / actions"]}
              rows={members.map((member) => [
                `${member.firstName} ${member.lastName}`,
                formatCurrency(member.totalPaid),
                <Badge key={`${member.id}-late`} tone={member.unpaidDays > 0 ? "warning" : "success"}>{member.unpaidDays} j</Badge>,
                formatCurrency(member.outstandingDebt),
                formatCurrency(member.penaltyDebt),
                <select
                  key={`${member.id}-status`}
                  aria-label={`Statut de ${member.firstName} ${member.lastName}`}
                  value={member.status}
                  onChange={(event) => void updateMemberStatus(member.id, event.target.value as AdminMember["status"])}
                  className="rounded-lg border border-white/10 bg-slate-950 px-2 py-1 text-xs text-slate-100"
                >
                  <option value="ACTIVE">Actif</option>
                  <option value="INACTIVE">Inactif</option>
                  <option value="ON_HOLD">En pause</option>
                </select>,
                <div key={`${member.id}-actions`} className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label={`Télécharger le relevé de ${member.firstName} ${member.lastName}`}
                    title="Télécharger le relevé individuel"
                    disabled={Boolean(reportBusy)}
                    onClick={() => void exportMemberStatement(member.id)}
                    className="rounded-md border border-cyan-400/20 bg-cyan-400/10 p-2 text-cyan-100 hover:bg-cyan-400/20 disabled:opacity-50"
                  >
                    <FileText className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Supprimer ${member.firstName} ${member.lastName}`}
                    title="Supprimer le compte membre"
                    disabled={memberActionBusy === member.id}
                    onClick={() => void deleteMember(member)}
                    className="rounded-md border border-rose-400/20 bg-rose-400/10 p-2 text-rose-200 hover:bg-rose-400/20 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>,
              ])}
            />
            {!members.length && !loading ? <p className="mt-4 text-sm text-slate-400">Aucun membre n’est enregistré.</p> : null}
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
            <h2 className="text-xl font-semibold text-white">Paiements récents</h2>
            <div className="mt-4 space-y-3">
              {transactions.map((transaction) => (
                <div key={transaction.id} className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">{transaction.memberName}</p>
                      <p className="text-xs text-slate-400">{formatDate(transaction.createdAt)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-cyan-200">{formatCurrency(transaction.amount)}</p>
                      <p className="text-xs text-slate-400">{transaction.method}</p>
                    </div>
                  </div>
                </div>
              ))}
              {!transactions.length && !loading ? <p className="text-sm text-slate-400">Aucun paiement enregistré.</p> : null}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
