import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateRegistry,updateSource} from './sync.mjs';
test('explicit mapping rejects duplicate projects and platform IDs',()=>{
 validateRegistry([{id:'one',modrinthId:'abc',curseforgeId:12}]);
 assert.throws(()=>validateRegistry([{id:'one'},{id:'one'}]));
 assert.throws(()=>validateRegistry([{id:'one',modrinthId:'abc'},{id:'two',modrinthId:'abc'}]));
});
test('failure preserves count and timestamp, never invents zero',()=>{
 const old={modrinth:{downloads:12,url:'https://modrinth.com/mod/a',updatedAt:'old',stale:false}};
 const failed=updateSource(old,'modrinth',null,'new');
 assert.equal(failed.modrinth.downloads,12);assert.equal(failed.modrinth.updatedAt,'old');assert.equal(failed.modrinth.stale,true);
 assert.deepEqual(updateSource({},'curseforge',null,'new'),{});assert.equal(old.modrinth.stale,false);
 const fresh=updateSource(failed,'curseforge',{downloads:8,url:'https://www.curseforge.com/a'},'new');
 assert.equal(Object.values(fresh).reduce((n,s)=>n+s.downloads,0),20);
 assert.throws(()=>updateSource({},'modrinth',{downloads:-1,url:'https://modrinth.com'},'new'));
 assert.equal(updateSource(failed,'modrinth',{downloads:0,url:'https://modrinth.com'},'new').modrinth.stale,false);
});

import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {sync} from './sync.mjs';
test('full sync merges explicit IDs, discovers new projects and retains failures',async()=>{
 const dir=await mkdtemp(tmpdir()+'/anvian-sync-');const root=pathToFileURL(dir+'/');
 try{
  await mkdir(dir+'/data');await mkdir(dir+'/src/data',{recursive:true});
  await writeFile(dir+'/data/registry.json',JSON.stringify([{id:'one',modrinthId:'abc',curseforgeId:12,featured:true}]));
  await writeFile(dir+'/src/data/projects.json',JSON.stringify([{id:'one',name:'Old',type:'mod',description:'Old',sources:{modrinth:{downloads:5,url:'https://modrinth.com/mod/one',updatedAt:'old',stale:false}}}]));
  const mock=async url=>({ok:true,json:async()=>url.includes('curseforge')?{data:{id:12,authors:[{name:'Anvian'}],downloadCount:7,links:{websiteUrl:'https://www.curseforge.com/minecraft/mc-mods/one'}}}:[{id:'abc',slug:'one',title:'One',project_type:'mod',description:'One',downloads:10},{id:'def',slug:'two',title:'Two',project_type:'modpack',description:'Two',downloads:2}]});
  assert.equal(await sync(mock,root,'test-key'),0);
  let result=JSON.parse(await readFile(dir+'/src/data/projects.json','utf8'));
  assert.equal(result.length,2);assert.equal(result[0].sources.modrinth.downloads+result[0].sources.curseforge.downloads,17);assert.equal(result[0].featured,true);
  const timestamp=result[0].sources.modrinth.updatedAt;
  assert.equal(await sync(async()=>{throw new Error('Offline');},root,'test-key'),3);
  result=JSON.parse(await readFile(dir+'/src/data/projects.json','utf8'));
  assert.equal(result[0].sources.modrinth.downloads,10);assert.equal(result[0].sources.modrinth.updatedAt,timestamp);assert.equal(result[0].sources.modrinth.stale,true);
 }finally{await rm(dir,{recursive:true,force:true});}
});
