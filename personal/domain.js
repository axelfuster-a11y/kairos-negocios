(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;root.KairosDomain=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const round=n=>Math.round((Number(n)+Number.EPSILON)*100)/100;
function parseMoney(input){
 let x=String(input??'').trim().replace(/^\$\s*/,'').replace(/\s*(?:pesos|ars)$/i,'').replace(/\s/g,'');
 if(!/^\d[\d.,]*$/.test(x))return null;
 if(x.includes(',')&&x.includes('.')){
  if((x.match(/,/g)||[]).length!==1)return null;
  const [whole,fraction]=x.split(',');
  if(!/^\d+$/.test(whole)&&!/^\d{1,3}(?:\.\d{3})+$/.test(whole))return null;
  if(!/^\d{1,2}$/.test(fraction))return null;
  x=whole.replace(/\./g,'')+'.'+fraction;
 }else if(x.includes(',')){
  if((x.match(/,/g)||[]).length!==1)return null;
  const [whole,fraction]=x.split(',');
  if(!/^\d+$/.test(whole)||!/^\d{1,2}$/.test(fraction))return null;
  x=whole+'.'+fraction;
 }else if(x.includes('.')){
  const parts=x.split('.');
  if(parts.length>2){
   if(parts[0].length>3||parts.slice(1).some(part=>part.length!==3))return null;
   x=parts.join('');
  }else{
   const [whole,fraction]=parts;
   if(!/^\d+$/.test(whole))return null;
   if(fraction.length===3)x=whole+fraction;
   else if(/^\d{1,2}$/.test(fraction))x=whole+'.'+fraction;
   else return null;
  }
 }
 const value=Number(x);
 return Number.isFinite(value)&&value>0?value:null;
}
function localISODate(date=new Date()){return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-')}
function validISODate(value){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return false;
 const date=new Date(value+'T00:00:00.000Z');
 return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
}
function accountBalance(account,movements){return round(Number(account.opening||0)+(movements||[]).reduce((sum,m)=>{if(m.status==='void')return sum;if(m.type==='transfer'){if(m.fromAccountId===account.id)return sum-Number(m.amount);if(m.toAccountId===account.id)return sum+Number(m.amount);return sum}if(m.accountId!==account.id)return sum;return sum+(m.type==='income'?1:-1)*Number(m.amount)},0))}
function summarize(state,month){const movements=state.movements||[],monthItems=movements.filter(m=>m.status!=='void'&&String(m.date||'').startsWith(month));return {balance:round((state.accounts||[]).reduce((sum,a)=>sum+accountBalance(a,movements),0)),income:round(monthItems.filter(m=>m.type==='income').reduce((s,m)=>s+Number(m.amount),0)),expense:round(monthItems.filter(m=>m.type==='expense').reduce((s,m)=>s+Number(m.amount),0)),debt:round((state.debts||[]).filter(d=>d.status!=='paid'&&d.status!=='void').reduce((s,d)=>s+Number(d.remaining??d.amount),0)),movementCount:monthItems.length}}
function validateMovement(m,accountIds){if(!['income','expense','transfer'].includes(m.type))return 'Tipo de movimiento inválido.';if(!String(m.description||'').trim())return 'Escribí una descripción.';if(!Number.isFinite(Number(m.amount))||Number(m.amount)<=0)return 'El monto debe ser mayor a cero.';if(m.type==='transfer'){if(!accountIds.includes(m.fromAccountId)||!accountIds.includes(m.toAccountId))return 'Elegí las dos cuentas.';if(m.fromAccountId===m.toAccountId)return 'El origen y destino deben ser distintos.'}else if(!accountIds.includes(m.accountId))return 'Elegí una cuenta válida.';if(!validISODate(m.date))return 'Elegí una fecha válida.';return null}
function validateDebt(d){if(!String(d.name||'').trim())return 'Escribí el concepto de la deuda.';if(!Number.isFinite(Number(d.amount))||Number(d.amount)<=0)return 'El monto debe ser mayor a cero.';if(d.remaining!==undefined&&!Number.isFinite(Number(d.remaining)))return 'El saldo pendiente debe ser un importe válido.';if(d.remaining!==undefined&&Number(d.remaining)<0)return 'El saldo pendiente no puede ser negativo.';if(d.remaining!==undefined&&Number(d.remaining)>Number(d.amount))return 'El saldo pendiente no puede superar el importe original.';return null}
function nextDate(date,repeat){const d=new Date(date+'T12:00:00');if(repeat==='daily')d.setDate(d.getDate()+1);else if(repeat==='weekly')d.setDate(d.getDate()+7);else if(repeat==='monthly'){const day=d.getDate();d.setDate(1);d.setMonth(d.getMonth()+1);const last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();d.setDate(Math.min(day,last))}else return null;return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function taskStats(tasks,referenceDate=localISODate()){const active=(tasks||[]).filter(t=>!t.done&&!t.archived),done=(tasks||[]).filter(t=>t.done);return {active:active.length,done:done.length,overdue:active.filter(t=>t.due&&t.due<referenceDate).length}}
function projectProgress(project,tasks){const related=(tasks||[]).filter(t=>t.projectId===project.id&&!t.archived);return related.length?Math.round(related.filter(t=>t.done).length/related.length*100):Number(project.progress||0)}
function buildCalendarItems(state,month){const out=[];for(const t of state.tasks||[])if(!t.archived&&t.due&&t.due.startsWith(month))out.push({id:'task:'+t.id,date:t.due,title:t.title,type:t.subjectId?'study':t.projectId?'project':'task'});for(const e of state.events||[])if(e.date&&e.date.startsWith(month))out.push({id:'event:'+e.id,date:e.date,title:e.title,type:e.type||'event',time:e.time||''});for(const d of state.debts||[])if(d.status!=='paid'&&d.due&&d.due.startsWith(month))out.push({id:'debt:'+d.id,date:d.due,title:'Vence: '+d.name,type:'debt'});for(const w of state.workEntries||[])if(w.date&&w.date.startsWith(month))out.push({id:'work:'+w.id,date:w.date,title:w.title||w.client||'Trabajo',type:'work'});return out.sort((a,b)=>a.date.localeCompare(b.date)||(a.time||'').localeCompare(b.time||''))}
function monthlyTotals(state,month){const xs=(state.workEntries||[]).filter(x=>(x.date||'').startsWith(month));return {income:round(xs.reduce((s,x)=>s+Number(x.income||0),0)),expenses:round(xs.reduce((s,x)=>s+Number(x.expenses||0),0)),hours:round(xs.reduce((s,x)=>s+Number(x.minutes||0),0)/60)}}
return Object.freeze({round,parseMoney,localISODate,accountBalance,summarize,validateMovement,validateDebt,nextDate,taskStats,projectProgress,buildCalendarItems,monthlyTotals});
});