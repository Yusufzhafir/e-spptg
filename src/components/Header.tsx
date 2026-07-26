import Image from 'next/image';
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs';
import { NotificationBell } from './NotificationBell';

interface HeaderProps {
  /** Page heading shown on the left. */
  title?: string;
}

export function Header({ title = 'Dashboard' }: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {/* Brand stands in for the removed hamburger on small screens */}
          <Image
            src="/SIPETA_LOGO.png"
            alt="SIAPTAH logo"
            width={32}
            height={32}
            className="h-8 w-8 shrink-0 lg:hidden"
          />
          <h1 className="truncate text-lg sm:text-xl md:text-2xl text-gray-900">{title}</h1>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <SignedOut>
            <SignInButton />
            <SignUpButton>
              <button className="bg-[#6c47ff] text-ceramic-white rounded-full font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 cursor-pointer">
                Sign Up
              </button>
            </SignUpButton>
          </SignedOut>
          <SignedIn>
            {/* Below lg these live in the bottom nav, so avoid showing them twice */}
            <div className="hidden items-center gap-3 lg:flex">
              <NotificationBell />
              <UserButton />
            </div>
          </SignedIn>
        </div>
      </div>
    </header>
  );
}
