import { readFile, readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const messagesPath = new URL('../client/src/i18n/messages.ts', import.meta.url);
const sourceRoot = fileURLToPath(new URL('../client/src/', import.meta.url));
const messagesSource = await readFile(messagesPath, 'utf8');

function dictionaryKeys(name) {
  const match = messagesSource.match(new RegExp(`const ${name}(?:: Dict)? = \\{([\\s\\S]*?)\\n\\};`));
  if (!match) throw new Error(`Missing dictionary: ${name}`);
  return new Set([...match[1].matchAll(/^\s*['"]([^'"]+)['"]\s*:/gm)].map((entry) => entry[1]));
}

function assertSameKeys(referenceName, candidateName) {
  const reference = dictionaryKeys(referenceName);
  const candidate = dictionaryKeys(candidateName);
  const missing = [...reference].filter((key) => !candidate.has(key));
  const extra = [...candidate].filter((key) => !reference.has(key));
  if (missing.length || extra.length) {
    throw new Error(`${candidateName} differs from ${referenceName}\nMissing: ${missing.join(', ')}\nExtra: ${extra.join(', ')}`);
  }
}

for (const locale of ['fr', 'es', 'de']) assertSameKeys('en', locale);
for (const locale of ['extraFr', 'extraEs', 'extraDe']) assertSameKeys('extraEn', locale);

const englishKeys = new Set([...dictionaryKeys('en'), ...dictionaryKeys('extraEn')]);

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(path));
    else if (['.ts', '.tsx'].includes(extname(entry.name))) files.push(path);
  }
  return files;
}

const missingUsedKeys = new Set();
for (const file of await sourceFiles(sourceRoot)) {
  const source = await readFile(file, 'utf8');
  for (const match of source.matchAll(/\bt\(\s*['"]([^'"]+)['"]/g)) {
    if (!englishKeys.has(match[1])) missingUsedKeys.add(match[1]);
  }
}
if (missingUsedKeys.size) throw new Error(`Unknown translation keys: ${[...missingUsedKeys].sort().join(', ')}`);

const html = await readFile(new URL('../client/index.html', import.meta.url), 'utf8');
if (!html.includes('<html lang="en"')) throw new Error('client/index.html must declare English as the canonical default.');

console.log(`i18n check passed: ${englishKeys.size} keys × 4 locales; all static t() calls resolve.`);
