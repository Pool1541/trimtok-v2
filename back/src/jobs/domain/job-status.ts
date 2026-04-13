export const JobStatus = {
  pending: "pending",
  downloading: "downloading",
  ready: "ready",
  trimming: "trimming",
  trimmed: "trimmed",
  creating_gif: "creating_gif",
  gif_created: "gif_created",
  creating_mp3: "creating_mp3",
  mp3_ready: "mp3_ready",
  error: "error",
} as const;

export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

export const TERMINAL_STATUSES: ReadonlySet<JobStatus> = new Set<JobStatus>([
  JobStatus.ready,
  JobStatus.trimmed,
  JobStatus.gif_created,
  JobStatus.mp3_ready,
  JobStatus.error,
]);

export const TERMINAL_WITH_ARTIFACT: ReadonlySet<JobStatus> = new Set<JobStatus>([
  JobStatus.ready,
  JobStatus.trimmed,
  JobStatus.gif_created,
  JobStatus.mp3_ready,
]);
