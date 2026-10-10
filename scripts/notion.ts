import {readFile,writeFile,rename} from 'node:fs/promises';
import type {Project,Source} from '../src/data/types.ts';
export interface NotionProperty {
 title?:{plain_text?:string;text?:{content?:string}}[];
 rich_text?:{plain_text?:string;text?:{content?:string}}[];
 select?:{name:string}|null;
 number?:number|null;
 date?:{start:string}|null;
 url?:string|null;
 checkbox?:boolean;
}
export interface NotionRow {id?:string;archived?:boolean;in_trash?:boolean;properties:Record<string,NotionProperty>}
interface NotionPage {results:NotionRow[];has_more?:boolean;next_cursor?:string|null}
const root=new URL('../',import.meta.url);
const valid=(n:unknown):n is number=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0;
const text=(p:NotionProperty|undefined)=>(p?.title??p?.rich_text??[]).map(t=>t.plain_text??t.text?.content??'').join('').trim();
export function applyNotionCounts(project:Project,row:NotionRow,now=new Date().toISOString()){
 const p=row.properties;
 if(!p)throw new Error('Missing Notion properties');
 const result=structuredClone(project);result.archived=p.Status?.select?.name==='Archived';let complete=true;
 const state=p.DownloadsStatus?.select?.name;
 for(const [source,label] of [['modrinth','Modrinth'],['curseforge','CurseForge']]){
  if(!project.expectedSources.includes(source))continue;
  const count=p[label+'Downloads']?.number;
  const date=p[label+'UpdatedAt']?.date?.start;
  const timestamp=Date.parse(date??'');
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
 else if(result.reportedDownloads){result.reportedDownloads.stale=true;result.reportedDownloads.partial||=!complete||state==='partial';}
 return result;
}
export function projectFromNotion(row:NotionRow,previous:Project[],now=new Date().toISOString()){
 const p=row.properties;
 const id=text(p.WebId),name=text(p.Name),type=p.WebType?.select?.name;
 if(!/^[a-z0-9_-]+$/.test(id)||!name||!['mod','modpack','resourcepack','datapack'].includes(type??''))throw new Error('Published project requires valid WebId, Name and WebType');
 function url(key:string,hosts?:readonly string[]){
  const value=p[key]?.url;if(!value)return null;
  const u=new URL(value);
  if(u.protocol!=='https:'||u.username||u.password||(hosts&&!hosts.includes(u.hostname))||/[?&](X-Amz-|token=|signature=)/i.test(u.search)||u.hostname.endsWith('notion.so')||u.hostname.endsWith('notion.site')||u.hostname.endsWith('notion-static.com'))throw new Error('Invalid public URL in '+key+' for '+id);
  return value;
 }
 const platformLinks:Record<string,string>={};
 for(const [source,key,hosts] of [['modrinth','WebModrinth',['modrinth.com']],['curseforge','WebCurseForge',['www.curseforge.com','curseforge.com']]] as const){const value=url(key,hosts);if(value)platformLinks[source]=value;}
 if(!Object.keys(platformLinks).length)throw new Error('Published project requires a public platform URL: '+id);
 const old=previous.find(project=>project.id===id);
 const sources:Record<string,Source>={};
 for(const [source,value] of Object.entries(platformLinks))if(old?.sources[source]?.url===value)sources[source]=old.sources[source];
 const project:Project={id,name,description:text(p.WebDescription),type:type!,icon:url('WebIcon'),image:url('WebImage'),github:url('WebGitHub',['github.com']),featured:p.WebFeatured?.checkbox===true,sources,platformLinks,expectedSources:Object.keys(platformLinks)};
 // Retain a combined baseline only while its platform mapping is unchanged.
 if(old?.reportedDownloads&&JSON.stringify([...old.expectedSources].sort())===JSON.stringify([...project.expectedSources].sort())&&project.expectedSources.every(source=>(old.platformLinks?.[source]??old.sources[source]?.url)===platformLinks[source]))project.reportedDownloads=old.reportedDownloads;
 return applyNotionCounts(project,row,now);
}
export async function syncNotion(fetcher=fetch,directory=root,env=process.env){
 const previous:Project[]=JSON.parse(await readFile(new URL('src/data/projects.json',directory),'utf8'));
 if(!env.NOTION_TOKEN||!env.NOTION_DATA_SOURCE_ID)throw new Error('Configure NOTION_TOKEN and NOTION_DATA_SOURCE_ID');
 const rows:NotionRow[]=[];let cursor:string|null|undefined;const seen=new Set<string>();
 do{
  let response:Response|undefined;
  for(let attempt=0;attempt<3;attempt++){
   response=await fetcher('https://api.notion.com/v1/data_sources/'+encodeURIComponent(env.NOTION_DATA_SOURCE_ID)+'/query',{method:'POST',headers:{Authorization:'Bearer '+env.NOTION_TOKEN,'Notion-Version':'2025-09-03','Content-Type':'application/json'},body:JSON.stringify({page_size:100,...(cursor?{start_cursor:cursor}:{})}),signal:AbortSignal.timeout(20000)});
   if(response.ok)break;
   if(response.status!==429&&response.status<500)throw new Error('Notion request failed: '+response.status);
   if(attempt<2){const delay=Math.min(30000,Math.max(1000,Number(response.headers.get('retry-after')??1)*1000));await new Promise(r=>setTimeout(r,delay));}
  }
  if(!response?.ok)throw new Error('Notion unavailable; snapshot retained');
  const page:NotionPage=await response.json();if(!Array.isArray(page.results))throw new Error('Invalid Notion response');
  rows.push(...page.results);cursor=page.has_more?page.next_cursor:null;
  if(page.has_more&&(!cursor||seen.has(cursor)))throw new Error('Invalid pagination');if(cursor)seen.add(cursor);
 }while(cursor);
 const output:Project[]=[],ids=new Set<string>(),links=new Set<string>();const now=new Date().toISOString();
 for(const row of rows){
  if(row.archived||row.in_trash)continue;
  const p=row.properties;if(!p)throw new Error('Invalid Notion row');
  if(p.Game?.select?.name!=='Minecraft-Java'||p.PublishOnWeb?.checkbox!==true)continue;
  const project=projectFromNotion(row,previous,now);
  if(ids.has(project.id))throw new Error('Duplicate WebId');ids.add(project.id);
  for(const link of Object.values(project.platformLinks!)){if(links.has(link))throw new Error('Duplicate platform URL');links.add(link);}
  output.push(project);
 }
 if(!output.length)throw new Error('No published projects; refusing to erase the snapshot');
 output.sort((a,b)=>a.id.localeCompare(b.id));
 const missing=output.filter(p=>p.reportedDownloads?.stale||p.reportedDownloads?.partial||!p.reportedDownloads||Object.values(p.sources).some(s=>s.stale)).length;
 const temp=new URL('src/data/projects.json.tmp',directory);await writeFile(temp,JSON.stringify(output,null,2)+'\n');await rename(temp,new URL('src/data/projects.json',directory));
 console.log(`Notion synchronized ${output.length-missing} projects; ${missing} with incomplete or stale counts.`);return missing;
}
