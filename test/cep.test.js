import test from 'node:test';
import assert from 'node:assert/strict';
import { attachCepLookup } from '../public/cep.js';
const pause = () => new Promise(resolve => setTimeout(resolve, 20));
function setup(fetcher, timeout) {
  const fields = Object.fromEntries(['deliveryCep','deliveryCepStatus','deliveryStreet','deliveryDistrict','deliveryCity','deliveryState','deliveryNumber','deliveryAddress'].map(id => {
    const e = new EventTarget(); e.value = ''; e.setAttribute = () => {}; e.removeAttribute = () => {}; return [id,e];
  }));
  fields.deliveryNumber.value = '123'; fields.deliveryAddress.value = 'Apartamento 2';
  const stop = attachCepLookup({getElementById:id=>fields[id]}, fetcher, 0, timeout);
  const input = code => {fields.deliveryCep.value=code;fields.deliveryCep.dispatchEvent(new Event('input'));};
  return {fields,input,stop};
}
const result = (street='Praça da Sé') => ({ok:true,json:async()=>({logradouro:street,bairro:'Sé',localidade:'São Paulo',uf:'SP'})});
test('CEP completo preenche endereço, preserva número/complemento e permite edição', async()=>{
  let calls=0; const {fields:f,input,stop}=setup(async url=>{calls++;assert.equal(url,'https://viacep.com.br/ws/01001000/json/');return result();});
  try {
    input('01001');await pause();assert.equal(calls,0);
    input('01001-000');await pause();assert.equal(calls,1);assert.equal(f.deliveryStreet.value,'Praça da Sé');assert.equal(f.deliveryDistrict.value,'Sé');assert.equal(f.deliveryCity.value,'São Paulo');assert.equal(f.deliveryState.value,'SP');assert.equal(f.deliveryNumber.value,'123');assert.equal(f.deliveryAddress.value,'Apartamento 2');
    f.deliveryStreet.value='Minha correção';input('01001000');await pause();assert.equal(calls,1);assert.equal(f.deliveryStreet.value,'Minha correção');
  } finally { stop(); }
});
test('CEP inexistente, incompleto ou falha permite preenchimento manual e nova tentativa',async()=>{
  let mode=0;const {fields:f,input,stop}=setup(async()=>{if(mode===0)return {ok:true,json:async()=>({erro:true})};if(mode===1)throw Error('offline');return result('');});
  try {f.deliveryStreet.value='Rua manual';input('99999999');await pause();assert.match(f.deliveryCepStatus.textContent,/não encontrado/);assert.equal(f.deliveryStreet.value,'Rua manual');mode=1;input('99999999');await pause();assert.match(f.deliveryCepStatus.textContent,/manualmente/);mode=2;input('01001000');await pause();assert.equal(f.deliveryStreet.value,'');assert.match(f.deliveryCepStatus.textContent,/Complete/);}finally{stop();}
});
test('Resposta antiga não sobrescreve novo CEP e busca preserva edição durante consulta',async()=>{
  const pending=[];const {fields:f,input,stop}=setup(()=>new Promise(resolve=>pending.push(resolve)));
  try {input('01001000');await pause();input('64000000');await pause();pending[1](result('Rua nova'));await pause();pending[0](result('Rua antiga'));await pause();assert.equal(f.deliveryStreet.value,'Rua nova');input('01001000');await pause();f.deliveryStreet.value='Edição manual';pending[2](result());await pause();assert.equal(f.deliveryStreet.value,'Edição manual');}finally{stop();}
});
test('Consulta expira sem bloquear endereço manual',async()=>{
  const {fields:f,input,stop}=setup((url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('timeout')))),5);
  try {input('01001000');await pause();assert.match(f.deliveryCepStatus.textContent,/manualmente/);}finally{stop();}
});
