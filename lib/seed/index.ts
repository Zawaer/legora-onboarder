/**
 * The seed registry.
 *
 * One entry today (Lexhav), but keyed by slug from the start: the pitch is that
 * you point Vanav at *any* hypergrowth company's Slack and it derives the
 * role, so the demo should never look like it was hard-coded for one company.
 * Adding a second company is a new file under `lib/seed/` and one line here.
 */

import type { Company } from "@/lib/types";
import { lexhav } from "./lexhav";

export { lexhav };

/** Every company we have a corpus for, keyed by `Company.slug`. */
export const COMPANIES: Record<string, Company> = {
  [lexhav.slug]: lexhav,
};

/** What the UI falls back to when no company is selected. */
export const DEFAULT_COMPANY_SLUG = lexhav.slug;

/** Look up a company by slug. Returns `undefined` for an unknown slug. */
export function getCompany(slug: string): Company | undefined {
  return COMPANIES[slug];
}

/** For company pickers / static params. */
export function listCompanies(): Company[] {
  return Object.values(COMPANIES);
}
