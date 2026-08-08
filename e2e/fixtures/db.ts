/**
 * Direct database access for seeding and teardown.
 *
 * Accounts are inserted with a scrypt digest in the same format as
 * `src/server/auth/password.ts` rather than through `users.create`, which would
 * mail a real invite link to whatever address it is handed.
 */
import dotenv from 'dotenv';
import { Client } from 'pg';
import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';

dotenv.config({ path: '.env.development.local' });

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number }
) => Promise<Buffer>;

/** Mirrors src/server/auth/password.ts — `scrypt$N$r$p$salt$hash`, both base64. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 32, {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 256 * 16384 * 8,
  });
  return `scrypt$16384$8$1$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function withDb<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set — the browser suite needs a database.');
  }

  const client = new Client({ connectionString });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}
