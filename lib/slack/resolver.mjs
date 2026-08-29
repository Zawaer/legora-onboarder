/**
 * A module-resolution hook, so a plain `node` process can import this repo's
 * TypeScript the same way Next does.
 *
 * Node 23.6+ strips types from `.ts` files on its own, but it does not do the
 * two things a bundler does and this codebase relies on:
 *
 *   1. the `@/…` path alias from tsconfig.json
 *   2. extensionless specifiers (`./legora` → `./legora.ts`)
 *
 * Twenty lines of resolver buys both, and means the Slack bot imports
 * `currentTask` from `lib/agent/supervise.ts` and `getCompany` from
 * `lib/seed/` — the real implementations, not copies of them that quietly stop
 * matching. That is the whole reason this file exists: without it the bot would
 * have to reimplement "which task is the hire on", and the first change to the
 * plan shape would make the Slack surface silently wrong.
 *
 * No transpiler, no ts-node, no build step, no extra dependency.
 *
 * Registered by `register()` in `hook.mjs`, which entry points load *before*
 * dynamically importing anything under `lib/`.
 */

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Repo root as a file:// URL with a trailing slash, handed over by hook.mjs. */
let root = "";

export function initialize(data) {
  root = data.root;
}

/** tsconfig `moduleResolution: bundler` semantics, minus the parts we do not use. */
const CANDIDATES = ["", ".ts", ".tsx", "/index.ts", "/index.tsx", ".mjs", ".js"];

function firstExisting(baseHref) {
  for (const suffix of CANDIDATES) {
    const url = new URL(baseHref + suffix);
    // A directory also "exists"; require a file with one of our extensions.
    if (suffix === "" && !/\.(ts|tsx|mjs|js|json)$/.test(url.pathname)) continue;
    if (existsSync(fileURLToPath(url))) return url;
  }
  return undefined;
}

function formatFor(url) {
  return /\.tsx?$/.test(url.pathname) ? "module-typescript" : "module";
}

export async function resolve(specifier, context, next) {
  // The `@/` alias, resolved against the repo root exactly as tsconfig maps it.
  if (specifier.startsWith("@/")) {
    const found = firstExisting(new URL(specifier.slice(2), root).href);
    if (found) return { url: found.href, format: formatFor(found), shortCircuit: true };
  }

  // Extensionless relative imports between repo files.
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    const parentUrl = context.parentURL;
    if (parentUrl && parentUrl.startsWith("file:")) {
      const found = firstExisting(new URL(specifier, parentUrl).href);
      if (found) return { url: found.href, format: formatFor(found), shortCircuit: true };
    }
  }

  const resolved = await next(specifier, context);

  // Node infers module type from the nearest package.json, which here has no
  // "type" field — so a bare `.ts` file triggers a MODULE_TYPELESS_PACKAGE_JSON
  // warning per file on startup. Stating the format silences a dozen lines of
  // noise in the terminal the demo is being run from.
  if (resolved && typeof resolved.url === "string" && /\.tsx?$/.test(resolved.url) && !resolved.format) {
    return { ...resolved, format: "module-typescript" };
  }
  return resolved;
}
