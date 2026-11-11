# Architecture Notes

## Current production shape

The deployed application is a single Cloudflare Worker module. The module embeds the HTML page and admin interface as source strings and routes HTTP requests to page and API handlers.

## Bound resources

The deployed Worker uses these bindings:

- `DB`: Cloudflare D1 database.
- `STORE`: Cloudflare KV namespace.

The Git repository intentionally stores source code only. D1 rows, KV values, account identifiers, and secret values are not application source files and must not be copied into Git.

## Refactoring approach

Keep the deployed Worker as the behavioral reference while extracting code in small, reviewable steps:

1. Inventory all route handlers and frontend entry points.
2. Separate static page markup/styles/scripts from the request router.
3. Extract API route groups and shared validation/response helpers.
4. Add tests for authentication, public data, profiles, jobs, courses, and applications.
5. Verify the D1 schema and bindings before any deployment change.
6. Deploy only after regression checks pass.

Do not change production database schema or data as part of source-only refactoring.
