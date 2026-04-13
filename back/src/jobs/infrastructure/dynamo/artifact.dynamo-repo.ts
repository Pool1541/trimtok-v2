import { PutCommand, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { getDynamoClient, TABLE_NAME } from "../../../shared/dynamo.client.js";
import { artifactPk, artifactSk } from "../../../shared/table-keys.js";
import { artifactTtlSeconds } from "../../domain/cache-artifact.entity.js";
import type { IArtifactRepository } from "../../application/ports/artifact.repository.js";
import type { CacheArtifact } from "../../domain/cache-artifact.entity.js";

export class ArtifactDynamoRepo implements IArtifactRepository {
  private get client() { return getDynamoClient(); }

  async findByKey(
    videoId: string,
    format: "mp4" | "mp3" | "gif",
    artifactType: "original" | "trim" | "gif",
    trimStart?: number,
    trimEnd?: number,
  ): Promise<CacheArtifact | null> {
    const result = await this.client.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          pk: artifactPk(videoId),
          sk: artifactSk(format, artifactType, trimStart, trimEnd),
        },
      }),
    );
    return (result.Item as CacheArtifact) ?? null;
  }

  async save(artifact: CacheArtifact): Promise<void> {
    const ttlSec = artifactTtlSeconds(artifact.format, artifact.artifactType);
    const item = {
      ...artifact,
      expiresAt: Math.floor(Date.now() / 1000) + ttlSec,
    };
    await this.client.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
  }

  async incrementDownloadCount(
    videoId: string,
    format: "mp4" | "mp3" | "gif",
    artifactType: "original" | "trim" | "gif",
    trimStart?: number,
    trimEnd?: number,
  ): Promise<void> {
    await this.client.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          pk: artifactPk(videoId),
          sk: artifactSk(format, artifactType, trimStart, trimEnd),
        },
        UpdateExpression: "ADD downloadCount :one",
        ExpressionAttributeValues: { ":one": 1 },
      }),
    );
  }
}
