# Repository Guidelines

## Project Structure & Module Organization

This is a Node.js ES module backend for an Express API. Runtime source lives in `src/`: `server.mjs` wires middleware and routes, `router/` defines HTTP endpoints, `controller/` contains request handlers, `services/` integrates Redis and chat analysis, `middleware/` contains Express middleware, `utils/` holds YouTube, file, math, and text-processing helpers, and `constants/` stores shared values. Prisma schema and database models are in `prisma/schema.prisma` for MongoDB. Redis OM entities are under `src/om/`. Generated or runtime media output belongs in `output/` and must stay untracked. Certificates are in `cert/`; do not add private keys or new secrets. Use Graphiphy MCP to learn more about the project structure.

## Build, Test, and Development Commands

- `npm install`: install dependencies from `package-lock.json`.
- `npm start`: run the API with `node ./src/server.mjs` on port `4000`.
- `npx prisma generate`: regenerate Prisma Client after editing `prisma/schema.prisma`.
- `node test/probe-eval.mjs`: run the current YouTube decipher probe script.

`npm test` is currently a placeholder that exits with an error, so add a real test script before relying on it in CI.

## Coding Style & Naming Conventions

Use JavaScript ES modules with `.mjs` files. Keep imports explicit and relative within `src/`, for example `../utils/yt-util.mjs`. Follow the existing two-space indentation and semicolon style where present. Use `camelCase` for variables and functions, `PascalCase` for classes such as `YtController` and `RedisService`, and kebab-case file names such as `yt-router.mjs` or `data-prc-util.mjs`.

## Testing Guidelines

Place executable probes or future tests under `test/`. Prefer focused tests around controllers, utilities, and middleware behavior before changing route contracts or streaming logic. Name new test files after the behavior under test, for example `yt-util.test.mjs` or `redis-middleware.test.mjs`. Any test that reaches YouTube, Redis, MongoDB, or the filesystem should document required environment variables and cleanup expectations.

## Commit & Pull Request Guidelines

Git history was not available in this checkout because the repository is blocked by Git safe-directory protection, so no project-specific commit convention could be confirmed. Use concise imperative commit subjects, for example `Add clip download endpoint`. Pull requests should include a short behavior summary, commands run, required environment changes, linked issues, and API examples or screenshots when response shape or user-visible behavior changes.

## Security & Configuration Tips

Keep `.env`, `output/`, `node_modules/`, and `dist/` out of version control. Required local services include MongoDB via `DATABASE_URL` and any Redis configuration used by `src/om/client.mjs` and `src/services/redis-service.mjs`. Avoid committing downloaded media, generated clips, private certificates, or credentials.


