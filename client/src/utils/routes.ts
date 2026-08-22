import type { NavigationState, PageRoute } from '../types';

const KNOWN_PAGES: PageRoute[] = [
  'home',
  'subscriptions',
  'library',
  'history',
  'liked',
  'playlists',
  'downloads',
  'settings',
  'watch',
  'channel',
  'search',
  'mychannel',
];

export function navToPath(nav: NavigationState): string {
  switch (nav.page) {
    case 'watch': {
      if (!nav.videoId) return '/';
      const q = new URLSearchParams();
      if (nav.playlistId) q.set('list', nav.playlistId);
      if (nav.playlistShuffle) q.set('shuffle', '1');
      const qs = q.toString();
      return `/watch/${encodeURIComponent(nav.videoId)}${qs ? `?${qs}` : ''}`;
    }
    case 'channel':
      return nav.channelId ? `/channel/${encodeURIComponent(nav.channelId)}` : '/';
    case 'mychannel':
      return '/my-channel';
    case 'search': {
      const q = nav.query ? `?q=${encodeURIComponent(nav.query)}` : '';
      return `/search${q}`;
    }
    case 'playlists':
      return nav.playlistId
        ? `/playlists/${encodeURIComponent(nav.playlistId)}`
        : '/playlists';
    case 'liked':
      return '/playlists/liked';
    case 'home':
      return '/';
    default:
      return `/${nav.page}`;
  }
}

export function pathToNav(pathname: string, search = ''): NavigationState {
  const params = new URLSearchParams(search);
  const raw = pathname.replace(/\/+$/, '') || '/';

  if (raw === '/' || raw === '') return { page: 'home' };
  if (raw === '/search') return { page: 'search', query: params.get('q') || '' };

  if (raw === '/my-channel') return { page: 'mychannel' };

  const watch = raw.match(/^\/watch\/(.+)$/);
  if (watch) {
    return {
      page: 'watch',
      videoId: decodeURIComponent(watch[1]),
      playlistId: params.get('list') || undefined,
      playlistShuffle: params.get('shuffle') === '1',
    };
  }

  const channel = raw.match(/^\/channel\/(.+)$/);
  if (channel) return { page: 'channel', channelId: decodeURIComponent(channel[1]) };

  if (raw === '/liked') return { page: 'playlists', playlistId: 'liked' };
  if (raw === '/playlists') return { page: 'playlists' };

  const playlist = raw.match(/^\/playlists\/(.+)$/);
  if (playlist) return { page: 'playlists', playlistId: decodeURIComponent(playlist[1]) };

  const page = raw.slice(1) as PageRoute;
  if (KNOWN_PAGES.includes(page) && page !== 'watch' && page !== 'channel' && page !== 'search' && page !== 'playlists') {
    return { page };
  }
  return { page: 'home' };
}
