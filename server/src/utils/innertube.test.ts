import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractChannelVideoCount, parsePlayerResponse } from './innertube.js';
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

  it('reads the channel video count from the nested page header', () => {
    const payload = {
      header: {
        pageHeaderRenderer: {
          content: {
            pageHeaderViewModel: {
              metadata: {
                contentMetadataViewModel: {
                  metadataRows: [
                    { metadataParts: [{ text: { content: '@Squeezie' } }] },
                    {
                      metadataParts: [
                        { text: { content: '19.1M subscribers' } },
                        { text: { content: '1.8K videos' } },
                      ],
                    },
                  ],
                },
              },
            },
          },
        },
      },
    };
    assert.equal(extractChannelVideoCount(payload), 1800);
    assert.equal(extractChannelVideoCount({
      header: {
        pageHeaderRenderer: {
          content: {
            pageHeaderViewModel: {
              metadata: {
                contentMetadataViewModel: {
                  metadataRows: [
                    { metadataParts: [{ text: { content: '450 videos' } }] },
                  ],
                },
              },
            },
          },
        },
      },
    }), 450);
  });
});
