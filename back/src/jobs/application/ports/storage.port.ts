export interface IStoragePort {
  /** Uploads a local file to S3. Returns the file size in bytes. */
  upload(key: string, localPath: string, contentType: string): Promise<number>;
  /** Streams an S3 object to a local file path. */
  download(key: string, destPath: string): Promise<void>;
  /** Generates a presigned GET URL. Default expiry: 3600s. */
  generatePresignedUrl(key: string, expiresIn?: number): Promise<string>;
  /** Returns true if the S3 object exists, false if not found. */
  objectExists(key: string): Promise<boolean>;
}
