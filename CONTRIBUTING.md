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
   npm install
   npm --prefix client install
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
