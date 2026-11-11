# Production D1 Schema Reference

This document records the table structure inspected in the existing Cloudflare D1 database on 2026-11-11. The inspection was read-only; no rows or schema objects were changed.

## Tables

- `users`: `id`, `account_id`, `name`, `email`, `password_hash`, `salt`, `avatar`, `theme`, `plan`, `plan_status`, `plan_expires_at`, `team_owner_id`, `team_members`, `created_at`.
- `sessions`: `token`, `user_id`, `expires_at`, `created_at`.
- `jobs`: `id`, `title`, `company`, `description`, `location`, `category`, `job_type`, `official_url`, `start_date`, `end_date`, `icon`, `is_featured`, `is_published`, `created_at`, `salary`, `education_level`, `work_hours`, `governorate`.
- `courses`: `id`, `title`, `provider`, `description`, `url`, `image_url`, `is_published`, `created_at`.
- `applications`: `id`, `user_id`, `job_id`, `full_name`, `email`, `phone`, `cv_url`, `message`, `created_at`, `status`.
- `plan_requests`: `id`, `user_id`, `plan`, `price_jod`, `status`, `created_at`, `expires_at`.
- `support_messages`: `id`, `user_id`, `name`, `email`, `message`, `status`, `created_at`.
- `announcements`: `id`, `title`, `body`, `image_url`, `link_url`, `is_published`, `created_at`.
- `ads`: `id`, `title`, `image_url`, `target_url`, `active`, `created_at`.

## Compatibility notes

- Registration writes the existing `users` columns and creates a row in `sessions`.
- Login verifies the existing PBKDF2-SHA256 password hash format (100,000 iterations) used by the shared `H` helper.
- Session lookup uses `sessions.token`, checks `expires_at`, and reads the user by `users.id`.
- Profile extras remain in KV under `profile:<user-id>`; no profile table is required.
- The new code does not require a database migration for registration, login, logout, or profile lookup.

## Change policy

Do not apply migrations to production as part of routine refactoring. Any future schema change must include a reviewed migration, a backup/rollback plan, and tests against a separate staging database first.
