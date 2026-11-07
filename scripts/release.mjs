// Usage: npm run release -- 0.3.0 "What changed, one line per item"
// Sets the version everywhere, commits, tags vX.Y.Z (the tag message becomes the release notes) and pushes.
// GitHub Actions then builds the installers and publishes the release; installed apps pick it up as an update.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const [v, notes] = process.argv.slice(2);
const die = msg => { console.error(msg); process.exit(1); };
if (!/^\d+\.\d+\.\d+$/.test(v || '')) die('usage: npm run release -- X.Y.Z "release notes"');
if (!notes) die('Add release notes as the second argument; they show up in the app as "What\'s new".');

const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
if (git('status', '--porcelain')) die('Commit or stash your changes first.');
if (git('tag', '-l', `v${v}`)) die(`v${v} already exists.`);
const current = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8')).version;
const newer = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; };
if (!newer(v, current)) die(`${v} must be newer than the current ${current}, or installed apps won't see it as an update.`);

const edit = (file, re, to) => {
  const s = readFileSync(file, 'utf8'), t = s.replace(re, to);
  if (s === t) die(`Couldn't find the version in ${file}`);
  writeFileSync(file, t);
};
edit('src-tauri/tauri.conf.json', /"version": "[^"]+"/, `"version": "${v}"`);
edit('package.json', /"version": "[^"]+"/, `"version": "${v}"`);
edit('package-lock.json', /("name": "beadboard",\s+"version": )"[^"]+"/g, `$1"${v}"`);
edit('src-tauri/Cargo.toml', /^version = "[^"]+"/m, `version = "${v}"`);
edit('src-tauri/Cargo.lock', /(name = "beadboard"\nversion = )"[^"]+"/, `$1"${v}"`);

git('add', 'src-tauri/tauri.conf.json', 'package.json', 'package-lock.json', 'src-tauri/Cargo.toml', 'src-tauri/Cargo.lock');
git('commit', '-m', `Release ${v}`);
git('tag', '-a', `v${v}`, '-m', notes);
execFileSync('git', ['push', '--follow-tags'], { stdio: 'inherit' });
console.log(`\nPushed v${v}. Follow the build with: gh run watch`);
