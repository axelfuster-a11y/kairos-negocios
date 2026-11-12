import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('./app-quality.js',import.meta.url),'utf8');
const domainSource=await readFile(new URL('./domain.js',import.meta.url),'utf8');
function makeContext(){
 const messages=[];
 const context={messages};
 vm.createContext(context);
 vm.runInContext(`
  var state={accounts:[{id:'mp',name:'Mercado Pago',kind:'Billetera virtual'}],prefs:{theme:'light',fontScale:'normal'}};
  var pendingChat=null;
  var assistantReply=function(){return 'respuesta anterior'};
  var sendChat=async function(text){const answer=assistantReply(text);chatSay('assistant',answer);return answer};
  var money=function(n){return '$'+n};
  var accountName=function(id){return state.accounts.find(a=>a.id===id)?.name||'Cuenta eliminada'};
  var chatSay=function(role,text,action){messages.push({role,text,action})};
  var save=async function(){};
  var renderAssistant=function(){};
  var renderSettings=function(){};
  var metric=function(label){return '<article class="card metric-card">'+label+'</article>'};
  var nav=function(){};
  var toast=function(){};
  var esc=function(value){return String(value)};
  var $=function(){return {}};
  var document={documentElement:{dataset:{}},querySelector:function(){return {content:''}},addEventListener:function(){}};
 `,context);
 vm.runInContext(domainSource,context);
 vm.runInContext(source,context);
 return context;
}

test('el chat separa gasto, saldo, fecha y hora y prepara un único gasto',async()=>{
 const c=makeContext();
 await c.sendChat('Gasté $3.000 el 12/11/2026 en transporte y ahora tengo $40.000 en Mercado Pago a las 14:30');
 assert.equal(c.pendingChat.kind,'compoundClarification');
 assert.equal(c.pendingChat.expenseAmount,3000);
 assert.equal(c.pendingChat.balanceAmount,40000);
 await c.sendChat('sí');
 assert.equal(c.pendingChat.kind,'movement');
 assert.equal(c.pendingChat.type,'expense');
 assert.equal(c.pendingChat.amount,3000);
 assert.equal(c.pendingChat.description,'transporte');
 assert.equal(c.pendingChat.accountId,'mp');
});

test('el chat no prepara movimientos con separadores numéricos ambiguos',async()=>{
 const c=makeContext();
 const answer=await c.sendChat('Gasté 1,234 en comida');
 assert.match(answer,/separadores ambiguos/);
 assert.equal(c.pendingChat,null);
});

test('el chat reconoce ingresos y conserva el importe sin confundirlo con el saldo',async()=>{
 const c=makeContext();
 await c.sendChat('Me pagaron el 12/11/2026 $50.000 por una comisión y ahora tengo $120.000 en Mercado Pago a las 14:30');
 assert.equal(c.pendingChat.kind,'compoundClarification');
 assert.equal(c.pendingChat.movementType,'income');
 assert.equal(c.pendingChat.expenseAmount,50000);
 assert.equal(c.pendingChat.balanceAmount,120000);
 await c.sendChat('sí');
 assert.equal(c.pendingChat.type,'income');
 assert.equal(c.pendingChat.amount,50000);
 assert.equal(c.pendingChat.description,'una comisión');
 assert.equal(c.pendingChat.accountId,'mp');
});

test('el chat ignora la fecha cuando aparece antes del importe',async()=>{
 const c=makeContext();
 await c.sendChat('Gasté el 12/11/2026 $3.000 en transporte desde Mercado Pago');
 assert.equal(c.pendingChat.type,'expense');
 assert.equal(c.pendingChat.amount,3000);
 assert.equal(c.pendingChat.description,'transporte');
 assert.equal(c.pendingChat.accountId,'mp');
});

test('una respuesta afirmativa no confirma una aclaración con varios importes sin saldo',async()=>{
 const c=makeContext();
 await c.sendChat('Gasté 3.000 y 5.000 en comida');
 assert.equal(c.pendingChat.kind,'compoundClarification');
 assert.equal(c.pendingChat.expenseAmount,undefined);
 await c.sendChat('sí');
 assert.equal(c.pendingChat,null);
 assert.match(c.messages.at(-1).text,/No preparé nada/);
});

test('una fecha sin importe no se registra como gasto',async()=>{
 const c=makeContext();
 const answer=await c.sendChat('Gasté el 12/11/2026');
 assert.match(answer,/No encontré un importe/);
 assert.equal(c.pendingChat,null);
});

test('una pregunta sobre gastos no se convierte en un movimiento',async()=>{
 const c=makeContext();
 const answer=await c.sendChat('¿Cuánto gasté?');
 assert.equal(answer,'respuesta anterior');
 assert.equal(c.pendingChat,null);
});

test('el chat identifica el gasto aunque el saldo aparezca primero',async()=>{
 const c=makeContext();
 await c.sendChat('Tengo $40.000 en Mercado Pago y gasté $3.000 en transporte');
 assert.equal(c.pendingChat.kind,'compoundClarification');
 assert.equal(c.pendingChat.expenseAmount,3000);
 assert.equal(c.pendingChat.balanceAmount,40000);
 await c.sendChat('sí');
 assert.equal(c.pendingChat.amount,3000);
 assert.equal(c.pendingChat.description,'transporte');
});

test('un único importe identificado como saldo nunca se registra como gasto',async()=>{
 const c=makeContext();
 const answer=await c.sendChat('Tengo $40.000 en Mercado Pago y gasté en comida');
 assert.match(answer,/parece ser un saldo/);
 assert.equal(c.pendingChat,null);
});
