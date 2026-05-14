import pg from "pg";
import { config } from "../config.js";
import { schemaSql } from "./schema.js";

const { Pool } = pg;

function createSslConfig() {
  if (!config.postgres.url) {
    return undefined;
  }

  if (config.postgres.sslMode === "require") {
    return { rejectUnauthorized: false };
  }

  return undefined;
}

let pool = null;

export function isDatabaseConfigured() {
  return Boolean(config.postgres.url);
}

export function getPool() {
  if (!isDatabaseConfigured()) {
    return null;
  }

  if (!pool) {
    pool = new Pool({
      connectionString: config.postgres.url,
      ssl: createSslConfig()
    });
  }

  return pool;
}

export async function initializeDatabase() {
  const db = getPool();

  if (!db) {
    console.warn("PostgreSQL is not configured. Machine status data will not be persisted.");
    return false;
  }

  await db.query(schemaSql);
  return true;
}
