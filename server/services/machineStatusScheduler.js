import { config } from "../config.js";
import {
  acquireSchedulerLock,
  releaseSchedulerLock,
  saveMachineStatusSnapshot
} from "../repositories/machineStatusRepository.js";
import { pruneDashboardPresenceSessions } from "../repositories/dashboardPresenceRepository.js";
import { fetchCurrentMachineStatus } from "./shopfloorService.js";

const schedulerState = {
  isRunning: false,
  lastStartedAt: null,
  lastCompletedAt: null,
  lastSucceededAt: null,
  lastErrorMessage: null,
  lastErrorAt: null,
  nextRunAt: null,
  timerId: null
};

function getIntervalMs() {
  return Math.max(15, config.pollingIntervalSeconds) * 1000;
}

function scheduleNextRun() {
  schedulerState.nextRunAt = new Date(Date.now() + getIntervalMs()).toISOString();
  schedulerState.timerId = setTimeout(() => {
    runScheduledSync().catch((error) => {
      console.error("Scheduled machine status sync failed.", error);
    });
  }, getIntervalMs());
}

export function getSchedulerState() {
  return {
    isRunning: schedulerState.isRunning,
    lastStartedAt: schedulerState.lastStartedAt,
    lastCompletedAt: schedulerState.lastCompletedAt,
    lastSucceededAt: schedulerState.lastSucceededAt,
    lastErrorAt: schedulerState.lastErrorAt,
    health: schedulerState.lastErrorAt ? "degraded" : "healthy",
    nextRunAt: schedulerState.nextRunAt,
    intervalSeconds: Math.max(15, config.pollingIntervalSeconds),
    manualRefreshEnabled: config.enableManualRefresh
  };
}

export async function syncMachineStatus() {
  if (schedulerState.isRunning) {
    return {
      skipped: true,
      reason: "sync_already_running",
      scheduler: getSchedulerState()
    };
  }

  schedulerState.isRunning = true;
  schedulerState.lastStartedAt = new Date().toISOString();
  schedulerState.lastErrorMessage = null;
  schedulerState.lastErrorAt = null;
  let lockClient = null;

  try {
    lockClient = await acquireSchedulerLock();

    if (!lockClient) {
      schedulerState.lastCompletedAt = new Date().toISOString();
      return {
        skipped: true,
        reason: "leader_lock_not_acquired",
        scheduler: getSchedulerState()
      };
    }

    await pruneDashboardPresenceSessions().catch((error) => {
      console.error("Dashboard presence pruning failed.", error);
    });

    const statusResult = await fetchCurrentMachineStatus();
    const persistence = await saveMachineStatusSnapshot(statusResult);
    schedulerState.lastCompletedAt = new Date().toISOString();
    schedulerState.lastSucceededAt = schedulerState.lastCompletedAt;

    return {
      skipped: false,
      ...statusResult,
      persistence,
      scheduler: getSchedulerState()
    };
  } catch (error) {
    schedulerState.lastCompletedAt = new Date().toISOString();
    schedulerState.lastErrorAt = schedulerState.lastCompletedAt;
    schedulerState.lastErrorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Machine status sync failed.", error);
    throw error;
  } finally {
    await releaseSchedulerLock(lockClient);
    schedulerState.isRunning = false;
  }
}

export async function runScheduledSync() {
  try {
    await syncMachineStatus();
  } finally {
    scheduleNextRun();
  }
}

export async function startMachineStatusScheduler() {
  if (schedulerState.timerId) {
    clearTimeout(schedulerState.timerId);
  }

  schedulerState.nextRunAt = null;
  runScheduledSync().catch((error) => {
    console.error("Initial machine status sync failed.", error);
  });
}

export function stopMachineStatusScheduler() {
  if (schedulerState.timerId) {
    clearTimeout(schedulerState.timerId);
    schedulerState.timerId = null;
  }
  schedulerState.nextRunAt = null;
}
