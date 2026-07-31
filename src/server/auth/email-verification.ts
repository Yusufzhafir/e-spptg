import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { and, eq, isNull, lt } from 'drizzle-orm';
import { db, DBTransaction } from '@/server/db/db';
import { emailVerificationTokens, users } from '@/server/db/schema';

/**
 * 24 hours rather than the reset flow's 1 hour. This link only proves an address
 * is reachable — it grants no password change — and someone who signs up in the
 * evening will often not open their mail until the next morning. A window short
 * enough to expire before then would send most people straight to "kirim ulang".
 */
export const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Mint a verification token and return the raw value for the email. Outstanding
 * unused tokens for the same user are dropped first, so "kirim ulang" makes the
 * previous link dead — otherwise an old message forwarded to someone else would
 * still verify the account.
 */
export async function createEmailVerificationToken(
  userId: number,
  tx?: DBTransaction
): Promise<{ token: string; expiresAt: Date }> {
  const queryDb = tx || db;
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);

  await queryDb
    .delete(emailVerificationTokens)
    .where(
      and(
        eq(emailVerificationTokens.userId, userId),
        isNull(emailVerificationTokens.usedAt)
      )
    );

  await queryDb.insert(emailVerificationTokens).values({
    id: hashToken(token),
    userId,
    expiresAt,
  });

  return { token, expiresAt };
}

/**
 * Resolve a raw token to its row and user, or null when unknown, expired or
 * already redeemed — the three are indistinguishable to the caller so the page
 * cannot be used to probe which links ever existed.
 */
export async function checkEmailVerificationToken(token: string) {
  if (!token) return null;

  const row = await db
    .select({ token: emailVerificationTokens, user: users })
    .from(emailVerificationTokens)
    .innerJoin(users, eq(emailVerificationTokens.userId, users.id))
    .where(eq(emailVerificationTokens.id, hashToken(token)))
    .limit(1);

  const found = row[0];
  if (!found) return null;
  if (found.token.usedAt) return null;
  if (found.token.expiresAt.getTime() <= Date.now()) return null;

  return found;
}

/**
 * Claim a token. Scoped by `usedAt IS NULL` and reported through the number of
 * rows updated, so two clicks on the same link cannot both win.
 */
export async function markEmailVerificationTokenUsed(
  tokenId: string,
  tx?: DBTransaction
): Promise<boolean> {
  const queryDb = tx || db;
  const updated = await queryDb
    .update(emailVerificationTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(emailVerificationTokens.id, tokenId),
        isNull(emailVerificationTokens.usedAt)
      )
    )
    .returning({ id: emailVerificationTokens.id });

  return updated.length > 0;
}

/** Housekeeping for links nobody opened. */
export async function deleteExpiredEmailVerificationTokens(): Promise<void> {
  await db
    .delete(emailVerificationTokens)
    .where(lt(emailVerificationTokens.expiresAt, new Date()));
}
