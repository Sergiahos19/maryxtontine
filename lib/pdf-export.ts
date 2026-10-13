import { jsPDF } from "jspdf";

import { formatCurrency } from "@/lib/formatters";

type GlobalReportStats = {
  totalMembers: number;
  totalCollected: number;
  totalOutstanding: number;
  membersUpToDate: number;
  membersLate: number;
  activeMembers: number;
  inactiveMembers: number;
  membersOnHold: number;
};

export type GlobalReport = {
  generatedAt: string;
  stats: GlobalReportStats;
};

export type MemberStatement = {
  generatedAt: string;
  member: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    status: string;
    dailyContribution: number;
    totalPaid: number;
    outstandingDebt: number;
    unpaidDays: number;
    penaltyDebt: number;
  };
  dues: Array<{ dueDate: string; amount: number; paid: number }>;
  penalties: Array<{ penaltyDate: string; amount: number; paid: number }>;
  transactions: Array<{
    amount: number;
    type: string;
    method: string;
    status: string;
    reference: string;
    createdAt: string;
  }>;
};

export type PaymentReceipt = {
  reference: string;
  transactionId: string;
  paidAt: string;
  member: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  amount: number;
  currency: string;
  purpose: "CONTRIBUTION" | "ARREARS";
  contributionDays: number;
  appliedToDebt: number;
  appliedToContributions: number;
  outstandingDebt: number;
};

const pageWidth = 210;
const contentWidth = 182;
const navy: [number, number, number] = [7, 28, 62];
const cyan: [number, number, number] = [22, 163, 196];
const slate: [number, number, number] = [71, 85, 105];

async function loadLogo() {
  const response = await fetch("/images/maryxok.jpeg");
  if (!response.ok) throw new Error("Le logo MARYX n’a pas pu être chargé.");
  const image = await createImageBitmap(await response.blob());
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Le logo MARYX n’a pas pu être préparé pour le relevé.");
  const scale = Math.max(canvas.width / image.width, canvas.height / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  context.beginPath();
  context.arc(128, 128, 128, 0, Math.PI * 2);
  context.clip();
  context.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
  image.close();
  return canvas.toDataURL("image/png");
}

function dateLabel(value: string) {
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" }).format(date);
}

function dateTimeLabel(value: string) {
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function makeDocument(title: string, generatedAt: string, logo: string) {
  const doc = new jsPDF();
  doc.setProperties({ title: `${title} | MARYX`, subject: "Relevé MARYX", creator: "MARYX" });
  const drawHeader = (page: number) => {
    doc.setFillColor(...navy);
    doc.rect(0, 0, pageWidth, 39, "F");
    doc.setDrawColor(...cyan);
    doc.setLineWidth(0.8);
    doc.circle(25.5, 19.5, 12.3, "S");
    doc.addImage(logo, "PNG", 14, 8, 23, 23);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(fitCell(doc, title, 150), 44, 19);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(190, 225, 238);
    doc.text(`Édité le ${dateTimeLabel(generatedAt)}`, 44, 27);
    doc.setFillColor(...cyan);
    doc.rect(14, 37, contentWidth, 1.5, "F");
    if (page > 1) {
      doc.setFontSize(8);
      doc.setTextColor(190, 225, 238);
      doc.text(`MARYX · ${title}`, 196, 34, { align: "right" });
    }
  };
  drawHeader(1);
  return { doc, drawHeader };
}

function addFooters(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(226, 232, 240);
    doc.line(14, 283, 196, 283);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...slate);
    doc.text("MARYX · Relevé généré automatiquement", 14, 289);
    doc.text(`${page} / ${pageCount}`, 196, 289, { align: "right" });
  }
}

function addSectionTitle(doc: jsPDF, title: string, y: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...navy);
  doc.text(title, 14, y);
  doc.setDrawColor(...cyan);
  doc.setLineWidth(0.7);
  doc.line(14, y + 2, 35, y + 2);
  return y + 9;
}

function addSummaryCard(doc: jsPDF, label: string, value: string, x: number, y: number, width: number) {
  doc.setFillColor(241, 248, 251);
  doc.setDrawColor(219, 234, 241);
  doc.roundedRect(x, y, width, 22, 2, 2, "FD");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...slate);
  doc.text(label, x + 4, y + 7);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...navy);
  const lines = doc.splitTextToSize(value, width - 8) as string[];
  doc.text(lines.slice(0, 2), x + 4, y + 16);
}

