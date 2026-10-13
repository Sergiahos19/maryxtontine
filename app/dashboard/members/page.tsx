"use client";

import { useEffect, useState } from "react";

import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { Table } from "@/components/ui/table";
import { formatCurrency } from "@/lib/formatters";

type MemberRow = {
  id: string;
  firstName: string;
  lastName: string;
  dailyContribution: number;
  status: string;
};

export default function MembersPage() {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/members", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as { error?: string; members?: MemberRow[] };
        if (!response.ok) setError(result.error ?? "Impossible de charger les dossiers membres.");
        else setMembers(result.members ?? []);
      })
      .catch(() => setError("Le service de données est inaccessible."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <Header />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">Membres</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Dossiers membres</h1>
        </div>
        {error ? <p role="alert" className="mb-4 text-red-300">{error}</p> : null}
        {loading ? <p className="mb-4 text-slate-400">Chargement...</p> : null}
        <Table
          headers={["Membre", "Cotisation journalière", "Statut"]}
          rows={members.map((member) => [
            `${member.firstName} ${member.lastName}`,
            formatCurrency(member.dailyContribution),
            <Badge key={member.id} tone={member.status === "ACTIVE" ? "success" : "warning"}>{member.status}</Badge>,
          ])}
        />
        {!members.length && !loading && !error ? <p className="mt-4 text-sm text-slate-400">Aucun dossier membre n’est enregistré.</p> : null}
      </div>
    </main>
  );
}
