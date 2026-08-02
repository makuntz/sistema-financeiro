export type UploadUrlResult = {
  url: string;
  expiresAt: Date;
  headers: Record<string, string>;
};

export type ObjectMetadata = {
  sizeInBytes: number;
  mimeType?: string;
};

export interface FileStorage {
  createUploadUrl(input: {
    key: string;
    mimeType: string;
    expiresInSeconds: number;
  }): Promise<UploadUrlResult>;
  createDownloadUrl(input: { key: string; expiresInSeconds: number }): Promise<UploadUrlResult>;
  exists(key: string): Promise<boolean>;
  getObjectMetadata(key: string): Promise<ObjectMetadata | null>;
  delete?(key: string): Promise<void>;
}

export class InMemoryFileStorage implements FileStorage {
  private readonly objects = new Map<string, { body: Buffer; mimeType: string }>();

  put(key: string, body: Buffer, mimeType: string): void {
    this.objects.set(key, { body, mimeType });
  }

  async createUploadUrl(input: {
    key: string;
    mimeType: string;
    expiresInSeconds: number;
  }): Promise<UploadUrlResult> {
    const expiresAt = new Date(Date.now() + input.expiresInSeconds * 1000);
    return {
      url: `memory://upload/${encodeURIComponent(input.key)}`,
      expiresAt,
      headers: { 'Content-Type': input.mimeType },
    };
  }

  async createDownloadUrl(input: {
    key: string;
    expiresInSeconds: number;
  }): Promise<UploadUrlResult> {
    const expiresAt = new Date(Date.now() + input.expiresInSeconds * 1000);
    return {
      url: `memory://download/${encodeURIComponent(input.key)}`,
      expiresAt,
      headers: {},
    };
  }

  async exists(key: string): Promise<boolean> {
    return this.objects.has(key);
  }

  async getObjectMetadata(key: string): Promise<ObjectMetadata | null> {
    const obj = this.objects.get(key);
    if (!obj) return null;
    return { sizeInBytes: obj.body.length, mimeType: obj.mimeType };
  }

  async delete(key: string): Promise<void> {
    this.objects.delete(key);
  }
}
