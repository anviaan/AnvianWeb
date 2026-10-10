import {readFile,writeFile,rename} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const valid=n=>Number.isSafeInteger(n)&&n>=0;
const text=p=>(p?.rich_text??[]).map(t=>t.plain_text??t.text?.content??'').join('').trim();
export function applyNotionCounts(project,row,now=new Date().toISOString()){
 const p=row.properties;
 if(!p)throw new Error('Missing Notion properties');
 const result=structuredClone(project);result.archived=p.Status?.select?.name==='Archived';let complete=true;
 const state=p.DownloadsStatus?.select?.name;
 for(const [source,label] of [['modrinth','Modrinth'],['curseforge','CurseForge']]){
  if(!project.expectedSources.includes(source))continue;
  const count=p[label+'Downloads']?.number;
  const date=p[label+'UpdatedAt']?.date?.start;
  const timestamp=Date.parse(date);
  if(valid(count)&&Number.isFinite(timestamp)&&timestamp<=Date.parse(now)+300000){
   const previous=result.sources[source];
   const url=previous?.url??project.platformLinks?.[source];
   if(!url){complete=false;continue;}
   result.sources[source]={url,downloads:count,updatedAt:new Date(timestamp).toISOString(),stale:state!=='current'||Date.parse(now)-timestamp>48*3600000};
  }else{complete=false;if(result.sources[source])result.sources[source].stale=true;}
 }
 // Downloads is already combined by n8n; never add it to platform counts.
 const combined=p.Downloads?.number;
 if(valid(combined))result.reportedDownloads={value:combined,stale:state!=='current'||!complete||Object.values(result.sources).some(s=>s.stale),partial:state==='partial'||!complete};
 else if(result.reportedDownloads)result.reportedDownloads.stale=true;
 return result;
}
export async function syncNotion(fetcher=fetch,directory=root,env=process.env){
 const registry=JSON.parse(await readFile(new URL('data/registry.json',directory),'utf8'));
 const previous=JSON.parse(await readFile(new URL('src/data/projects.json',directory),'utf8'));
 if(!env.NOTION_TOKEN||!env.NOTION_DATA_SOURCE_ID)throw new Error('Configure NOTION_TOKEN and NOTION_DATA_SOURCE_ID');
 const rows=[];let cursor;const seen=new Set();
 do{
  let response;
  for(let attempt=0;attempt<3;attempt++){
   response=await fetcher('https://api.notion.com/v1/data_sources/'+encodeURIComponent(env.NOTION_DATA_SOURCE_ID)+'/query',{method:'POST',headers:{Authorization:'Bearer '+env.NOTION_TOKEN,'Notion-Version':'2025-09-03','Content-Type':'application/json'},body:JSON.stringify({page_size:100,...(cursor?{start_cursor:cursor}:{})}),signal:AbortSignal.timeout(20000)});
   if(response.ok)break;
   if(response.status!==429&&response.status<500)throw new Error('Notion request failed: '+response.status);
   if(attempt<2)await new Promise(r=>setTimeout(r,Math.min(30000,Math.max(1000,Number(response.headers.get('retry-after')??1)*1000))));
  }
  if(!response.ok)throw new Error('Notion unavailable; snapshot retained');
  const page=await response.json();if(!Array.isArray(page.results))throw new Error('Invalid Notion response');
  rows.push(...page.results);cursor=page.has_more?page.next_cursor:null;
  if(page.has_more&&(!cursor||seen.has(cursor)))throw new Error('Invalid pagination');if(cursor)seen.add(cursor);
 }while(cursor);
 const byModrinth=new Map(),byCurseForge=new Map();
 for(const row of rows){
  if(row.archived||row.in_trash)continue;
  const p=row.properties;if(!p)throw new Error('Invalid Notion row');
  if(p.Game?.select?.name!=='Minecraft-Java')continue;
  for(const [name,map] of [['ModrinthID',byModrinth],['CurseforgeID',byCurseForge]]){const id=text(p[name]);if(id){if(map.has(id))throw new Error('Duplicate Notion platform ID');map.set(id,row);}}
 }
 let missing=0;
 const output=previous.map(project=>{
  const entry=registry.find(e=>e.id===project.id);if(!entry)throw new Error('Missing editorial mapping');
  const a=byModrinth.get(entry.modrinthId),b=byCurseForge.get(String(entry.curseforgeId));
  if(a&&b&&a.id!==b.id)throw new Error('Conflicting Notion equivalence');
  const row=a??b;
  if(row)return applyNotionCounts(project,row);
  missing++;const retained=structuredClone(project);for(const s of Object.values(retained.sources))s.stale=true;if(retained.reportedDownloads)retained.reportedDownloads.stale=true;return retained;
 });
 const temp=new URL('src/data/projects.json.tmp',directory);await writeFile(temp,JSON.stringify(output,null,2)+'\n');await rename(temp,new URL('src/data/projects.json',directory));
 console.log(`Notion synchronized ${output.length-missing} projects; ${missing} retained without match.`);return missing;
}
