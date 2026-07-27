import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const manifest = JSON.parse(read('data/manifest.json'));

assert.equal(manifest.schemaVersion, 1);
assert.equal(manifest.projectId, 'learning-center');
assert.equal(manifest.devProjectUrl, 'http://127.0.0.1:7001/');
assert.equal(manifest.projectUrl, 'https://nonomil.github.io/learning-center/');
assert.ok(manifest.packs.length >= 3);
assert.match(read('index.html'), /<title>学习中心<\/title>/);
assert.match(read('app.js'), /learncenter_progress_v1_/);
assert.match(read('app.js'), /petbank\.bridge\.v1\.completed/);
assert.doesNotMatch(read('app.js'), /petbank_points/);
assert.equal(fs.existsSync(path.join(root, 'local-server.mjs')), true);
console.log(`learning center contract passed: ${manifest.packs.length} packs`);
