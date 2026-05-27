import "dotenv/config";
import express from "express";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "./config.js";
import { closeDatabase, initializeDatabase, isDatabaseConfigured } from "./db/index.js";
import {
  AppError,
  attachRequestContext,
  asyncHandler,
  errorHandler,
  notFoundHandler,
  setApiResponseHeaders
} from "./lib/http.js";
import { getCurrentMachineStatuses } from "./repositories/machineStatusRepository.js";
import {
  getDashboardPresenceSummary,
  upsertDashboardPresence
} from "./repositories/dashboardPresenceRepository.js";
import { getMachineStatusAnalysis } from "./repositories/machineStatusAnalysisRepository.js";
import {
  getSchedulerState,
  startMachineStatusScheduler,
  stopMachineStatusScheduler,
  syncMachineStatus
} from "./services/machineStatusScheduler.js";
import { parsePresenceHeartbeat } from "./models/presenceModel.js";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, "../dist");
let server = null;

app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: config.nodeEnv === "production" ? undefined : false
  })
);
app.use(attachRequestContext);
app.use(setApiResponseHeaders);
app.use(express.json({ limit: "32kb" }));

app.get("/api/health", asyncHandler(async (_req, res) => {
  res.json({
    ok: true,
    serverTime: new Date().toISOString(),
    apiConfigured: Boolean(config.shopfloor.apiKey),
    databaseConfigured: isDatabaseConfigured(),
    scheduler: getSchedulerState()
  });
}));

app.get("/api/machine-status/current-status", asyncHandler(async (_req, res) => {
  const statusResult = await getCurrentMachineStatuses();
  res.json({
    ...statusResult,
    scheduler: getSchedulerState()
  });
}));

app.get("/api/machine-status/analysis", asyncHandler(async (req, res) => {
  const rawWindowHours = Number.parseInt(req.query.windowHours, 10);
  const windowHours = Number.isFinite(rawWindowHours)
    ? Math.min(24 * 31, Math.max(1, rawWindowHours))
    : 24;

  const since = req.query.since ? new Date(String(req.query.since)) : null;
  const until = req.query.until ? new Date(String(req.query.until)) : null;
  const machineIds = typeof req.query.machineIds === "string"
    ? req.query.machineIds
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    : [];
  const hasCustomRange =
    since instanceof Date &&
    !Number.isNaN(since.getTime()) &&
    until instanceof Date &&
    !Number.isNaN(until.getTime()) &&
    since.getTime() < until.getTime();

  const result = await getMachineStatusAnalysis(
    hasCustomRange
      ? { since, until, machineIds }
      : { windowHours, machineIds }
  );
  res.json({
    ...result,
    scheduler: getSchedulerState()
  });
}));

app.post("/api/telemetry/dashboard-view", asyncHandler(async (req, res) => {
  const payload = parsePresenceHeartbeat(req.body);
  const result = await upsertDashboardPresence(payload, req.get("user-agent"));
  res.status(202).json(result);
}));

app.get("/api/admin/dashboard-presence", asyncHandler(async (_req, res) => {
  const result = await getDashboardPresenceSummary();
  res.json(result);
}));

app.post("/api/machine-status/current-status/refresh", asyncHandler(async (_req, res) => {
  if (!config.enableManualRefresh) {
    throw new AppError(403, "Manual refresh is disabled.");
  }

  const result = await syncMachineStatus();
  res.json(result);
}));

if (process.env.NODE_ENV === "production") {
  app.use(express.static(distDir));

  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) {
      next();
      return;
    }

    res.sendFile(path.join(distDir, "index.html"));
  });
}

app.use(notFoundHandler);
app.use(errorHandler);

async function shutdown(signal) {
  console.log(`Received ${signal}. Shutting down.`);
  stopMachineStatusScheduler();

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }

  await closeDatabase();
  process.exit(0);
}

initializeDatabase()
  .then(() => {
    startMachineStatusScheduler();
    server = app.listen(config.port, config.host, () => {
      console.log(
        `Press Radius dashboard server listening on http://${config.host}:${config.port}`
      );
      console.log(
        `Machine status scheduler running every ${Math.max(15, config.pollingIntervalSeconds)} seconds`
      );
    });
  })
  .catch((error) => {
    console.error("Failed to initialize dashboard services.", error);
    process.exit(1);
  });

process.on("SIGINT", () => {
  shutdown("SIGINT").catch((error) => {
    console.error("Failed to shut down cleanly.", error);
    process.exit(1);
  });
});

process.on("SIGTERM", () => {
  shutdown("SIGTERM").catch((error) => {
    console.error("Failed to shut down cleanly.", error);
    process.exit(1);
  });
});
