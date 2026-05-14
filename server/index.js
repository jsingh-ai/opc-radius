import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "./config.js";
import { initializeDatabase, isDatabaseConfigured } from "./db/index.js";
import { saveMachineStatusSnapshot } from "./repositories/machineStatusRepository.js";
import { fetchCurrentMachineStatus } from "./services/shopfloorService.js";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, "../dist");

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    serverTime: new Date().toISOString(),
    apiConfigured: Boolean(config.shopfloor.apiKey),
    databaseConfigured: isDatabaseConfigured()
  });
});

app.get("/api/machine-status/current-status", async (_req, res) => {
  try {
    const statusResult = await fetchCurrentMachineStatus();
    const persistence = await saveMachineStatusSnapshot(statusResult);

    res.json({
      ...statusResult,
      persistence
    });
  } catch (error) {
    const statusCode = error?.status || 500;
    res.status(statusCode).json({
      message:
        error instanceof Error
          ? error.message
          : "Unexpected error while fetching machine status.",
      upstreamPayload: error?.payload,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

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

initializeDatabase()
  .then(() => {
    app.listen(config.port, config.host, () => {
      console.log(
        `Press Radius dashboard server listening on http://${config.host}:${config.port}`
      );
    });
  })
  .catch((error) => {
    console.error("Failed to initialize PostgreSQL schema.", error);
    process.exit(1);
  });