function fitCell(doc: jsPDF, value: string, width: number) {
  let result = value;
  while (result.length > 1 && doc.getTextWidth(result) > width - 4) result = `${result.slice(0, -2)}…`;
  return result;
}

function addTable(
  doc: jsPDF,
  title: string,
  headers: string[],
  rows: string[][],
  widths: number[],
  y: number,
  drawHeader: (page: number) => void,
) {
  if (y > 255) {
    doc.addPage();
    drawHeader(doc.getNumberOfPages());
    y = 47;
  }
  y = addSectionTitle(doc, title, y);
  const drawColumnHeaders = () => {
    doc.setFillColor(...navy);
    doc.rect(14, y, contentWidth, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    let x = 14;
    headers.forEach((header, index) => {
      doc.text(fitCell(doc, header, widths[index]), x + 2, y + 5.4);
      x += widths[index];
    });
    y += 8;
  };
  drawColumnHeaders();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  rows.forEach((row, rowIndex) => {
    if (y > 270) {
      doc.addPage();
      drawHeader(doc.getNumberOfPages());
      y = 47;
      drawColumnHeaders();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
    }
    if (rowIndex % 2 === 0) {
      doc.setFillColor(246, 249, 251);
      doc.rect(14, y, contentWidth, 8, "F");
    }
    doc.setTextColor(51, 65, 85);
    let x = 14;
    row.forEach((value, index) => {
      doc.text(fitCell(doc, value, widths[index]), x + 2, y + 5.4);
      x += widths[index];
    });
    y += 8;
  });
  return y + 8;
}

function typeLabel(type: string) {
  const labels: Record<string, string> = {
    CONTRIBUTION: "Cotisation",
    DEBT_PAYMENT: "Règlement dette",
    PARTIAL_PAYMENT: "Paiement partiel",
    ADJUSTMENT: "Ajustement",
    REFUND: "Remboursement",
  };
  return labels[type] ?? type;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = { ACTIVE: "Actif", INACTIVE: "Inactif", ON_HOLD: "En pause", SUCCESS: "Confirmé", PENDING: "En attente", FAILED: "Échoué" };
  return labels[status] ?? status;
}

export async function downloadGlobalReport(report: GlobalReport) {
  const logo = await loadLogo();
  const { doc } = makeDocument("Synthèse globale", report.generatedAt, logo);
  const stats = [
    ["Membres enregistrés", String(report.stats.totalMembers)],
    ["Total collecté", formatCurrency(report.stats.totalCollected)],
    ["Montant restant dû", formatCurrency(report.stats.totalOutstanding)],
    ["Membres à jour", String(report.stats.membersUpToDate)],
    ["Membres en retard", String(report.stats.membersLate)],
    ["Comptes actifs", String(report.stats.activeMembers)],
    ["Comptes inactifs", String(report.stats.inactiveMembers)],
    ["Comptes en pause", String(report.stats.membersOnHold)],
  ];
  let y = 52;
  stats.forEach(([label, value], index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    addSummaryCard(doc, label, value, 14 + column * 93, y + row * 28, 89);
  });
  y += 4 * 28 + 4;
  addSectionTitle(doc, "Périmètre du relevé", y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...slate);
  doc.text("Cette synthèse présente uniquement des indicateurs agrégés. Elle ne contient aucune donnée individuelle ni aucun historique nominatif.", 14, y + 8, { maxWidth: contentWidth });
  addFooters(doc);
  doc.save("maryx-synthese-globale.pdf");
}

export async function downloadMemberStatement(statement: MemberStatement) {
  const logo = await loadLogo();
  const fullName = `${statement.member.firstName} ${statement.member.lastName}`.trim();
  const { doc, drawHeader } = makeDocument(`Relevé individuel · ${fullName}`, statement.generatedAt, logo);
  let y = 49;
  y = addSectionTitle(doc, "Informations du membre", y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...slate);
  doc.text(`Nom : ${fullName}`, 14, y);
  doc.text(`E-mail : ${statement.member.email}`, 14, y + 6);
  doc.text(`Téléphone : ${statement.member.phone}`, 112, y);
  doc.text(`Statut : ${statusLabel(statement.member.status)}`, 112, y + 6);
  y += 15;

  const summary = [
    ["Total versé", formatCurrency(statement.member.totalPaid)],
    ["Dette totale", formatCurrency(statement.member.outstandingDebt)],
    ["Dont pénalités", formatCurrency(statement.member.penaltyDebt)],
    ["Jours impayés", String(statement.member.unpaidDays)],
    ["Cotisation / jour", formatCurrency(statement.member.dailyContribution)],
  ];
  summary.forEach(([label, value], index) => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    addSummaryCard(doc, label, value, 14 + column * 62, y + row * 26, 58);
  });
  y += 2 * 26 + 4;

  const dueRows = statement.dues.map((due) => [
    dateLabel(due.dueDate),
    formatCurrency(due.amount),
    formatCurrency(due.paid),
    formatCurrency(due.amount - due.paid),
  ]);
  y = addTable(doc, "Cotisations échues non réglées", ["Échéance", "Montant dû", "Déjà réglé", "Reste à payer"], dueRows, [45, 45, 45, 47], y, drawHeader);
  if (!dueRows.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...slate);
    doc.text("Aucune cotisation échue impayée.", 14, y - 6);
    y += 2;
  }

  const penaltyRows = statement.penalties.map((penalty) => [
    dateLabel(penalty.penaltyDate),
    formatCurrency(penalty.amount),
    formatCurrency(penalty.paid),
    formatCurrency(penalty.amount - penalty.paid),
  ]);
  y = addTable(doc, "Pénalités non réglées", ["Date", "Montant", "Déjà réglé", "Reste à payer"], penaltyRows, [45, 45, 45, 47], y, drawHeader);
  if (!penaltyRows.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...slate);
    doc.text("Aucune pénalité impayée.", 14, y - 6);
    y += 2;
  }

  const transactionRows = statement.transactions.map((transaction) => [
    dateTimeLabel(transaction.createdAt),
    typeLabel(transaction.type),
    formatCurrency(transaction.amount),
    transaction.method,
    statusLabel(transaction.status),
    transaction.reference,
  ]);
  addTable(doc, "Historique des transactions", ["Date", "Opération", "Montant", "Mode", "Statut", "Référence"], transactionRows, [28, 33, 29, 28, 23, 41], y, drawHeader);
  addFooters(doc);
  const safeName = fullName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  doc.save(`maryx-releve-${safeName || "membre"}.pdf`);
}

