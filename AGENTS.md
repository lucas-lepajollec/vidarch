# VidArch agent guide

This file is public repository guidance for maintainers and AI agents. Inspect the current branch, working tree, code, configuration and documentation before changing anything. Preserve unrelated work.

## Product boundaries

VidArch combines familiar video discovery with permanent local ownership. Cookies, downloaded media, databases, private URLs and session state are sensitive. Preserve the distinction between online discovery and the local-owned library, and use only authorized media in demos or tests.

## Development

- Install both dependency trees with `npm ci` and `npm --prefix client ci`.
- Run the complete development stack with `npm run dev`; use explicit LAN commands only on trusted networks.
- Validate normal changes with `npm test` and `npm run build`.
- Use `npm run build:demo` when demo behavior changes and validate container behavior for deployment changes.
- Keep root and client lockfiles synchronized only when their dependencies intentionally change.

## Repository expectations

- Update tests, `README.md`, focused documentation and `CHANGELOG.md` when behavior, storage or compatibility changes.
- Never commit cookies, real media, databases, `.env` values, logs or private account data.
- Follow `CONTRIBUTING.md` for pull requests and `SECURITY.md` for vulnerabilities.
- GitHub is the public review surface; maintainers integrate the exact accepted result into authoritative Forgejo history.

Local machine notes belong in ignored `AGENTS.override.md` and `.project-local/`, never in this public file.
