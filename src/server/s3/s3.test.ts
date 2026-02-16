import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { extractS3KeyFromDocumentUrl } from './s3';

const ORIGINAL_ENV = process.env;

describe('extractS3KeyFromDocumentUrl', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    process.env.S3_BUCKET_NAME = 'my-bucket';
    delete process.env.S3_PUBLIC_URL;
    delete process.env.S3_ENDPOINT;
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('extracts key using S3_PUBLIC_URL pattern', () => {
    process.env.S3_PUBLIC_URL = 'https://files.example.com';
    const key = extractS3KeyFromDocumentUrl(
      'https://files.example.com/my-bucket/submissions/KTP/file%20name.pdf'
    );

    expect(key).toBe('submissions/KTP/file name.pdf');
  });

  it('extracts key using S3_ENDPOINT pattern', () => {
    process.env.S3_ENDPOINT = 'https://r2.example.com';
    const key = extractS3KeyFromDocumentUrl(
      'https://r2.example.com/my-bucket/submissions/KK/doc.pdf'
    );

    expect(key).toBe('submissions/KK/doc.pdf');
  });

  it('extracts key from pathname fallback when bucket appears in URL path', () => {
    const key = extractS3KeyFromDocumentUrl(
      'https://cdn.example.com/proxy/my-bucket/submissions/Permohonan/a.pdf'
    );

    expect(key).toBe('submissions/Permohonan/a.pdf');
  });

  it('throws when key cannot be extracted', () => {
    expect(() =>
      extractS3KeyFromDocumentUrl('https://cdn.example.com/no-bucket/path.pdf')
    ).toThrow('Could not extract S3 key from document URL');
  });
});
