/**
 * Shared Clerk <SignIn/> / <SignUp/> styling so the hosted form matches the rest
 * of the app: no double card border, blue primary buttons, same input rounding.
 */
export const clerkAppearance = {
  variables: {
    colorPrimary: '#2563eb',
    colorText: '#111827',
    colorTextSecondary: '#4b5563',
    colorDanger: '#dc2626',
    borderRadius: '0.5rem',
    fontSize: '0.9375rem',
  },
  elements: {
    // The AuthShell already provides the card, spacing and branding.
    rootBox: 'w-full',
    cardBox: 'w-full shadow-none border-0',
    card: 'w-full shadow-none border-0 bg-transparent p-0',
    header: 'text-left',
    headerTitle: 'text-2xl font-bold text-gray-900',
    headerSubtitle: 'text-gray-600',
    socialButtonsBlockButton:
      'border-gray-300 hover:bg-gray-50 transition-colors',
    formButtonPrimary:
      'bg-blue-600 hover:bg-blue-700 text-sm normal-case font-medium shadow-sm',
    formFieldInput: 'border-gray-300 focus:border-blue-500 focus:ring-blue-500',
    footerActionLink: 'text-blue-600 hover:text-blue-700 font-medium',
    dividerLine: 'bg-gray-200',
    dividerText: 'text-gray-400',
  },
} as const;
