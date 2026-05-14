import crypto from "crypto";

export class AppError extends Error {
  constructor(statusCode, publicMessage, internalMessage = publicMessage) {
    super(internalMessage);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.publicMessage = publicMessage;
  }
}

export function attachRequestContext(req, res, next) {
  req.requestId = crypto.randomUUID();
  res.setHeader("X-Request-Id", req.requestId);
  next();
}

export function setApiResponseHeaders(req, res, next) {
  if (req.path.startsWith("/api/")) {
    res.setHeader("Cache-Control", "no-store");
  }
  next();
}

export function notFoundHandler(req, res) {
  res.status(404).json({
    message: "Resource not found.",
    requestId: req.requestId
  });
}

export function errorHandler(error, req, res, _next) {
  const statusCode = error instanceof AppError ? error.statusCode : 500;
  const message =
    error instanceof AppError ? error.publicMessage : "Unexpected server error.";

  if (statusCode >= 500) {
    console.error(`[${req.requestId}]`, error);
  }

  res.status(statusCode).json({
    message,
    requestId: req.requestId
  });
}

export function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
