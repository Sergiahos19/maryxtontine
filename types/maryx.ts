export type Role = "ADMIN" | "MEMBER";
export type MemberStatus = "ACTIVE" | "INACTIVE" | "ON_HOLD";
export type ContributionState = "PAID" | "PARTIAL" | "UNPAID" | "OVERDUE";
export type TransactionType =
  | "CONTRIBUTION"
  | "DEBT_PAYMENT"
  | "PARTIAL_PAYMENT"
  | "ADJUSTMENT"
  | "REFUND";

export interface Member {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: Role;
  status: MemberStatus;
  joinDate: string;
  dailyContribution: number;
  totalPaid: number;
  outstandingDebt: number;
  unpaidDays: number;
  lastActivity: string;
}

export interface Transaction {
  id: string;
  memberId: string;
  memberName: string;
  amount: number;
  type: TransactionType;
  method: string;
  status: "PENDING" | "SUCCESS" | "FAILED";
  reference: string;
  createdAt: string;
  confirmedAt?: string;
}

export interface NotificationItem {
  id: string;
  memberId: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  severity: "info" | "warning" | "success";
}

export interface ContributionSummary {
  totalMembers: number;
  totalCollected: number;
  totalOutstanding: number;
  membersUpToDate: number;
  membersLate: number;
}
