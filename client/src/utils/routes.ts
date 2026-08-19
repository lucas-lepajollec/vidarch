import type { NavigationState, PageRoute } from '../types';

const KNOWN_PAGES: PageRoute[] = [
  'home',
  'subscriptions',
  'library',
  'history',
  'liked',
  'downloads',
  'settings',
  'watch',
  'channel',
  'search',
  'mychannel',
];

export function navToPath(nav: NavigationState): string {
  switch (nav.page) {
    case 'watch':
      return nav.videoId ? `/watch/${encodeURIComponent(nav.videoId)}` : '/';
    case 'channel':
      return nav.channelId ? `/channel/${encodeURIComponent(nav.channelId)}` : '/';
    case 'mychannel':
      return '/my-channel';
    case 'search': {
      const q = nav.query ? `?q=${encodeURIComponent(nav.query)}` : '';
      return `/search${q}`;
    }
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
  if (watch) return { page: 'watch', videoId: decodeURIComponent(watch[1]) };

  const channel = raw.match(/^\/channel\/(.+)$/);
  if (channel) return { page: 'channel', channelId: decodeURIComponent(channel[1]) };

  const page = raw.slice(1) as PageRoute;
  if (KNOWN_PAGES.includes(page) && page !== 'watch' && page !== 'channel' && page !== 'search') {
    return { page };
  }
  return { page: 'home' };
}
