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
        {/* The nav. The demo and the letter of intent are the two surfaces a
            stranger should be able to reach without being told about them, so
            they sit in the navigation rather than at the bottom of a long page.

            /pitch is deliberately NOT here. It is the traction evidence board
            and it reads zeros to anyone who is not a judge, which is exactly
            the wrong thing to show a prospect who followed a link from an
            email. The page still exists; it is handed out directly.

            /pricing is gone rather than merely unlinked: the URL 404s and the
            page is parked in app/_pricing. A price shown before the product
            has earned the question is answering something nobody asked, and a
            stale number left reachable is worse than no number at all.

            Hidden below sm: two links plus a CTA still crowd a phone, and a
            hamburger for three items is more machinery than the problem
            deserves. */}
        <nav className="ml-auto hidden items-center gap-0.5 sm:flex">
          {right ?? (
            <>
              {/* The demo link points at the hire page, not the manager
                  dashboard. A cold visitor has no idea who Rebecca Hartley is
                  or why a roster matters; the hire page explains itself in one
                  screen, and it is the link we send prospects anyway. The
                  manager view is still the buyer's screen and still live, it
                  just is not what a stranger should meet first. */}
              <NavLink href="/hire/demo-legal-engineer">Demo</NavLink>
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
