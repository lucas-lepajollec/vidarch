import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parsePlayerResponse } from './innertube.js';
import { sanitizeAvatarUrl, sanitizeThumbUrl } from './youtube.js';

describe('original metadata helpers', () => {
  it('reads the original title from player videoDetails', () => {
    const parsed = parsePlayerResponse({
      videoDetails: {
        videoId: 'eMn43As24Bo',
        title: 'Le Jeu de la Vie',
        shortDescription: 'desc',
        author: 'EGO',
        thumbnail: { thumbnails: [{ url: 'https://i.ytimg.com/vi/eMn43As24Bo/hqdefault.jpg?sqp=expired' }] },
      },
    });
    assert.equal(parsed?.title, 'Le Jeu de la Vie');
    assert.equal(parsed?.channelTitle, 'EGO');
    assert.equal(parsed?.thumbnailUrl, 'https://i.ytimg.com/vi/eMn43As24Bo/hqdefault.jpg');
  });

  it('strips expired ytimg signatures and fixes s0 avatars', () => {
    assert.equal(
      sanitizeThumbUrl('https://i.ytimg.com/vi/abc/hqdefault.jpg?sqp=-oay&rs=AOn4'),
      'https://i.ytimg.com/vi/abc/hqdefault.jpg',
    );
    assert.match(
      sanitizeAvatarUrl('https://yt3.googleusercontent.com/xyz=s0'),
      /=s240/,
    );
  });
});
