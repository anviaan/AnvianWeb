import {syncNotion} from './notion.mjs';
import {readFile,writeFile,rename} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const root=new URL('../',import.meta.url);
export function validateRegistry(entries){
 if(!Array.isArray(entries))throw new Error('Registry must be an array');
 const ids=new Set(),remote=new Set();
 for(const e of entries){
  if(typeof e.id!=='string'||!e.id||ids.has(e.id))throw new Error('Duplicate or missing editorial ID'); ids.add(e.id);
  if(e.curseforgeId!==undefined&&(!Number.isSafeInteger(e.curseforgeId)||e.curseforgeId<1))throw new Error('Invalid CurseForge ID');
  if(e.type&&!['mod','modpack','resourcepack','datapack'].includes(e.type))throw new Error('Invalid project type');
  if(e.curseforgeUrl&&!/^https:\/\/www\.curseforge\.com\/minecraft\//.test(e.curseforgeUrl))throw new Error('Invalid CurseForge URL');
  for(const key of ['modrinthId','curseforgeId'])if(e[key]){const id=key+':'+e[key];if(remote.has(id))throw new Error('Duplicate platform mapping');remote.add(id);}
  if(e.github&&!/^https:\/\/github\.com\/[^/]+\/[^/]+\/?$/.test(e.github))throw new Error('Invalid GitHub link');
 }
}
export function updateSource(old,name,fresh,now){
 const sources=structuredClone(old??{});
 if(fresh){if(!Number.isSafeInteger(fresh.downloads)||fresh.downloads<0||!/^https:\/\//.test(fresh.url))throw new Error('Invalid platform data');const url=new URL(fresh.url);if(url.username||url.password||!(name==='modrinth'?['modrinth.com']:['www.curseforge.com','curseforge.com']).includes(url.hostname))throw new Error('Unexpected platform URL');sources[name]={...fresh,updatedAt:now,stale:false};}
 else if(sources[name])sources[name].stale=true;
 return sources;
}
export async function sync(fetcher=fetch, directory=root, apiKey=undefined){
 const root=directory;
 const registry=JSON.parse(await readFile(new URL('data/registry.json',root),'utf8'));
 const previous=JSON.parse(await readFile(new URL('src/data/projects.json',root),'utf8'));
 validateRegistry(registry);const now=new Date().toISOString();
 async function request(url,options={}){const response=await fetcher(url,{...options,signal:AbortSignal.timeout(20000),headers:{'User-Agent':'AnvianWeb/1.0 (https://anvian.net)','Accept':'application/json',...options.headers}});if(!response.ok)throw new Error('Platform HTTP '+response.status);return response.json();}
 let discovered=[];
 try{discovered=await request('https://api.modrinth.com/v2/user/anvian/projects');if(!Array.isArray(discovered))throw new Error('Invalid project list');}
 catch{console.warn('Modrinth discovery failed; keeping editorial registry.');discovered=[];}
 for(const p of discovered)if(!registry.some(e=>e.modrinthId===p.id))registry.push({id:p.slug,modrinthId:p.id,featured:false});
 validateRegistry(registry);const output=[];let failures=0;
 for(const e of registry){
  const old=previous.find(p=>p.id===e.id);
  let p=old?structuredClone(old):{id:e.id,name:e.name,description:e.description,type:e.type,icon:null,image:null,github:null,sources:{}};
  if(e.modrinthId){try{
   const m=discovered.find(m=>m.id===e.modrinthId)??await request('https://api.modrinth.com/v2/project/'+encodeURIComponent(e.modrinthId));
   if(m.id!==e.modrinthId||!['mod','modpack','resourcepack','datapack'].includes(m.project_type))throw new Error('Unexpected project');
   p.sources=updateSource(p.sources,'modrinth',{url:'https://modrinth.com/'+m.project_type+'/'+m.slug,downloads:m.downloads},now);
   const gallery=m.gallery??[];
   Object.assign(p,{name:m.title,description:m.description,type:m.project_type,icon:m.icon_url,image:gallery.find(g=>g.featured)?.url??gallery[0]?.url??null,github:m.source_url?.startsWith('https://github.com/')?m.source_url:null});
  }catch{p.sources=updateSource(p.sources,'modrinth',null,now);failures++;console.warn(e.id+': Modrinth unavailable');}}
  if(e.curseforgeId){try{
   if(!apiKey)throw new Error('Missing secret');
   const {data:m}=await request('https://api.curseforge.com/v1/mods/'+e.curseforgeId,{headers:{'x-api-key':apiKey}});
   if(m.id!==e.curseforgeId||!m.authors?.some(a=>a.name.toLowerCase()==='anvian'))throw new Error('Unverified ownership');
   p.sources=updateSource(p.sources,'curseforge',{url:m.links.websiteUrl,downloads:m.downloadCount},now);
   if(!p.name)Object.assign(p,{name:m.name,description:m.summary,type:e.type??'mod',icon:m.logo?.url,image:m.screenshots?.[0]?.url??null});
  }catch{p.sources=updateSource(p.sources,'curseforge',null,now);failures++;console.warn(e.id+': CurseForge unavailable');}}
  if(!p.name||!p.type)throw new Error('No initial metadata for '+e.id+'; refusing incomplete snapshot');
  for(const key of ['name','description','image','github','type'])if(e[key]!==undefined)p[key]=e[key];
  p.featured=e.featured??false;if(e.curseforgeUrl)p.platformLinks={...p.platformLinks,curseforge:e.curseforgeUrl};p.expectedSources=['modrinth','curseforge'].filter(s=>e[s+'Id']||e[s+'Url']);output.push(p);
 }
 const target=new URL('src/data/projects.json',root),temp=new URL('src/data/projects.json.tmp',root);
 await writeFile(temp,JSON.stringify(output,null,2)+'\n');await rename(temp,target);
 await writeFile(new URL('data/registry.json',root),JSON.stringify(registry,null,2)+'\n');
 console.log('Synced '+output.length+' projects; '+failures+' unavailable sources.');return failures;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)syncNotion().then(f=>{if(f)process.exitCode=1;}).catch(()=>{console.error('Sync failed; inspect registry and platform availability.');process.exitCode=1;});
