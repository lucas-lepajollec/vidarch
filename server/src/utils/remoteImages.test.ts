import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  cacheEntryId,
  isDummyYoutubeThumb,
  jpegDimensions,
  looksLikeImage,
  pruneCacheDir,
  youtubeThumbCandidates,
} from './remoteImages.js';

describe('remote image helpers', () => {
  it('lists youtube thumbnail candidates', () => {
    const urls = youtubeThumbCandidates('eMn43As24Bo');
    assert.ok(urls.some((u) => u.includes('/maxresdefault.jpg')));
    assert.ok(urls.some((u) => u.includes('img.youtube.com')));
  });

  it('treats tiny buffers as dummy thumbs', () => {
    assert.equal(isDummyYoutubeThumb(Buffer.from('x')), true);
  });

  it('reads jpeg dimensions from SOF0 and flags the 120x90 dummy', () => {
    const buf = Buffer.alloc(900, 0);
    Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x5a, 0x00, 0x78, 0x03, 0x01, 0x22, 0x00]).copy(buf);
    const size = jpegDimensions(buf);
    assert.deepEqual(size, { width: 120, height: 90 });
    assert.equal(isDummyYoutubeThumb(buf), true);
  });

  it('rejects non-image payloads', () => {
    assert.equal(looksLikeImage(Buffer.from('<html>nope</html>')), false);
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x5a, 0x00, 0x78, 0x03, 0x01, 0x22, 0x00]);
    assert.equal(looksLikeImage(jpeg), true);
  });

  it('parses cache filenames', () => {
    assert.equal(cacheEntryId('eMn43As24Bo.jpg'), 'eMn43As24Bo');
    assert.equal(cacheEntryId('UCxH16958KSxT4Z9yL_9JYtw.webp'), 'UCxH16958KSxT4Z9yL_9JYtw');
    assert.equal(cacheEntryId('notes.txt'), null);
  });

  it('keeps protected and recent cache files, deletes stale search thumbs', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vidarch-cache-'));
    const keepId = 'eMn43As24Bo';
    const staleId = 's47X4a2OjYA';
    const freshId = 'cKkFzGMfWA8';
    const keepFile = path.join(dir, `${keepId}.jpg`);
    const staleFile = path.join(dir, `${staleId}.jpg`);
    const freshFile = path.join(dir, `${freshId}.jpg`);
    fs.writeFileSync(keepFile, 'x');
    fs.writeFileSync(staleFile, 'x');
    fs.writeFileSync(freshFile, 'x');
    const now = Date.now();
    const nineDays = 9 * 24 * 60 * 60 * 1000;
    fs.utimesSync(keepFile, new Date(now - nineDays), new Date(now - nineDays));
    fs.utimesSync(staleFile, new Date(now - nineDays), new Date(now - nineDays));
    fs.utimesSync(freshFile, new Date(now - 60_000), new Date(now - 60_000));

    const result = pruneCacheDir(dir, new Set([keepId]), 7 * 24 * 60 * 60 * 1000, now);
    assert.equal(result.deleted, 1);
    assert.equal(fs.existsSync(keepFile), true);
    assert.equal(fs.existsSync(staleFile), false);
    assert.equal(fs.existsSync(freshFile), true);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
