import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('./app-core.js',import.meta.url),'utf8');
const match=source.match(/async function tx\(label,fn\)\{[\s\S]*?\n\}/);
assert.ok(match,'No se encontró la transacción de la aplicación');

function makeContext(save){
 const context={
  state:{value:1},
  undoStack:[],
  redoStack:[],
  messages:[],
  clone:value=>JSON.parse(JSON.stringify(value)),
  save,
  render(){this.rendered=true},
  historyButtons(){},
  toast(message){this.messages.push(message)},
  console:{error(){}}
 };
 vm.createContext(context);
 vm.runInContext(match[0],context);
 return context;
}

test('tx confirma éxito solo después de persistir',async()=>{
 let writes=0;
 const context=makeContext(async()=>{writes++});
 const result=await context.tx('Actualizado',()=>{context.state.value=2});
 assert.equal(result,true);
 assert.equal(writes,1);
 assert.equal(context.state.value,2);
 assert.equal(context.undoStack.length,1);
 assert.equal(context.rendered,true);
});

test('tx revierte estado e historial y devuelve false si falla el guardado',async()=>{
 const context=makeContext(async()=>{throw new Error('almacenamiento lleno')});
 context.undoStack.push({label:'anterior',state:{value:0}});
 context.redoStack.push({label:'rehacer',state:{value:3}});
 const result=await context.tx('Actualizado',()=>{context.state.value=2});
 assert.equal(result,false);
 assert.equal(context.state.value,1);
 assert.equal(context.undoStack.length,1);
 assert.equal(context.redoStack.length,1);
 assert.match(context.messages.at(-1),/almacenamiento lleno/);
 assert.equal(context.rendered,undefined);
});
