import {syncNotion} from './notion.ts';
import {pathToFileURL} from 'node:url';
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)syncNotion().then(f=>{if(f)process.exitCode=1;}).catch(error=>{console.error('Notion sync failed:',error.message);process.exitCode=1;});
