-- Kairós P1: sesiones simples de caja.
-- Inspirado en flujos POS, traducido a apertura, movimientos y cierre.

create table if not exists public.cash_registers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  nombre text not null default 'Caja principal',
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table if not exists public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  cash_register_id uuid not null,
  estado text not null default 'abierta' check (estado in ('abierta', 'cerrada')),
  abierta_at timestamptz not null default now(),
  cerrada_at timestamptz,
  saldo_inicial numeric not null default 0 check (saldo_inicial >= 0),
  efectivo_esperado numeric,
  efectivo_contado numeric,
  diferencia numeric,
  notas_apertura text,
  notas_cierre text,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (cash_register_id, user_id)
    references public.cash_registers(id, user_id)
    on delete restrict,
  check (
    (estado = 'abierta' and cerrada_at is null and efectivo_contado is null and diferencia is null)
    or
    (estado = 'cerrada' and cerrada_at is not null and efectivo_esperado is not null
      and efectivo_contado is not null and diferencia is not null)
  )
);

do $do$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'cash_sessions_id_user_id_unique'
      and conrelid = 'public.cash_sessions'::regclass
  ) then
    alter table public.cash_sessions
      add constraint cash_sessions_id_user_id_unique unique (id, user_id);
  end if;
end;
$do$;

alter table public.movimientos_financieros
  add column if not exists cash_session_id uuid;

do $do$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'movimientos_financieros_cash_session_fk'
      and conrelid = 'public.movimientos_financieros'::regclass
  ) then
    alter table public.movimientos_financieros
      add constraint movimientos_financieros_cash_session_fk
      foreign key (cash_session_id, user_id)
      references public.cash_sessions(id, user_id)
      on delete restrict
      not valid;
  end if;
end;
$do$;

create unique index if not exists uq_open_cash_session_per_register
  on public.cash_sessions(user_id, cash_register_id)
  where estado = 'abierta';

create index if not exists idx_cash_sessions_user_opened
  on public.cash_sessions(user_id, abierta_at desc);
create index if not exists idx_cash_sessions_user_status
  on public.cash_sessions(user_id, estado);
create index if not exists idx_movimientos_cash_session
  on public.movimientos_financieros(user_id, cash_session_id)
  where cash_session_id is not null;

alter table public.cash_registers enable row level security;
alter table public.cash_sessions enable row level security;

drop policy if exists "cash_registers_select_own" on public.cash_registers;
drop policy if exists "cash_registers_insert_own" on public.cash_registers;
drop policy if exists "cash_registers_update_own" on public.cash_registers;
create policy "cash_registers_select_own" on public.cash_registers
  for select using (auth.uid() = user_id);
create policy "cash_registers_insert_own" on public.cash_registers
  for insert with check (auth.uid() = user_id);
create policy "cash_registers_update_own" on public.cash_registers
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "cash_sessions_select_own" on public.cash_sessions;
create policy "cash_sessions_select_own" on public.cash_sessions
  for select using (auth.uid() = user_id);

create or replace function public.open_cash_session(
  opening_amount numeric default 0,
  opening_notes text default null,
  register_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_register_id uuid := register_id;
  v_session_id uuid;
begin
  if v_uid is null then
    raise exception 'Usuario no autenticado';
  end if;
  if coalesce(opening_amount, 0) < 0 then
    raise exception 'El saldo inicial no puede ser negativo';
  end if;

  if v_register_id is null then
    select id into v_register_id
    from public.cash_registers
    where user_id = v_uid and activa = true
    order by created_at
    limit 1;

    if v_register_id is null then
      insert into public.cash_registers(user_id, nombre)
      values (v_uid, 'Caja principal')
      returning id into v_register_id;
    end if;
  elsif not exists (
    select 1 from public.cash_registers
    where id = v_register_id and user_id = v_uid and activa = true
  ) then
    raise exception 'Caja no encontrada o inactiva';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_uid::text), hashtext(v_register_id::text));

  if exists (
    select 1 from public.cash_sessions
    where user_id = v_uid
      and cash_register_id = v_register_id
      and estado = 'abierta'
  ) then
    raise exception 'Esta caja ya tiene una sesión abierta';
  end if;

  insert into public.cash_sessions(
    user_id, cash_register_id, saldo_inicial, notas_apertura
  )
  values (
    v_uid, v_register_id, coalesce(opening_amount, 0), nullif(trim(opening_notes), '')
  )
  returning id into v_session_id;

  return jsonb_build_object(
    'ok', true,
    'session_id', v_session_id,
    'register_id', v_register_id,
    'opening_amount', coalesce(opening_amount, 0),
    'status', 'abierta'
  );
end;
$$;

create or replace function public.attach_cash_session_to_movement()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.cash_session_id is null
    and lower(coalesce(new.medio_pago, '')) = 'efectivo'
  then
    select s.id into new.cash_session_id
    from public.cash_sessions s
    where s.user_id = new.user_id
      and s.estado = 'abierta'
    order by s.abierta_at desc
    limit 1;
  end if;

  if new.cash_session_id is not null and not exists (
    select 1 from public.cash_sessions s
    where s.id = new.cash_session_id
      and s.user_id = new.user_id
      and s.estado = 'abierta'
  ) then
    raise exception 'La sesión de caja no existe, está cerrada o pertenece a otro usuario';
  end if;

  return new;
end;
$$;

drop trigger if exists attach_cash_session_to_movement_trigger
  on public.movimientos_financieros;
