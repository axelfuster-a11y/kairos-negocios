import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const D=require('./domain.js');
test('balance combina saldo inicial e ingresos/gastos sin mezclar cuentas',()=>{const a={id:'mp',opening:1000};const ms=[{accountId:'mp',type:'income',amount:500},{accountId:'mp',type:'expense',amount:200},{accountId:'cash',type:'income',amount:900}];assert.equal(D.accountBalance(a,ms),1300)});
test('resumen mensual excluye otros meses y deudas pagadas',()=>{const s={accounts:[{id:'a',opening:100}],movements:[{accountId:'a',type:'income',amount:50,date:'2026-11-01'},{accountId:'a',type:'expense',amount:10,date:'2026-10-31'}],debts:[{amount:80,status:'open'},{amount:20,status:'paid'}]};assert.deepEqual(D.summarize(s,'2026-11'),{balance:140,income:50,expense:0,debt:80})});
test('validación rechaza monto cero, cuenta desconocida y descripción vacía',()=>{const base={type:'expense',description:'Comida',amount:10,accountId:'a',date:'2026-11-11'};assert.equal(D.validateMovement(base,['a']),null);assert.match(D.validateMovement({...base,amount:0},['a']),/monto/);assert.match(D.validateMovement({...base,accountId:'x'},['a']),/cuenta/);assert.match(D.validateMovement({...base,description:' '},['a']),/descripción/)});

test('transferencia mueve saldo entre cuentas sin crear ingreso ni gasto',()=>{const s={accounts:[{id:'mp',opening:1000},{id:'cash',opening:100}],movements:[{type:'transfer',fromAccountId:'mp',toAccountId:'cash',amount:300,date:'2026-11-11'}],debts:[]};assert.deepEqual(D.summarize(s,'2026-11'),{balance:1100,income:0,expense:0,debt:0});assert.equal(D.accountBalance(s.accounts[0],s.movements),700);assert.equal(D.accountBalance(s.accounts[1],s.movements),400)});
test('validación impide transferencias a la misma cuenta',()=>{const m={type:'transfer',description:'Mover plata',amount:10,fromAccountId:'a',toAccountId:'a',date:'2026-11-11'};assert.match(D.validateMovement(m,['a']),/distintos/)});

test('repetición mensual respeta el último día del mes',()=>{assert.equal(D.nextDate('2026-01-31','monthly'),'2026-02-28');assert.equal(D.nextDate('2026-02-28','monthly'),'2026-03-28')});
test('repetición semanal conserva la fecha local',()=>{assert.equal(D.nextDate('2026-11-11','weekly'),'2026-11-18')});
test('progreso de proyecto usa tareas completadas y omite archivadas',()=>{const p={id:'p'};const ts=[{projectId:'p',done:true},{projectId:'p',done:false},{projectId:'p',done:true,archived:true}];assert.equal(D.projectProgress(p,ts),50)});
test('calendario reúne tareas, eventos y vencimientos sin duplicar transferencias',()=>{const s={tasks:[{id:'t',title:'Entrega',due:'2026-11-12',subjectId:'s'}],events:[{id:'e',title:'Médico',date:'2026-11-12',time:'10:00'}],debts:[{id:'d',name:'Cuota',due:'2026-11-12',status:'open'}],workEntries:[]};const xs=D.buildCalendarItems(s,'2026-11');assert.equal(xs.length,3);assert.deepEqual(xs.map(x=>x.type).sort(),['debt','event','study'])});
test('deudas con saldo cero no agregan pasivo',()=>{const s={accounts:[],movements:[],debts:[{amount:100,remaining:0,status:'open'},{amount:50,remaining:20,status:'open'}]};assert.equal(D.summarize(s,'2026-11').debt,20)});
