import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { MAX_VIDEO_DURATION_SECONDS } from "../domain/video-processor.entity.js";
import { videoTooLong, internalError } from "../../shared/errors.js";
import type { IDownloaderPort, DownloadOutput } from "../application/ports/downloader.port.js";

export class YtDlpAdapter implements IDownloaderPort {
  async downloadVideo(url: string, destDir: string): Promise<DownloadOutput> {
    const ytdlp = process.env.YTDLP_PATH ?? "/opt/bin/yt-dlp";

    const ffmpeg = process.env.FFMPEG_PATH ?? "/opt/bin/ffmpeg";

    const args = [
      "--no-playlist",
      "--no-warnings",
      "--restrict-filenames",
      "--write-info-json",
      "--ffmpeg-location", ffmpeg,
      "-f", "bv*[vcodec~='^(h264|avc)'][ext=mp4]+ba[ext=m4a]/bv*[vcodec~='^(h264|avc)']+ba/b[vcodec~='^(h264|avc)']/bv*+ba/b",
      "--merge-output-format", "mp4",
      "--recode-video", "mp4",
      "--postprocessor-args", "ffmpeg:-c:v libx264 -c:a aac -movflags +faststart",
      "-P", destDir,
      "-o", "%(id)s.%(ext)s",
      url,
    ];

    await new Promise<void>((resolve, reject) => {
      const child = spawn(ytdlp, args, { stdio: "pipe" });
      let stderr = "";
      child.stderr?.on("data", (d: Buffer) => { stderr += d.toString(); });
      child.on("close", (code) => {
        if (code !== 0) reject(internalError(`yt-dlp exited with code ${code}: ${stderr}`));
        else resolve();
      });
      child.on("error", reject);
    });

    // Find the info JSON file
    const { readdirSync } = await import("node:fs");
    const files = readdirSync(destDir);
    const infoFile = files.find((f) => f.endsWith(".info.json"));
    const videoFile = files.find((f) => !f.endsWith(".info.json") && !f.endsWith(".part"));

    if (!infoFile || !videoFile) {
      throw internalError("yt-dlp did not produce expected output files");
    }

    const infoPath = join(destDir, infoFile);
    const infoRaw = await readFile(infoPath, "utf-8");
    const info = JSON.parse(infoRaw) as {
      id: string;
      title: string;
      duration: number;
      thumbnail?: string;
    };

    if (info.duration > MAX_VIDEO_DURATION_SECONDS) {
      throw videoTooLong();
    }

    const localPath = join(destDir, videoFile);
    const { stat } = await import("node:fs/promises");
    const stats = await stat(localPath);

    return {
      localPath,
      fileSizeBytes: stats.size,
      videoInfo: {
        videoId: info.id,
        title: info.title,
        duration: info.duration,
        thumbnailUrl: info.thumbnail ?? null,
      },
    };
  }
}
