# Bioalergia API

This is the main backend API for the Bioalergia project, built on top of [Hono](https://hono.dev/) and Node.js.

## Local Development

- `pnpm dev` - Starts the development server with hot-reload.
- `pnpm build` - Builds the application for production.
- `pnpm start` - Starts the built production server.

## Environment Variables

Database URLs and external service API keys should be placed in the `/packages/db/.env` file or the root level environment configuration. Important variables include:

- `DATABASE_URL`: Connection string for Postgres.

## Testing

Tests are powered by Vitest.

- `pnpm test` - Run unit and integration tests.
