import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const D=require('./domain.js');
test('balance combina saldo inicial e ingresos/gastos sin mezclar cuentas',()=>{const a={id:'mp',opening:1000};const ms=[{accountId:'mp',type:'income',amount:500},{accountId:'mp',type:'expense',amount:200},{accountId:'cash',type:'income',amount:900}];assert.equal(D.accountBalance(a,ms),1300)});
test('resumen mensual excluye otros meses y deudas pagadas',()=>{const s={accounts:[{id:'a',opening:100}],movements:[{accountId:'a',type:'income',amount:50,date:'2026-11-01'},{accountId:'a',type:'expense',amount:10,date:'2026-10-31'}],debts:[{amount:80,status:'open'},{amount:20,status:'paid'}]};assert.deepEqual(D.summarize(s,'2026-11'),{balance:140,income:50,expense:0,debt:80,movementCount:1})});
test('validación rechaza monto cero, cuenta desconocida y descripción vacía',()=>{const base={type:'expense',description:'Comida',amount:10,accountId:'a',date:'2026-11-11'};assert.equal(D.validateMovement(base,['a']),null);assert.match(D.validateMovement({...base,amount:0},['a']),/monto/);assert.match(D.validateMovement({...base,accountId:'x'},['a']),/cuenta/);assert.match(D.validateMovement({...base,description:' '},['a']),/descripción/)});

test('transferencia mueve saldo entre cuentas sin crear ingreso ni gasto',()=>{const s={accounts:[{id:'mp',opening:1000},{id:'cash',opening:100}],movements:[{type:'transfer',fromAccountId:'mp',toAccountId:'cash',amount:300,date:'2026-11-11'}],debts:[]};assert.deepEqual(D.summarize(s,'2026-11'),{balance:1100,income:0,expense:0,debt:0,movementCount:1});assert.equal(D.accountBalance(s.accounts[0],s.movements),700);assert.equal(D.accountBalance(s.accounts[1],s.movements),400)});
test('validación impide transferencias a la misma cuenta',()=>{const m={type:'transfer',description:'Mover plata',amount:10,fromAccountId:'a',toAccountId:'a',date:'2026-11-11'};assert.match(D.validateMovement(m,['a']),/distintos/)});

test('repetición mensual conserva el fin de mes y ajusta fechas largas',()=>{assert.equal(D.nextDate('2026-01-31','monthly'),'2026-02-28');assert.equal(D.nextDate('2026-02-28','monthly'),'2026-03-31');assert.equal(D.nextDate('2026-03-31','monthly'),'2026-04-30');assert.equal(D.nextDate('2026-01-30','monthly'),'2026-02-28')});
test('repetición semanal conserva la fecha local',()=>{assert.equal(D.nextDate('2026-11-11','weekly'),'2026-11-18')});
test('repetición mensual conserva el día original cuando febrero acorta el mes',()=>{
 assert.equal(D.nextDate('2026-02-28','monthly',30,false),'2026-03-30');
 assert.equal(D.nextDate('2026-02-28','monthly',31,true),'2026-03-31');
});
test('progreso de proyecto usa tareas completadas y omite archivadas',()=>{const p={id:'p'};const ts=[{projectId:'p',done:true},{projectId:'p',done:false},{projectId:'p',done:true,archived:true}];assert.equal(D.projectProgress(p,ts),50)});
test('calendario reúne tareas, eventos y vencimientos sin duplicar transferencias',()=>{const s={tasks:[{id:'t',title:'Entrega',due:'2026-11-12',subjectId:'s'}],events:[{id:'e',title:'Médico',date:'2026-11-12',time:'10:00'}],debts:[{id:'d',name:'Cuota',due:'2026-11-12',status:'open'}],workEntries:[]};const xs=D.buildCalendarItems(s,'2026-11');assert.equal(xs.length,3);assert.deepEqual(xs.map(x=>x.type).sort(),['debt','event','study'])});
test('deudas con saldo cero no agregan pasivo',()=>{const s={accounts:[],movements:[],debts:[{amount:100,remaining:0,status:'open'},{amount:50,remaining:20,status:'open'}]};assert.equal(D.summarize(s,'2026-11').debt,20)});

test('validación de deuda impide que el saldo pendiente supere el importe original',()=>{const base={name:'Tarjeta',amount:100,remaining:80};assert.equal(D.validateDebt(base),null);assert.match(D.validateDebt({...base,remaining:120}),/no puede superar/)});
test('deuda sin saldo pendiente no se confunde con saldo negativo',()=>{assert.equal(D.validateDebt({name:'Cuota',amount:100,remaining:0}),null);assert.match(D.validateDebt({name:'Cuota',amount:100,remaining:-1}),/no puede ser negativo/)});

