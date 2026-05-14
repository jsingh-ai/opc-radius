import { z } from "zod";

const envBoolean = z.preprocess((value) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }
  }

  return value;
}, z.boolean());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  HOST: z.string().min(1).default("127.0.0.1"),
  VITE_APP_TITLE: z.string().min(1).default("Press Radius OPC Dashboard"),
  SHOPFLOOR_API_BASE_URL: z.string().url().default("https://fsmradiusapi.fivestar.com"),
  SHOPFLOOR_API_KEY: z.string().min(1),
  SHOPFLOOR_KCO: z.string().min(1).default("2"),
  SHOPFLOOR_PLANT_CODE: z.string().min(1).default("2"),
  SHOPFLOOR_MACH_PREFIX: z.string().min(1).default("2"),
  SHOPFLOOR_INCLUDE_EVENT_DETAILS: envBoolean.default(false),
  SHOPFLOOR_POLLING_INTERVAL_SECONDS: z.coerce.number().int().min(15).default(60),
  SHOPFLOOR_UPSTREAM_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(10000),
  ENABLE_MANUAL_REFRESH: envBoolean.default(false),
  DATABASE_URL: z.string().min(1),
  DATABASE_SSL_MODE: z.enum(["disable", "prefer", "require"]).default("prefer"),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
  DATABASE_IDLE_TIMEOUT_MS: z.coerce.number().int().min(1000).max(300000).default(30000),
  DATABASE_CONNECTION_TIMEOUT_MS: z.coerce.number().int().min(1000).max(300000).default(10000)
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
}

const env = parsed.data;

export const config = {
  nodeEnv: env.NODE_ENV,
  appTitle: env.VITE_APP_TITLE,
  port: env.PORT,
  host: env.HOST,
  pollingIntervalSeconds: env.SHOPFLOOR_POLLING_INTERVAL_SECONDS,
  enableManualRefresh: env.ENABLE_MANUAL_REFRESH,
  shopfloor: {
    baseUrl: env.SHOPFLOOR_API_BASE_URL,
    apiKey: env.SHOPFLOOR_API_KEY,
    kco: env.SHOPFLOOR_KCO,
    plantCode: env.SHOPFLOOR_PLANT_CODE,
    machPrefix: env.SHOPFLOOR_MACH_PREFIX,
    includeEventDetails: env.SHOPFLOOR_INCLUDE_EVENT_DETAILS,
    upstreamTimeoutMs: env.SHOPFLOOR_UPSTREAM_TIMEOUT_MS
  },
  postgres: {
    url: env.DATABASE_URL,
    sslMode: env.DATABASE_SSL_MODE,
    poolMax: env.DATABASE_POOL_MAX,
    idleTimeoutMs: env.DATABASE_IDLE_TIMEOUT_MS,
    connectionTimeoutMs: env.DATABASE_CONNECTION_TIMEOUT_MS
  }
};
