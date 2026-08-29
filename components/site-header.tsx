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
      <div className="mx-auto flex h-14 max-w-[1180px] items-center gap-4 px-5 sm:px-8 lg:px-12">
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
          // Solid ink, the same primary-action colour as every other button in
          // the product. Deliberately NOT the brass accent: that marks verified
          // evidence — the rule on a citation, the attribution line, the panel
          // dots — and spending it on nav chrome would blunt the one visual
          // distinction the product is actually built on.
          ? "bg-ink font-medium text-paper hover:opacity-90"
          : "text-muted hover:bg-surface-2 hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}
