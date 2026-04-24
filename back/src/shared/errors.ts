export enum ErrorCode {
  INVALID_URL = "INVALID_URL",
  VIDEO_TOO_LONG = "VIDEO_TOO_LONG",
  INVALID_TRIM_RANGE = "INVALID_TRIM_RANGE",
  JOB_NOT_FOUND = "JOB_NOT_FOUND",
  JOB_NOT_READY = "JOB_NOT_READY",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  INTERNAL_ERROR = "INTERNAL_ERROR",
  VIDEO_NOT_AVAILABLE = "VIDEO_NOT_AVAILABLE",
}

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly httpStatus: number,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function invalidUrl(): AppError {
  return new AppError(ErrorCode.INVALID_URL, "The provided URL is not a valid TikTok URL.", 400);
}

export function videoTooLong(): AppError {
  return new AppError(
    ErrorCode.VIDEO_TOO_LONG,
    "Video exceeds the maximum allowed duration of 5 minutes.",
    422,
  );
}

export function invalidTrimRange(): AppError {
  return new AppError(
    ErrorCode.INVALID_TRIM_RANGE,
    "trimStart must be less than trimEnd and trimEnd must not exceed the video duration.",
    400,
  );
}

export function jobNotFound(): AppError {
  return new AppError(ErrorCode.JOB_NOT_FOUND, "The requested job was not found.", 404);
}

export function jobNotReady(): AppError {
  return new AppError(
    ErrorCode.JOB_NOT_READY,
    "The job must be in 'ready' or 'trimmed' status for this operation.",
    409,
  );
}

export function rateLimitExceeded(): AppError {
  return new AppError(
    ErrorCode.RATE_LIMIT_EXCEEDED,
    "Rate limit exceeded. Maximum 10 requests per minute per IP.",
    429,
  );
}

export function videoNotAvailable(): AppError {
  return new AppError(
    ErrorCode.VIDEO_NOT_AVAILABLE,
    "Video is not available for download or does not exist.",
    404,
  );
}

export function internalError(cause?: unknown): AppError {
  return new AppError(ErrorCode.INTERNAL_ERROR, "An internal error occurred.", 500, cause);
}
