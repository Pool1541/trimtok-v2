// Pure key builder functions for TrimtokTable single-table design

export function jobPk(jobId: string): string {
  return `JOB#${jobId}`;
}

export function jobSk(): string {
  return "METADATA";
}

export function artifactPk(videoId: string): string {
  return `ARTIFACT#${videoId}`;
}

export function artifactSk(
  format: string,
  type: string,
  trimStart?: number,
  trimEnd?: number,
): string {
  if (trimStart !== undefined && trimEnd !== undefined) {
    return `${format.toUpperCase()}#${type.toUpperCase()}#${trimStart}#${trimEnd}`;
  }
  return `${format.toUpperCase()}#${type.toUpperCase()}`;
}

export function lockPk(videoId: string): string {
  return `LOCK#${videoId}`;
}

export function lockSk(): string {
  return "LOCK";
}

export function connPk(connId: string): string {
  return `CONN#${connId}`;
}

export function connSk(): string {
  return "METADATA";
}

export function gsi1Pk(jobId: string): string {
  return `JOB#${jobId}`;
}

export function gsi1Sk(connId: string): string {
  return `CONN#${connId}`;
}

export function rateLimitPk(clientIp: string): string {
  const now = Math.floor(Date.now() / 1000);
  const windowId = Math.floor(now / 60);
  return `RATELIMIT#${clientIp}#W#${windowId}`;
}

export function rateLimitSk(): string {
  return "RATELIMIT";
}

export function processingEventSk(iso: string, ulid: string): string {
  return `EVENT#${iso}#${ulid}`;
}
