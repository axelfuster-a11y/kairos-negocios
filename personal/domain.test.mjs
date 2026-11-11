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
