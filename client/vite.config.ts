import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function demoMetadataPlugin(enabled: boolean): Plugin {
  return {
    name: 'vidarch-demo-metadata',
    transformIndexHtml(html) {
      if (!enabled) return html
      return html
        .replace('<title>VidArch — Self-Hosted Video Archiver & Player</title>', '<title>VidArch — Démonstration publique</title>')
        .replace(
          '</head>',
          `    <meta name="robots" content="noindex,nofollow,noarchive" />\n    <meta name="vidarch-mode" content="demo" />\n    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src 'self' data: blob:; media-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self' data:; connect-src 'self'; object-src 'none'; frame-src 'none'; worker-src 'none'; base-uri 'self'; form-action 'self'" />\n  </head>`,
        )
    },
    generateBundle() {
      if (!enabled) return
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: 'User-agent: *\nDisallow: /\n',
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const demoMode = mode === 'demo'
  return {
    plugins: [
      react(),
      tailwindcss(),
      demoMetadataPlugin(demoMode),
    ],
    build: {
      outDir: demoMode ? 'dist-demo' : 'dist',
      emptyOutDir: true,
    },
    server: {
      port: demoMode ? 2505 : 2499,
      host: process.env.VIDARCH_DEV_HOST || '127.0.0.1',
      proxy: demoMode ? undefined : {
        '/api': {
          target: 'http://localhost:2498',
          changeOrigin: true,
        },
        '/media': {
          target: 'http://localhost:2498',
          changeOrigin: true,
        },
      },
    },
  }
})
