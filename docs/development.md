# Local Development

## Requirements

- Node.js 20 or newer
- npm
- Access to the Cloudflare account for local Worker binding access

## Setup

```bash
npm install
npm run dev
```

Wrangler reads `wrangler.toml` for the Worker entry point and the D1/KV binding declarations. Do not add production passwords or API tokens to tracked files. Use Wrangler's local secret workflow for any required secrets.

## Checks

```bash
npm run check
npm test
```

The smoke tests cover the health route, public and admin HTML responses, unknown-route handling, free-tier job/course visibility, and unauthenticated job-detail access. They do not mutate production D1 data.

## Production safety

The modular entry point is a repository refactoring target, not an automatic production deployment. Run the checks and perform a staging/regression review before deploying. The production database and KV data must remain untouched during source-only refactoring.
