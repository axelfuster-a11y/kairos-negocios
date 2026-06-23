create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  nombre text not null,
  tipo text not null default 'empleado',
  rol text,
  horas_semanales numeric not null default 0,
  remuneracion_objetivo numeric not null default 0,
  cargas_pct numeric not null default 0,
  comision_pct numeric not null default 0,
  participacion_pct numeric not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (tipo in ('duenio', 'socio', 'empleado', 'colaborador')),
  check (horas_semanales >= 0),
  check (remuneracion_objetivo >= 0),
  check (cargas_pct >= 0 and cargas_pct <= 200),
  check (comision_pct >= 0 and comision_pct <= 100),
  check (participacion_pct >= 0 and participacion_pct <= 100)
);

do $do$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'team_members_id_user_id_unique'
      and conrelid = 'public.team_members'::regclass
  ) then
    alter table public.team_members
      add constraint team_members_id_user_id_unique unique (id, user_id);
  end if;
end;
$do$;

create table if not exists public.team_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reserva_minima numeric not null default 0,
  max_pago_duenio_pct numeric not null default 50,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (reserva_minima >= 0),
  check (max_pago_duenio_pct >= 0 and max_pago_duenio_pct <= 100)
);

create table if not exists public.team_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  team_member_id uuid not null,
  fecha date not null default current_date,
  monto numeric not null,
  tipo text not null default 'sueldo',
  medio_pago text,
  notas text,
  movimiento_financiero_id uuid,
  created_at timestamptz not null default now(),
  foreign key (team_member_id, user_id)
    references public.team_members(id, user_id)
    on delete restrict,
  check (monto > 0),
  check (tipo in ('sueldo', 'honorario', 'bono', 'comision', 'retiro_duenio', 'distribucion_utilidad', 'otro'))
);

create or replace function public.validate_team_ownership_total()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_total numeric;
begin
  perform pg_advisory_xact_lock(hashtext(new.user_id::text), hashtext('team_ownership'));

  select coalesce(sum(participacion_pct), 0)
    into v_total
  from public.team_members
  where user_id = new.user_id
    and id <> new.id;

  if v_total + coalesce(new.participacion_pct, 0) > 100 then
    raise exception using message = 'La participacion societaria total no puede superar 100%';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_team_ownership_total_trigger on public.team_members;
create trigger validate_team_ownership_total_trigger
before insert or update of participacion_pct, user_id on public.team_members
for each row
execute function public.validate_team_ownership_total();

drop trigger if exists set_team_members_updated_at on public.team_members;
create trigger set_team_members_updated_at
before update on public.team_members
for each row
execute function public.set_updated_at();

drop trigger if exists set_team_settings_updated_at on public.team_settings;
create trigger set_team_settings_updated_at
before update on public.team_settings
for each row
execute function public.set_updated_at();

alter table public.team_members enable row level security;
alter table public.team_settings enable row level security;
alter table public.team_payments enable row level security;

drop policy if exists "team_members_select_own" on public.team_members;
drop policy if exists "team_members_insert_own" on public.team_members;
drop policy if exists "team_members_update_own" on public.team_members;
drop policy if exists "team_members_delete_own" on public.team_members;
create policy "team_members_select_own" on public.team_members for select using (auth.uid() = user_id);
create policy "team_members_insert_own" on public.team_members for insert with check (auth.uid() = user_id);
create policy "team_members_update_own" on public.team_members for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "team_members_delete_own" on public.team_members for delete using (auth.uid() = user_id);

drop policy if exists "team_settings_select_own" on public.team_settings;
drop policy if exists "team_settings_insert_own" on public.team_settings;
drop policy if exists "team_settings_update_own" on public.team_settings;
drop policy if exists "team_settings_delete_own" on public.team_settings;
create policy "team_settings_select_own" on public.team_settings for select using (auth.uid() = user_id);
create policy "team_settings_insert_own" on public.team_settings for insert with check (auth.uid() = user_id);
create policy "team_settings_update_own" on public.team_settings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "team_settings_delete_own" on public.team_settings for delete using (auth.uid() = user_id);

