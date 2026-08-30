# Contributing to VidArch

Thank you for your interest in contributing to **VidArch**! Follow these guidelines to help keep the project clean, secure, and maintainable.

---

## 🚀 Getting Started

1. **Fork the repository** on GitHub.
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/lucas-lepajollec/vidarch.git
   cd vidarch
   ```
3. **Install dependencies**:
   ```bash
   npm ci
   npm --prefix client ci
   ```
4. **Run the local development server**:
   ```bash
   npm run dev
   ```

---

## 🛠️ Development Workflow

- Create a feature branch with a descriptive name:
  ```bash
  git checkout -b feature/your-feature-name
  ```
- Make your modifications adhering to TypeScript strict mode and the existing code style.
- Validate that the project builds cleanly with 0 TypeScript errors:
  ```bash
  npm run build
  ```
- Commit your changes using clear conventional commit messages (e.g., `feat: add video playlist support`, `fix: handle edge case in subscriber formatter`).
- Push to your branch and open a Pull Request.

---

## 📜 Pull Request Guidelines

- Ensure your branch is up-to-date with the `main` branch.
- Include a concise summary of what changes were made and why.
- Confirm that no temporary files, node_modules, or real media/data files are committed.

Use `npm ci` for an existing checkout so the committed lockfiles remain unchanged. Use `npm install` only when intentionally changing dependencies, and include all resulting manifest and lockfile changes in the same pull request.

## Maintainer release process

Releases are deliberate milestones, not snapshots of every merge. Prepare a release pull request that updates every declared version source, moves completed entries out of `Unreleased` in [CHANGELOG.md](CHANGELOG.md), and documents storage compatibility, migrations, and rollback when relevant. After all required checks pass, tag the exact accepted `main` commit with an annotated `vMAJOR.MINOR.PATCH` tag and push it through the authoritative Forgejo remote. Verify that the identical tag reaches GitHub and that the versioned container finishes successfully before publishing a draft GitHub release. Never move or reuse a published version tag.
