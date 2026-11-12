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
function extractMoneyMentions(text){
 const source=String(text??'');
 const masked=source
  .replace(/\b\d{4}-\d{2}-\d{2}\b/g,m=>' '.repeat(m.length))
  .replace(/\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/g,m=>' '.repeat(m.length))
  .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g,m=>' '.repeat(m.length));
 const re=/(?:\$\s*)?\b\d[\d.,]*\b\s*(?:pesos|ars)?/gi,out=[];let match;
 while((match=re.exec(masked))!==null){const value=parseMoney(match[0]);if(value!==null)out.push({value,index:match.index,raw:source.slice(match.index,match.index+match[0].length)})}
 return out;
}
function localISODate(date=new Date()){return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-')}
function validISODate(value){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return false;
 const date=new Date(value+'T00:00:00.000Z');
 return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
}
function accountBalance(account,movements){return round(Number(account.opening||0)+(movements||[]).reduce((sum,m)=>{if(m.status==='void')return sum;if(m.type==='transfer'){if(m.fromAccountId===account.id)return sum-Number(m.amount);if(m.toAccountId===account.id)return sum+Number(m.amount);return sum}if(m.accountId!==account.id)return sum;return sum+(m.type==='income'?1:-1)*Number(m.amount)},0))}
function summarize(state,month){const movements=state.movements||[],monthItems=movements.filter(m=>m.status!=='void'&&String(m.date||'').startsWith(month));return {balance:round((state.accounts||[]).reduce((sum,a)=>sum+accountBalance(a,movements),0)),income:round(monthItems.filter(m=>m.type==='income').reduce((s,m)=>s+Number(m.amount),0)),expense:round(monthItems.filter(m=>m.type==='expense').reduce((s,m)=>s+Number(m.amount),0)),debt:round((state.debts||[]).filter(d=>d.status!=='paid'&&d.status!=='void').reduce((s,d)=>s+Number(d.remaining??d.amount),0)),movementCount:monthItems.length}}
function validateMovement(m,accountIds){if(!['income','expense','transfer'].includes(m.type))return 'Tipo de movimiento inválido.';if(m.status!==undefined&&!['posted','void'].includes(m.status))return 'Estado de movimiento inválido.';if(!String(m.description||'').trim())return 'Escribe una descripción.';if(!Number.isFinite(Number(m.amount))||Number(m.amount)<=0)return 'El monto debe ser mayor a cero.';if(m.type==='transfer'){if(!accountIds.includes(m.fromAccountId)||!accountIds.includes(m.toAccountId))return 'Elige las dos cuentas.';if(m.fromAccountId===m.toAccountId)return 'El origen y destino deben ser distintos.'}else if(!accountIds.includes(m.accountId))return 'Elige una cuenta válida.';if(!validISODate(m.date))return 'Elige una fecha válida.';return null}
function validateDebt(d){if(d.status!==undefined&&!['open','paid','void'].includes(d.status))return 'Estado de deuda inválido.';if(!String(d.name||'').trim())return 'Escribe el concepto de la deuda.';if(!Number.isFinite(Number(d.amount))||Number(d.amount)<=0)return 'El monto debe ser mayor a cero.';if(d.remaining!==undefined&&!Number.isFinite(Number(d.remaining)))return 'El saldo pendiente debe ser un importe válido.';if(d.remaining!==undefined&&Number(d.remaining)<0)return 'El saldo pendiente no puede ser negativo.';if(d.remaining!==undefined&&Number(d.remaining)>Number(d.amount))return 'El saldo pendiente no puede superar el importe original.';return null}
function prepareDebtPayment(debt,amount,accountId,date,movementId,createdAt,notes=''){
 if(!debt)throw new Error('No se encontró la deuda.');
 const remaining=Number(debt.remaining??debt.amount);
 if(!Number.isFinite(remaining)||remaining<0)throw new Error('El saldo pendiente de la deuda no es válido.');
 if(!Number.isFinite(Number(amount))||Number(amount)<=0||Number(amount)>remaining)throw new Error('El pago debe ser mayor a cero y no superar el saldo pendiente.');
 if(!accountId)throw new Error('Elige una cuenta válida.');
 if(!validISODate(date))throw new Error('Elige una fecha válida.');
 const value=round(Number(amount)),updatedDebt={...debt,remaining:round(remaining-value)};
 const installment=Number(debt.installmentAmount);
 if(Number.isFinite(installment)&&installment>0){
  const paidInstallments=Math.floor((value+0.005)/installment);
  if(paidInstallments>0){
   if(Number(debt.installments)>0)updatedDebt.installments=Math.max(0,Number(debt.installments)-paidInstallments);
   if(debt.frequency!=='once'&&debt.due){
    const dueParts=debt.due.split('-').map(Number),sourceLast=new Date(Date.UTC(dueParts[0],dueParts[1],0)).getUTCDate();
    const anchorDay=Number(debt.installmentDay)||dueParts[2],endOfMonth=typeof debt.installmentEndOfMonth==='boolean'?debt.installmentEndOfMonth:dueParts[2]===sourceLast;
    updatedDebt.installmentDay=anchorDay;updatedDebt.installmentEndOfMonth=endOfMonth;
    for(let i=0;i<paidInstallments;i++)updatedDebt.due=nextDate(updatedDebt.due,debt.frequency,anchorDay,endOfMonth)||updatedDebt.due;
   }
  }
 }
 if(updatedDebt.remaining<=0.005){updatedDebt.remaining=0;updatedDebt.status='paid'}
 const debtBefore={remaining:debt.remaining??debt.amount,status:debt.status,installments:debt.installments,due:debt.due,installmentDay:debt.installmentDay,installmentEndOfMonth:debt.installmentEndOfMonth};
 const movement={id:movementId,type:'expense',description:'Pago de deuda: '+debt.name,amount:value,accountId,date,category:'Pago de deuda',notes:notes||'',debtId:debt.id,debtBefore,status:'posted',createdAt};
 return {debt:updatedDebt,movement};
}
function revertDebtPayment(debt,movement){
 if(!debt||!movement||movement.debtId!==debt.id||!movement.debtBefore)throw new Error('No hay datos suficientes para revertir este pago.');
 const updated={...debt},before=movement.debtBefore;
 for(const key of ['remaining','status','installments','due','installmentDay','installmentEndOfMonth']){
  if(Object.prototype.hasOwnProperty.call(before,key))updated[key]=before[key];else delete updated[key];
 }
 return updated;
}
function validateBackup(backup){
 if(!backup||!['kairos-backup-v1','kairos-backup-v2'].includes(backup.format))return 'El archivo no es una copia compatible de Kairós.';
 const data=backup.data;
 const required=['accounts','movements','debts','tasks'];
 const optional=['events','projects','subjects','workEntries','clients','timeSessions','reviews','chat'];
 if(!data||required.some(key=>!Array.isArray(data[key])))return 'La copia está incompleta o tiene una estructura inválida.';
 if(optional.some(key=>data[key]!==undefined&&!Array.isArray(data[key])))return 'La copia contiene una sección con formato inválido.';
 for(const key of [...required,...optional]){
  const seen=new Set();
  for(const item of data[key]||[]){
   if(!item||typeof item!=='object'||Array.isArray(item))return 'La copia contiene un registro inválido.';
   const id=item.id;
   if(typeof id!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(id)||seen.has(id))return 'La copia contiene un identificador inválido o repetido.';
   seen.add(id);
  }
 }
 if(data.accounts.some(a=>!String(a.name||'').trim()||(a.opening!==undefined&&!Number.isFinite(Number(a.opening)))))return 'La copia contiene una cuenta inválida.';
 const ids=data.accounts.map(a=>a.id);
 for(const movement of data.movements){const error=validateMovement(movement,ids);if(error)return 'La copia contiene un movimiento inválido: '+error}
 for(const debt of data.debts){const error=validateDebt(debt);if(error)return 'La copia contiene una deuda inválida: '+error}
 const debtById=new Map(data.debts.map(debt=>[debt.id,debt]));
 for(const movement of data.movements){
  if(movement.debtId===undefined||movement.debtId===null)continue;
  const debt=debtById.get(movement.debtId);
  if(!debt||movement.type!=='expense')return 'La copia contiene un pago vinculado a una deuda inexistente o inválido.';
  if(movement.debtBefore!==undefined){
   const before=movement.debtBefore;
   if(!before||typeof before!=='object'||Array.isArray(before))return 'La copia contiene un historial de pago inválido.';
   if(before.remaining!==undefined&&(!Number.isFinite(before.remaining)||before.remaining<0||before.remaining>Number(debt.amount)))return 'La copia contiene un saldo previo de deuda inválido.';
   if(before.status!==undefined&&!['open','paid','void'].includes(before.status))return 'La copia contiene un estado previo de deuda inválido.';
   if(before.installments!==undefined&&(!Number.isInteger(before.installments)||before.installments<0))return 'La copia contiene cuotas previas inválidas.';
   if(before.due!==undefined&&!validISODate(before.due))return 'La copia contiene un vencimiento previo inválido.';
   if(before.installmentDay!==undefined&&(!Number.isInteger(before.installmentDay)||before.installmentDay<1||before.installmentDay>31))return 'La copia contiene un día de cuota inválido.';
   if(before.installmentEndOfMonth!==undefined&&typeof before.installmentEndOfMonth!=='boolean')return 'La copia contiene una regla de vencimiento inválida.';
  }
 }
 if(data.tasks.some(t=>!String(t.title||'').trim()))return 'La copia contiene una tarea inválida.';
 for(const subject of data.subjects||[]){
  if(subject.attachments!==undefined&&!Array.isArray(subject.attachments))return 'La copia contiene adjuntos con formato inválido.';
  const attachmentIds=new Set();
  for(const file of subject.attachments||[]){
   if(!file||typeof file!=='object'||Array.isArray(file)||typeof file.id!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(file.id)||attachmentIds.has(file.id))return 'La copia contiene un identificador de adjunto inválido o repetido.';
   attachmentIds.add(file.id);
   if(!String(file.name||'').trim()||!['application/pdf','image/png','image/jpeg','image/webp'].includes(file.type)||!Number.isFinite(Number(file.size))||Number(file.size)<0||Number(file.size)>5*1024*1024||typeof file.data!=='string'||!file.data.startsWith('data:'+file.type+';base64,'))return 'La copia contiene un adjunto inválido o superior a 5 MB.';
  }
 }
 if(data.prefs!==undefined&&(!data.prefs||typeof data.prefs!=='object'||Array.isArray(data.prefs)))return 'Las preferencias de la copia no son válidas.';
 const prefs=data.prefs||{};
 if(prefs.currency!==undefined&&!['ARS','USD','EUR'].includes(prefs.currency))return 'La moneda de la copia no está admitida.';
 if(prefs.theme!==undefined&&!['light','dark','system'].includes(prefs.theme))return 'El tema de la copia no es válido.';
 if(prefs.fontScale!==undefined&&!['normal','large','larger'].includes(prefs.fontScale))return 'El tamaño de letra de la copia no es válido.';
 if(prefs.dailyReviewTime!==undefined&&prefs.dailyReviewTime!==''&&!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(prefs.dailyReviewTime))return 'La hora de revisión de la copia no es válida.';
 for(const key of ['pomodoro','shortBreak','longBreak'])if(prefs[key]!==undefined&&(!Number.isInteger(Number(prefs[key]))||Number(prefs[key])<1||Number(prefs[key])>120))return 'La duración del temporizador de la copia no es válida.';
 if(data.focus!==undefined){
  const focus=data.focus;
  if(!focus||typeof focus!=='object'||Array.isArray(focus))return 'La configuración del temporizador no es válida.';
  if(focus.running!==undefined&&typeof focus.running!=='boolean')return 'El estado del temporizador no es válido.';
  if(focus.mode!==undefined&&!['focus','short','long'].includes(focus.mode))return 'El modo del temporizador no es válido.';
  if(focus.remaining!==undefined&&(!Number.isFinite(Number(focus.remaining))||Number(focus.remaining)<0||Number(focus.remaining)>7200))return 'El tiempo restante no es válido.';
  if(focus.until!==undefined&&focus.until!==null&&(!Number.isFinite(Number(focus.until))||Number(focus.until)<=0))return 'La fecha de finalización del temporizador no es válida.';
  if(focus.taskId!==undefined&&focus.taskId!==null&&(typeof focus.taskId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(focus.taskId)))return 'La tarea del temporizador no es válida.';
 }
 return null;
}
function nextDate(date,repeat,anchorDay=null,endOfMonth=null){if(!validISODate(date))return null;const [year,month,day]=date.split('-').map(Number);let target;if(repeat==='daily')target=new Date(Date.UTC(year,month-1,day+1));else if(repeat==='weekly')target=new Date(Date.UTC(year,month-1,day+7));else if(repeat==='monthly'){const sourceLast=new Date(Date.UTC(year,month,0)).getUTCDate(),nextMonth=new Date(Date.UTC(year,month,1)),targetLast=new Date(Date.UTC(year,month+1,0)).getUTCDate(),anchor=Number(anchorDay)>0?Math.min(31,Math.floor(Number(anchorDay))):day,preserveEnd=endOfMonth===null?day===sourceLast:endOfMonth===true,targetDay=preserveEnd?targetLast:Math.min(anchor,targetLast);target=new Date(Date.UTC(nextMonth.getUTCFullYear(),nextMonth.getUTCMonth(),targetDay))}else return null;return target.toISOString().slice(0,10)}
function taskStats(tasks,referenceDate=localISODate()){const active=(tasks||[]).filter(t=>!t.done&&!t.archived),done=(tasks||[]).filter(t=>t.done);return {active:active.length,done:done.length,overdue:active.filter(t=>t.due&&t.due<referenceDate).length}}
function projectProgress(project,tasks){const related=(tasks||[]).filter(t=>t.projectId===project.id&&!t.archived);return related.length?Math.round(related.filter(t=>t.done).length/related.length*100):Number(project.progress||0)}
function buildCalendarItems(state,month){const out=[];for(const t of state.tasks||[])if(!t.archived&&t.due&&t.due.startsWith(month))out.push({id:'task:'+t.id,date:t.due,title:t.title,type:t.subjectId?'study':t.projectId?'project':'task'});for(const e of state.events||[])if(e.date&&e.date.startsWith(month))out.push({id:'event:'+e.id,date:e.date,title:e.title,type:e.type||'event',time:e.time||''});for(const d of state.debts||[])if(d.status!=='paid'&&d.due&&d.due.startsWith(month))out.push({id:'debt:'+d.id,date:d.due,title:'Vence: '+d.name,type:'debt'});for(const w of state.workEntries||[])if(w.date&&w.date.startsWith(month))out.push({id:'work:'+w.id,date:w.date,title:w.title||w.client||'Trabajo',type:'work'});return out.sort((a,b)=>a.date.localeCompare(b.date)||(a.time||'').localeCompare(b.time||''))}
function monthlyTotals(state,month){const xs=(state.workEntries||[]).filter(x=>(x.date||'').startsWith(month));return {income:round(xs.reduce((s,x)=>s+Number(x.income||0),0)),expenses:round(xs.reduce((s,x)=>s+Number(x.expenses||0),0)),hours:round(xs.reduce((s,x)=>s+Number(x.minutes||0),0)/60)}}
return Object.freeze({round,parseMoney,extractMoneyMentions,localISODate,accountBalance,summarize,validateMovement,validateDebt,prepareDebtPayment,revertDebtPayment,validateBackup,nextDate,taskStats,projectProgress,buildCalendarItems,monthlyTotals});
});