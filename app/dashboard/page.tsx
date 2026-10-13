"use client";

import { AlertTriangle, Download, Landmark, TrendingUp } from "lucide-react";
import { startTransition, useEffect, useState } from "react";

import { Header } from "@/components/layout/header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/formatters";
import {
  downloadGlobalReport,
  downloadMemberStatement,
  downloadPaymentReceipt,
  type GlobalReport,
  type MemberStatement,
  type PaymentReceipt,
} from "@/lib/pdf-export";

type MemberPortalMember = {
  id: string;
  firstName: string;
  dailyContribution: number;
  totalPaid: number;
  outstandingDebt: number;
  penaltyDebt: number;
  unpaidDays: number;
  lastActivity: string | null;
};

type MemberPortalTransaction = {
  id: string;
  amount: number;
  type: string;
  status: string;
  createdAt: string;
};

async function requestMemberOverview() {
  const response = await fetch("/api/member/overview", { cache: "no-store" });
  const result = await response.json() as {
    error?: string;
    member?: {
      id: string;
      first_name: string;
      daily_contribution: number;
      total_paid: number;
      outstanding_debt: number;
      penalty_debt: number;
      unpaid_days: number;
      last_activity: string | null;
    };
    transactions?: MemberPortalTransaction[];
  };
  if (!response.ok || !result.member) throw new Error(result.error ?? "Impossible de charger votre tableau de bord.");
  return {
    member: {
      id: result.member.id,
      firstName: result.member.first_name,
      dailyContribution: result.member.daily_contribution,
      totalPaid: result.member.total_paid,
      outstandingDebt: result.member.outstanding_debt,
      penaltyDebt: result.member.penalty_debt,
      unpaidDays: result.member.unpaid_days,
      lastActivity: result.member.last_activity,
    },
    transactions: result.transactions ?? [],
  };
}

async function requestPaymentVerification(attemptId: string) {
  const response = await fetch("/api/payments/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ attemptId }),
  });
  const result = await response.json() as {
    error?: string;
    status?: string;
    purpose?: "CONTRIBUTION" | "ARREARS";
    contributionDays?: number;
    coveredDays?: number;
    appliedToDebt?: number;
    appliedToContributions?: number;
    outstandingDebt?: number;
    receipt?: PaymentReceipt;
  };
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

function paymentSuccessMessage(verification: Awaited<ReturnType<typeof requestPaymentVerification>>) {
  if (verification.purpose === "ARREARS") {
    return `Régularisation confirmée : ${formatCurrency(verification.appliedToDebt)} affectés aux impayés. Solde restant : ${formatCurrency(verification.outstandingDebt)}.`;
  }
  return `Paiement confirmé : ${formatCurrency(verification.appliedToDebt)} affectés aux impayés et ${verification.coveredDays}/${verification.contributionDays} jour(s) intégralement couverts. Solde restant : ${formatCurrency(verification.outstandingDebt)}.`;
}

