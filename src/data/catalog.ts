import snapshot from './projects.json';
import type {Project} from './types';
export type {Project,Source} from './types';
export const projects=snapshot as Project[];
export const labels:Record<string,string>={mod:'Mod',modpack:'Modpack',resourcepack:'Resource pack',datapack:'Datapack'};
export const total=(p:Project)=>p.reportedDownloads?.value??Object.values(p.sources).reduce((n,s)=>n+s.downloads,0);
export const partial=(p:Project)=>p.reportedDownloads?.partial??p.expectedSources.some(s=>!(s in p.sources));
export const count=(n:number)=>new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1}).format(n);
