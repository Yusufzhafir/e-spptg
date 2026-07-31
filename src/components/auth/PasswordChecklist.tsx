'use client';

import { Check, X } from 'lucide-react';
import { passwordChecklist } from '@/lib/password-policy';
import { cn } from '@/lib/utils';

/**
 * Live rundown of the password policy under the field. Shown only once the user
 * has typed something — an untouched form should not open with a list of red
 * crosses telling them what they have done wrong.
 */
export function PasswordChecklist({ value }: { value: string }) {
  if (!value) return null;

  return (
    <ul className="mt-2 grid gap-1 sm:grid-cols-2">
      {passwordChecklist(value).map((rule) => (
        <li
          key={rule.label}
          className={cn(
            'flex items-center gap-1.5 text-xs',
            rule.ok ? 'text-green-600' : 'text-gray-500'
          )}
        >
          {rule.ok ? (
            <Check className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <X className="h-3.5 w-3.5 shrink-0 text-gray-300" />
          )}
          {rule.label}
        </li>
      ))}
    </ul>
  );
}
