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

/**
 * Generate S3 key and public URL for a file
 * No longer generates presigned URLs - uploads are handled server-side via tRPC
 */
export async function generateUploadUrl(
  filename: string,
  mimeType: string,
  category: string
): Promise<{
  publicUrl: string;
  s3Key: string;
}> {
  // Generate unique key
  const timestamp = Date.now();
  const randomId = crypto.randomBytes(8).toString('hex');
  const s3Key = `submissions/${category}/${timestamp}-${randomId}-${filename}`;

  const publicUrl = `${process.env.S3_PUBLIC_URL || process.env.S3_ENDPOINT}/${process.env.S3_BUCKET_NAME}/${s3Key}`;

  return {
    publicUrl,
    s3Key,
  };
}

/**
 * Upload file buffer directly to S3 (server-side)
 */
export async function uploadFileToS3(
  fileBuffer: Buffer,
  s3Key: string,
  contentType: string
): Promise<{
  success: boolean;
  publicUrl: string;
}> {
  try {
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME!,
      Key: s3Key,
      Body: fileBuffer,
      ContentType: contentType,
    });

    await s3Client.send(command);

    const publicUrl = `${process.env.S3_PUBLIC_URL || process.env.S3_ENDPOINT}/${process.env.S3_BUCKET_NAME}/${s3Key}`;

    return {
      success: true,
      publicUrl,
    };
  } catch (error) {
    console.error('Error uploading file to S3:', error);
    throw new Error(`Failed to upload file to S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
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

/**
 * Generate a signed URL for a template document
 * Templates are stored at list-dokumen/template-documents/
 * Signed URL expires in 1 week (604800 seconds)
 */
export async function getTemplateSignedUrl(templateType: string): Promise<string> {
  // Dynamic import to avoid circular dependencies
  const { TEMPLATE_FILENAME_MAP } = await import('@/lib/templates');
  const filename = templateType//TEMPLATE_FILENAME_MAP[templateType as keyof typeof TEMPLATE_FILENAME_MAP];
  if (!filename) {
    throw new Error(`Template type tidak valid: ${templateType}`);
  }
  const s3Key = `template-documents/${filename}`;
  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME!,
    Key: s3Key,
  });

  const signedUrl = await getSignedUrl(s3Client, command, {
    expiresIn: 604800, // 1 week
  });
  console.log('signedUrl\n\n\n', signedUrl,'\n\n\n');

  return signedUrl;
}