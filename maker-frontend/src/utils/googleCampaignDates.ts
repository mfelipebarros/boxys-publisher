const DEFAULT_DURATION_DAYS = 30;

const pad = (value: number) => String(value).padStart(2, "0");

const formatDate = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const getTodayDateString = (baseDate: Date = new Date()): string => {
  const localDate = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate()
  );
  return formatDate(localDate);
};

export const normalizeCampaignDurationDays = (
  durationDays?: number | null,
  fallback: number = DEFAULT_DURATION_DAYS
): number => {
  const numeric = Number(durationDays);
  if (!Number.isFinite(numeric)) return fallback;

  const normalized = Math.trunc(numeric);
  return normalized > 0 ? normalized : fallback;
};

export const computeCampaignDateWindow = (
  durationDays?: number | null,
  baseDate: Date = new Date()
): { startDate: string; endDate: string; durationDays: number } => {
  const normalizedDuration = normalizeCampaignDurationDays(durationDays);
  const start = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate()
  );
  const end = new Date(start);
  end.setDate(end.getDate() + normalizedDuration - 1);

  return {
    startDate: formatDate(start),
    endDate: formatDate(end),
    durationDays: normalizedDuration,
  };
};
