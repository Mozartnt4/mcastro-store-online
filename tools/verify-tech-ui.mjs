// Teste de interações DOM contra o Worker e SQLite reais, sem publicar.
// Uso: node tools/verify-tech-ui.mjs /caminho/happy-dom/lib/index.js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { D1 } from '../test/helpers/d1.js';
import worker from '../src/index.js';
const { Window } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : 'happy-dom');
const env={DB:new D1()};const windows=[];
const html=readFileSync(new URL('../public/tech.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../public/tech.js',import.meta.url),'utf8');
await worker.fetch(new Request('https://loja.test/api/health'),env);
await env.DB.prepare("UPDATE configuracoes SET valor='teste-ui' WHERE chave='admin_password'").run();
async function until(fn){for(let i=0;i<150;i++){if(fn())return;await new Promise(r=>setTimeout(r,20));}throw new Error('Tempo excedido: '+fn.toString());}
function windowAt(path,admin=false){
 const w=new Window({url:'https://loja.test'+path,settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true,enableJavaScriptEvaluation:true}});windows.push(w);
 if(admin){w.sessionStorage.setItem('mcastro_admin_password','teste-ui');w.sessionStorage.setItem('mcastro_admin','1');}
 w.confirm=()=>true;w.scrollTo=()=>{};
 w.fetch=async(path,options={})=>{let body=options.body;if(body instanceof w.FormData){const f=new FormData();for(const [k,v] of body)f.append(k,typeof v==='string'?v:new Blob([await v.arrayBuffer()],{type:v.type}));body=f;}return worker.fetch(new Request(new URL(path,w.location.href),{...options,body}),env);};
 w.document.write(html);w.eval(js);return w;
}
const click=(w,sel)=>{const el=w.document.querySelector(sel);assert.ok(el,'Existe '+sel);el.click();};
const fill=(w,sel,value)=>{const el=w.document.querySelector(sel);assert.ok(el,'Existe '+sel);el.value=value;el.dispatchEvent(new w.Event('input',{bubbles:true}));};
const submit=(w,id)=>w.document.getElementById(id).dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
try{
 const a=windowAt('/tech/admin',true);await until(()=>a.document.querySelector('[data-tab="categorias"]'));
 click(a,'[data-tab="categorias"]');await until(()=>a.document.getElementById('new'));click(a,'#new');
 fill(a,'[name="nome"]','Câmeras');click(a,'#add-field');fill(a,'[name="label"]','Tem Wi-Fi no local?');submit(a,'catalog-form');await until(()=>a.document.querySelector('[data-edit]'));
 click(a,'[data-tab="servicos"]');await until(()=>a.document.getElementById('new')?.textContent.includes('serviço'));click(a,'#new');fill(a,'[name="nome"]','Instalação Wi-Fi');fill(a,'[name="descricao"]','Instalação profissional');submit(a,'catalog-form');await until(()=>a.document.querySelector('[data-edit]'));
 const p=windowAt('/tech');await until(()=>p.document.querySelector('[data-service]'));click(p,'[data-service]');await until(()=>p.document.getElementById('request'));
 fill(p,'[name="nome"]','Cliente do navegador');fill(p,'[name="telefone"]','86977777777');fill(p,'[name="endereco"]','Teresina, Centro');fill(p,'[name="descricao"]','Preciso de uma câmera na garagem');fill(p,'input[name^="field_"]','Sim');submit(p,'request');await until(()=>p.document.body.textContent.includes('Solicitação recebida'));
 assert.match(p.document.body.textContent,/MC-ORC-000001/);
 click(a,'[data-tab="solicitacoes"]');await until(()=>a.document.querySelector('[data-request]'));click(a,'[data-request]');await until(()=>a.document.getElementById('quote-form'));
 fill(a,'[name="preco"]','150');fill(a,'[name="custo"]','40');fill(a,'[name="reposicao"]','50');fill(a,'[name="prazo"]','Até 3 dias úteis');submit(a,'quote-form');await until(()=>a.document.getElementById('publish'));
 click(a,'#publish');await until(()=>a.document.getElementById('copy-link'));
 const row=await env.DB.prepare('SELECT token FROM tech_orcamentos').first();const q=windowAt('/tech/orcamento/'+row.token);await until(()=>q.document.getElementById('approve'));
 assert.equal(q.document.body.textContent.includes('Custo interno'),false);assert.match(q.document.body.textContent,/150,00/);click(q,'#approve');await until(()=>q.document.body.textContent.includes('Decisão registrada em'));
 assert.match(q.document.body.textContent,/Aprovado/);assert.equal(q.document.getElementById('approve'),null);
 console.log('PASSOU: categoria → pergunta → serviço → solicitação → orçamento → link → aprovação, pela interface DOM e API real.');
}finally{for(const w of windows)w.happyDOM.abort();env.DB.close();}
