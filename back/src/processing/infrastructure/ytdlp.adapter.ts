import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { MAX_VIDEO_DURATION_SECONDS } from "../domain/video-processor.entity.js";
import { videoTooLong, internalError, videoNotAvailable } from "../../shared/errors.js";
import type { IDownloaderPort, DownloadOutput } from "../application/ports/downloader.port.js";

interface YtDlpMetadata {
  id: string;
  title: string;
  duration: number;
  thumbnail?: string;
}

export class YtDlpAdapter implements IDownloaderPort {
  private async runYtDlp(ytdlpPath: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
    return await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      const child = spawn(ytdlpPath, args, { stdio: "pipe" });
      let stdout = "";
      let stderr = "";

      child.stdout?.on("data", (d: Buffer) => {
        stdout += d.toString();
      });
      child.stderr?.on("data", (d: Buffer) => {
        stderr += d.toString();
      });

      child.on("close", (code) => {
        if (code !== 0) {
          reject(internalError(`yt-dlp exited with code ${code}: ${stderr}`));
          return;
        }
        resolve({ stdout, stderr });
      });

      child.on("error", reject);
    });
  }

  private toDomainError(err: unknown): Error {
    if (!(err instanceof Error)) {
      return internalError("Unknown error type from yt-dlp process");
    }

    const cause = "cause" in err ? (err as { cause?: unknown }).cause : undefined;
    const details = `${err.message} ${typeof cause === "string" ? cause : ""}`.toLowerCase();
    if (details.includes("is blocked from accessing this post") || details.includes("video unavailable")) {
      return videoNotAvailable();
    }

    return err;
  }

  private async fetchMetadata(ytdlpPath: string, url: string): Promise<YtDlpMetadata> {
    const probeArgs = [
      "--no-playlist",
      "--no-warnings",
      "--skip-download",
      "--dump-single-json",
      url,
    ];

    const { stdout } = await this.runYtDlp(ytdlpPath, probeArgs);

    let parsed: unknown;
    try {
      parsed = JSON.parse(stdout);
    } catch {
      throw internalError("Failed to parse yt-dlp metadata output");
    }

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as { id?: unknown }).id !== "string" ||
      typeof (parsed as { title?: unknown }).title !== "string" ||
      typeof (parsed as { duration?: unknown }).duration !== "number"
    ) {
      throw internalError("yt-dlp metadata output is missing required fields");
    }

    const metadata = parsed as YtDlpMetadata;
    return {
      id: metadata.id,
      title: metadata.title,
      duration: metadata.duration,
      thumbnail: metadata.thumbnail,
    };
  }

  async downloadVideo(url: string, destDir: string): Promise<DownloadOutput> {
    const ytdlp = process.env.YTDLP_PATH ?? "/opt/bin/yt-dlp";

    const ffmpeg = process.env.FFMPEG_PATH ?? "/opt/bin/ffmpeg";

    const metadata = await this.fetchMetadata(ytdlp, url).catch((err) => {
      throw this.toDomainError(err);
    });
    
    if (metadata.duration > MAX_VIDEO_DURATION_SECONDS) {
      throw videoTooLong();
    }

    // Use an isolated subdirectory per download to avoid picking up stale files
    // from previous Lambda invocations that reuse /tmp across warm starts.
    const { mkdtemp } = await import("node:fs/promises");
    const workDir = await mkdtemp(join(destDir, "dl-"));

    const args = [
      "--no-playlist",
      "--no-warnings",
      "--restrict-filenames",
      "--write-info-json",
      "--ffmpeg-location", ffmpeg,
      "-f", "bv*[vcodec~='^(h264|avc)'][ext=mp4]+ba[ext=m4a]/bv*[vcodec~='^(h264|avc)']+ba/b[vcodec~='^(h264|avc)']/bv*+ba/b",
      "--merge-output-format", "mp4",
      "--recode-video", "mp4",
      "--postprocessor-args", "ffmpeg:-c:v libopenh264 -c:a aac -movflags +faststart",
      "-P", workDir,
      "-o", "%(id)s.%(ext)s",
      url,
    ];

    await this.runYtDlp(ytdlp, args).catch((err) => {
      throw this.toDomainError(err);
    });
    
    // Find the info JSON file — scan only workDir to avoid stale files in /tmp
    const { readdirSync } = await import("node:fs");
    const files = readdirSync(workDir);
    const infoFile = files.find((f) => f.endsWith(".info.json"));
    const videoFile = files.find((f) => !f.endsWith(".info.json") && !f.endsWith(".part"));

    if (!infoFile || !videoFile) {
      throw internalError("yt-dlp did not produce expected output files");
    }

    const infoPath = join(workDir, infoFile);
    const infoRaw = await readFile(infoPath, "utf-8");
    const info = JSON.parse(infoRaw) as YtDlpMetadata;
    const duration = info.duration ?? metadata.duration;

    const localPath = join(workDir, videoFile);
    const { stat } = await import("node:fs/promises");
    const stats = await stat(localPath);

    return {
      localPath,
      fileSizeBytes: stats.size,
      videoInfo: {
        videoId: info.id ?? metadata.id,
        title: info.title ?? metadata.title,
        duration,
        thumbnailUrl: info.thumbnail ?? metadata.thumbnail ?? null,
      },
    };
  }
}
