import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateBucketCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  PutBucketCorsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../env';
import { logger } from '../lib/logger';

const PRESIGN_TTL_SECONDS = 300;

const credentials = {
  accessKeyId: env.S3_ACCESS_KEY_ID,
  secretAccessKey: env.S3_SECRET_ACCESS_KEY,
};

// Two clients: server-to-server calls may use an internal hostname, while URLs handed
// to the browser must be signed against the host the browser can actually reach.
const s3 = new S3Client({
  region: env.S3_REGION,
  endpoint: env.S3_ENDPOINT,
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
  credentials,
});

const presigner = new S3Client({
  region: env.S3_REGION,
  endpoint: env.S3_PUBLIC_ENDPOINT ?? env.S3_ENDPOINT,
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
  credentials,
});

export interface CompletedPart {
  partNumber: number;
  etag: string;
}

export async function ensureBucket(allowedOrigin: string) {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
  } catch {
    await s3
      .send(new CreateBucketCommand({ Bucket: env.S3_BUCKET }))
      .then(() => logger.info('created storage bucket', { bucket: env.S3_BUCKET }))
      .catch((error) => {
        if (error?.name !== 'BucketAlreadyOwnedByYou') throw error;
      });
  }

  // The browser PUTs parts straight at the bucket, so it needs CORS and it needs to read
  // back the ETag of every part. MinIO answers NotImplemented here because it takes its
  // CORS policy from MINIO_API_CORS_ALLOW_ORIGIN instead, which docker-compose sets.
  try {
    await s3.send(
      new PutBucketCorsCommand({
        Bucket: env.S3_BUCKET,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedOrigins: [allowedOrigin],
              AllowedMethods: ['PUT', 'GET', 'HEAD'],
              AllowedHeaders: ['*'],
              ExposeHeaders: ['ETag'],
              MaxAgeSeconds: 3600,
            },
          ],
        },
      }),
    );
    logger.info('applied bucket cors policy', { origin: allowedOrigin });
  } catch (error) {
    logger.warn('could not set bucket cors, configure it on the provider', {
      reason: error instanceof Error ? error.name : String(error),
    });
  }
}

export async function createMultipartUpload(key: string, contentType: string) {
  const result = await s3.send(
    new CreateMultipartUploadCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      ContentType: contentType,
    }),
  );

  if (!result.UploadId) {
    throw new Error('S3 did not return an upload id');
  }

  return result.UploadId;
}

export function presignUploadPart(key: string, uploadId: string, partNumber: number) {
  return getSignedUrl(
    presigner,
    new UploadPartCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    }),
    { expiresIn: PRESIGN_TTL_SECONDS * 12 },
  );
}

export async function completeMultipartUpload(
  key: string,
  uploadId: string,
  parts: CompletedPart[],
) {
  await s3.send(
    new CompleteMultipartUploadCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts.map((part) => ({ PartNumber: part.partNumber, ETag: part.etag })),
      },
    }),
  );
}

export async function abortMultipartUpload(key: string, uploadId: string) {
  await s3
    .send(new AbortMultipartUploadCommand({ Bucket: env.S3_BUCKET, Key: key, UploadId: uploadId }))
    .catch((error) => logger.warn('failed to abort multipart upload', { key, error: String(error) }));
}

export async function headObject(key: string) {
  const result = await s3.send(new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
  return { size: result.ContentLength ?? 0, etag: result.ETag?.replaceAll('"', '') ?? null };
}

export async function readObjectHead(key: string, bytes: number) {
  const result = await s3.send(
    new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Range: `bytes=0-${bytes - 1}` }),
  );
  return Buffer.from(await result.Body!.transformToByteArray());
}

export async function deleteObject(key: string) {
  await s3.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
}

export function presignDownload(
  key: string,
  options: { disposition: string; contentType: string },
) {
  return getSignedUrl(
    presigner,
    new GetObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      ResponseContentDisposition: options.disposition,
      ResponseContentType: options.contentType,
    }),
    { expiresIn: PRESIGN_TTL_SECONDS },
  );
}
