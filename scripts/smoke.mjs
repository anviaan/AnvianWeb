import {readFile,access} from 'node:fs/promises';
import assert from 'node:assert/strict';
const files=['index.html','projects/index.html','blog/index.html','blog/hello_world/index.html','blog/mcmodtest/index.html','rss.xml','sitemap-index.xml','robots.txt'];
for(const file of files){const text=await readFile('dist/'+file,'utf8');assert.ok(text.length>0);if(file.endsWith('.html')){assert.ok(text.includes('lang="en"'));assert.ok(text.includes('rel="canonical"'));for(const match of text.matchAll(/(?:href|src)="(\/[^"?#]*)(?:[?#][^"]*)?"/g)){const path=match[1];await access('dist'+(path.endsWith('/')?path+'index.html':path));}}}
const catalog=await readFile('dist/projects/index.html','utf8');
const projects=JSON.parse(await readFile('src/data/projects.json','utf8'));
assert.equal((catalog.match(/data-downloads=/g)??[]).length,projects.length);
assert.ok(catalog.includes('partial total'));assert.ok(!catalog.includes('CURSEFORGE_API_KEY'));
assert.ok((await readFile('dist/blog/mcmodtest/index.html','utf8')).includes('https://gitlab.com/anvian/mcmodtest'));
console.log('Static routes, local links/assets, metadata, article links and no-JS catalog verified.');
