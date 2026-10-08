import snapshot from './projects.json';
export interface Source {url:string;downloads:number;updatedAt:string;stale:boolean}
export interface Project {id:string;name:string;description:string;type:string;icon:string|null;image:string|null;github:string|null;featured:boolean;sources:Record<string,Source>;platformLinks?:Record<string,string>;expectedSources:string[]}
export const projects:Project[]=snapshot;
export const labels:Record<string,string>={mod:'Mod',modpack:'Modpack',resourcepack:'Resource pack',datapack:'Datapack'};
export const total=(p:Project)=>Object.values(p.sources).reduce((n,s)=>n+s.downloads,0);
export const partial=(p:Project)=>p.expectedSources.some(s=>!(s in p.sources));
export const count=(n:number)=>new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1}).format(n);
