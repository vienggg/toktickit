/**
 * Playwright global setup for e2e/lab-03 (review of PR #70, item 1 — blocking).
 *
 * Every spec in this folder authenticates as one of the
 * `regression-suite-{requester,staff,admin}@toktick.internal` fixture
 * accounts (see ./api-fixtures.ts). Those accounts are defined and upserted
 * by `server/tests/helpers/testAuth.ts`'s `ensureRegression*()` functions,
 * which historically only ran as a side effect of the SERVER's own vitest
 * suite (`npm run test` inside server/) touching that helper file. On a
 * genuinely fresh database — migrate + seed + `npm run dev`, without ever
 * running the server's vitest suite — none of those rows exist, and every
 * spec here 401s at its first `login()` call.
 *
 * This global setup removes that hidden dependency: it imports the exact
 * same `ensureRegression*()` upserts the server's tests use and runs them
 * once, directly against the same Postgres database the dev server itself
 * targets (via Prisma's `getPrisma()`, which defaults to
 * postgresql://toktickit:toktickit@localhost:5432/toktickit — the same
 * fallback `server/src/prisma.ts` and `server/.env` both use), before any
 * spec in this directory runs. It does not depend on the server's vitest
 * suite ever having executed against this database.
 *
 * Import path note: this file lives in `e2e/lab-03/`, a sibling of
 * `server/`. `server/tests/helpers/testAuth.ts` uses ESM ".js" import
 * specifiers (e.g. `from "../../src/app.js"`) that resolve to the
 * co-located ".ts" sources under Node's "bundler" module resolution
 * (server/tsconfig.json sets `moduleResolution: "bundler"`), which is also
 * how Playwright's own TypeScript loader resolves ".js" specifiers to
 * ".ts" files. No separate tsconfig or path mapping was needed here — a
 * plain relative import into server/tests/helpers/testAuth.ts (which in
 * turn resolves its own "../../src/*.js" imports relative to itself, inside
 * server/) worked without modification. This was verified by actually
 * running the suite (see the PR review response / task report for the
 * fresh-state simulation), not just by inspection.
 */
import {
  ensureRegressionRequester,
  ensureRegressionStaff,
  ensureRegressionAdmin,
} from "../../server/tests/helpers/testAuth.js";

async function globalSetup() {
  // Run sequentially rather than Promise.all: these are simple upserts
  // against a handful of distinct rows with no shared mutable state, but
  // keeping them sequential makes a failure's stack trace point at exactly
  // which fixture account failed to provision.
  await ensureRegressionRequester();
  await ensureRegressionStaff();
  await ensureRegressionAdmin();
}

export default globalSetup;
