import { z } from "zod";

export const presenceHeartbeatSchema = z.object({
  sessionId: z.string().min(8).max(128),
  currentPath: z.string().min(1).max(256),
  pageTitle: z.string().trim().max(200).optional().nullable(),
  theme: z.enum(["light", "dark"]).optional().nullable(),
  viewportWidth: z.number().int().min(0).max(10000).optional().nullable(),
  viewportHeight: z.number().int().min(0).max(10000).optional().nullable(),
  event: z.enum(["heartbeat", "pagehide"]).default("heartbeat")
});

export function parsePresenceHeartbeat(payload) {
  return presenceHeartbeatSchema.parse(payload);
}
