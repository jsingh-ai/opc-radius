import { z } from "zod";

const upstreamMachineSchema = z.object({
  kco: z.coerce.number().int().nullable().optional(),
  plantCode: z.union([z.string(), z.number()]).nullable().optional(),
  machineId: z.union([z.string(), z.number()]),
  jobCode: z.union([z.string(), z.number()]).nullable().optional(),
  operationCode: z.union([z.string(), z.number()]).nullable().optional(),
  eventType: z.union([z.string(), z.number()]).nullable().optional(),
  statusCode: z.union([z.string(), z.number()]).nullable().optional(),
  statusDescription: z.union([z.string(), z.number()]).nullable().optional(),
  eventStartTime: z.string().nullable().optional().or(z.literal("")),
  eventSeqCode: z.union([z.string(), z.number()]).nullable().optional()
});

const upstreamPayloadSchema = z.array(upstreamMachineSchema);

function cleanString(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized === "" ? null : normalized;
}

function normalizeTimestamp(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function validateAndNormalizeMachinePayload(payload) {
  const records = upstreamPayloadSchema.parse(payload);

  return records.map((record) => ({
    kco: record.kco ?? null,
    plantCode: cleanString(record.plantCode),
    machineId: cleanString(record.machineId) || "unknown",
    jobCode: cleanString(record.jobCode),
    operationCode: cleanString(record.operationCode),
    eventType: cleanString(record.eventType),
    statusCode: cleanString(record.statusCode),
    statusDescription: cleanString(record.statusDescription),
    eventStartTime: normalizeTimestamp(record.eventStartTime),
    eventSeqCode: cleanString(record.eventSeqCode)
  }));
}
