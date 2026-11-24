import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';
import { parseSitemap } from '../scripts/indexnow.mjs';

const website = fileURLToPath(new URL('../', import.meta.url));
const repo = path.resolve(website, '..');
const cloudflare = process.env.ARCHIFY_SITE_TARGET === 'cloudflare';
const output = path.join(website, cloudflare ? 'dist-cloudflare' : 'dist');
const origin = cloudflare ? 'https://archify.si/' : 'https://tt-a1i.github.io/archify/';
const extension = cloudflare ? '' : '.html';
const nodes = node => [node, ...(node.childNodes || []).flatMap(nodes)];
const attr = (node, name) => node?.attrs?.find(item => item.name === name)?.value;
const text = node => node?.nodeName === '#text' ? node.value : (node?.childNodes || []).map(text).join('');

for (const lang of ['en', 'zh']) {
  test(`${lang} enterprise page explains the model, embeds the Studio, and states its limits`, () => {
    const prefix = lang === 'zh' ? 'zh/' : '';
    const file = `${prefix}enterprise.html`;
    const documentUrl = new URL(`${prefix}enterprise${extension}`, origin);
    const all = nodes(parse(fs.readFileSync(path.join(output, file), 'utf8')));
    const base = new URL(attr(all.find(node => node.tagName === 'base'), 'href'), documentUrl);
    const article = all.find(node => node.tagName === 'article');
    assert.ok(article, file);
    assert.equal(nodes(article).filter(node => node.tagName === 'h1').length, 1);

    const visible = text(article);
    for (const term of ['ArchiMate', 'BPMN', 'UML', 'TOGAF ADM', 'Studio']) assert.ok(visible.includes(term), `${lang}: ${term}`);
    // Every view type the layer supports is named, so the page cannot drift from the product.
    for (const type of ['archimate', 'bpmn', 'activity', 'state', 'sequence', 'usecase', 'class', 'component', 'deployment']) {
      assert.ok(nodes(article).some(node => node.tagName === 'code' && text(node) === type), `${lang}: view type ${type}`);
    }
    assert.match(visible, lang === 'en' ? /no automatic layout/i : /没有自动布局/);
    assert.match(visible, lang === 'en' ? /does not prove/i : /不能证明/);

    const ids = new Set(all.map(node => attr(node, 'id')).filter(Boolean));
    for (const id of ['answer', 'views', 'language', 'studio', 'generate', 'cli', 'limits']) assert.ok(ids.has(id), `${lang}: stable section ${id}`);
    const toc = all.find(node => attr(node, 'class') === 'article-toc');
    const tocLinks = nodes(toc).filter(node => node.tagName === 'a');
    assert.equal(tocLinks.length, 7);
    for (const link of tocLinks) {
      const destination = new URL(attr(link, 'href'), base);
      assert.equal(destination.origin + destination.pathname, documentUrl.origin + documentUrl.pathname, 'TOC fragments stay on this page');
      const anchor = nodes(article).find(node => attr(node, 'id') === decodeURIComponent(destination.hash.slice(1)));
      assert.ok(anchor, `${lang}: TOC target ${destination.hash}`);
      const boundary = anchor.parentNode.tagName === 'p' ? anchor.parentNode : anchor;
      const siblings = boundary.parentNode.childNodes;
      const next = siblings.slice(siblings.indexOf(boundary) + 1).find(node => node.tagName);
      assert.equal(next?.tagName, 'h2', `${destination.hash}: anchor precedes its heading`);
      assert.equal(text(next), text(link), `${destination.hash}: TOC label matches the section`);
    }

    // The embedded Studio and its direct link resolve to the staged page from both languages.
    const frame = nodes(article).find(node => node.tagName === 'iframe');
    assert.ok(attr(frame, 'title'), `${lang}: the Studio frame is titled`);
    const studio = new URL(attr(frame, 'src'), base);
    assert.equal(studio.pathname, new URL('enterprise-studio.html', origin).pathname);

    const links = nodes(article).filter(node => node.tagName === 'a').map(node => new URL(attr(node, 'href'), base));
    assert.ok(links.some(link => link.pathname === studio.pathname), `${lang}: direct Studio link`);
    for (const url of links) {
      if (url.origin !== new URL(origin).origin) continue;
      const relative = decodeURIComponent(url.pathname).replace(new RegExp(`^/${cloudflare ? '' : 'archify/'}`), '');
      const target = path.resolve(output, relative || 'index.html');
      assert.ok(target.startsWith(`${output}${path.sep}`), `${lang}: link escapes output ${url.href}`);
      const candidates = [target, `${target}.html`, path.join(target, 'index.html')];
      assert.ok(candidates.some(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile()), `${lang}: dead internal link ${url.href}`);
    }

    const schema = JSON.parse(text(all.find(node => node.tagName === 'script' && attr(node, 'type') === 'application/ld+json')));
    const structured = schema['@graph'].find(item => item['@type'] === 'TechArticle');
    assert.equal(structured.url, `https://archify.si/${prefix}enterprise`);
    assert.equal(structured.inLanguage, lang === 'zh' ? 'zh-Hans' : 'en');

    const switcher = all.find(node => attr(node, 'data-language-switch') !== undefined);
    const switched = new URL(attr(switcher, 'href'), base);
    assert.equal(switched.pathname, new URL(`${lang === 'zh' ? '' : 'zh/'}enterprise${extension}`, origin).pathname);
  });
}

test('the site serves the exact Studio page that ships in the Skill', () => {
  assert.deepEqual(
    fs.readFileSync(path.join(output, 'enterprise-studio.html')),
    fs.readFileSync(path.join(repo, 'archify/enterprise/studio.html')),
  );
});

test('both enterprise routes are in the sitemap and IndexNow inventory', () => {
  const urls = parseSitemap(fs.readFileSync(path.join(output, 'sitemap.xml'), 'utf8'));
  for (const url of ['https://archify.si/enterprise', 'https://archify.si/zh/enterprise']) assert.ok(urls.includes(url));
});
