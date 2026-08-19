import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseMaxHeight,
  buildYtDlpFormatSelector,
  buildYtDlpFormatSort,
  isRetryableYoutubeError,
  isFatalDownloadError,
  youtubeDownloadAttempts,
  metadataPlayerClient,
  encodeQualityNote,
  parseQualityNote,
  LAST_RESORT_FORMAT,
  PRIMARY_DOWNLOAD_CLIENT,
} from './ytdlpDownload.js';

describe('yt-dlp download strategy', () => {
  it('maps quality labels to height caps', () => {
    assert.equal(parseMaxHeight('2160p'), 2160);
    assert.equal(parseMaxHeight('4K'), 2160);
    assert.equal(parseMaxHeight('1440p'), 1440);
    assert.equal(parseMaxHeight('2k'), 1440);
    assert.equal(parseMaxHeight('1080p'), 1080);
    assert.equal(parseMaxHeight('720p'), 720);
    assert.equal(parseMaxHeight('360p'), 360);
    assert.equal(parseMaxHeight(undefined), 1080);
  });

  it('does not filter height in -f so missing 4K cannot abort the download', () => {
    assert.equal(buildYtDlpFormatSelector(2160), 'bv*+ba/b');
    assert.equal(buildYtDlpFormatSelector(720), 'bv*+ba/b');
    assert.equal(LAST_RESORT_FORMAT, 'bv*+ba/b');
    assert.equal(buildYtDlpFormatSort(2160), 'res:2160,vcodec:h264,acodec:m4a');
  });

  it('retries 403 / UNPLAYABLE / missing formats / merge failures', () => {
    assert.equal(isRetryableYoutubeError('ERROR: [youtube] HTTP Error 403: Forbidden'), true);
    assert.equal(isRetryableYoutubeError('The page needs to be reloaded'), true);
    assert.equal(isRetryableYoutubeError('Requested format is not available'), true);
    assert.equal(isRetryableYoutubeError('Failed to merge formats'), true);
    assert.equal(isFatalDownloadError('canceled'), true);
    assert.equal(isRetryableYoutubeError('canceled'), false);
  });

  it('uses web_embedded first and yt-dlp default last, never cookies with the default client', () => {
    const withCookies = youtubeDownloadAttempts(true);
    const anonymous = youtubeDownloadAttempts(false);
    assert.equal(PRIMARY_DOWNLOAD_CLIENT, 'web_embedded');
    assert.equal(withCookies[0].client, 'web_embedded');
    assert.equal(withCookies[0].useCookies, false);
    assert.ok(withCookies.some((a) => a.client === 'web_safari' && a.useCookies));
    assert.equal(withCookies[withCookies.length - 1].client, null);
    assert.equal(withCookies[withCookies.length - 1].useCookies, false);
    assert.equal(anonymous[0].client, 'web_embedded');
    assert.equal(anonymous.some((a) => a.useCookies), false);
    assert.equal(anonymous[anonymous.length - 1].client, null);
    assert.equal(anonymous.some((a) => a.client === 'android_vr'), false);
    assert.equal(metadataPlayerClient(false), 'android_vr');
    assert.equal(metadataPlayerClient(true), 'tv');
  });

  it('encodes a quality mismatch for the UI', () => {
    assert.equal(encodeQualityNote('2160p', 1080), 'lower:2160p:1080p');
    assert.equal(encodeQualityNote('720p', 1080), 'higher:720p:1080p');
    assert.equal(encodeQualityNote('1080p', 1080), null);
    assert.deepEqual(parseQualityNote('lower:2160p:360p'), {
      direction: 'lower',
      requested: '2160p',
      actual: '360p',
    });
    assert.equal(parseQualityNote(null), null);
  });
});
