"use client";

import { useEffect, useMemo, useState } from "react";

import { AppShell, PageHeading, useSessionUser } from "@/components/layout/app-shell";
import { TransactionList } from "@/components/dashboard/transaction-list";
import { Panel } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { formatCurrency } from "@/lib/formatters";

type TransactionRow = {
  id: string;
  memberName: string;
  amount: number;
  type: string;
  method: string;
  status: string;
  reference: string;
  createdAt: string;
};

export default function HistoryPage() {
  return (
    <AppShell>
      <History />
    </AppShell>
  );
}

function History() {
  const user = useSessionUser();
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/history", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as { error?: string; transactions?: TransactionRow[] };
        if (!response.ok) setError(result.error ?? "Impossible de charger l’historique.");
        else setTransactions(result.transactions ?? []);
      })
      .catch(() => setError("Le service est inaccessible. Réessayez plus tard."))
      .finally(() => setLoading(false));
  }, []);

  const total = useMemo(() => transactions.filter((row) => row.status === "SUCCESS").reduce((sum, row) => sum + Number(row.amount), 0), [transactions]);
  const isAdmin = user.role === "ADMIN";

  return (
    <>
      <PageHeading
        title="Historique"
        description={loading ? "Chargement..." : `${transactions.length} transaction(s), ${formatCurrency(total)} confirmés au total.`}
      />
      {error ? <Notice tone="error" className="mb-5">{error}</Notice> : null}
      <Panel>
        <TransactionList items={transactions} showMember={isAdmin} empty={loading ? "Chargement..." : "Aucune transaction enregistrée pour l’instant."} />
      </Panel>
    </>
  );
}
