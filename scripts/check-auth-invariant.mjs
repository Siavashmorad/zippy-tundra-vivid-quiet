#!/usr/bin/env node
/**
 * Fail loudly when the running dev server and the next build disagree about
 * `VITE_AUTH_ENABLED`.
 *
 * `npm run dev`, `npm run build` and `npm run preview` all get the flag from
 * `scripts/with-app-env.mjs`, so they agree by construction — but a dev server
 * started outside npm (`npx vite dev`) does not, and the result is sign-in
 * visible in the live preview and absent from the built output, or the reverse.
 *
 * The two sides compared:
 *  - **dev**: what the running server resolved, read from the `/__app-env`
 *    endpoint the template's dev-only `appEnvPlugin` serves.
 *  - **build**: what the wrapper hands `vite build` / `vite preview`.
 *
 * The built bundle is not read: Vite inlines the flag and the minifier folds
 * `"false" !== "false"` away, so the built client JS carries no marker to
 * compare against unless the app is made to emit one.
 *
 * `scripts/browser-smoke.mjs` runs the comparison on every smoke; run it
 * standalone against a live dev server with `npm run check:auth` (exit 0 agree,
 * 1 diverged, 2 could not observe). Callers comparing the flag should use
 * `compareAuthInvariant()` rather than re-deriving it.
 *
 * In CI (`CI=true`) without a live dev server the probe is indeterminate; that
 * is not treated as failure — the invariant logic is covered by unit tests and
 * the build side is still resolved via `with-app-env.mjs` during `npm run build`.
 */
import { APP_ENV_ROUTE } from "./app-env-plugin.mjs";
import { isMainModule, mergeAppEnv, projectRoot, readAppEnv } from "./with-app-env.mjs";

const DEFAULT_DEV_URL = "http://127.0.0.1:8080";

/** The predicate `src/lib/auth/{client,server}.ts` apply to the flag. */
export function authEnabledFromEnvValue(value) {
  return value !== "false";
}

/**
 * Compare the two resolved values. `null` means "could not observe" — reported
 * as indeterminate rather than as agreement.
 */
export function compareAuthInvariant({ devAuthEnabled, buildAuthEnabled }) {
  const label = (value) => (value ? "on" : "off");
  if (devAuthEnabled === null || devAuthEnabled === undefined) {
    return {
      status: "indeterminate",
      message: "[auth-invariant] could not read the dev server's resolved VITE_AUTH_ENABLED",
    };
  }
  if (devAuthEnabled === buildAuthEnabled) {
    return {
      status: "ok",
      message: `[auth-invariant] dev and build agree: sign-in ${label(devAuthEnabled)}`,
    };
  }
  return {
    status: "diverged",
    message:
      `[auth-invariant] dev server has sign-in ${label(devAuthEnabled)} but the next ` +
      `build has it ${label(buildAuthEnabled)}. Start the app with \`npm run dev\` — ` +
      "invoking vite directly skips scripts/with-app-env.mjs, so the dev server and " +
      "the built output resolve .grok/app-env.json differently.",
  };
}

/**
 * Ask the dev server which env it resolved. Anything but a JSON object from
 * `/__app-env` (no server, a built-output preview, an older workspace without
 * the plugin) is "could not observe".
 */
export async function probeDevAuthEnabled(devUrl, fetchImpl = fetch) {
  let env;
  try {
    const response = await fetchImpl(new URL(APP_ENV_ROUTE, devUrl).href);
    if (!response.ok) return null;
    env = JSON.parse(await response.text());
  } catch {
    return null;
  }
  if (env === null || typeof env !== "object") return null;
  return authEnabledFromEnvValue(env.VITE_AUTH_ENABLED);
}

/** The smoke-verdict warnings for a comparison: a real divergence only. */
export function authInvariantWarnings(result) {
  return result.status === "diverged" ? [result.message] : [];
}

/** What `vite build` / `vite preview` will resolve, via the same wrapper. */
export function buildAuthEnabled(root = projectRoot(), processEnv = process.env) {
  const env = mergeAppEnv(readAppEnv(root), processEnv);
  return authEnabledFromEnvValue(env.VITE_AUTH_ENABLED);
}

async function main(argv) {
  const devUrlFlag = argv.indexOf("--dev-url");
  const devUrl = devUrlFlag === -1 ? DEFAULT_DEV_URL : argv[devUrlFlag + 1];
  const buildSide = buildAuthEnabled();
  const result = compareAuthInvariant({
    devAuthEnabled: await probeDevAuthEnabled(devUrl),
    buildAuthEnabled: buildSide,
  });
  if (result.status === "ok") {
    console.log(result.message);
    process.exit(0);
  }
  if (result.status === "indeterminate") {
    // GitHub Actions and other CI runners have no live `npm run dev`.
    // Unit tests already cover compareAuthInvariant / probeDevAuthEnabled.
    if (process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true") {
      const label = buildSide ? "on" : "off";
      console.log(
        `${result.message}\n[auth-invariant] CI: no live dev server — treating as pass; ` +
          `build-side sign-in is ${label} (unit tests cover the invariant).`,
      );
      process.exit(0);
    }
    console.error(result.message);
    process.exit(2);
  }
  console.error(result.message);
  process.exit(1);
}

if (isMainModule(import.meta.url)) {
  await main(process.argv.slice(2));
}
