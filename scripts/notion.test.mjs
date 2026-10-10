import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {applyNotionCounts,syncNotion} from './notion.mjs';
const project={id:'one',sources:{modrinth:{url:'https://modrinth.com/mod/one',downloads:10,updatedAt:'2026-10-01T00:00:00Z',stale:false}},expectedSources:['modrinth','curseforge'],platformLinks:{curseforge:'https://www.curseforge.com/minecraft/mc-mods/one'}};
const row={id:'page',properties:{Game:{select:{name:'Minecraft-Java'}},ModrinthID:{rich_text:[{plain_text:'abc'}]},Downloads:{number:100},DownloadsStatus:{select:{name:'current'}},ModrinthDownloads:{number:20},ModrinthUpdatedAt:{date:{start:'2026-10-09T00:00:00Z'}},CurseForgeDownloads:{number:80},CurseForgeUpdatedAt:{date:{start:'2026-10-09T00:00:00Z'}}}};
test('Notion total is not double counted; dates and missing counts remain honest',()=>{
 const p=applyNotionCounts(project,row,'2026-10-09T01:00:00Z');assert.equal(p.reportedDownloads.value,100);assert.equal(p.reportedDownloads.stale,false);assert.equal(p.sources.curseforge.downloads,80);
 const broken=structuredClone(row);broken.properties.CurseForgeDownloads.number=null;const stale=applyNotionCounts(p,broken,'2026-10-09T01:00:00Z');assert.equal(stale.sources.curseforge.downloads,80);assert.equal(stale.reportedDownloads.partial,true);
 assert.equal(applyNotionCounts(project,row,'2026-10-12T00:00:00Z').reportedDownloads.stale,true);
});
test('pagination and Notion failures preserve existing snapshot',async()=>{
 const dir=pathToFileURL((await mkdtemp(tmpdir()+'/notion-test-'))+'/');await mkdir(new URL('data/',dir));await mkdir(new URL('src/data/',dir),{recursive:true});await writeFile(new URL('data/registry.json',dir),JSON.stringify([{id:'one',modrinthId:'abc'}]));const file=new URL('src/data/projects.json',dir);await writeFile(file,JSON.stringify([project]));const original=await readFile(file,'utf8');
 await assert.rejects(syncNotion(async()=>({ok:false,status:403}),dir,{NOTION_TOKEN:'test',NOTION_DATA_SOURCE_ID:'test'}));assert.equal(await readFile(file,'utf8'),original);
 let calls=0;await syncNotion(async()=>({ok:true,json:async()=>++calls===1?{results:[],has_more:true,next_cursor:'next'}:{results:[row],has_more:false}}),dir,{NOTION_TOKEN:'test',NOTION_DATA_SOURCE_ID:'test'});assert.equal(calls,2);assert.equal(JSON.parse(await readFile(file,'utf8'))[0].reportedDownloads.value,100);
});

test('Notion Archived status is imported and can be cleared',()=>{const archived=structuredClone(row);archived.properties.Status={select:{name:'Archived'}};const result=applyNotionCounts(project,archived);assert.equal(result.archived,true);archived.properties.Status.select.name='Done';assert.equal(applyNotionCounts(result,archived).archived,false);});
