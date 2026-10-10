import {syncNotion} from './notion.ts';
if(import.meta.main)syncNotion().then(f=>{if(f)process.exitCode=1;}).catch(error=>{console.error('Notion sync failed:',error.message);process.exitCode=1;});
