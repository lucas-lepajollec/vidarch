# Security Policy

## 🛡️ Supported Versions

We actively provide security updates for the latest release branch of VidArch.

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

---

## 🔒 Reporting a Vulnerability

If you discover a potential security vulnerability in VidArch, please **do NOT open a public GitHub issue**.

Instead, please report it privately:
- Open a **GitHub Security Advisory** on this repository (under the "Security" tab -> "Advisories" -> "New draft security advisory"), or
- Contact the maintainer directly via their GitHub profile.

Please include:
1. A description of the vulnerability and its potential impact.
2. Step-by-step instructions (or proof of concept) to reproduce the issue.
3. Your proposed fix or mitigation if you have one.

We will review your submission promptly and coordinate a patch and release before public disclosure.

## Hardening a deployment

- Set `AUTH_PASSWORD` or a password in **Settings → Sécurité** before exposing the host.
- Do not serve or share the `data/` directory: it contains `vidarch.db`, `cookies.txt`, and the session secret.
- Put VidArch behind HTTPS (Caddy / Nginx). The session cookie is `HttpOnly` + `SameSite=Lax` (and `Secure` when the request is HTTPS).
- Keep yt-dlp updated (`yt-dlp -U` on startup / weekly, or the Settings button). YouTube extractors break often.
