import snapshot from './projects.json';
export interface Source {url:string;downloads:number;updatedAt:string;stale:boolean}
export interface Project {id:string;name:string;description:string;type:string;icon:string|null;image:string|null;github:string|null;featured:boolean;archived?:boolean;sources:Record<string,Source>;platformLinks?:Record<string,string>;expectedSources:string[];reportedDownloads?:{value:number;stale:boolean;partial:boolean}}
export const projects=snapshot as Project[];
export const labels:Record<string,string>={mod:'Mod',modpack:'Modpack',resourcepack:'Resource pack',datapack:'Datapack'};
export const total=(p:Project)=>p.reportedDownloads?.value??Object.values(p.sources).reduce((n,s)=>n+s.downloads,0);
export const partial=(p:Project)=>p.reportedDownloads?.partial??p.expectedSources.some(s=>!(s in p.sources));
export const count=(n:number)=>new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1}).format(n);
