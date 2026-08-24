export function isYouTubeVideoId(id?: string | null): boolean {
  return typeof id === 'string' && /^[a-zA-Z0-9_-]{11}$/.test(id);
}

export function encodeMediaPath(rel: string): string {
  return rel
    .replace(/\\/g, '/')
    .replace(/^\/media\/downloads\//, '')
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

export function localMediaUrl(rel?: string | null): string | undefined {
  if (!rel) return undefined;
  if (rel.startsWith('/media/')) return rel;
  if (rel.startsWith('http://') || rel.startsWith('https://')) return rel;
  return `/media/downloads/${encodeMediaPath(rel)}`;
}

export function isLocalMediaUrl(url?: string | null): boolean {
  return !!url && (url.startsWith('/media/') || url.startsWith('/demo/') || url.startsWith('data:') || url.startsWith('blob:'));
}

export function proxyThumbUrl(id: string): string {
  return `/media/thumb/${encodeURIComponent(id)}`;
}

export function proxyAvatarUrl(id: string): string {
  return `/media/avatar/${encodeURIComponent(id)}`;
}

export function proxyBannerUrl(id: string): string {
  return `/media/banner/${encodeURIComponent(id)}`;
}

export function youtubeThumbUrl(id: string, variant: 'maxresdefault' | 'sddefault' | 'hq720' | 'hqdefault' | 'mqdefault' | '0' = 'hqdefault'): string {
  return `https://i.ytimg.com/vi/${id}/${variant}.jpg`;
}

export function sanitizeThumbUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    if (u.hostname.includes('ytimg.com')) {
      u.search = '';
      u.hash = '';
      return u.toString();
    }
  } catch {}
  return url;
}

export function sanitizeAvatarUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  return url.replace(/=s0(?=$|[-?&])/i, '=s240-c-k-c0x00ffffff-no-rj');
}

export interface ThumbLike {
  id: string;
  is_downloaded?: number;
  local_thumbnail_path?: string | null;
  thumbnail_url?: string | null;
  thumbnailUrl?: string | null;
}

export function buildThumbFallbacks(video: ThumbLike): string[] {
  const urls: string[] = [];
  const push = (u?: string | null) => {
    if (u && !urls.includes(u)) urls.push(u);
  };

  if (video.is_downloaded === 1) {
    push(localMediaUrl(video.local_thumbnail_path));
  }
  if (isYouTubeVideoId(video.id)) {
    push(proxyThumbUrl(video.id));
  }
  const extra = video.thumbnail_url || video.thumbnailUrl;
  if (extra && isLocalMediaUrl(extra)) push(extra);
  return urls;
}

export function resolveThumbnail(video: ThumbLike): string {
  return buildThumbFallbacks(video)[0] || '';
}

export function avatarSrc(channelId?: string | null, fallbackUrl?: string | null): string | undefined {
  if (fallbackUrl && isLocalMediaUrl(fallbackUrl)) return fallbackUrl;
  const isCustom = !!channelId && String(channelId).startsWith('custom_');
  if (isCustom && !fallbackUrl) return undefined;
  if (channelId) {
    const base = proxyAvatarUrl(channelId);
    if (fallbackUrl && !isLocalMediaUrl(fallbackUrl) && /^https?:\/\//i.test(fallbackUrl)) {
      return `${base}?u=${encodeURIComponent(sanitizeAvatarUrl(fallbackUrl) || fallbackUrl)}`;
    }
    if (isCustom) return undefined;
    return base;
  }
  return undefined;
}

export function bannerSrc(channelId?: string | null, fallbackUrl?: string | null): string | undefined {
  if (fallbackUrl && isLocalMediaUrl(fallbackUrl)) return fallbackUrl;
  if (channelId && fallbackUrl && /^https?:\/\//i.test(fallbackUrl)) {
    return `${proxyBannerUrl(channelId)}?u=${encodeURIComponent(fallbackUrl)}`;
  }
  if (fallbackUrl) return fallbackUrl;
  return undefined;
}
