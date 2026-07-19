import { Injectable, OnModuleInit, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
} from "@aws-sdk/client-s3";

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client: S3Client;
  private bucket: string;
  private privateBucket: string;
  private publicUrl: string;

  constructor(private config: ConfigService) {
    this.bucket = config.get<string>("MINIO_BUCKET", "siges-cctv");
    this.privateBucket = config.get<string>("MINIO_PRIVATE_BUCKET", `${this.bucket}-private`);
    this.publicUrl = config.get<string>("MINIO_PUBLIC_URL", "http://localhost:9000");
    this.client = new S3Client({
      endpoint: config.get<string>("MINIO_ENDPOINT", "http://localhost:9000"),
      region: "us-east-1",
      credentials: {
        accessKeyId: config.get<string>("MINIO_USER", "siges_minio"),
        secretAccessKey: config.get<string>("MINIO_PASSWORD", "siges_minio_change_me"),
      },
      forcePathStyle: true,
    });
  }

  async onModuleInit() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`Bucket "${this.bucket}" already exists`);
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      await this.client.send(
        new PutBucketPolicyCommand({
          Bucket: this.bucket,
          Policy: JSON.stringify({
            Version: "2012-10-17",
            Statement: [
              {
                Effect: "Allow",
                Principal: "*",
                Action: ["s3:GetObject"],
                Resource: [`arn:aws:s3:::${this.bucket}/*`],
              },
            ],
          }),
        }),
      );
      this.logger.log(`Bucket "${this.bucket}" created with public-read policy`);
    }

    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.privateBucket }));
      this.logger.log(`Private bucket "${this.privateBucket}" already exists`);
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.privateBucket }));
      this.logger.log(`Private bucket "${this.privateBucket}" created without public-read policy`);
    }
  }

  async upload(key: string, buffer: Buffer, mimeType: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      }),
    );
    return `${this.publicUrl}/${this.bucket}/${key}`;
  }

  async uploadPrivateLikeHistorical(key: string, buffer: Buffer, mimeType: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.privateBucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      }),
    );
    // This reference is resolved by a future authorized download endpoint, never by the bucket directly.
    return `private://${key}`;
  }

  async deletePrivateHistorical(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.privateBucket, Key: key }));
  }
}
