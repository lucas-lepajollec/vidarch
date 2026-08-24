import type { Channel, DownloadTask, PlaylistSummary, SearchResultItem, Video } from '../types';
import { DEMO_VIDEO_PATH } from './config';

const palette = [
  ['#ff5a67', '#30131d', '#0b1016'],
  ['#73c7e8', '#123243', '#090d12'],
  ['#c084fc', '#2e1748', '#0b1016'],
  ['#fb923c', '#4a2415', '#101317'],
  ['#34d399', '#12372e', '#08110f'],
  ['#facc15', '#44370d', '#12100a'],
] as const;

function svgData(svg: string): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function escapeSvg(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
  })[char] || char);
}

function avatar(label: string, index: number): string {
  const [accent, middle, dark] = palette[index % palette.length];
  const initials = escapeSvg(label.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase());
  return svgData(`
    <svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
      <defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${accent}"/><stop offset=".55" stop-color="${middle}"/><stop offset="1" stop-color="${dark}"/></linearGradient></defs>
      <rect width="240" height="240" rx="120" fill="url(#a)"/>
      <circle cx="178" cy="62" r="44" fill="none" stroke="white" stroke-opacity=".2" stroke-width="3"/>
      <text x="120" y="143" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="70" font-weight="800">${initials}</text>
    </svg>
  `);
}

