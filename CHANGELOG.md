# Changelog

Notable user-visible changes to VidArch will be recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and published versions will follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-09-06

### Added

- The first deliberately maintained VidArch pre-1.0 release line.
- Familiar video discovery, subscriptions, downloads, local playback, channels, playlists, history and owned-library workflows.
- A consistent repository, quality, security, and release foundation.
- English, French, Spanish and German interfaces plus an isolated demo built only from licensed fictional/public fixtures.
- A recorded SQLite schema version, checked idempotent migrations and fail-closed protection against unsafe downgrades.
- Multi-architecture container delivery with a verified yt-dlp binary, health checks, SBOM, provenance and immutable commit-SHA rollback tags.

### Security

- Updated the transitive `qs` request parser to a patched release before publishing the first maintained version.

Earlier development remains available in Git history; this changelog does not invent releases that were never deliberately published.

[Unreleased]: https://github.com/lucas-lepajollec/vidarch/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/lucas-lepajollec/vidarch/releases/tag/v0.1.0
