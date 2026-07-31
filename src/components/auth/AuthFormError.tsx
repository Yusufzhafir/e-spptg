'use client';

import { AlertCircle } from 'lucide-react';

/**
 * Form-level failure banner for the auth screens — wrong credentials, a
 * throttled attempt, an expired reset link. Field-level problems stay with
 * `FieldError` under the input they belong to.
 *
 * `role="alert"` so a screen reader announces the failure instead of leaving the
 * user to wonder why pressing "Masuk" did nothing.
 */
export function AuthFormError({ message }: { message?: string | null }) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
