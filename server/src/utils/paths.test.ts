import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import os from 'os';
import path from 'path';
import { isSafePath, encodeMediaPath } from './paths.js';

describe('path helpers', () => {
  it('blocks path traversal', () => {
    const base = path.join(os.tmpdir(), 'vidarch-safe');
    assert.equal(isSafePath(base, '../etc/passwd'), false);
    assert.equal(isSafePath(base, 'channel/video.mp4'), true);
    assert.equal(isSafePath(base, path.join('channel', 'video.mp4')), true);
  });

  it('encodes media path segments', () => {
    assert.equal(encodeMediaPath('Foo Bar/a.webp'), 'Foo%20Bar/a.webp');
    assert.equal(encodeMediaPath('/media/downloads/Foo/a.webp'), 'Foo/a.webp');
  });
});