export async function downloadPaymentReceipt(receipt: PaymentReceipt) {
  const logo = await loadLogo();
  const { doc } = makeDocument("Reçu de paiement", receipt.paidAt, logo);
  const fullName = `${receipt.member.firstName} ${receipt.member.lastName}`.trim();
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(167, 243, 208);
  doc.roundedRect(14, 51, contentWidth, 30, 3, 3, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(5, 150, 105);
  doc.text("PAIEMENT CONFIRMÉ", 20, 61);
  doc.setFontSize(20);
  doc.setTextColor(...navy);
  doc.text(formatCurrency(receipt.amount), 20, 73);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...slate);
  doc.text(receipt.currency, 20 + doc.getTextWidth(formatCurrency(receipt.amount)) + 3, 73);

  let y = addSectionTitle(doc, "Informations du membre", 96);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...slate);
  doc.text(`Nom : ${fullName}`, 14, y);
  doc.text(`E-mail : ${receipt.member.email}`, 14, y + 7);
  doc.text(`Téléphone : ${receipt.member.phone || "Non renseigné"}`, 14, y + 14);

  y += 27;
  y = addSectionTitle(doc, "Détails du règlement", y);
  const details: Array<[string, string]> = [
    ["Date de confirmation", dateTimeLabel(receipt.paidAt)],
    ["Référence MARYX", receipt.reference],
    ["Référence transaction SasPay", receipt.transactionId],
    ["Mode de paiement", "SasPay"],
    ["Type d’opération", receipt.purpose === "ARREARS" ? "Régularisation des impayés" : `Cotisations (${receipt.contributionDays} jour(s))`],
    ["Impayés réglés", formatCurrency(receipt.appliedToDebt)],
    ["Cotisations couvertes", formatCurrency(receipt.appliedToContributions)],
    ["Solde restant après règlement", formatCurrency(receipt.outstandingDebt)],
  ];
  details.forEach(([label, value], index) => {
    const rowY = y + index * 12;
    if (index % 2 === 0) {
      doc.setFillColor(246, 249, 251);
      doc.roundedRect(14, rowY - 5, contentWidth, 10, 1.5, 1.5, "F");
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...slate);
    doc.text(label, 18, rowY + 1);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...navy);
    doc.text(fitCell(doc, value, 92), 192, rowY + 1, { align: "right" });
  });
  addFooters(doc);
  const safeReference = receipt.reference.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  doc.save(`maryx-recu-${safeReference || "paiement"}.pdf`);
}
