import type { ContributionState, Member } from "@/types/maryx";

export function getContributionState(member: Pick<Member, "unpaidDays" | "outstandingDebt" | "dailyContribution">): ContributionState {
  if (member.unpaidDays === 0 && member.outstandingDebt === 0) return "PAID";
  if (member.outstandingDebt > 0 && member.outstandingDebt < member.dailyContribution) return "PARTIAL";
  if (member.unpaidDays > 0 && member.outstandingDebt >= member.dailyContribution) return "OVERDUE";
  return "UNPAID";
}

export function getDebtProgress(member: Member): number {
  if (member.dailyContribution <= 0) return 0;
  return Math.min(100, (member.totalPaid / (member.totalPaid + member.outstandingDebt || 1)) * 100);
}

export function getPaymentStatusLabel(member: Member): string {
  switch (getContributionState(member)) {
    case "PAID":
      return "À jour";
    case "PARTIAL":
      return "Paiement partiel";
    case "OVERDUE":
      return `${member.unpaidDays} jours de retard`;
    default:
      return "Non payé";
  }
}
