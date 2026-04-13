import type { CacheArtifact } from "../../domain/cache-artifact.entity.js";

export interface IArtifactRepository {
  findByKey(
    videoId: string,
    format: "mp4" | "mp3" | "gif",
    artifactType: "original" | "trim" | "gif",
    trimStart?: number,
    trimEnd?: number,
  ): Promise<CacheArtifact | null>;
  save(artifact: CacheArtifact): Promise<void>;
  incrementDownloadCount(
    videoId: string,
    format: "mp4" | "mp3" | "gif",
    artifactType: "original" | "trim" | "gif",
    trimStart?: number,
    trimEnd?: number,
  ): Promise<void>;
}
