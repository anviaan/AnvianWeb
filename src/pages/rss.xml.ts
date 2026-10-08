import rss from '@astrojs/rss';
import {getCollection} from 'astro:content';
import type {APIContext} from 'astro';
export async function GET(context:APIContext){const posts=await getCollection('blog',p=>!p.data.draft);return rss({title:'Anvian’s Blog',description:'Mods, development, and experiments.',site:context.site!,items:posts.map(p=>({title:p.data.title,pubDate:p.data.date,description:p.data.description,link:`/blog/${p.id}/`}))});}
