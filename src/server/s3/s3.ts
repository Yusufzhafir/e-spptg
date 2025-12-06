import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'auto',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
  endpoint: process.env.S3_ENDPOINT,
});

export async function generateUploadUrl(
  filename: string,
  mimeType: string,
  category: string
): Promise<{
  uploadUrl: string;
  publicUrl: string;
  s3Key: string;
}> {
  // Generate unique key
  const timestamp = Date.now();
  const randomId = crypto.randomBytes(8).toString('hex');
  const s3Key = `submissions/${category}/${timestamp}-${randomId}-${filename}`;

  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME!,
    Key: s3Key,
    ContentType: mimeType,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, {
    expiresIn: 3600, // 1 hour
  });

  const publicUrl = `${process.env.S3_PUBLIC_URL || process.env.S3_ENDPOINT}/${process.env.S3_BUCKET_NAME}/${s3Key}`;

  return {
    uploadUrl,
    publicUrl,
    s3Key,
  };
}

export async function getDownloadUrl(s3Key: string) {
  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME!,
    Key: s3Key,
  });

  return getSignedUrl(s3Client, command, {
    expiresIn: 3600,
  });
}