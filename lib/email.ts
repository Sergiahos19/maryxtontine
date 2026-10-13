/**
 * Envoi d’emails via l’API REST d’EmailJS (https://www.emailjs.com/docs/rest-api/send/).
 * Un seul modèle générique est utilisé ; ses variables sont documentées dans le README.
 * Prérequis côté EmailJS : Account > Security > « Allow EmailJS API for non-browser applications ».
 */

type EmailMessage = {
  to: string;
  toName: string;
  subject: string;
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
};

function emailConfig() {
  const serviceId = process.env.EMAILJS_SERVICE_ID?.trim();
  const templateId = process.env.EMAILJS_TEMPLATE_ID?.trim();
  const publicKey = process.env.EMAILJS_PUBLIC_KEY?.trim();
  const privateKey = process.env.EMAILJS_PRIVATE_KEY?.trim();
  return serviceId && templateId && publicKey && privateKey ? { serviceId, templateId, publicKey, privateKey } : null;
}

export function isEmailConfigured() {
  return Boolean(emailConfig());
}

/** Adresse publique du site, utilisée pour les liens dans les emails. */
export function publicUrl(path = "/") {
  const base = process.env.MARYX_PUBLIC_URL?.trim() || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");
  return new URL(path, base).toString();
}

/** N’échoue jamais : un email non envoyé ne doit pas bloquer un paiement ou une inscription. */
export async function sendEmail(email: EmailMessage) {
  const config = emailConfig();
  if (!config) return false;
  try {
    const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: config.serviceId,
        template_id: config.templateId,
        user_id: config.publicKey,
        accessToken: config.privateKey,
        template_params: {
          to_email: email.to,
          to_name: email.toName,
          subject: email.subject,
          title: email.title,
          message: email.message,
          action_url: email.actionUrl ?? publicUrl("/"),
          action_label: email.actionLabel ?? "Ouvrir MARYX",
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.error("EmailJS send failed", response.status, (await response.text()).slice(0, 200));
      return false;
    }
    return true;
  } catch (error) {
    console.error("EmailJS unreachable", error instanceof Error ? error.message : "Unknown error");
    return false;
  }
}
