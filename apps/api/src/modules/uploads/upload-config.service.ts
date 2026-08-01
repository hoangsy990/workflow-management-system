import type { Prisma, PrismaClient } from "@prisma/client";
import { config } from "../../config.js";

type Db = PrismaClient | Prisma.TransactionClient;

const uploadMaxMbKey = "file.upload.max_mb";
const uploadAllowedMimeTypesKey = "file.upload.allowed_mime_types";
const mimeTypePattern = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*(?:\+[a-z0-9][a-z0-9!#$&^_.+-]*)?$/i;

export const defaultAllowedUploadMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "video/mp4"
] as const;

export interface UploadConfig {
  maxMb: number;
  allowedMimeTypes: string[];
  accept: string;
}

function parseMaxUploadMb(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return config.MAX_UPLOAD_MB;
  return Math.max(1, Math.min(config.MAX_UPLOAD_MB, Math.floor(parsed)));
}

export function parseAllowedUploadMimeTypes(value: unknown) {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\s,;]+/)
      : [...defaultAllowedUploadMimeTypes];
  const normalized = rawValues
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().toLowerCase())
    .filter((item) => mimeTypePattern.test(item));

  const uniqueValues = [...new Set(normalized)];
  return uniqueValues.length > 0 ? uniqueValues : [...defaultAllowedUploadMimeTypes];
}

export async function getUploadConfig(db: Db): Promise<UploadConfig> {
  const settings = await db.systemSetting.findMany({
    where: { key: { in: [uploadMaxMbKey, uploadAllowedMimeTypesKey] } },
    select: { key: true, value: true }
  });
  const values = new Map(settings.map((setting) => [setting.key, setting.value]));
  const allowedMimeTypes = parseAllowedUploadMimeTypes(values.get(uploadAllowedMimeTypesKey));
  return {
    maxMb: parseMaxUploadMb(values.get(uploadMaxMbKey)),
    allowedMimeTypes,
    accept: allowedMimeTypes.join(",")
  };
}