export default function DashboardPage() {
  const [member, setMember] = useState<MemberPortalMember | null>(null);
  const [transactions, setTransactions] = useState<MemberPortalTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [paymentMessage, setPaymentMessage] = useState("");
  const [paymentReceipt, setPaymentReceipt] = useState<PaymentReceipt | null>(null);
  const [receiptError, setReceiptError] = useState("");
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [pendingAttemptId, setPendingAttemptId] = useState("");
  const [reportBusy, setReportBusy] = useState("");
  const [reportError, setReportError] = useState("");

  useEffect(() => {
    if (!paymentMessage && !paymentError && !receiptError) return;
    const timeout = window.setTimeout(() => {
      setPaymentMessage("");
      setPaymentError("");
      setReceiptError("");
    }, 10_000);
    return () => window.clearTimeout(timeout);
  }, [paymentMessage, paymentError, receiptError]);

  useEffect(() => {
    let active = true;
    const returnedAttemptId = new URLSearchParams(window.location.search).get("payment") ?? "";
    const storedAttemptId = window.sessionStorage.getItem("maryx-pending-payment") ?? "";
    const attemptId = returnedAttemptId || storedAttemptId;

    if (/^[0-9a-f-]{36}$/i.test(attemptId)) {
      startTransition(() => {
        setPendingAttemptId(attemptId);
        if (returnedAttemptId) setVerifyBusy(true);
      });
      if (returnedAttemptId) {
        window.history.replaceState(null, "", "/dashboard");
        void requestPaymentVerification(attemptId)
          .then((verification) => {
            if (!active) return;
            if (verification.status === "APPROVED") {
              setPaymentMessage(paymentSuccessMessage(verification));
              if (verification.receipt) {
                setPaymentReceipt(verification.receipt);
                const downloadKey = `maryx-receipt-downloaded:${verification.receipt.reference}`;
                if (window.sessionStorage.getItem(downloadKey) !== "true") {
                  window.sessionStorage.setItem(downloadKey, "true");
                  void downloadPaymentReceipt(verification.receipt).catch(() => {
                    if (active) setReceiptError("Le paiement est confirmé, mais le reçu automatique n’a pas pu être téléchargé. Utilisez le bouton de téléchargement.");
                  });
                }
              }
              window.sessionStorage.removeItem("maryx-pending-payment");
              setPendingAttemptId("");
              void requestMemberOverview().then((overview) => {
                if (!active) return;
                setMember(overview.member);
                setTransactions(overview.transactions);
              }).catch(() => {
                if (active) setPaymentError("Le paiement est confirmé, mais le tableau de bord n’a pas pu être actualisé.");
              });
            } else if (verification.status === "DECLINED" || verification.status === "CANCELED") {
              setPaymentMessage("Le paiement n’a pas été confirmé. Vous pouvez réessayer.");
              window.sessionStorage.removeItem("maryx-pending-payment");
              setPendingAttemptId("");
            } else {
              setPaymentMessage("Le paiement est toujours en attente de confirmation.");
            }
          })
          .catch((verificationError: unknown) => {
            if (active) setPaymentError(verificationError instanceof Error ? verificationError.message : "La vérification du paiement a échoué.");
          })
          .finally(() => {
            if (active) setVerifyBusy(false);
          });
      }
    }

    void requestMemberOverview()
      .then((overview) => {
        if (!active) return;
        setMember(overview.member);
        setTransactions(overview.transactions);
      })
      .catch((overviewError: unknown) => {
        if (active) setError(overviewError instanceof Error ? overviewError.message : "Le service de données est inaccessible. Réessayez plus tard.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, []);

  async function startPayment(purpose: "CONTRIBUTION" | "ARREARS", days = 0) {
    setPaymentError("");
    setPaymentMessage("");
    setPaymentBusy(true);
    try {
      const response = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose, days }),
      });
      const result = await response.json() as { error?: string; attemptId?: string; checkoutUrl?: string };
      if (!response.ok || !result.attemptId || !result.checkoutUrl) {
        setPaymentError(result.error ?? "Impossible de démarrer le paiement.");
        return;
      }
      window.sessionStorage.setItem("maryx-pending-payment", result.attemptId);
      window.location.assign(result.checkoutUrl);
    } catch {
      setPaymentError("Le service de paiement est inaccessible. Réessayez.");
    } finally {
      setPaymentBusy(false);
    }
  }

  async function verifyPayment() {
    if (!pendingAttemptId) return;
    setPaymentError("");
    setVerifyBusy(true);
    try {
      const verification = await requestPaymentVerification(pendingAttemptId);
      if (verification.status === "APPROVED") {
        setPaymentMessage(paymentSuccessMessage(verification));
        if (verification.receipt) {
          setPaymentReceipt(verification.receipt);
          const downloadKey = `maryx-receipt-downloaded:${verification.receipt.reference}`;
          if (window.sessionStorage.getItem(downloadKey) !== "true") {
            window.sessionStorage.setItem(downloadKey, "true");
            void downloadPaymentReceipt(verification.receipt).catch(() => {
              setReceiptError("Le paiement est confirmé, mais le reçu automatique n’a pas pu être téléchargé. Utilisez le bouton de téléchargement.");
            });
          }
        }
        window.sessionStorage.removeItem("maryx-pending-payment");
        setPendingAttemptId("");
        const overview = await requestMemberOverview();
        setMember(overview.member);
        setTransactions(overview.transactions);
      } else if (verification.status === "DECLINED" || verification.status === "CANCELED") {
        setPaymentMessage("Le paiement n’a pas été confirmé. Vous pouvez réessayer.");
        window.sessionStorage.removeItem("maryx-pending-payment");
        setPendingAttemptId("");
      } else {
        setPaymentMessage("Le paiement est toujours en attente de confirmation.");
      }
    } catch (verificationError) {
      setPaymentError(verificationError instanceof Error ? verificationError.message : "La vérification du paiement a échoué.");
    } finally {
      setVerifyBusy(false);
    }
  }

  async function downloadReceipt() {
    if (!paymentReceipt) return;
    setReceiptError("");
    try {
      await downloadPaymentReceipt(paymentReceipt);
    } catch (error) {
      console.error("Payment receipt download failed", error instanceof Error ? error.message : "Unknown error");
      setReceiptError("Le reçu n’a pas pu être téléchargé. Vérifiez votre connexion et réessayez.");
    }
  }

  async function downloadReport(scope: "member" | "global") {
    setReportError("");
    setReportBusy(scope);
    try {
      const response = await fetch(`/api/reports?scope=${scope}`, { cache: "no-store" });
      if (scope === "member") {
        const result = await response.json() as MemberStatement & { error?: string };
        if (!response.ok) {
          setReportError(result.error ?? "Le relevé n’a pas pu être généré.");
          return;
        }
        await downloadMemberStatement(result);
      } else {
        const result = await response.json() as GlobalReport & { error?: string };
        if (!response.ok) {
          setReportError(result.error ?? "Le relevé n’a pas pu être généré.");
          return;
        }
        await downloadGlobalReport(result);
      }
    } catch {
      setReportError("Le relevé n’a pas pu être téléchargé. Réessayez.");
    } finally {
      setReportBusy("");
    }
  }

  const [contributionDays, setContributionDays] = useState("1");

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <Header />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">Tableau de bord</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">
              {member ? `Bonjour, ${member.firstName}` : "Mon espace"}
            </h1>
          </div>
          {member ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" className="gap-2" onClick={() => void downloadReport("member")} disabled={Boolean(reportBusy)}>
                <Download className="h-4 w-4" /> {reportBusy === "member" ? "Préparation..." : "Mon relevé"}
              </Button>
              <Button variant="primary" className="gap-2" onClick={() => void downloadReport("global")} disabled={Boolean(reportBusy)}>
                <Download className="h-4 w-4" /> {reportBusy === "global" ? "Préparation..." : "Relevé global"}
              </Button>
            </div>
          ) : null}
        </div>

        {error ? <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-red-200">{error}</p> : null}
        {reportError ? <p role="alert" className="mb-4 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-red-200">{reportError}</p> : null}
        {loading ? <p className="text-slate-400">Chargement des données...</p> : null}

        {member ? (
          <>
            <div className="mb-6">
              <Badge tone={member.unpaidDays > 0 || member.outstandingDebt > 0 ? "warning" : "success"}>
                {member.unpaidDays > 0 ? `${member.unpaidDays} jours en retard` : member.outstandingDebt > 0 ? "Solde à régulariser" : "Aucun jour impayé enregistré"}
              </Badge>
            </div>
            <section className="mb-5 flex flex-col gap-4 rounded-2xl border border-cyan-400/20 bg-cyan-500/5 p-5 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex-1">
                <h2 className="font-semibold text-white">Payer mes cotisations</h2>
                <p className="mt-1 text-sm text-slate-400">Cotisation par jour : {formatCurrency(member.dailyContribution)}</p>
                <label className="mt-4 block max-w-xs space-y-2 text-sm text-slate-300">
                  <span>Nombre de jours à payer</span>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    step="1"
                    value={contributionDays}
                    onChange={(event) => setContributionDays(event.target.value)}
                    disabled={paymentBusy}
                    className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-slate-100"
                  />
                </label>
                <p className="mt-2 text-sm text-cyan-100">Montant sélectionné : {formatCurrency(member.dailyContribution * Math.max(1, Number(contributionDays) || 1))}</p>
                <p className="mt-1 max-w-xl text-xs text-slate-400">Les paiements couvrent d’abord les impayés et pénalités. Si une partie sert à réduire une dette, la cotisation du jour peut rester à régler.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                {pendingAttemptId ? (
                  <Button variant="secondary" type="button" onClick={() => void verifyPayment()} disabled={verifyBusy}>
                    {verifyBusy ? "Vérification..." : "Vérifier mon paiement"}
                  </Button>
                ) : null}
                <Button type="button" onClick={() => void startPayment("CONTRIBUTION", Number(contributionDays))} disabled={paymentBusy || !Number.isSafeInteger(Number(contributionDays)) || Number(contributionDays) < 1 || Number(contributionDays) > 365}>
                  {paymentBusy ? "Préparation..." : `Payer ${contributionDays || 1} jour(s)`}
                </Button>
              </div>
            </section>
            {paymentMessage ? <p role="status" className="mb-4 text-sm text-emerald-300">{paymentMessage}</p> : null}
            {paymentReceipt ? (
              <div className="mb-4 flex flex-col gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-emerald-200">Votre reçu de paiement est disponible au téléchargement.</p>
                <Button type="button" variant="secondary" className="shrink-0 gap-2" onClick={() => void downloadReceipt()}>
                  <Download className="h-4 w-4" /> Télécharger mon reçu PDF
                </Button>
              </div>
            ) : null}
            {paymentError ? <p role="alert" className="mb-4 text-sm text-red-300">{paymentError}</p> : null}
            {receiptError ? <p role="alert" className="mb-4 text-sm text-amber-200">{receiptError}</p> : null}
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <StatCard label="Cotisation journalière" value={formatCurrency(member.dailyContribution)} detail="Montant en vigueur" accent="cyan" icon={<Landmark className="h-5 w-5 text-cyan-300" />} />
              <StatCard label="Total versé" value={formatCurrency(member.totalPaid)} detail="Transactions confirmées" accent="emerald" icon={<TrendingUp className="h-5 w-5 text-emerald-300" />} />
              <StatCard label="Jours impayés" value={String(member.unpaidDays)} detail={`Dernière activité : ${member.lastActivity ? formatDate(member.lastActivity) : "Aucune"}`} accent="rose" icon={<AlertTriangle className="h-5 w-5 text-rose-300" />} />
            </section>
            <section className="mt-5 rounded-2xl border border-amber-400/25 bg-amber-500/5 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="font-semibold text-white">Impayés et pénalités</h2>
                  <p className="mt-2 text-2xl font-semibold text-amber-100">{formatCurrency(member.outstandingDebt)}</p>
                  <p className="mt-1 text-sm text-slate-300">Total échu à régulariser, pénalités comprises</p>
                  <p className="mt-1 text-xs text-slate-400">Dont pénalités : {formatCurrency(member.penaltyDebt)} · {member.unpaidDays} jour(s) impayé(s)</p>
                </div>
                <Badge tone={member.outstandingDebt > 0 ? "warning" : "success"}>
                  {member.outstandingDebt > 0 ? "Régularisation nécessaire" : "Aucun impayé"}
                </Badge>
              </div>
              <div className="mt-5 border-t border-white/10 pt-4">
                <p className="mb-3 text-sm text-slate-400">Ce paiement règle le montant total échu. La cotisation du jour reste dans son paiement séparé.</p>
                <Button type="button" variant="primary" onClick={() => void startPayment("ARREARS")} disabled={paymentBusy || member.outstandingDebt <= 0}>
                  {paymentBusy ? "Préparation..." : member.outstandingDebt > 0 ? `Régulariser tous mes impayés · ${formatCurrency(member.outstandingDebt)}` : "Aucun impayé à régler"}
                </Button>
              </div>
            </section>
            <section className="mt-8 rounded-2xl border border-white/10 bg-slate-900/70 p-5">
              <h2 className="mb-4 text-xl font-semibold text-white">Mes transactions</h2>
              <Table
                headers={["Date", "Type", "Montant", "Statut"]}
                rows={transactions.map((transaction) => [
                  formatDate(transaction.createdAt),
                  transaction.type,
                  formatCurrency(transaction.amount),
                  <Badge key={transaction.id} tone={transaction.status === "SUCCESS" ? "success" : "warning"}>{transaction.status}</Badge>,
                ])}
              />
              {!transactions.length ? <p className="mt-4 text-sm text-slate-400">Aucune transaction enregistrée pour le moment.</p> : null}
            </section>
          </>
        ) : !loading && !error ? (
          <p className="rounded-xl border border-white/10 bg-slate-900/70 p-5 text-slate-300">Aucun dossier membre n’est associé à ce compte. Contactez l’administrateur.</p>
        ) : null}
      </div>
    </main>
  );
}