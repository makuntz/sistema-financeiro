import {
  S3Client,
  HeadObjectCommand,
  DeleteObjectCommand,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Env } from '@pp-planning/config/env';
import {
  InMemoryFileStorage,
  type FileStorage,
  type ObjectMetadata,
  type UploadUrlResult,
} from './file-storage.js';

export function createS3FileStorage(env: Env): FileStorage {
  if (!env.S3_ENDPOINT || !env.S3_ACCESS_KEY || !env.S3_SECRET_KEY) {
    throw new Error(
      'S3 storage requires S3_ENDPOINT, S3_ACCESS_KEY and S3_SECRET_KEY to be configured.',
    );
  }

  return new S3FileStorage({
    endpoint: env.S3_ENDPOINT,
    publicEndpoint: env.S3_PUBLIC_ENDPOINT ?? env.S3_ENDPOINT,
    region: env.S3_REGION,
    bucket: env.S3_BUCKET,
    accessKeyId: env.S3_ACCESS_KEY,
    secretAccessKey: env.S3_SECRET_KEY,
  });
}

type S3FileStorageConfig = {
  endpoint: string;
  publicEndpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

function buildClient(config: {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}): S3Client {
  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: true,
  });
}

export class S3FileStorage implements FileStorage {
  private readonly internalClient: S3Client;
  private readonly publicClient: S3Client;
  private readonly bucket: string;

  constructor(config: S3FileStorageConfig) {
    this.bucket = config.bucket;
    this.internalClient = buildClient({
      endpoint: config.endpoint,
      region: config.region,
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    });
    this.publicClient = buildClient({
      endpoint: config.publicEndpoint,
      region: config.region,
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    });
  }

  async createUploadUrl(input: {
    key: string;
    mimeType: string;
    expiresInSeconds: number;
  }): Promise<UploadUrlResult> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: input.key,
      ContentType: input.mimeType,
    });
    // Sign with the public endpoint so emulator/device can PUT directly.
    const url = await getSignedUrl(this.publicClient, command, {
      expiresIn: input.expiresInSeconds,
    });
    return {
      url,
      expiresAt: new Date(Date.now() + input.expiresInSeconds * 1000),
      headers: { 'Content-Type': input.mimeType },
    };
  }

  async createDownloadUrl(input: {
    key: string;
    expiresInSeconds: number;
  }): Promise<UploadUrlResult> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: input.key,
    });
    const url = await getSignedUrl(this.publicClient, command, {
      expiresIn: input.expiresInSeconds,
    });
    return {
      url,
      expiresAt: new Date(Date.now() + input.expiresInSeconds * 1000),
      headers: {},
    };
  }

  async putObject(input: { key: string; body: Buffer; mimeType: string }): Promise<void> {
    await this.internalClient.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.mimeType,
      }),
    );
  }

  async exists(key: string): Promise<boolean> {
    const metadata = await this.getObjectMetadata(key);
    return metadata != null;
  }

  async getObjectMetadata(key: string): Promise<ObjectMetadata | null> {
    try {
      const response = await this.internalClient.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return {
        sizeInBytes: response.ContentLength ?? 0,
        mimeType: response.ContentType,
      };
    } catch (error: unknown) {
      const err = error as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await this.internalClient.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}

let sharedInMemory: InMemoryFileStorage | null = null;

export function getSharedInMemoryFileStorage(): InMemoryFileStorage {
  if (!sharedInMemory) {
    sharedInMemory = new InMemoryFileStorage();
  }
  return sharedInMemory;
}

export function createFileStorage(env: Env, override?: FileStorage): FileStorage {
  if (override) return override;

  if (env.NODE_ENV === 'test') {
    return getSharedInMemoryFileStorage();
  }

  if (env.NODE_ENV === 'production') {
    if (!env.S3_ENDPOINT || !env.S3_ACCESS_KEY || !env.S3_SECRET_KEY) {
      throw new Error(
        'Production requires S3 storage. Configure S3_ENDPOINT, S3_ACCESS_KEY and S3_SECRET_KEY.',
      );
    }
    return createS3FileStorage(env);
  }

  if (env.S3_ENDPOINT && env.S3_ACCESS_KEY && env.S3_SECRET_KEY) {
    return createS3FileStorage(env);
  }

  return getSharedInMemoryFileStorage();
}
