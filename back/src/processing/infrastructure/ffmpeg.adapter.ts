import { spawn } from "node:child_process";
import { internalError } from "../../shared/errors.js";
import type { ITranscoderPort } from "../application/ports/transcoder.port.js";

const FFMPEG = process.env.FFMPEG_PATH ?? "/opt/bin/ffmpeg";

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(FFMPEG, args, { stdio: "pipe" });
    let stderr = "";
    child.stderr?.on("data", (d: Buffer) => { stderr += d.toString(); });
    child.on("close", (code) => {
      if (code !== 0) reject(internalError(`ffmpeg exited with code ${code}: ${stderr}`));
      else resolve();
    });
    child.on("error", reject);
  });
}

export class FfmpegAdapter implements ITranscoderPort {
  async trim(inputPath: string, outputPath: string, start: number, end: number): Promise<void> {
    await runFfmpeg([
      "-y",
      "-ss", String(start),
      "-to", String(end),
      "-i", inputPath,
      "-c", "copy",
      "-avoid_negative_ts", "make_zero",
      outputPath,
    ]);
  }

  async createGif(inputPath: string, outputPath: string, start: number, end: number): Promise<void> {
    const MAX_GIF_DURATION = 6;
    const segmentDuration = end - start;
    if (segmentDuration > MAX_GIF_DURATION) {
      throw internalError(`GIF duration cannot exceed ${MAX_GIF_DURATION} seconds (got ${segmentDuration}s)`);
    }
    await runFfmpeg([
      "-y",
      "-ss", String(start),
      "-t", String(segmentDuration),
      "-i", inputPath,
      "-an",
      "-c:v", "libopenh264",
      "-b:v", "800k",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      "-r", "15",
      "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
      outputPath,
    ]);
  }

  async extractMp3(inputPath: string, outputPath: string, start?: number, end?: number): Promise<void> {
    const args: string[] = ["-y"];
    if (start !== undefined) args.push("-ss", String(start));
    if (end !== undefined) args.push("-to", String(end));
    args.push("-i", inputPath, "-vn", "-acodec", "libmp3lame", "-q:a", "2", outputPath);
    await runFfmpeg(args);
  }
}
