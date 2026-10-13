"use client";

import { CalendarClock, Download, FileText, History, Minus, PieChart, Plus, ShieldAlert, WalletCards } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { ContributionRing, type RingDayState } from "@/components/brand/contribution-ring";
import { Stat } from "@/components/dashboard/stat-card";
import { TransactionList } from "@/components/dashboard/transaction-list";
import { AppShell, useSessionUser } from "@/components/layout/app-shell";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { IconChip } from "@/components/ui/icon-chip";
import { Notice } from "@/components/ui/notice";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/formatters";
import {
  downloadGlobalReport,
  downloadMemberStatement,
  downloadPaymentReceipt,
  type GlobalReport,
  type MemberStatement,
  type PaymentReceipt,
} from "@/lib/pdf-export";

type Overview = {
  member: {
    firstName: string;
    dailyContribution: number;
    dailyLatePenalty: number;
    totalPaid: number;
    outstandingDebt: number;
    penaltyDebt: number;
    unpaidDays: number;
    coveredUntil: string | null;
  };
  transactions: { id: string; amount: number; type: string; method: string; status: string; createdAt: string }[];
  pendingPayments: { id: string; amount: number; purpose: "CONTRIBUTION" | "ARREARS"; contributionDays: number; createdAt: string }[];
  calendar: { date: string; state: RingDayState }[];
};

type Verification = {
  status: string;
  purpose?: "CONTRIBUTION" | "ARREARS";
  contributionDays: number;
  coveredDays: number;
  appliedToDebt: number;
  appliedToContributions: number;
  outstandingDebt: number;
  receipt?: PaymentReceipt;
};

const PENDING_KEY = "maryx-pending-payment";
const QUICK_DAYS = [1, 7, 30];

function readSession(key: string) {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSession(key: string, value: string | null) {
  try {
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, value);
  } catch {
    // Stockage indisponible : la liste des paiements en attente du serveur prend le relais.
  }
}

async function requestOverview(): Promise<Overview> {
  const response = await fetch("/api/member/overview", { cache: "no-store" });
  const result = await response.json() as {
    error?: string;
    member?: {
      first_name: string;
      daily_contribution: number;
      daily_late_penalty: number;
      total_paid: number;
      outstanding_debt: number;
      penalty_debt: number;
      unpaid_days: number;
      covered_until: string | null;
    };
    transactions?: Overview["transactions"];
    pendingPayments?: Overview["pendingPayments"];
    calendar?: Overview["calendar"];
  };
  if (!response.ok || !result.member) throw new Error(result.error ?? "Impossible de charger votre solde.");
  return {
    member: {
      firstName: result.member.first_name,
      dailyContribution: result.member.daily_contribution,
      dailyLatePenalty: result.member.daily_late_penalty,
      totalPaid: result.member.total_paid,
      outstandingDebt: result.member.outstanding_debt,
      penaltyDebt: result.member.penalty_debt,
      unpaidDays: result.member.unpaid_days,
      coveredUntil: result.member.covered_until,
    },
    transactions: result.transactions ?? [],
    pendingPayments: result.pendingPayments ?? [],
    calendar: result.calendar ?? [],
  };
}

async function requestVerification(attemptId: string): Promise<Verification> {
  const response = await fetch("/api/payments/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ attemptId }),
  });
  const result = await response.json() as Partial<Verification> & { error?: string };
  if (!response.ok) throw new Error(result.error ?? "La vérification du paiement a échoué.");
  return {
    status: result.status ?? "PENDING",
    purpose: result.purpose,
    contributionDays: result.contributionDays ?? 1,
    coveredDays: result.coveredDays ?? 0,
    appliedToDebt: result.appliedToDebt ?? 0,
    appliedToContributions: result.appliedToContributions ?? 0,
    outstandingDebt: result.outstandingDebt ?? 0,
    receipt: result.receipt,
  };
}

function successMessage(verification: Verification) {
  if (verification.purpose === "ARREARS") {
    return `Paiement confirmé. ${formatCurrency(verification.appliedToDebt)} ont réglé vos impayés. Reste à payer : ${formatCurrency(verification.outstandingDebt)}.`;
  }
  const debtPart = verification.appliedToDebt > 0 ? ` ${formatCurrency(verification.appliedToDebt)} ont d’abord réglé vos impayés.` : "";
  return `Paiement confirmé.${debtPart} ${verification.coveredDays} jour(s) couverts sur ${verification.contributionDays}.`;
}

