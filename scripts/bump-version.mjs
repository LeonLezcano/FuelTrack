import fs from 'node:fs';

const versionPath = 'version.json';
const pkgPath = 'package.json';
const swPath = 'sw.js';
const appPath = 'src/app.js';

const v = JSON.parse(fs.readFileSync(versionPath, 'utf-8'));
const [maj, min, patch] = v.version.replace(/^v/, '').split('.').map(Number);
const nextPatch = String(patch + 1).padStart(2, '0');
const nextSemver = `${maj}.${min}.${nextPatch}`;
const nextTag = `v${nextSemver}`;
const nextCacheName = `fueltrack-cache-${nextTag}`;

v.version = nextTag;
v.build = new Date().toISOString().slice(0, 10).replace(/-/g, '') + '.1';
v.releaseDate = new Date().toISOString().slice(0, 10);
v.cacheName = nextCacheName;
fs.writeFileSync(versionPath, JSON.stringify(v, null, 2) + '\n', 'utf-8');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
pkg.version = nextSemver;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');

const sw = fs.readFileSync(swPath, 'utf-8').replace(
  /const CACHE_NAME = 'fueltrack-cache-v[^']+';/,
  `const CACHE_NAME = '${nextCacheName}';`
);
fs.writeFileSync(swPath, sw, 'utf-8');

const app = fs.readFileSync(appPath, 'utf-8').replace(
  /const APP_VERSION = 'v[^']+';/,
  `const APP_VERSION = '${nextTag}';`
);
fs.writeFileSync(appPath, app, 'utf-8');

console.log(`Bumped FuelTrack to ${nextTag} (${nextCacheName})`);
