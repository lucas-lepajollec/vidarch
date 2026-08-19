/**
 * YouTube download strategy for yt-dlp (2026).
 *
 * Do not force a height filter (`height<=2160`): if 4K is missing, yt-dlp
 * reports "Requested format is not available" and aborts. Cap with
 * `--format-sort res:HEIGHT` instead, like MeTube / the yt-dlp README.
 *
 * Prefer `web_embedded` first: URLs include an `n=` throttling param (nsig).
 * yt-dlp's current default (`android_vr`) has no `n=` and YouTube kills the
 * transfer around 10–15 MB with HTTP 403. Last attempt omits `player_client`
 * so a yt-dlp upgrade can pick a new default without a VidArch change.
 *
 * Do not filter `vcodec^=avc1` in `-f`: YouTube 4K is VP9/AV1 only, H.264
 * stops at 1080p. Prefer h264/m4a via `--format-sort` when they exist.
 * Never mix player clients. Never pin itag 18.
 */
export type YoutubeDownloadAttempt = {
  client: string | null;
  useCookies: boolean;
};

export const LAST_RESORT_FORMAT = 'bv*+ba/b';
export const PRIMARY_DOWNLOAD_CLIENT = 'web_embedded';

export function parseMaxHeight(resolution?: string): number {
  const r = String(resolution || '1080p').toLowerCase();
  if (r.includes('2160') || r.includes('4k')) return 2160;
  if (r.includes('1440') || r.includes('2k')) return 1440;
  if (r.includes('720')) return 720;
  if (r.includes('480')) return 480;
  if (r.includes('360')) return 360;
  if (r.includes('240')) return 240;
  if (r.includes('1080')) return 1080;
  const n = parseInt(r, 10);
  return Number.isFinite(n) && n >= 144 ? n : 1080;
}

export function snapQualityLabel(height: number): string {
  if (!Number.isFinite(height) || height <= 0) return '';
  if (height >= 2000) return '2160p';
  if (height >= 1400) return '1440p';
  if (height >= 1000) return '1080p';
  if (height >= 700) return '720p';
  if (height >= 450) return '480p';
  if (height >= 300) return '360p';
  if (height >= 200) return '240p';
  return `${Math.round(height)}p`;
}

export function qualityLabelFromHeight(height: number): string {
  const snapped = snapQualityLabel(height);
  return snapped || `${Math.round(height)}p`;
}

/** Best video+audio, else muxed. Resolution cap is applied with -S, not here. */
export function buildYtDlpFormatSelector(_height?: number): string {
  return 'bv*+ba/b';
}

export function buildYtDlpFormatSort(height: number): string {
  return `res:${height},vcodec:h264,acodec:m4a`;
}

export type QualityNote = {
  direction: 'lower' | 'higher';
  requested: string;
  actual: string;
};

export function encodeQualityNote(requestedResolution: string, actualHeight: number): string | null {
  const requested = snapQualityLabel(parseMaxHeight(requestedResolution));
  const actual = snapQualityLabel(actualHeight);
  if (!requested || !actual || requested === actual) return null;
  const direction = parseMaxHeight(actual) < parseMaxHeight(requested) ? 'lower' : 'higher';
  return `${direction}:${requested}:${actual}`;
}

export function parseQualityNote(raw?: string | null): QualityNote | null {
  if (!raw) return null;
  const match = String(raw).trim().match(/^(lower|higher):(\d+p):(\d+p)$/i);
  if (!match) return null;
  return {
    direction: match[1].toLowerCase() as 'lower' | 'higher',
    requested: match[2],
    actual: match[3],
  };
}

export function isFatalDownloadError(message: string): boolean {
  return /URL YouTube invalide|URL non autorisée|Cible YouTube vide|canceled|annulé|ENOSPC|No space left|EACCES: permission/i.test(
    message,
  );
}

export function isRetryableYoutubeError(message: string): boolean {
  if (isFatalDownloadError(message)) return false;
  return /page needs to be reloaded|UNPLAYABLE|HTTP Error 403|403: Forbidden|Requested format is not available|No video formats found|Sign in to confirm|nsig extraction failed|Unable to extract|missing a URL|SABR|Skipping client|ffmpeg|Failed to merge|gave up after|HTTP Error 429|timed out|Connection reset/i.test(
    message,
  );
}

export function youtubeDownloadAttempts(hasCookies: boolean): YoutubeDownloadAttempt[] {
  const attempts: YoutubeDownloadAttempt[] = [
    { client: PRIMARY_DOWNLOAD_CLIENT, useCookies: false },
  ];
  if (hasCookies) {
    attempts.push({ client: 'web_safari', useCookies: true });
  }
  attempts.push({ client: null, useCookies: false });
  return attempts;
}

export function metadataPlayerClient(hasCookies: boolean): string {
  return hasCookies ? 'tv' : 'android_vr';
}
