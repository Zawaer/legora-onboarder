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
        <div className="ml-auto flex items-center gap-1.5">
          {right ?? (
            <>
              {/* Two links, both of which mean something to someone who has
                  never seen this product. "Your own data" and "JD check" used
                  to sit here and told a first-time visitor nothing; they are
                  now named by what they do, in the body of the landing page.
                  "Letter of intent" is a sales instrument, not a surface, and
                  lives next to the price. */}
              <NavLink href="/manager">Manager view</NavLink>
              <NavLink href="/#waitlist" emphasis>
                Join the waitlist
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
