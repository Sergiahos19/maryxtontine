"use client";

import { useEffect, useState } from "react";

import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { Table } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/formatters";

type TransactionRow = {
  id: string;
  memberId: string;
  memberName: string;
  amount: number;
  type: string;
  status: string;
  createdAt: string;
};

export default function HistoryPage() {
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
      .catch(() => setError("Le service de données est inaccessible."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <Header />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">Historique</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Transactions et mouvements</h1>
        </div>
        {error ? <p role="alert" className="mb-4 text-red-300">{error}</p> : null}
        {loading ? <p className="mb-4 text-slate-400">Chargement...</p> : null}
        <Table
          headers={["Date", "Membre", "Montant", "Type", "Statut"]}
          rows={transactions.map((transaction) => [
            formatDate(transaction.createdAt),
            transaction.memberName,
            formatCurrency(Number(transaction.amount)),
            transaction.type,
            <Badge key={transaction.id} tone={transaction.status === "SUCCESS" ? "success" : "warning"}>{transaction.status}</Badge>,
          ])}
        />
        {!transactions.length && !loading && !error ? <p className="mt-4 text-sm text-slate-400">Aucune transaction enregistrée.</p> : null}
      </div>
    </main>
  );
}
