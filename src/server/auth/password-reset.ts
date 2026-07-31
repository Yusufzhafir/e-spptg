import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { and, eq, isNull, lt } from 'drizzle-orm';
import { db, DBTransaction } from '@/server/db/db';
import { passwordResetTokens, users } from '@/server/db/schema';

/**
 * Short-lived on purpose: the link travels through email, so the window in which
 * a leaked inbox turns into an account takeover should be small. One hour is the
 * usual compromise between that and someone who reads their mail on a break.
 */
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Mint a reset token for a user and return the raw value to put in the email.
 *
 * Any of the user's outstanding tokens are invalidated first, so requesting a
 * new link makes every older link dead — otherwise a forwarded or shoulder-read
 * old email would still work.
 */
export async function createPasswordResetToken(
  userId: number,
  tx?: DBTransaction
): Promise<{ token: string; expiresAt: Date }> {
  const queryDb = tx || db;
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await queryDb
    .delete(passwordResetTokens)
    .where(and(eq(passwordResetTokens.userId, userId), isNull(passwordResetTokens.usedAt)));

  await queryDb.insert(passwordResetTokens).values({
    id: hashToken(token),
    userId,
    expiresAt,
  });

  return { token, expiresAt };
}

/**
 * Resolve a raw reset token to its user, or null when it is unknown, expired or
 * already redeemed. The three cases are deliberately indistinguishable to the
 * caller so the UI cannot be used to probe which links ever existed.
 */
export async function consumeCheckPasswordResetToken(token: string) {
  if (!token) return null;

  const row = await db
    .select({ token: passwordResetTokens, user: users })
    .from(passwordResetTokens)
    .innerJoin(users, eq(passwordResetTokens.userId, users.id))
    .where(eq(passwordResetTokens.id, hashToken(token)))
    .limit(1);

  const found = row[0];
  if (!found) return null;
  if (found.token.usedAt) return null;
  if (found.token.expiresAt.getTime() <= Date.now()) return null;

  return found;
}

/**
 * Mark a token spent. Scoped by `usedAt IS NULL` and reported through the number
 * of rows updated, so two requests racing on the same link cannot both win.
 */
export async function markPasswordResetTokenUsed(
  tokenId: string,
  tx?: DBTransaction
): Promise<boolean> {
  const queryDb = tx || db;
  const updated = await queryDb
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(passwordResetTokens.id, tokenId), isNull(passwordResetTokens.usedAt)))
    .returning({ id: passwordResetTokens.id });

  return updated.length > 0;
}

/** Housekeeping for tokens nobody redeemed. */
export async function deleteExpiredPasswordResetTokens(): Promise<void> {
  await db.delete(passwordResetTokens).where(lt(passwordResetTokens.expiresAt, new Date()));
}