export default function DashboardPage() {
  return (
    <AppShell access="member">
      <MemberDashboard />
    </AppShell>
  );
}

function MemberDashboard() {
  const user = useSessionUser();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loadError, setLoadError] = useState("");
  const [days, setDays] = useState(1);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [verifyingId, setVerifyingId] = useState("");
  const [message, setMessage] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null);
  const [reportBusy, setReportBusy] = useState("");

  const refresh = useCallback(async () => {
    try {
      setOverview(await requestOverview());
      setLoadError("");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Le service est inaccessible. Réessayez plus tard.");
    }
  }, []);

  const verify = useCallback(async (attemptId: string) => {
    setVerifyingId(attemptId);
    setMessage(null);
    try {
      const verification = await requestVerification(attemptId);
      if (verification.status === "APPROVED") {
        setMessage({ tone: "success", text: successMessage(verification) });
        writeSession(PENDING_KEY, null);
        if (verification.receipt) {
          setReceipt(verification.receipt);
          const downloadKey = `maryx-receipt-downloaded:${verification.receipt.reference}`;
          if (readSession(downloadKey) !== "true") {
            writeSession(downloadKey, "true");
            void downloadPaymentReceipt(verification.receipt).catch(() => undefined);
          }
        }
      } else if (verification.status === "DECLINED" || verification.status === "CANCELED") {
        writeSession(PENDING_KEY, null);
        setMessage({ tone: "error", text: "Le paiement n’a pas abouti. Aucun montant n’a été débité par MARYX. Vous pouvez réessayer." });
      } else {
        setMessage({ tone: "info", text: "Le paiement est encore en attente chez SasPay. Vérifiez à nouveau dans quelques minutes." });
      }
      await refresh();
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "La vérification du paiement a échoué." });
    } finally {
      setVerifyingId("");
    }
  }, [refresh]);

  useEffect(() => {
    const returnedId = new URLSearchParams(window.location.search).get("payment") ?? "";
    const timeout = window.setTimeout(() => {
      if (/^[0-9a-f-]{36}$/i.test(returnedId)) {
        window.history.replaceState(null, "", "/dashboard");
        void verify(returnedId);
      } else {
        void refresh();
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [refresh, verify]);

  async function startPayment(purpose: "CONTRIBUTION" | "ARREARS") {
    setMessage(null);
    setPaymentBusy(true);
    try {
      const response = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose, days: purpose === "CONTRIBUTION" ? days : 0 }),
      });
      const result = await response.json() as { error?: string; attemptId?: string; checkoutUrl?: string };
      if (!response.ok || !result.attemptId || !result.checkoutUrl) {
        setMessage({ tone: "error", text: result.error ?? "Impossible de démarrer le paiement." });
        setPaymentBusy(false);
        return;
      }
      writeSession(PENDING_KEY, result.attemptId);
      window.location.assign(result.checkoutUrl);
    } catch {
      setMessage({ tone: "error", text: "Le service de paiement ne répond pas. Vérifiez votre connexion." });
      setPaymentBusy(false);
    }
  }

  async function downloadReport(scope: "member" | "global") {
    setReportBusy(scope);
    try {
      const response = await fetch(`/api/reports?scope=${scope}`, { cache: "no-store" });
      const result = await response.json() as (MemberStatement & GlobalReport) & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Le relevé n’a pas pu être généré.");
      if (scope === "member") await downloadMemberStatement(result);
      else await downloadGlobalReport(result);
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Le relevé n’a pas pu être téléchargé." });
    } finally {
      setReportBusy("");
    }
  }

  if (loadError && !overview) {
    return <Notice tone="error" action={<Button size="sm" variant="secondary" onClick={() => void refresh()}>Réessayer</Button>}>{loadError}</Notice>;
  }
  if (!overview) {
    return <p className="py-16 text-center text-muted" aria-busy="true">Chargement de votre solde...</p>;
  }

  const { member, transactions, pendingPayments, calendar } = overview;
  const inDebt = member.outstandingDebt > 0;
  const paidDays = calendar.filter((day) => day.state === "paid").length;
  const amount = member.dailyContribution * days;

  return (
    <div className="space-y-5">
      {message ? (
        <Notice
          tone={message.tone}
          action={message.tone === "success" && receipt ? (
            <Button size="sm" variant="secondary" onClick={() => void downloadPaymentReceipt(receipt).catch(() => setMessage({ tone: "error", text: "Le reçu n’a pas pu être téléchargé." }))}>
              <Download className="h-4 w-4" /> Reçu PDF
            </Button>
          ) : undefined}
        >
          {message.text}
        </Notice>
      ) : null}

      <section className="brand-card overflow-hidden p-5 sm:p-7" aria-label="Mon solde">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 pt-1">
            <div className="flex items-center gap-3">
              <Avatar src={user.avatarUrl} firstName={user.firstName} lastName={user.lastName} size="lg" className="ring-2 ring-white/25" />
              <div className="min-w-0">
                <p className="brand-muted text-xs">Bonjour</p>
                <p className="truncate font-display text-lg font-semibold">{user.firstName} {user.lastName}</p>
              </div>
            </div>
            <p className="mt-5 text-sm brand-muted">{inDebt ? "Reste à régler" : "Votre situation"}</p>
            <p className="mt-1 font-display text-[2.4rem] leading-none font-bold tabular sm:text-5xl">
              {inDebt ? member.outstandingDebt.toLocaleString("fr-FR") : "À jour"}
              {inDebt ? <span className="ml-1.5 text-base font-semibold brand-muted">FCFA</span> : null}
            </p>
            <p className="mt-2.5 text-sm brand-muted">
              {inDebt
                ? `${member.unpaidDays} jour(s) impayé(s)${member.penaltyDebt ? `, dont ${formatCurrency(member.penaltyDebt)} de pénalités` : ""}.`
                : member.coveredUntil ? `Réglé jusqu’au ${formatDate(member.coveredUntil)}.` : "Pensez à la cotisation du jour."}
            </p>
          </div>
          <ContributionRing
            days={calendar.map((day) => ({ state: day.state, label: formatDate(day.date) }))}
            title={`${paidDays} jours cotisés sur les 14 derniers`}
            className="w-28 shrink-0 sm:w-36"
          >
            <span className="font-display text-xl font-bold tabular sm:text-2xl">{paidDays}<span className="brand-muted text-sm">/14</span></span>
            <span className="text-[10px] brand-muted">jours</span>
          </ContributionRing>
        </div>
        <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
          {inDebt ? (
            <button
              type="button"
              onClick={() => void startPayment("ARREARS")}
              disabled={paymentBusy}
              className="min-h-12 rounded-full bg-white px-5 font-semibold text-maryx-blue transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {paymentBusy ? "Redirection vers SasPay..." : `Régulariser ${formatCurrency(member.outstandingDebt)}`}
            </button>
          ) : null}
          <a
            href="#payer"
            className={`flex min-h-12 items-center justify-center rounded-full px-5 font-semibold transition-colors ${inDebt ? "border border-white/25 text-white hover:bg-white/10" : "bg-white text-maryx-blue hover:opacity-90"}`}
          >
            Payer des jours
          </a>
        </div>
      </section>

      <nav aria-label="Actions rapides" className="grid grid-cols-3 gap-2">
        {[
          { label: "Mon relevé", icon: FileText, onClick: () => void downloadReport("member"), busy: reportBusy === "member" },
          { label: "Synthèse", icon: PieChart, onClick: () => void downloadReport("global"), busy: reportBusy === "global" },
          { label: "Historique", icon: History, href: "/history" },
        ].map((action) => {
          const content = (
            <>
              <IconChip icon={action.icon} className="h-12 w-12 rounded-2xl" />
              <span className="text-xs font-medium text-ink">{action.busy ? "..." : action.label}</span>
            </>
          );
          return action.href ? (
            <Link key={action.label} href={action.href} className="flex flex-col items-center gap-2 rounded-2xl py-2 hover:bg-surface-2">{content}</Link>
          ) : (
            <button key={action.label} type="button" onClick={action.onClick} disabled={Boolean(reportBusy)} className="flex flex-col items-center gap-2 rounded-2xl py-2 hover:bg-surface-2 disabled:opacity-60">{content}</button>
          );
        })}
      </nav>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]" id="payer">
        <Panel title="Payer mes cotisations" description={`${formatCurrency(member.dailyContribution)} par jour. Les impayés sont réglés en premier.`}>
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-line-strong p-2">
            <button
              type="button"
              aria-label="Retirer un jour"
              onClick={() => setDays((value) => Math.max(1, value - 1))}
              disabled={days <= 1 || paymentBusy}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-ink disabled:opacity-40"
            >
              <Minus className="h-4 w-4" />
            </button>
            <label className="flex-1 text-center">
              <span className="sr-only">Nombre de jours à payer</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={365}
                value={days}
                onChange={(event) => setDays(Math.min(365, Math.max(1, Math.trunc(Number(event.target.value)) || 1)))}
                disabled={paymentBusy}
                className="w-full bg-transparent text-center font-display text-3xl font-bold text-ink tabular outline-none"
              />
              <span className="block text-xs text-muted">{days > 1 ? "jours" : "jour"}</span>
            </label>
            <button
              type="button"
              aria-label="Ajouter un jour"
              onClick={() => setDays((value) => Math.min(365, value + 1))}
              disabled={days >= 365 || paymentBusy}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-ink disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex gap-2">
            {QUICK_DAYS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setDays(value)}
                aria-pressed={days === value}
                className={`flex-1 rounded-full border py-2 text-sm font-medium ${days === value ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:text-ink"}`}
              >
                {value === 1 ? "1 jour" : `${value} jours`}
              </button>
            ))}
          </div>
          <Button block className="mt-4" onClick={() => void startPayment("CONTRIBUTION")} disabled={paymentBusy}>
            {paymentBusy ? "Redirection vers SasPay..." : `Payer ${formatCurrency(amount)}`}
          </Button>
          {inDebt ? (
            <p className="mt-2 text-xs text-muted">
              {amount <= member.outstandingDebt ? "Ce montant servira entièrement à réduire vos impayés." : `${formatCurrency(member.outstandingDebt)} iront d’abord à vos impayés, le reste à vos jours.`}
            </p>
          ) : null}
        </Panel>
      </div>

      {pendingPayments.length ? (
        <Panel title="Paiements en attente" description="Si vous avez payé sur SasPay, vérifiez pour créditer votre compte.">
          <ul className="divide-y divide-line">
            {pendingPayments.map((payment) => (
              <li key={payment.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="font-medium text-ink tabular">{formatCurrency(payment.amount)}</p>
                  <p className="text-xs text-muted">
                    {payment.purpose === "ARREARS" ? "Régularisation" : `${payment.contributionDays} jour(s)`}, {formatDateTime(payment.createdAt)}
                  </p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => void verify(payment.id)} disabled={Boolean(verifyingId)}>
                  {verifyingId === payment.id ? "Vérification..." : "Vérifier"}
                </Button>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={WalletCards} label="Total versé" value={formatCurrency(member.totalPaid)} />
        <Stat icon={CalendarClock} label="Jours impayés" value={String(member.unpaidDays)} tone={member.unpaidDays ? "bad" : "ok"} />
        <Stat icon={ShieldAlert} label="Pénalités dues" value={formatCurrency(member.penaltyDebt)} tone={member.penaltyDebt ? "warn" : "default"} detail={`${formatCurrency(member.dailyLatePenalty)} par jour de retard`} />
        <Stat icon={CalendarClock} label="Couvert jusqu’au" value={member.coveredUntil ? formatDate(member.coveredUntil) : "Non"} detail="Jours payés d’avance" />
      </div>

      <Panel
        title="Dernières transactions"
        action={transactions.length ? <Link href="/history" className="text-sm font-medium text-accent hover:underline">Tout voir</Link> : undefined}
      >
        <TransactionList items={transactions} empty="Aucune transaction pour le moment. Votre premier paiement apparaîtra ici." />
      </Panel>
    </div>
  );
}
