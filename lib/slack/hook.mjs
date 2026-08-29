/**
 * Bootstrap for any plain-node entry point that needs to import this repo's
 * TypeScript: registers `resolver.mjs` and checks the Node version.
 *
 * Import this, *then* `await import()` the modules under `lib/`. Static imports
 * are hoisted above this file's side effects, so a top-level
 * `import { … } from "./app"` in the same file would resolve before the hook is
 * installed and fail. Dynamic import after registration is the whole trick.
 */

import { register } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
/** lib/slack → lib → repo root. Derived from this file so cwd does not matter. */
const repoRoot = path.resolve(here, "..", "..");

/**
 * Type-stripping landed on by default in Node 23.6. On anything older, `.ts`
 * files fail to parse with a syntax error pointing at a type annotation, which
 * reads as "the code is broken" rather than "the runtime is too old".
 */
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 23 || (major === 23 && minor < 6)) {
  console.error(
    `\nOnboarder's Slack bot needs Node 23.6 or newer (running ${process.versions.node}).\n` +
      `It executes the repo's TypeScript directly using Node's built-in type stripping, so there is no\n` +
      `build step and no extra dependency — but that feature does not exist in older releases.\n\n` +
      `  nvm install 24 && nvm use 24\n`,
  );
  process.exit(1);
}

register(new URL("./resolver.mjs", import.meta.url), import.meta.url, {
  data: { root: pathToFileURL(repoRoot + path.sep).href },
});

export { repoRoot };
