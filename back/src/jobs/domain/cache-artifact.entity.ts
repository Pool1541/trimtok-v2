export interface CacheArtifact {
  pk: string;
  sk: string;
  type: "ARTIFACT";
  videoId: string;
  tiktokUrl: string;
  format: "mp4" | "mp3" | "gif";
  artifactType: "original" | "trim" | "gif";
  s3Key: string;
  fileSizeBytes?: number;
  duration?: number;
  title?: string;
  thumbnailUrl?: string;
  trimStart?: number;
  trimEnd?: number;
  downloadCount: number;
  createdAt: string;
  /** Unix epoch seconds, TTL attribute */
  expiresAt: number;
}

// TTL values per D3 (research.md decision table)
const TTL_MAP: Record<string, Record<string, number>> = {
  mp4: { original: 172800, trim: 86400 },
  gif: { gif: 86400 },
  mp3: { original: 172800, trim: 86400 },
};

export function artifactTtlSeconds(
  format: "mp4" | "mp3" | "gif",
  artifactType: "original" | "trim" | "gif",
): number {
  return TTL_MAP[format]?.[artifactType] ?? 86400;
}
