import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
// Nunca cria banco. Reutiliza o nome conhecido ou a associação DB da última implantação existente.
export async function resolveExistingD1(config, apiToken, fetcher=fetch) {
  if(config.d1_databases?.some(b=>b.binding==='DB'&&uuid.test(b.database_id)))return config;
  if(!apiToken)throw new Error('Configure a associação DB existente antes de publicar. Token de publicação indisponível para resolução automática.');
  const account=config.account_id;
  if(!/^[a-f0-9]{32}$/i.test(account||''))throw new Error('Conta Cloudflare não configurada.');
  const get=async path=>{
    const r=await fetcher(`https://api.cloudflare.com/client/v4/accounts/${account}${path}`,{headers:{authorization:`Bearer ${apiToken}`},signal:AbortSignal.timeout(20000)});
    if(!r.ok)throw new Error(`Cloudflare não autorizou a consulta necessária (${r.status}).`);
    const d=await r.json();if(d.success===false)throw new Error('Cloudflare rejeitou a consulta de configuração.');return d.result;
  };
  let binding;
  try {
    const data=await get('/d1/database?per_page=1000');const matches=(Array.isArray(data)?data:[]).filter(d=>d.name==='mcastro-database');
    if(matches.length===1&&uuid.test(matches[0].uuid))binding={binding:'DB',database_name:'mcastro-database',database_id:matches[0].uuid};
    if(matches.length>1)throw new Error('Mais de um banco com o nome esperado.');
  } catch { /* O token padrão Workers Builds pode não ter D1:Read. Lê apenas metadados do próprio Worker. */ }
  if(!binding) {
    const script='/workers/scripts/'+encodeURIComponent(config.name);
    const data=await get(script+'/deployments');const deployments=(Array.isArray(data)?data:data?.deployments||[]).sort((a,b)=>String(b.created_on||'').localeCompare(String(a.created_on||'')));
    for(const deployment of deployments.slice(0,20)) {
      const versionIds=[...new Set((deployment.versions||[]).map(v=>v.version_id).filter(Boolean))];
      const candidates=[];
      for(const id of versionIds) {
        const version=await get(script+'/versions/'+encodeURIComponent(id));
        for(const b of version.resources?.bindings||[])if(b.name==='DB'&&b.type==='d1'&&uuid.test(b.id||b.database_id))candidates.push(b.id||b.database_id);
      }
      const ids=[...new Set(candidates)];
      if(ids.length>1)throw new Error('Implantação com mais de uma associação DB. Confirme o banco existente.');
      if(ids.length===1){binding={binding:'DB',database_name:'mcastro-database',database_id:ids[0]};break;}
    }
  }
  if(!binding)throw new Error('Banco existente não localizado. Publicação interrompida; nenhum banco foi criado.');
  return {...config,d1_databases:[...(config.d1_databases||[]).filter(b=>b.binding!=='DB'),binding]};
}

export async function configureD1({required=false}={}) {
  const config=JSON.parse(readFileSync('wrangler.jsonc','utf8'));
  if(config.d1_databases?.some(b=>b.binding==='DB'&&uuid.test(b.database_id)))return config;
  const apiToken=process.env.CLOUDFLARE_API_TOKEN||process.env.CF_API_TOKEN;
  if(!apiToken&&!required){console.log('Instalação local: configuração online DB será resolvida na publicação.');return config;}
  const next=await resolveExistingD1(config,apiToken);
  writeFileSync('wrangler.jsonc',JSON.stringify(next,null,2)+'\n');
  console.log('DB configurado para o banco existente mcastro-database. Nenhum banco criado ou substituído.');
  return next;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await configureD1({required:process.argv.includes('--required')});
