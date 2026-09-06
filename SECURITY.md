# Security policy

VidArch downloads and stores media, account cookies, metadata, session state, and a local database. Reports involving unauthorized access, unsafe paths, remote-content handling, command execution, session protection, or the dependency and container supply chain are especially important.

## Supported versions

Security fixes target the latest `0.1.x` release and `main`. Older pre-1.0 releases may require upgrading to receive a fix.

## Reporting a vulnerability

Use the repository's [private vulnerability reporting form](https://github.com/lucas-lepajollec/vidarch/security/advisories/new).

If private reporting is unavailable, open a minimal public issue asking for a private contact channel. Do not include cookies, downloaded media, private URLs, database contents, exploit code, or other sensitive details in that issue.

Include the affected commit or image tag, deployment method, clear reproduction steps, the expected impact, and a sanitized proof of concept when possible. You should receive an acknowledgement within seven days and an initial assessment within fourteen days.

## Hardening a deployment

- Configure authentication before exposing VidArch beyond a trusted host.
- Do not serve or share the `data/` directory; it can contain `vidarch.db`, `cookies.txt`, and session secrets.
- Put remote deployments behind HTTPS and keep the shipped cookie protections intact.
- Keep `yt-dlp` and the container image updated because upstream extractors change frequently.
