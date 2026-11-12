import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const viewSource=await readFile(new URL('./app-views-3.js',import.meta.url),'utf8');
const start=viewSource.indexOf('function chatActionMarkup()');
const end=viewSource.indexOf('\nfunction renderAssistant()',start);
assert.ok(start>=0&&end>start,'No se encontró el renderizado seguro del chat');
const chatSource=viewSource.slice(start,end);

function makeContext(){
 const context={
  pendingChat:null,
  state:{accounts:[]},
  esc:value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
 };
 vm.createContext(context);
 vm.runInContext(chatSource,context);
 return context;
}

test('el historial ignora HTML de acciones incluido en una copia importada',()=>{
 const context=makeContext();
 const html=context.chatBubble({id:'m1',role:'assistant',text:'Hola',action:'<img src=x onerror=alert(1)>'});
 assert.match(html,/Hola/);
 assert.doesNotMatch(html,/<img/i);
 assert.doesNotMatch(html,/onerror/i);
});

test('los botones del chat escapan identificadores y nombres de cuenta',()=>{
 const context=makeContext();
 context.state.accounts=[{id:'<img src=x onerror=alert(1)>',name:'<script>alert(1)</script>'}];
 context.pendingChat={kind:'movement',messageId:'m1',accountId:null};
 const html=context.chatBubble({id:'m1',role:'assistant',text:'Elige una cuenta'});
 assert.match(html,/&lt;img/);
 assert.match(html,/&lt;script&gt;/);
 assert.doesNotMatch(html,/<img/i);
 assert.doesNotMatch(html,/<script/i);
});
