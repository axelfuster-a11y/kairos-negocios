-- Ejecutar en Supabase SQL Editor ANTES de aplicar la migración 008.
-- Solo lectura: no modifica datos.

select
  count(*) filter (
    where stock_antes is null
       or stock_despues is null
       or stock_antes < 0
       or stock_despues < 0
       or stock_despues <> stock_antes + cantidad
  ) as invalid_stock_movements,
  count(*) as total_stock_movements
from public.stock_movements;

select
  p.id as payment_id,
  p.user_id,
  p.movimiento_financiero_id,
  p.fecha,
  p.monto,
  p.tipo
from public.team_payments p
left join public.movimientos_financieros m
  on m.id = p.movimiento_financiero_id
 and m.user_id = p.user_id
where p.movimiento_financiero_id is not null
  and m.id is null
order by p.created_at;

select
  user_id,
  movimiento_financiero_id,
  count(*) as payment_count
from public.team_payments
where movimiento_financiero_id is not null
group by user_id, movimiento_financiero_id
having count(*) > 1;

select
  count(*) filter (where total <= 0) as sales_with_non_positive_total,
  count(*) filter (where fecha is null) as sales_without_date,
  count(*) as total_sales
from public.ventas;

select
  count(*) filter (where monto <= 0) as non_positive_movements,
  count(*) filter (where fecha is null) as movements_without_date,
  count(*) as total_movements
from public.movimientos_financieros;

-- Resultado esperado para aplicar 008 sin reparación previa:
-- invalid_stock_movements puede ser mayor a 0 porque la constraint se crea NOT VALID.
-- Las consultas de pagos huérfanos y movimientos reutilizados deben devolver 0 filas.
-- Las ventas/movimientos no positivos no bloquean 008, pero deben revisarse antes de
-- endurecer montos y anulaciones en la siguiente migración.
