# VidArch public demo

VidArch includes a dedicated static demonstration profile built from the real React interface.

## Safety boundary

The public demo is deliberately isolated from the self-hosted product:

- the media catalogue uses locally bundled Blender Open Movie stills, while account state, counters, history and playlists are simulated;
- state lives only in browser memory and resets on reload;
- downloads, scans and system actions are simulations;
- no Express server, SQLite database, yt-dlp process, account, cookie or upload is used;
- external API calls and outbound links are blocked;
- the demo build is marked `noindex,nofollow,noarchive` and ships a restrictive CSP.

The normal VidArch build is unchanged and continues to use the real backend.

## Open Movie media

The demo library uses locally bundled stills from Blender Open Movie projects
instead of invented placeholder artwork. Film metadata is presented for
illustration, while views, subscriptions, download state and watch progress
remain simulated in the browser.

The complete media attribution list is stored in
`client/public/demo/open-movies/ATTRIBUTION.md`. Project names and title cards
remain credited to their authors; the demo does not claim affiliation with
Blender Studio.

## Local commands

```bash
# Interactive demo development server on http://127.0.0.1:2505
npm run dev:demo

# Static production demo output in client/dist-demo
npm run build:demo

# Preview the production demo build
npm --prefix client run preview:demo
```

## Intended deployment

Create a second Vercel project from this repository and let the root `vercel.json` build only the demo profile. Keep the product itself on its self-hosted/Docker deployment.

Intended public address: `demo.vidarch.lucas-homelab.fr`.

No deployment or custom domain is considered active until both the Vercel deployment and the custom-domain HTTP response have been verified.

## Validation checklist

- normal frontend and backend builds still pass;
- demo build contains `robots.txt`, demo metadata and no backend bundle;
- no request leaves the demo origin;
- home, search, channel, library, playlists, downloads, watch and settings remain navigable;
- download simulation, like, playlist mutation and session reset work;
- desktop, tablet, mobile portrait and mobile landscape layouts are checked.
