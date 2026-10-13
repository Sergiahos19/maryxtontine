type JsonObject = Record<string, unknown>;

export class SasPayApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | undefined,
    readonly details: string | undefined,
  ) {
    super(`SASPAY_REQUEST_FAILED_${status}`);
    this.name = "SasPayApiError";
  }
}

export class SasPayInvalidCheckoutResponseError extends Error {
  constructor(
    readonly reason: "missing-session-id" | "invalid-session-id" | "missing-checkout-url" | "untrusted-checkout-url",
    readonly checkoutHost?: string,
  ) {
    super(`SASPAY_INVALID_CHECKOUT_RESPONSE_${reason.toUpperCase().replaceAll("-", "_")}`);
    this.name = "SasPayInvalidCheckoutResponseError";
  }
}

export type SasPayPayment = {
  checkoutSessionId: string;
  transactionId?: string;
  status: "PENDING" | "SUCCESS" | "FAILED" | "CANCELLED" | "EXPIRED";
  amount?: number;
  currency?: string;
};

function isSasPayStatus(value: string): value is SasPayPayment["status"] {
  return value === "PENDING"
    || value === "SUCCESS"
    || value === "FAILED"
    || value === "CANCELLED"
    || value === "EXPIRED";
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function unwrapData(value: unknown): JsonObject {
  if (!isObject(value)) return {};
  return isObject(value.data) ? value.data : value;
}

function getApiErrorDetails(value: unknown) {
  if (!isObject(value)) return { code: undefined, details: undefined };
  const error = isObject(value.error) ? value.error : value;
  const code = typeof error.code === "string" ? error.code : undefined;
  if (typeof error.message === "string") return { code, details: error.message.slice(0, 300) };

  const validationMessages = Object.entries(error)
    .flatMap(([field, messages]) => {
      const items = Array.isArray(messages) ? messages : [messages];
      return items
        .filter((message): message is string => typeof message === "string")
        .map((message) => `${field}: ${message}`);
    })
    .slice(0, 3);
  return { code, details: validationMessages.length ? validationMessages.join("; ").slice(0, 300) : undefined };
}

async function requestSasPay(path: string, body?: JsonObject): Promise<unknown> {
  const apiKey = process.env.SASPAY_SECRET_KEY?.trim();
  if (!apiKey) throw new Error("SASPAY_NOT_CONFIGURED");

  const response = await fetch(`https://api.saspay.me/api/v1${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const rawResult = await response.text();
  let result: unknown = null;
  try {
    result = JSON.parse(rawResult);
  } catch {
    result = null;
  }
  if (!response.ok || (isObject(result) && result.success === false)) {
    const { code, details } = getApiErrorDetails(result);
    throw new SasPayApiError(response.status, code, details);
  }
  return result;
}

export function getSasPayCheckoutErrorMessage(error: unknown) {
  if (error instanceof SasPayApiError) {
    if (error.status === 401) return "SasPay a refusé la clé API. Vérifiez qu’elle est active et qu’il s’agit de la clé de production prévue.";
    if (error.status === 403) return "La clé SasPay n’est pas autorisée à encaisser. Vérifiez le scope PAYIN ou BOTH et l’activation du compte marchand.";
    if (error.status === 429) return "SasPay limite temporairement les demandes. Patientez un instant puis réessayez.";
    if (error.status === 400 || error.status === 422) {
      return `SasPay a refusé les données du paiement${error.details ? ` : ${error.details}` : "."}`;
    }
    if (error.details) return `SasPay a répondu avec l’erreur ${error.status}${error.code ? ` (${error.code})` : ""} : ${error.details}`;
    return `SasPay a répondu avec l’erreur ${error.status}${error.code ? ` (${error.code})` : ""}.`;
  }
  if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
    return "SasPay ne répond pas actuellement. Vérifiez votre connexion puis réessayez.";
  }
  if (error instanceof Error && error.message === "SASPAY_INVALID_CHECKOUT_RESPONSE") {
    return "SasPay a créé une réponse de paiement invalide. Vérifiez le compte marchand et contactez le support SasPay si le problème persiste.";
  }
  return "Impossible de joindre SasPay. Vérifiez la clé, le scope PAYIN/BOTH et la connexion Internet, puis réessayez.";
}

export async function createSasPayCheckout(input: {
  amount: number;
  description: string;
  email: string;
  customerName: string;
  attemptId: string;
  returnUrl: string;
}) {
  const result = unwrapData(await requestSasPay("/checkout-sessions/", {
    amount: input.amount.toFixed(2),
    currency: "XOF",
    description: input.description,
    customer_email: input.email,
    customer_name: input.customerName,
    return_url: input.returnUrl,
    metadata: { maryx_payment_id: input.attemptId },
  }));
  const sessionId = result.id;
  if (sessionId === undefined || sessionId === null || sessionId === "") {
    throw new SasPayInvalidCheckoutResponseError("missing-session-id");
  }
  if (typeof sessionId !== "string" || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(sessionId)) {
    throw new SasPayInvalidCheckoutResponseError("invalid-session-id");
  }
  if (typeof result.checkout_url !== "string" || !result.checkout_url) {
    throw new SasPayInvalidCheckoutResponseError("missing-checkout-url");
  }

  let checkoutUrl: URL;
  try {
    checkoutUrl = new URL(result.checkout_url);
  } catch {
    throw new SasPayInvalidCheckoutResponseError("untrusted-checkout-url");
  }
  if (
    checkoutUrl.protocol !== "https:"
    || !["pay.saspay.me", "checkout.saspay.me"].includes(checkoutUrl.hostname)
  ) {
    throw new SasPayInvalidCheckoutResponseError("untrusted-checkout-url", checkoutUrl.hostname);
  }

  return { sessionId, checkoutUrl: checkoutUrl.toString() };
}

export async function retrieveSasPayPayment(checkoutSessionId: string): Promise<SasPayPayment> {
  const sessionResult = unwrapData(await requestSasPay(
    `/checkout-sessions/${encodeURIComponent(checkoutSessionId)}/status/`,
  ));
  const sessionStatus = typeof sessionResult.status === "string" ? sessionResult.status.toUpperCase() : "";
  if (sessionStatus !== "PAID" && !isSasPayStatus(sessionStatus)) {
    throw new Error("SASPAY_INVALID_SESSION_RESPONSE");
  }

  const transactionId = typeof sessionResult.transaction_id === "string" ? sessionResult.transaction_id : "";
  if (!transactionId) {
    if (sessionStatus === "PENDING" || sessionStatus === "CANCELLED" || sessionStatus === "EXPIRED" || sessionStatus === "FAILED") {
      return { checkoutSessionId, status: sessionStatus };
    }
    throw new Error("SASPAY_INVALID_SESSION_RESPONSE");
  }

  const verification = unwrapData(await requestSasPay(
    `/payments/${encodeURIComponent(transactionId)}/verify/`,
  ));
  const verifiedId = typeof verification.id === "string" ? verification.id : "";
  const status = typeof verification.status === "string" ? verification.status.toUpperCase() : "";
  if (verifiedId !== transactionId || !isSasPayStatus(status) || status === "EXPIRED") {
    throw new Error("SASPAY_INVALID_PAYMENT_RESPONSE");
  }

  if (status !== "SUCCESS") return { checkoutSessionId, transactionId, status };

  const rawAmount = verification.requested_amount ?? verification.amount;
  const amount = typeof rawAmount === "number" || typeof rawAmount === "string" ? Number(rawAmount) : NaN;
  const currency = typeof verification.currency === "string" ? verification.currency.toUpperCase() : "";
  if (!Number.isSafeInteger(amount) || currency !== "XOF") {
    throw new Error("SASPAY_INVALID_PAYMENT_RESPONSE");
  }

  return { checkoutSessionId, transactionId, status, amount, currency };
}
