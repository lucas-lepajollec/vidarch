export type QualityNote = {
  direction: 'lower' | 'higher';
  requested: string;
  actual: string;
};

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
