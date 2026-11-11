# Architecture Notes

## Current production shape

The deployed application remains a single Cloudflare Worker module. The repository now contains a source-only modularization branch on `main`; it has not been deployed to production.

## Source layout

- `worker/worker.js`: immutable-in-practice snapshot of the Worker source at the start of the GitHub migration.
- `src/worker.js`: modular Worker entry point; imports the page documents and backend helpers.
- `src/frontend/public-page.js`: public application HTML document.
- `src/frontend/admin-page.js`: administration dashboard HTML document.
- `src/backend/utils.js`: JSON response, request parsing, cookie, ID, time, and password-hashing helpers.
- `src/backend/auth.js`: session lookup and plan entitlement checks.
- `src/backend/auth-api.js`: account registration, login, and logout with D1-backed sessions.
- `src/backend/public-api.js`: public data, current-user profile retrieval, and job/course detail reads.
- `src/backend/account-api.js`: profile updates, support, subscriptions, team membership, and applications.
- `src/backend/admin-api.js`: admin login, authorization, data reads, and management actions.

## Bound resources

The deployed Worker uses:

- `DB`: Cloudflare D1.
- `STORE`: Cloudflare KV.

The repository intentionally stores source code only. D1 rows, KV values, account identifiers, and secret values must not be committed.

## API route inventory

The modular entry point delegates authentication, public reads, account writes, and administrative operations to dedicated backend modules.

## Safe refactoring approach

1. Keep `worker/worker.js` as a recovery reference.
2. Extract frontend and backend modules without changing behavior.
3. Add automated tests for login, registration, sessions, public data, profiles, jobs, courses, and applications.
4. Verify the D1 schema and bindings before any deployment change.
5. Compare the modular worker behavior against production before switching the deployed entry point.

No production database schema or data was changed as part of this source-only refactor.


## Public API module

- `src/backend/public-api.js`: authenticated session lookup, public job/course catalog response, and job/course detail reads. The Worker entry point delegates public read routes to this module.

- `src/backend/account-api.js`: profile updates, support requests, subscription requests, team membership, and job applications.
