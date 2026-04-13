import { S3Client } from "@aws-sdk/client-s3";
import { Resource } from "sst";

let _client: S3Client | undefined;

export function getS3Client(): S3Client {
  if (!_client) {
    _client = new S3Client({});
  }
  return _client;
}

export const BUCKET_NAME: string = (Resource as unknown as Record<string, { name: string }>)["ArtifactsBucket"].name;