test('parseo de importes argentinos distingue miles, decimales y formatos ambiguos',()=>{
 assert.equal(D.parseMoney('3.000'),3000);
 assert.equal(D.parseMoney('1.234.567'),1234567);
 assert.equal(D.parseMoney('1.234,56'),1234.56);
 assert.equal(D.parseMoney('1234,56'),1234.56);
 assert.equal(D.parseMoney('12.34'),12.34);
 assert.equal(D.parseMoney('1,234'),null);
 assert.equal(D.parseMoney('1.234.56'),null);
});
test('fechas imposibles no se aceptan como movimientos',()=>{
 const base={type:'expense',description:'Comida',amount:10,accountId:'a',date:'2026-02-28'};
 assert.equal(D.validateMovement(base,['a']),null);
 assert.match(D.validateMovement({...base,date:'2026-02-30'},['a']),/fecha/);
 assert.match(D.validateMovement({...base,date:'2026-13-01'},['a']),/fecha/);
});
test('tareas atrasadas se calculan con la fecha local de referencia',()=>{
 const tasks=[{due:'2026-11-11',done:false},{due:'2026-11-12',done:false},{due:'2026-11-10',done:true},{due:'2026-11-01',done:false,archived:true}];
 assert.deepEqual(D.taskStats(tasks,'2026-11-12'),{active:2,done:1,overdue:1});
});
test('pago parcial reduce deuda y crea un único gasto vinculado',()=>{
 const debt={id:'d1',name:'Universidad',amount:100000,remaining:100000,status:'open'};
 const result=D.prepareDebtPayment(debt,30000,'mp','2026-11-12','m1','2026-11-12T12:00:00Z','Pago parcial');
 assert.equal(result.debt.remaining,70000);
 assert.equal(result.debt.status,'open');
 assert.equal(result.movement.type,'expense');
 assert.equal(result.movement.amount,30000);
 assert.equal(result.movement.accountId,'mp');
 assert.equal(result.movement.debtId,'d1');
 assert.equal(result.movement.notes,'Pago parcial');
 assert.equal(debt.remaining,100000);
});
test('revertir un pago restaura el saldo y los vencimientos sin borrar datos de la deuda',()=>{
 const debt={id:'d5',name:'Universidad',amount:120,remaining:120,status:'open',installments:2,installmentAmount:60,frequency:'monthly',due:'2026-01-31',notes:'Mantener'};
 const payment=D.prepareDebtPayment(debt,60,'mp','2026-01-01','m5','2026-01-01T12:00:00Z');
 assert.equal(payment.debt.remaining,60);
 assert.equal(payment.debt.due,'2026-02-28');
 const reverted=D.revertDebtPayment(payment.debt,payment.movement);
 assert.equal(reverted.remaining,120);
 assert.equal(reverted.status,'open');
 assert.equal(reverted.installments,2);
 assert.equal(reverted.due,'2026-01-31');
 assert.equal(reverted.name,'Universidad');
 assert.equal(reverted.notes,'Mantener');
 assert.throws(()=>D.revertDebtPayment(payment.debt,{debtId:'d5'}),/revertir/);
});
test('pago total cierra deuda y registra el gasto por el mismo importe',()=>{
 const debt={id:'d2',name:'Tarjeta',amount:50000,remaining:20000,status:'open'};
 const result=D.prepareDebtPayment(debt,20000,'bank','2026-11-12','m2','2026-11-12T12:00:00Z');
 assert.equal(result.debt.remaining,0);
 assert.equal(result.debt.status,'paid');
 assert.equal(result.movement.amount,20000);
 assert.equal(D.accountBalance({id:'bank',opening:50000},[result.movement]),30000);
});
test('pago de deuda rechaza importes superiores al saldo pendiente y fechas inválidas',()=>{
 const debt={id:'d3',name:'Cuota',amount:100,remaining:40,status:'open'};
 assert.throws(()=>D.prepareDebtPayment(debt,41,'mp','2026-11-12','m3','now'),/no superar/);
 assert.throws(()=>D.prepareDebtPayment(debt,10,'mp','2026-02-30','m3','now'),/fecha/);
 assert.throws(()=>D.prepareDebtPayment(debt,10,'','2026-11-12','m3','now'),/cuenta/);
});
test('pago de cuotas adelanta vencimiento solo por cuotas completas abonadas',()=>{
 const debt={id:'d4',name:'Cuota',amount:180,remaining:180,status:'open',installments:3,installmentAmount:60,frequency:'monthly',due:'2026-01-31'};
 const partial=D.prepareDebtPayment(debt,30,'mp','2026-01-01','m4','now');
 assert.equal(partial.debt.due,'2026-01-31');
 assert.equal(partial.debt.installments,3);
 const full=D.prepareDebtPayment(debt,120,'mp','2026-01-01','m5','now');
 assert.equal(full.debt.due,'2026-03-31');
 assert.equal(full.debt.installments,1);
});
test('saldo pendiente no admite NaN',()=>{
 assert.match(D.validateDebt({name:'Tarjeta',amount:100,remaining:NaN}),/importe válido/);
});

test('extracción de importes ignora fechas y horas y conserva importes argentinos',()=>{
 const mentions=D.extractMoneyMentions('Gasté $3.000 el 12/11/2026 y ahora tengo $40.000 en Mercado Pago a las 14:30');
 assert.deepEqual(mentions.map(x=>x.value),[3000,40000]);
 assert.equal(D.extractMoneyMentions('Gasté 1,234 en un servicio').length,0);
});
test('restauración acepta copias válidas y rechaza datos corruptos',()=>{
 const backup={format:'kairos-backup-v2',data:{accounts:[{id:'a',name:'Efectivo',opening:100}],movements:[{id:'m',type:'expense',description:'Comida',amount:10,accountId:'a',date:'2026-11-12'}],debts:[{id:'d',name:'Cuota',amount:50,remaining:50}],tasks:[{id:'t',title:'Estudiar'}]}};
 assert.equal(D.validateBackup(backup),null);
 assert.match(D.validateBackup({...backup,format:'otro'}),/compatible/);
 assert.match(D.validateBackup({...backup,data:{...backup.data,movements:[{type:'expense',description:'Comida',amount:10,accountId:'inexistente',date:'2026-11-12'}]}}),/movimiento inválido/);
 assert.match(D.validateBackup({...backup,data:{...backup.data,tasks:[{}]}}),/tarea inválida/);
});
