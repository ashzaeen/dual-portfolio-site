// Minimal ESM resolver hook so plain-Node scripts can import the app's
// "@/..." path alias (and extensionless "@/data/foo"). Also swaps React's
// `cache` for an identity fn so cache-wrapped fetchers in lib/notion.js are
// callable outside a React render. Run via:
//   node --loader ./scripts/_alias-loader.mjs --env-file=.env.local scripts/<x>.mjs
import { pathToFileURL } from "node:url";
import { resolve as resolvePath } from "node:path";
import { existsSync } from "node:fs";

const ROOT = process.cwd();

export async function resolve(specifier, context, nextResolve) {
  // Route "react" to a shim that neutralizes cache() (see react-cache-shim.mjs).
  if (specifier === "react" && !context.parentURL?.includes("react-cache-shim")) {
    const shim = pathToFileURL(resolvePath(ROOT, "scripts/react-cache-shim.mjs")).href;
    return nextResolve(shim, context);
  }
  if (specifier.startsWith("@/")) {
    let abs = resolvePath(ROOT, specifier.slice(2));
    if (!existsSync(abs) && existsSync(abs + ".js")) abs += ".js";
    return nextResolve(pathToFileURL(abs).href, context);
  }
  // Extensionless relative imports (e.g. "./_notion-helpers") — Node ESM needs
  // the extension; append .js when the bare path doesn't resolve.
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if ((specifier.startsWith("./") || specifier.startsWith("../")) && !/\.[mc]?js$/.test(specifier)) {
      return nextResolve(specifier + ".js", context);
    }
    throw err;
  }
}