drop policy if exists "team_payments_select_own" on public.team_payments;
drop policy if exists "team_payments_insert_own" on public.team_payments;
drop policy if exists "team_payments_update_own" on public.team_payments;
drop policy if exists "team_payments_delete_own" on public.team_payments;
create policy "team_payments_select_own" on public.team_payments for select using (auth.uid() = user_id);
create policy "team_payments_insert_own" on public.team_payments for insert with check (auth.uid() = user_id);
create policy "team_payments_update_own" on public.team_payments for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "team_payments_delete_own" on public.team_payments for delete using (auth.uid() = user_id);

create index if not exists idx_team_members_user_id on public.team_members(user_id);
create index if not exists idx_team_members_user_active on public.team_members(user_id, activo);
create index if not exists idx_team_members_user_tipo on public.team_members(user_id, tipo);
create index if not exists idx_team_payments_user_id on public.team_payments(user_id);
create index if not exists idx_team_payments_member_id on public.team_payments(team_member_id);
create index if not exists idx_team_payments_user_fecha on public.team_payments(user_id, fecha);

create or replace function public.record_team_payment(
  member_id uuid,
  payment_amount numeric,
  payment_type text,
  payment_date date default current_date,
  payment_method text default null,
  payment_notes text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_member public.team_members%rowtype;
  v_payment_id uuid;
  v_movement_id uuid;
  v_description text;
begin
  if v_uid is null then
    raise exception 'Usuario no autenticado';
  end if;
  if payment_amount is null or payment_amount <= 0 then
    raise exception 'El monto debe ser mayor a cero';
  end if;
  if payment_type not in ('sueldo', 'honorario', 'bono', 'comision', 'retiro_duenio', 'distribucion_utilidad', 'otro') then
    raise exception 'Tipo de pago invalido';
  end if;

  select *
    into v_member
  from public.team_members
  where id = member_id
    and user_id = v_uid
    and activo = true
  for update;

  if not found then
    raise exception 'Integrante no encontrado o inactivo';
  end if;
  if payment_type in ('retiro_duenio', 'distribucion_utilidad')
    and v_member.tipo not in ('duenio', 'socio') then
    raise exception 'Los retiros y distribuciones solo corresponden a dueños o socios';
  end if;

  v_description := case payment_type
    when 'retiro_duenio' then 'Retiro del dueño - ' || v_member.nombre
    when 'distribucion_utilidad' then 'Distribución de utilidad - ' || v_member.nombre
    else 'Pago de equipo - ' || v_member.nombre
  end;

  insert into public.movimientos_financieros (
    user_id, fecha, descripcion, monto, tipo, medio_pago, categoria, mes, origen
  )
  values (
    v_uid,
    coalesce(payment_date, current_date),
    v_description,
    payment_amount,
    'egreso',
    nullif(trim(payment_method), ''),
    case
      when payment_type in ('retiro_duenio', 'distribucion_utilidad') then 'retiros_duenio'
      else 'personal'
    end,
    to_char(coalesce(payment_date, current_date), 'YYYY-MM'),
    'equipo'
  )
  returning id into v_movement_id;

  insert into public.team_payments (
    user_id, team_member_id, fecha, monto, tipo, medio_pago, notas, movimiento_financiero_id
  )
  values (
    v_uid,
    v_member.id,
    coalesce(payment_date, current_date),
    payment_amount,
    payment_type,
    nullif(trim(payment_method), ''),
    nullif(trim(payment_notes), ''),
    v_movement_id
  )
  returning id into v_payment_id;

  return jsonb_build_object(
    'ok', true,
    'payment_id', v_payment_id,
    'movement_id', v_movement_id,
    'member_id', v_member.id,
    'amount', payment_amount
  );
end;
$$;

grant execute on function public.record_team_payment(uuid, numeric, text, date, text, text) to authenticated;