create trigger attach_cash_session_to_movement_trigger
before insert or update of cash_session_id, medio_pago
on public.movimientos_financieros
for each row
execute function public.attach_cash_session_to_movement();

create or replace function public.record_cash_adjustment(
  session_id uuid,
  adjustment_type text,
  adjustment_amount numeric,
  adjustment_description text,
  adjustment_date date default current_date
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_session public.cash_sessions%rowtype;
  v_movement_id uuid;
  v_finance_type text;
begin
  if v_uid is null then
    raise exception 'Usuario no autenticado';
  end if;
  if adjustment_type not in ('ingreso', 'retiro', 'gasto') then
    raise exception 'Tipo de movimiento de caja inválido';
  end if;
  if adjustment_amount is null or adjustment_amount <= 0 then
    raise exception 'El monto debe ser mayor a cero';
  end if;
  if nullif(trim(adjustment_description), '') is null then
    raise exception 'Falta la descripción';
  end if;

  select * into v_session
  from public.cash_sessions
  where id = session_id
    and user_id = v_uid
    and estado = 'abierta'
  for update;

  if not found then
    raise exception 'La sesión de caja no existe o ya está cerrada';
  end if;

  v_finance_type := case when adjustment_type = 'ingreso' then 'ingreso' else 'egreso' end;

  insert into public.movimientos_financieros(
    user_id, fecha, descripcion, monto, tipo, medio_pago, categoria, mes, origen,
    cash_session_id
  )
  values (
    v_uid,
    coalesce(adjustment_date, current_date),
    trim(adjustment_description),
    adjustment_amount,
    v_finance_type,
    'efectivo',
    case adjustment_type
      when 'retiro' then 'retiro_caja'
      when 'gasto' then 'gastos'
      else 'ingreso_caja'
    end,
    to_char(coalesce(adjustment_date, current_date), 'YYYY-MM'),
    'caja',
    v_session.id
  )
  returning id into v_movement_id;

  return jsonb_build_object(
    'ok', true,
    'movement_id', v_movement_id,
    'session_id', v_session.id,
    'type', adjustment_type,
    'amount', adjustment_amount
  );
end;
$$;

create or replace function public.get_cash_session_summary(session_id uuid)
returns jsonb
language sql
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'session_id', s.id,
    'status', s.estado,
    'opening_amount', s.saldo_inicial,
    'cash_income', coalesce(sum(m.monto) filter (where m.tipo = 'ingreso'), 0),
    'cash_expense', coalesce(sum(m.monto) filter (where m.tipo = 'egreso'), 0),
    'expected_cash', s.saldo_inicial
      + coalesce(sum(m.monto) filter (where m.tipo = 'ingreso'), 0)
      - coalesce(sum(m.monto) filter (where m.tipo = 'egreso'), 0),
    'movement_count', count(m.id),
    'opened_at', s.abierta_at,
    'closed_at', s.cerrada_at
  )
  from public.cash_sessions s
  left join public.movimientos_financieros m
    on m.cash_session_id = s.id
   and m.user_id = s.user_id
   and lower(coalesce(m.medio_pago, '')) = 'efectivo'
  where s.id = session_id
    and s.user_id = auth.uid()
  group by s.id;
$$;

create or replace function public.close_cash_session(
  session_id uuid,
  counted_cash numeric,
  closing_notes text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_session public.cash_sessions%rowtype;
  v_income numeric;
  v_expense numeric;
  v_expected numeric;
  v_difference numeric;
begin
  if v_uid is null then
    raise exception 'Usuario no autenticado';
  end if;
  if counted_cash is null or counted_cash < 0 then
    raise exception 'El efectivo contado no puede ser negativo';
  end if;

  select * into v_session
  from public.cash_sessions
  where id = session_id
    and user_id = v_uid
    and estado = 'abierta'
  for update;

  if not found then
    raise exception 'La sesión de caja no existe o ya está cerrada';
  end if;

  select
    coalesce(sum(monto) filter (where tipo = 'ingreso'), 0),
    coalesce(sum(monto) filter (where tipo = 'egreso'), 0)
  into v_income, v_expense
  from public.movimientos_financieros
  where cash_session_id = v_session.id
    and user_id = v_uid
    and lower(coalesce(medio_pago, '')) = 'efectivo';

  v_expected := v_session.saldo_inicial + v_income - v_expense;
  v_difference := counted_cash - v_expected;

  update public.cash_sessions
  set
    estado = 'cerrada',
    cerrada_at = now(),
    efectivo_esperado = v_expected,
    efectivo_contado = counted_cash,
    diferencia = v_difference,
    notas_cierre = nullif(trim(closing_notes), '')
  where id = v_session.id
    and user_id = v_uid;

  return jsonb_build_object(
    'ok', true,
    'session_id', v_session.id,
    'status', 'cerrada',
    'opening_amount', v_session.saldo_inicial,
    'cash_income', v_income,
    'cash_expense', v_expense,
    'expected_cash', v_expected,
    'counted_cash', counted_cash,
    'difference', v_difference
  );
end;
$$;

grant execute on function public.open_cash_session(numeric, text, uuid) to authenticated;
grant execute on function public.record_cash_adjustment(uuid, text, numeric, text, date) to authenticated;
grant execute on function public.get_cash_session_summary(uuid) to authenticated;
grant execute on function public.close_cash_session(uuid, numeric, text) to authenticated;

drop trigger if exists capture_audit_event_trigger on public.cash_sessions;
create trigger capture_audit_event_trigger
after insert or update or delete on public.cash_sessions
for each row execute function public.capture_audit_event();
