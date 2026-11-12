import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('./app-quality.js',import.meta.url),'utf8');
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
