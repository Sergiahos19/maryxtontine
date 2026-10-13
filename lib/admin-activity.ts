import { randomUUID } from "node:crypto";

import { database } from "@/lib/database";

export function recordAdminActivity(memberId: string, action: string, details: string) {
  const member = database.prepare("select first_name, last_name from members where id = ?").get(memberId) as
    | { first_name: string; last_name: string }
    | undefined;
  const memberName = member ? `${member.first_name} ${member.last_name}`.trim() : "Compte membre";
  database.prepare(`
    insert into admin_notifications (id, member_id, member_name, action, details)
    values (?, ?, ?, ?, ?)
  `).run(randomUUID(), memberId, memberName, action, details);
}