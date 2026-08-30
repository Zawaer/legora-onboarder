"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * The fallback path for scroll reveal.
 *
 * The CSS in globals.css uses `animation-timeline: view()`, which is Chrome and
 * Edge only — Safari and Firefox render the page correctly and completely
 * still, but with no motion at all. This adds the same reveal for them.
 *
 * The ordering matters and it is the whole reason this is not the usual
 * IntersectionObserver snippet. Nothing is hidden by CSS. The `js-reveal` class
 * that does the hiding is set by an inline script in the document head, which
 * only runs if scripting is on, and this observer — which is what puts it back
 * — is imported by the same bundle. So the states are: no JS, everything
 * visible; JS, hidden for a moment and then revealed. There is no path where a
 * script failing leaves a reader looking at nothing, which is the failure mode
 * this pattern normally ships with.
 */
export default function Reveal() {
  // Re-run on every navigation. This component lives in the root layout, which
  // React keeps mounted across client-side route changes, so an effect with an
  // empty dependency list runs exactly once in the life of the tab. The
  // `js-reveal` class is set by a script in <head> and therefore also survives
  // those navigations. Together that produced a page that was blank rather than
  // merely unanimated: navigate away and back, and the new page's nodes arrive
  // hidden by a class that is still there, with no observer left watching for
  // them. Keying the effect on the path re-queries and re-observes each time.
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    if (!root.classList.contains("js-reveal")) return;

    // Staggered children are observed individually so each one arrives on its
    // own, rather than the container revealing everything at once.
    const nodes = Array.from(
      document.querySelectorAll("[data-reveal], [data-stagger] > *"),
    );

    // If anything goes wrong below, or the browser lacks IntersectionObserver,
    // drop the hiding class rather than leaving the page blank.
    if (!("IntersectionObserver" in window)) {
      root.classList.remove("js-reveal");
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-revealed");
          io.unobserve(entry.target);
        }
      },
      // Fires a little before the section reaches reading position, so the
      // motion has finished by the time anyone is actually looking at it.
      { rootMargin: "0px 0px -12% 0px", threshold: 0.01 },
    );

    for (const node of nodes) io.observe(node);

    // Belt and braces: if something stalls, reveal everything after 3s.
    const failsafe = window.setTimeout(() => {
      for (const node of nodes) node.classList.add("is-revealed");
    }, 3000);

    return () => {
      io.disconnect();
      window.clearTimeout(failsafe);
    };
  }, [pathname]);

  // The header condenses once the page has moved. Done here rather than in
  // SiteHeader because that is a server component used on every route, and
  // making it a client one to read a scroll position would cost more than the
  // effect is worth. A class on the root element is all the CSS needs.
  useEffect(() => {
    const root = document.documentElement;
    let ticking = false;
    const apply = () => {
      root.classList.toggle("is-scrolled", window.scrollY > 24);
      ticking = false;
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      // rAF rather than a raw handler: this fires on every scroll event and
      // reading scrollY outside a frame is how you lose 60fps.
      requestAnimationFrame(apply);
    };
    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return null;
}
