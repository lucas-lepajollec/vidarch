const UNSET_OWNER_TITLES = new Set([
  'my channel',
  'ma chaîne',
  'ma chaine',
  'mi canal',
  'mein kanal',
]);

export function isUnsetOwnerTitle(title?: string | null): boolean {
  const trimmed = (title || '').trim();
  if (!trimmed) return true;
  return UNSET_OWNER_TITLES.has(trimmed.toLowerCase());
}

export function ownerDisplayTitle(title: string | null | undefined, fallback: string): string {
  return isUnsetOwnerTitle(title) ? fallback : String(title).trim();
}
