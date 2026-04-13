import {
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getS3Client, BUCKET_NAME } from "../../../shared/s3.client.js";
import type { IStoragePort } from "../../application/ports/storage.port.js";
import { createReadStream, createWriteStream } from "node:fs";
import { stat } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";

export class ArtifactStorageAdapter implements IStoragePort {
  private get client() { return getS3Client(); }

  async upload(key: string, localPath: string, contentType: string): Promise<number> {
    const body = createReadStream(localPath);
    await this.client.send(
      new PutObjectCommand({ Bucket: BUCKET_NAME, Key: key, Body: body, ContentType: contentType }),
    );
    const stats = await stat(localPath);
    return stats.size;
  }

  async download(key: string, destPath: string): Promise<void> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }),
    );
    if (!response.Body) {
      throw new Error(`S3 GetObject returned empty body for key: ${key}`);
    }
    const writer = createWriteStream(destPath);
    await pipeline(response.Body as Readable, writer);
  }

  async generatePresignedUrl(key: string, expiresIn = 3600): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }),
      { expiresIn },
    );
  }

  async objectExists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
      return true;
    } catch (err) {
      if (err instanceof S3ServiceException && err.$metadata.httpStatusCode === 404) {
        return false;
      }
      throw err;
    }
  }
}
