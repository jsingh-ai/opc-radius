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
