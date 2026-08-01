import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

interface AutoCodeConfigInput {
  prefixKey: string;
  paddingKey: string;
  defaultPrefix: string;
  defaultPadding?: number;
}

export interface AutoCodeConfig {
  prefix: string;
  padding: number;
}

function parsePrefix(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toUpperCase();
  return /^[A-Z0-9_-]{2,12}$/.test(normalized) ? normalized : fallback;
}

function parsePadding(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed >= 3 && parsed <= 8 ? parsed : fallback;
}

export async function getAutoCodeConfig(db: Db, input: AutoCodeConfigInput): Promise<AutoCodeConfig> {
  const settings = await db.systemSetting.findMany({
    where: { key: { in: [input.prefixKey, input.paddingKey] } },
    select: { key: true, value: true }
  });
  const values = new Map(settings.map((setting) => [setting.key, setting.value]));
  const defaultPadding = input.defaultPadding ?? 4;

  return {
    prefix: parsePrefix(values.get(input.prefixKey), input.defaultPrefix),
    padding: parsePadding(values.get(input.paddingKey), defaultPadding)
  };
}

export function dateScopedCodePrefix(prefix: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  const day = parts.find((part) => part.type === "day")?.value ?? "00";
  return `${prefix}-${year}${month}${day}`;
}

export function nextDateScopedCode(prefix: string, count: number, padding: number) {
  return `${prefix}-${String(count + 1).padStart(padding, "0")}`;
}
