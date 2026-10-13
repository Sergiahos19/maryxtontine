const DEFAULT_TIME_ZONE = "Africa/Porto-Novo";

function resolveTimeZone() {
  const configured = process.env.MARYX_TIMEZONE?.trim() || DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: configured });
    return configured;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

const calendarFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: resolveTimeZone(),
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Jour calendaire (AAAA-MM-JJ) dans le fuseau de la tontine, et non en UTC. */
export function currentDate(date = new Date()) {
  return calendarFormatter.format(date);
}

export function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function nextDate(value: string) {
  return addDays(value, 1);
}
