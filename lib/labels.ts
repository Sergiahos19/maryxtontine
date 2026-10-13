const transactionTypes: Record<string, string> = {
  CONTRIBUTION: "Cotisation",
  DEBT_PAYMENT: "Régularisation",
  PARTIAL_PAYMENT: "Paiement partiel",
  ADJUSTMENT: "Ajustement",
  REFUND: "Remboursement",
};

const transactionStatuses: Record<string, string> = {
  SUCCESS: "Confirmé",
  PENDING: "En attente",
  FAILED: "Échoué",
};

const memberStatuses: Record<string, string> = {
  ACTIVE: "Actif",
  INACTIVE: "Inactif",
  ON_HOLD: "En pause",
};

const paymentMethods: Record<string, string> = {
  CASH: "Espèces",
  "MOBILE MONEY": "Mobile Money",
  "BANK TRANSFER": "Virement",
  SasPay: "SasPay",
};

export const transactionTypeLabel = (value: string) => transactionTypes[value] ?? value;
export const transactionStatusLabel = (value: string) => transactionStatuses[value] ?? value;
export const memberStatusLabel = (value: string) => memberStatuses[value] ?? value;
export const paymentMethodLabel = (value: string) => paymentMethods[value] ?? value;