function banner(label: string, index: number): string {
  const [accent, middle, dark] = palette[index % palette.length];
  return svgData(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1600" height="360" viewBox="0 0 1600 360">
      <defs><linearGradient id="b"><stop stop-color="${dark}"/><stop offset=".55" stop-color="${middle}"/><stop offset="1" stop-color="${accent}"/></linearGradient></defs>
      <rect width="1600" height="360" fill="url(#b)"/>
      <path d="M0 300 C260 130 420 360 710 190 S1170 45 1600 210" fill="none" stroke="white" stroke-opacity=".14" stroke-width="3"/>
      <path d="M0 330 C270 160 470 400 770 210 S1220 80 1600 250" fill="none" stroke="${accent}" stroke-opacity=".7" stroke-width="8"/>
      <text x="80" y="125" fill="white" fill-opacity=".55" font-family="Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="10">ESPACE CRÉATEUR</text>
      <text x="80" y="215" fill="white" font-family="Arial, sans-serif" font-size="68" font-weight="800">${escapeSvg(label)}</text>
    </svg>
  `);
}

export const demoChannels: Channel[] = [
  {
    id: 'demo-owner',
    title: 'Vidéothèque démo',
    handle: '@vidarch-demo',
    description: 'Profil local fictif utilisé uniquement pour présenter les fonctions de VidArch.',
    avatar_url: avatar('VidArch Demo', 0),
    banner_url: banner('VIDÉOTHÈQUE DÉMO', 0),
    subscriber_count: '0',
    video_count: 0,
    downloaded_count: 0,
    total_detected_videos: 0,
    auto_download: 0,
    auto_download_mode: 'future',
    max_resolution: '1080p',
    is_subscribed: 0,
    is_owner: 1,
    is_active_owner: 1,
    language: 'fr',
  },
  {
    id: 'demo-blender-open-movies',
    title: 'Blender Open Movies · sélection',
    handle: '@open-movies-demo',
    description: 'Une sélection de films ouverts, making-of et études de production publiés par Blender Studio.',
    avatar_url: avatar('Open Movies Demo', 1),
    banner_url: banner('BLENDER OPEN MOVIES', 1),
    subscriber_count: '4,1 M',
    video_count: 20,
    downloaded_count: 8,
    total_detected_videos: 20,
    auto_download: 1,
    auto_download_mode: 'future',
    max_resolution: '1440p',
    is_subscribed: 1,
    language: 'en',
  },
];

const videoSeeds = [
  { title: 'Big Buck Bunny', duration: 596, downloaded: 1, thumbnail: '31-big-buck-bunny-still.jpg', date: '20080530', project: 'Big Buck Bunny', license: 'CC BY 3.0' },
  { title: 'Sintel — The Movie', duration: 888, downloaded: 1, thumbnail: '30-sintel-still.png', date: '20100927', project: 'Sintel', license: 'CC BY 3.0' },
  { title: 'Tears of Steel', duration: 734, downloaded: 1, thumbnail: '09-tears-of-steel-breakdown.webp', date: '20120926', project: 'Tears of Steel', license: 'CC BY 3.0' },
  { title: 'Spring — Open Movie', duration: 464, downloaded: 1, thumbnail: '10-spring.webp', date: '20190404', project: 'Spring', license: 'CC BY 4.0' },
  { title: 'Sprite Fright — Showreel', duration: 192, downloaded: 1, thumbnail: '24-sprite-fright-showreel.webp', date: '20211029', project: 'Sprite Fright', license: 'CC BY' },
  { title: 'Charge — Open Movie', duration: 256, downloaded: 1, thumbnail: '16-charge.webp', date: '20221215', project: 'Charge', license: 'CC BY' },
  { title: 'Cosmos Laundromat: First Cycle', duration: 730, downloaded: 1, thumbnail: '26-cosmos-laundromat-film.webp', date: '20150810', project: 'Cosmos Laundromat', license: 'CC BY' },
  { title: 'Making of Big Buck Bunny', duration: 1306, downloaded: 1, thumbnail: '01-big-buck-bunny.webp', date: '20080601', project: 'Big Buck Bunny', license: 'CC BY 3.0' },
  { title: 'Big Buck Bunny — Deleted Scenes', duration: 796, downloaded: 0, thumbnail: '02-big-buck-bunny-making-of.webp', date: '20080602', project: 'Big Buck Bunny', license: 'CC BY 3.0' },
  { title: 'Big Buck Bunny — Quadsplit', duration: 596, downloaded: 0, thumbnail: '03-big-buck-bunny-breakdown.webp', date: '20080603', project: 'Big Buck Bunny', license: 'CC BY 3.0' },
  { title: 'Sintel — Pre-production Workshop', duration: 737, downloaded: 0, thumbnail: '04-sintel.webp', date: '20100928', project: 'Sintel', license: 'CC BY 3.0' },
  { title: 'Sintel — Quad Split', duration: 887, downloaded: 0, thumbnail: '05-sintel-workshop.webp', date: '20100929', project: 'Sintel', license: 'CC BY 3.0' },
  { title: 'Tears of Steel — Casting the Actors', duration: 110, downloaded: 0, thumbnail: '07-tears-of-steel.webp', date: '20120927', project: 'Tears of Steel', license: 'CC BY 3.0' },
  { title: 'Tears of Steel — Behind the Scenes', duration: 566, downloaded: 0, thumbnail: '08-tears-of-steel-casting.webp', date: '20120928', project: 'Tears of Steel', license: 'CC BY 3.0' },
  { title: 'Spring — Open Content Overview', duration: 508, downloaded: 0, thumbnail: '12-spring-artwork.webp', date: '20190405', project: 'Spring', license: 'CC BY 4.0' },
  { title: 'Spring — Frames Selection', duration: 384, downloaded: 0, thumbnail: '23-spring-frames.webp', date: '20190406', project: 'Spring', license: 'CC BY 4.0' },
  { title: 'Sprite Fright — Production Lessons', duration: 642, downloaded: 0, thumbnail: '13-sprite-fright.webp', date: '20211030', project: 'Sprite Fright', license: 'CC BY' },
  { title: 'Sprite Fright — Production Notes', duration: 918, downloaded: 0, thumbnail: '14-sprite-fright-making-of.webp', date: '20211031', project: 'Sprite Fright', license: 'CC BY' },
  { title: 'Charge — Reference vs Final', duration: 321, downloaded: 0, thumbnail: '25-charge-reference-final.webp', date: '20221216', project: 'Charge', license: 'CC BY' },
  { title: 'Cosmos Laundromat — Grass Simulation', duration: 248, downloaded: 0, thumbnail: '20-cosmos-laundromat-making-of.webp', date: '20150811', project: 'Cosmos Laundromat', license: 'CC BY' },
] as const;

function durationString(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}:${String(remaining).padStart(2, '0')}`;
}

export const demoVideos: Video[] = videoSeeds.map((seed, index) => {
  const channel = demoChannels.find((item) => item.id === 'demo-blender-open-movies')!;
  const day = String((index % 24) + 1).padStart(2, '0');
  return {
    id: `demo-video-${String(index + 1).padStart(2, '0')}`,
    channel_id: channel.id,
    channel_title: channel.title,
    channel_avatar: channel.avatar_url,
    title: seed.title,
    description: `${seed.project} est présenté à partir de contenus publiés par Blender Studio sous licence ${seed.license}. Les compteurs et états de bibliothèque sont simulés localement pour la démonstration VidArch.`,
    duration: seed.duration,
    duration_string: durationString(seed.duration),
    view_count: 48_000 + index * 37_420,
    upload_date: seed.date,
    thumbnail_url: `/demo/open-movies/${seed.thumbnail}`,
    local_video_path: seed.downloaded ? DEMO_VIDEO_PATH : undefined,
    file_size: seed.downloaded ? 84_000_000 + index * 4_250_000 : undefined,
    resolution: seed.downloaded ? (index % 3 === 0 ? '1440p' : '1080p') : undefined,
    fps: 30,
    ext: seed.downloaded ? 'mp4' : undefined,
    is_downloaded: seed.downloaded,
    watch_progress: index === 1 ? 164 : 0,
    is_watched: index === 0 ? 1 : 0,
    liked: index === 2 || index === 6 ? 1 : 0,
    created_at: `2026-08-${day}T12:00:00.000Z`,
    downloaded_at: seed.downloaded ? `2026-08-${day}T14:30:00.000Z` : undefined,
    channel_video_count: channel.video_count,
    channel_downloaded_count: channel.downloaded_count,
    language: 'en',
  } satisfies Video;
});

export const demoPlaylists: PlaylistSummary[] = [
  {
    id: 'liked',
    title: 'Vidéos « J’aime »',
    system: true,
    video_count: 2,
    cover_thumb: demoVideos[2].thumbnail_url,
    cover_video_id: demoVideos[2].id,
  },
  {
    id: 'demo-playlist-focus',
    title: 'À regarder au calme',
    system: false,
    video_count: 4,
    cover_thumb: demoVideos[4].thumbnail_url,
    cover_video_id: demoVideos[4].id,
    created_at: '2026-08-18T10:00:00.000Z',
    updated_at: '2026-08-23T18:00:00.000Z',
  },
  {
    id: 'demo-playlist-inspiration',
    title: 'Inspiration visuelle',
    system: false,
    video_count: 3,
    cover_thumb: demoVideos[0].thumbnail_url,
    cover_video_id: demoVideos[0].id,
    created_at: '2026-08-12T09:00:00.000Z',
    updated_at: '2026-08-22T20:00:00.000Z',
  },
];

export const demoPlaylistVideos: Record<string, string[]> = {
  liked: [demoVideos[2].id, demoVideos[6].id],
  'demo-playlist-focus': [demoVideos[4].id, demoVideos[8].id, demoVideos[1].id, demoVideos[13].id],
  'demo-playlist-inspiration': [demoVideos[0].id, demoVideos[2].id, demoVideos[15].id],
};

export const demoSearchItems: SearchResultItem[] = demoVideos.filter((video) => !video.is_downloaded).map((video) => ({
  id: video.id,
  type: 'video',
  title: video.title,
  channelTitle: video.channel_title,
  channelId: video.channel_id,
  duration: video.duration,
  durationString: video.duration_string,
  thumbnailUrl: video.thumbnail_url,
  url: `https://demo.invalid/watch/${video.id}`,
  description: video.description,
  viewCount: video.view_count,
  uploadDate: 'il y a quelques jours',
  channelAvatar: video.channel_avatar,
  language: 'fr',
}));

export const demoInitialQueue: DownloadTask[] = [];
