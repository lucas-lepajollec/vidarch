import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isAllowedYouTubeTarget,
  looksLikeUrl,
  isYouTubeVideoId,
  extractYouTubeVideoId,
  pickContentLanguage,
  buildYtDlpLangArgs,
  parseYoutubeHandle,
} from './youtube.js';

describe('youtube helpers', () => {
  it('accepts youtube watch URLs', () => {
    assert.equal(isAllowedYouTubeTarget('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), true);
    assert.equal(isAllowedYouTubeTarget('https://youtu.be/dQw4w9WgXcQ'), true);
  });

  it('rejects non-youtube and local URLs', () => {
    assert.equal(isAllowedYouTubeTarget('https://evil.example/video'), false);
    assert.equal(isAllowedYouTubeTarget('file:///etc/passwd'), false);
    assert.equal(isAllowedYouTubeTarget('http://127.0.0.1/watch'), false);
    assert.equal(isAllowedYouTubeTarget('https://user:pass@youtube.com/watch?v=dQw4w9WgXcQ'), false);
  });

  it('accepts handles and search queries', () => {
    assert.equal(isAllowedYouTubeTarget('@Veritasium'), true);
    assert.equal(isAllowedYouTubeTarget('science etonante'), true);
  });

  it('validates video ids', () => {
    assert.equal(isYouTubeVideoId('dQw4w9WgXcQ'), true);
    assert.equal(isYouTubeVideoId('imp_abcd1234'), false);
    assert.equal(extractYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
    assert.equal(looksLikeUrl('file://x'), true);
  });

  it('picks a language code from yt-dlp metadata', () => {
    assert.equal(pickContentLanguage({ language: 'fr-FR' }), 'fr');
    assert.equal(pickContentLanguage({ original_language: 'en' }), 'en');
    assert.equal(pickContentLanguage({ audio_language: 'de_DE' }), 'de');
    assert.equal(pickContentLanguage({}), '');
    assert.equal(pickContentLanguage({ language: 'fr', original_language: 'en' }), 'en');
  });

  it('parses YouTube handles and rejects channel IDs', () => {
    assert.equal(parseYoutubeHandle('@Veritasium'), '@Veritasium');
    assert.equal(parseYoutubeHandle('Veritasium'), '@Veritasium');
    assert.equal(parseYoutubeHandle('https://www.youtube.com/@Veritasium'), '@Veritasium');
    assert.equal(parseYoutubeHandle('https://www.youtube.com/@Veritasium/videos'), '@Veritasium');
    assert.equal(parseYoutubeHandle('https://www.youtube.com/channel/UCHnyfMqiRRG1u-2MsSQLbXA'), null);
    assert.equal(parseYoutubeHandle('UCHnyfMqiRRG1u-2MsSQLbXA'), null);
    assert.equal(parseYoutubeHandle(''), null);
  });

  it('uses android_vr only so web DASH URLs are not mixed in', () => {
    const args = buildYtDlpLangArgs();
    assert.ok(args.includes('youtube:player_client=android_vr'));
    assert.equal(args.some((a) => a.includes('android_vr,web') || a.includes('lang=')), false);
  });
});
