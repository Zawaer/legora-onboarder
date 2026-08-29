import Link from "next/link";
import { Wordmark } from "./ui";

export default function SiteHeader({
  right,
  sticky = true,
}: {
  right?: React.ReactNode;
  sticky?: boolean;
}) {
  return (
    <header
      className={`${
        sticky ? "sticky top-0 z-30" : ""
      } border-b border-line bg-paper/85 backdrop-blur-md`}
    >
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-4 px-5 sm:px-8">
        <Link href="/" className="shrink-0">
          <Wordmark />
        </Link>
        <span className="hidden truncate text-[12px] text-faint sm:block">
          onboarding for roles that have never existed
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {right ?? (
            <>
              {/* The bring-your-own-corpus entry point. Hidden on the narrowest
                  screens only because the bar has no room, not because it is
                  secondary — it is the difference between a demo and a pilot. */}
              <span className="hidden sm:contents">
                <NavLink href="/ingest">Your own data</NavLink>
              </span>
              <NavLink href="/manager">Manager view</NavLink>
              <NavLink href="/loi">Letter of intent</NavLink>
              <NavLink href="/pay" emphasis>
                Pricing
              </NavLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function NavLink({
  href,
  children,
  emphasis = false,
}: {
  href: string;
  children: React.ReactNode;
  emphasis?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-md px-2.5 py-1.5 text-[13px] transition-colors ${
        emphasis
          ? "border border-line bg-surface font-medium text-ink hover:border-line-strong"
          : "text-muted hover:bg-surface-2 hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}
