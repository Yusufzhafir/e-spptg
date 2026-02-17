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

export function extractS3KeyFromDocumentUrl(documentUrl: string): string {
  const bucket = process.env.S3_BUCKET_NAME;

  if (!bucket) {
    throw new Error('S3 bucket is not configured');
  }

  const normalizedBucket = bucket.replace(/^\/+|\/+$/g, '');
  const normalizedUrl = documentUrl.trim();

  const baseCandidates = [process.env.S3_PUBLIC_URL, process.env.S3_ENDPOINT]
    .filter((base): base is string => Boolean(base))
    .map((base) => base.replace(/\/+$/g, ''));

  for (const base of baseCandidates) {
    const prefix = `${base}/${normalizedBucket}/`;
    if (normalizedUrl.startsWith(prefix)) {
      const key = normalizedUrl.slice(prefix.length);
      if (key) return decodeURIComponent(key);
    }
  }

  let parsed: URL;
  try {
    parsed = new URL(normalizedUrl);
  } catch {
    throw new Error('Invalid document URL');
  }

  const normalizedPath = parsed.pathname.replace(/^\/+/, '');
  const bucketToken = `${normalizedBucket}/`;
  const bucketIndex = normalizedPath.indexOf(bucketToken);
  if (bucketIndex !== -1) {
    const key = normalizedPath.slice(bucketIndex + bucketToken.length);
    if (key) return decodeURIComponent(key);
  }

  if (parsed.hostname.startsWith(`${normalizedBucket}.`)) {
    const key = normalizedPath;
    if (key) return decodeURIComponent(key);
  }

  throw new Error('Could not extract S3 key from document URL');
}

export async function getDownloadUrl(s3Key: string, expiresInSeconds = 3600) {
  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME!,
    Key: s3Key,
  });

  return getSignedUrl(s3Client, command, {
    expiresIn: expiresInSeconds,
  });
}

/**
 * Generate a signed URL for a template document
 * Templates are stored at list-dokumen/template-documents/
 * Signed URL expires in 1 week (604800 seconds)
 */
export async function getTemplateSignedUrl(templateType: string): Promise<string> {
  const filename = templateType;
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

  return signedUrl;
}

/**
 * Fetch template PDF from S3 server-side and return as Buffer
 * This avoids CORS issues when accessing private S3 buckets
 */
export async function fetchTemplatePDF(templateType: string): Promise<Buffer> {
  const filename = templateType;
  if (!filename) {
    throw new Error(`Template type tidak valid: ${templateType}`);
  }
  const s3Key = `template-documents/${filename}`;
  
  try {
    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME!,
      Key: s3Key,
    });

    const response = await s3Client.send(command);
    
    if (!response.Body) {
      throw new Error('Template PDF not found or empty');
    }

    // Convert stream to buffer
    // AWS SDK v3 returns Body as a Readable stream
    const bodyStream = response.Body;
    
    if (!bodyStream) {
      throw new Error('Template PDF body is empty');
    }

    // Convert stream to buffer using async iteration (works for both Node.js and web streams)
    const chunks: Buffer[] = [];
    
    // Check if it's an async iterable (Node.js Readable stream or web ReadableStream)
    const asyncIterableBody = bodyStream as AsyncIterable<unknown>;
    if (typeof asyncIterableBody[Symbol.asyncIterator] === 'function') {
      for await (const chunk of asyncIterableBody) {
        if (Buffer.isBuffer(chunk)) {
          chunks.push(chunk);
        } else if (chunk instanceof Uint8Array) {
          chunks.push(Buffer.from(chunk));
        } else {
          chunks.push(Buffer.from(String(chunk)));
        }
      }
      return Buffer.concat(chunks);
    }
    
    // Fallback: Handle as Node.js Readable stream with event emitter
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const stream = bodyStream as NodeJS.ReadableStream;
      
      stream.on('data', (chunk: unknown) => {
        if (Buffer.isBuffer(chunk)) {
          chunks.push(chunk);
        } else if (chunk instanceof Uint8Array) {
          chunks.push(Buffer.from(chunk));
        } else {
          chunks.push(Buffer.from(String(chunk)));
        }
      });
      
      stream.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
      
      stream.on('error', (error) => {
        reject(error);
      });
    });
  } catch (error) {
    console.error('Error fetching template PDF from S3:', error);
    throw new Error(`Failed to fetch template PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
