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
        {/* The nav. Pricing, traction and the letter of intent used to live
            only in the footer, which meant the price of the product was
            reachable from one small link at the very bottom of a long page.
            They are navigation, so they sit in the navigation.

            Hidden below sm and left in the footer there instead: four links
            plus a CTA do not fit on a phone, and a hamburger for five items is
            more machinery than the problem deserves. */}
        <nav className="ml-auto hidden items-center gap-0.5 sm:flex">
          {right ?? (
            <>
              <NavLink href="/manager">Manager view</NavLink>
              <NavLink href="/pricing">Pricing</NavLink>
              <NavLink href="/pitch">Traction</NavLink>
              <NavLink href="/loi">Letter of intent</NavLink>
            </>
          )}
        </nav>
        <div className="ml-auto flex items-center sm:ml-2.5">
          <NavLink href="/#waitlist" emphasis>
            Join the waitlist
          </NavLink>
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
