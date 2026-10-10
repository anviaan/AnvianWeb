export {};
const {DOKPLOY_URL:url,DOKPLOY_API_KEY:key,DOKPLOY_APPLICATION_ID:id}=process.env;
if(!url||!key||!id){console.error('Configure DOKPLOY_URL, DOKPLOY_API_KEY and DOKPLOY_APPLICATION_ID as repository secrets.');process.exit(1);}
const endpoint=new URL('/api/application.deploy',url);
if(endpoint.protocol!=='https:')throw new Error('Dokploy must use HTTPS');
const response=await fetch(endpoint,{method:'POST',headers:{'x-api-key':key,'Content-Type':'application/json'},body:JSON.stringify({applicationId:id}),signal:AbortSignal.timeout(30000)});
if(!response.ok){console.error('Dokploy rejected deployment: HTTP '+response.status);process.exit(1);}
console.log('Dokploy deployment requested. Check Dokploy for build completion.');
