import fs from 'node:fs';

const semver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const read = (path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), 'utf8'));
const packageJson = read('../package.json');
const packageLock = read('../package-lock.json');
const clientPackage = read('../client/package.json');
const version = packageJson.version;

if (!packageJson.private) throw new Error('The VidArch application package must stay private; it is not published to npm.');
if (!clientPackage.private) throw new Error('The internal VidArch client package must stay private.');
if (!semver.test(version)) throw new Error(`Invalid product version: ${version}`);
if (packageLock.name !== packageJson.name || packageLock.packages?.['']?.name !== packageJson.name) {
  throw new Error('package.json and package-lock.json product names do not match.');
}
if (packageLock.version !== version || packageLock.packages?.['']?.version !== version) {
  throw new Error('package.json and package-lock.json product versions do not match.');
}

if (process.env.GITHUB_REF_TYPE === 'tag') {
  const expected = `v${version}`;
  if (process.env.GITHUB_REF_NAME !== expected) {
    throw new Error(`Release tag ${process.env.GITHUB_REF_NAME} does not match product version ${expected}.`);
  }
}

console.log(`VidArch product version verified: ${version}; private client package is not versioned separately.`);
