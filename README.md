<div align="center">
  <h1>🎬 VidArch</h1>
  <p><strong>A modern, self-hosted YouTube archiver, subscriptions manager, and ad-free offline video player.</strong></p>

  <p>
    <a href="https://github.com/lucas-lepajollec/vidarch/pkgs/container/vidarch"><img src="https://img.shields.io/badge/Docker-GHCR-2CA5E0?style=for-the-badge&logo=docker&logoColor=white" alt="Docker GHCR" /></a>
    <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-22-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" /></a>
    <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" /></a>
    <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.7-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" /></a>
    <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" /></a>
    <a href="https://github.com/yt-dlp/yt-dlp"><img src="https://img.shields.io/badge/yt--dlp-powered-FF0000?style=for-the-badge&logo=youtube&logoColor=white" alt="yt-dlp" /></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge" alt="MIT license" /></a>
  </p>
</div>

---

## ✨ Overview

**VidArch** is an independent, self-hosted media platform designed to archive your favorite YouTube channels, download high-resolution videos (up to 4K/60fps) automatically or on-demand, explore disk directories physically, and provide an ultra-slick, modern browsing and playback experience without ads, sponsors, or tracking.

It runs locally or on your home server / NAS using Docker, keeping your media, subscriptions, and viewing history completely private, self-contained, and persistent.

---

## 🚀 Key Features

- 🎯 **Pixel-Perfect Responsive UI**: Dark mode interface with modern fluid layout across desktop, tablet, and mobile (centered fixed search bar, navigation drawer, responsive 4-column cards).
- 📥 **High-Resolution Archiving**: Automatic or on-demand video downloads with resolution selector (4K, 1440p, 1080p, 720p, 480p, audio only).
- 🗂️ **Real Disk Folder Explorer**: Visual folder cards matching your physical disk directory structure (`downloads/<channel>/`) with folder disk weight in Mo/Go, video counts, and instant playback.
- 📡 **Automated Subscriptions Radar**: Real-time status indicator of pending/un-downloaded videos across all subscribed creator channels.
- 🎬 **Offline & Direct Video Streaming**: Custom HTML5 media player supporting HTTP 206 Partial Content range requests, instant scrubbing, theater mode, picture-in-picture, and custom playback speeds.
- 🔍 **Unified Live & Local Search**: Instant search through locally archived videos, subscribed channels, and live YouTube results with instant metadata extraction.
- 👤 **Creator Studio & Custom Channel Spaces**: Claim existing YouTube channels or create custom spaces with banners, logos, and descriptions to organize imported MP4/WebM videos.
- 🔄 **Account & Channel Switcher**: 1-click channel switching dropdown to manage multiple owned creator channels or dissociate unclaimed spaces.
- 🛡️ **Production-Ready & Hardened Security**: Helmet Content Security Policy, multi-tier rate limiting, command injection prevention, path traversal defense, and reverse proxy compatibility (`trust proxy`).
- 🍪 **YouTube Authentication (Cookies)**: Easy `cookies.txt` import to bypass age restrictions and access private/unlisted videos.

---

## 🛠️ Tech Stack

| Component | Technology |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons |
| **Backend** | Node.js 22, Express 5, TypeScript |
| **Database** | SQLite 3 via `better-sqlite3` (WAL Mode) |
| **Media Processing** | `yt-dlp`, `ffmpeg`, `ffprobe` |
| **Security** | Helmet (CSP), Express Rate Limit, Compression, Path Confinement |
| **Containerization** | Docker, Docker Compose, GitHub Container Registry (GHCR) |

---

## 🐳 Quick Start with Docker (Recommended)

### Option A: Using Pre-Built Image from GitHub Container Registry (Fastest)

Create a `docker-compose.yml` file:

```yaml
services:
  vidarch:
    image: ghcr.io/lucas-lepajollec/vidarch:latest
    container_name: vidarch
    restart: unless-stopped
    ports:
      - "2499:2499"
    environment:
      - PORT=2499
      - NODE_ENV=production
      - DATA_DIR=/app/data
      - DOWNLOADS_DIR=/app/downloads
    volumes:
      - ./data:/app/data
      - ./downloads:/app/downloads
```

Then launch the container:
```bash
docker compose up -d
```

### Option B: Build from Source

```bash
# 1. Clone the repository
git clone https://github.com/lucas-lepajollec/vidarch.git
cd vidarch

# 2. Configure environment
cp .env.example .env

# 3. Launch with Docker Compose
docker compose up -d
```

Open **`http://localhost:2499`** in your browser.

---

## 💻 Manual Installation (Local / Development)

### Requirements
- **Node.js**: `v20+` or `v22+`
- **Python**: `3.10+` with `yt-dlp` installed (`pip install -U yt-dlp`)
- **FFmpeg & FFprobe**: Installed and available in your system `PATH`

### 1. Install dependencies
```bash
# Install root and server dependencies
npm install

# Install client frontend dependencies
npm --prefix client install
```

### 2. Start development mode
```bash
npm run dev
```
- Client dev server: `http://localhost:2499`
- Server API: `http://localhost:2498`

### 3. Production build & start
```bash
npm run build
npm start
```

---

## ⚙️ Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `2498` (dev) / `2499` (prod) | HTTP listening port for Express server |
| `NODE_ENV` | `development` | Runtime environment (`development` or `production`) |
| `DATA_DIR` | `./data` | Directory for SQLite database (`vidarch.db`) and `cookies.txt` |
| `DOWNLOADS_DIR` | `./downloads` | Directory for archived videos, thumbnails, and JSON metadata |
| `YT_DLP_PATH` | Auto-detected | Custom absolute path to the `yt-dlp` binary |

---

## 🔒 Reverse Proxy Configuration (Nginx / Caddy)

When exposing VidArch to the internet, place it behind a reverse proxy with HTTPS.

### Caddy Example
```caddyfile
vidarch.yourdomain.com {
    reverse_proxy localhost:2499
}
```

### Nginx Example
```nginx
server {
    server_name vidarch.yourdomain.com;

    client_max_body_size 10G;

    location / {
        proxy_pass http://127.0.0.1:2499;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## ⚖️ Legal Disclaimer

**VidArch** is an independent, community-driven open-source project created for personal backup, offline viewing, and educational purposes. It is **not affiliated with, endorsed by, or sponsored by Google LLC or YouTube LLC**. 

YouTube is a registered trademark of Google LLC. All trademarks and brand names belong to their respective owners. Users are responsible for complying with applicable local copyright laws and third-party terms of service.

---

## 🤝 Contributing

Contributions, bug reports, and feature requests are welcome!
Please check [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
