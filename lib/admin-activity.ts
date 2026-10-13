import { randomUUID } from "node:crypto";

import { db as defaultDb, type Db } from "@/lib/database";

export async function recordAdminActivity(memberId: string, action: string, details: string, db: Db = defaultDb) {
  const member = await db.get<{ first_name: string; last_name: string }>("select first_name, last_name from members where id = ?", [memberId]);
  const memberName = member ? `${member.first_name} ${member.last_name}`.trim() : "Compte membre";
  await db.run(
    "insert into admin_notifications (id, member_id, member_name, action, details) values (?, ?, ?, ?, ?)",
    [randomUUID(), memberId, memberName, action, details],
  );
}
