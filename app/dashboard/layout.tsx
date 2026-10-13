"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void fetch("/api/auth/session", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) {
        router.replace("/auth/signin");
        return;
      }
      const result = (await response.json()) as { user: { id: string } | null };
      if (!result.user) {
        router.replace("/auth/signin");
        return;
      }
      setReady(true);
    }).catch(() => router.replace("/auth/signin"));
  }, [router]);

  if (!ready) return null;
  return <>{children}</>;
}
