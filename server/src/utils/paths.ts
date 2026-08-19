import path from 'path';
import fs from 'fs';

function normalizeForCompare(p: string): string {
  const resolved = path.resolve(p);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

/** True when `targetPath` (relative or absolute) resolves inside `baseDir`. */
export function isSafePath(baseDir: string, targetPath: string): boolean {
  if (!baseDir || !targetPath || typeof targetPath !== 'string') return false;
  if (targetPath.includes('\0')) return false;

  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(baseDir, targetPath);
  const baseCmp = normalizeForCompare(resolvedBase);
  const targetCmp = normalizeForCompare(resolvedTarget);
  const prefix = baseCmp.endsWith(path.sep) ? baseCmp : baseCmp + path.sep;
  return targetCmp === baseCmp || targetCmp.startsWith(prefix);
}

/** Resolve a user/DB path against base, or `null` if it escapes. */
export function resolveInside(baseDir: string, targetPath: string): string | null {
  if (!isSafePath(baseDir, targetPath)) return null;
  return path.resolve(baseDir, targetPath);
}

export function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/** Encode each path segment so `/media/downloads/Foo Bar/a.webp` stays valid. */
export function encodeMediaPath(rel: string): string {
  return rel
    .replace(/\\/g, '/')
    .replace(/^\/media\/downloads\//, '')
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

export function toPosixRel(rel: string): string {
  return rel.replace(/\\/g, '/');
}
