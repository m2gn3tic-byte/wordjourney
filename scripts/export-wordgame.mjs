#!/usr/bin/env node
/** Self-contained word-game playtest. No server, CDN or purchase SDK required. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve, relative, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const entry = resolve(dist, 'index.html');
const output = resolve(root, 'artifacts/Sonarannak.html');
const mime = { '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const attr = (tag, name) => tag.match(new RegExp(`\\b${name}=["']([^"']+)["']`, 'i'))?.[1];
function fileFor(url, from = entry) {
  if (/^(?:[a-z][\w+.-]*:|\/\/)/i.test(url)) throw new Error(`Unexpected external dependency: ${url}`);
  const path = decodeURIComponent(url.split(/[?#]/)[0]);
  const file = path.startsWith('/') ? resolve(dist, `.${path}`) : resolve(dirname(from), path);
  const rel = relative(dist, file);
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`)) throw new Error('Asset escapes dist');
  return file;
}
async function asData(url, from) {
  if (/^(?:data:|#)/.test(url)) return url;
  const file = fileFor(url, from), type = mime[extname(file)];
  if (!type) throw new Error(`Unsupported asset: ${file}`);
  return `data:${type};base64,${(await readFile(file)).toString('base64')}`;
}
let html = await readFile(entry, 'utf8');
html = html.replace(/<html\b([^>]*)>/i, '<html$1 data-standalone>');
for (const match of [...html.matchAll(/<link\b[^>]*>/gi)]) {
  const tag = match[0], rel = attr(tag, 'rel'), href = attr(tag, 'href');
  if (rel === 'modulepreload') throw new Error('Standalone entry must not have shared JS chunks');
  if (rel === 'manifest' || rel === 'apple-touch-icon') { html = html.replace(tag, ''); continue; }
  if (rel === 'icon') html = html.replace(tag, () => tag.replace(href, () => 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="10" fill="#34583f"/><path d="M25 6C4 4 3 23 12 25S28 23 25 6Z" fill="#f4efe3"/></svg>').toString('base64')));
  else if (rel === 'stylesheet') {
    const file = fileFor(href);
    let css = await readFile(file, 'utf8');
    for (const m of [...css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)]) {
      const data = await asData(m[1], file);
      css = css.replace(m[0], () => `url("${data}")`);
    }
    if (/@import\b/.test(css)) throw new Error('Unbundled CSS import');
    html = html.replace(tag, () => `<style>${css.replace(/<\/style/gi, '\\3c /style')}</style>`);
  } else throw new Error(`Unrecognised link: ${tag}`);
}
for (const match of [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>\s*<\/script>/gi)]) {
  const js = await readFile(fileFor(match[1]), 'utf8');
  if (/\bimport\s*(?:\(|["'{*])/.test(js)) throw new Error('Standalone needs a single bundled JS entry');
  html = html.replace(match[0], () => `<script type="module">${js.replace(/<\/script/gi, '<\\/script')}</script>`);
}
if (/<(?:link|script)\b[^>]*\b(?:href|src)=["']\//i.test(html)) throw new Error('External resource remains');
await mkdir(dirname(output), { recursive: true });
await writeFile(output, html);
console.log(`Standalone word game: ${relative(root, output)} (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MiB)`);
