-- Rumkolonien: fælles terraforming af Mars. Alle spillere bidrager til én måler.

create table public.terraform (
  id         int primary key check (id = 1),
  points     bigint not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.terraform (id, points) values (1, 0);

create table public.terraform_contrib (
  key_hash    text primary key references public.colonies(key_hash) on delete cascade,
  points      bigint not null default 0,
  hour_start  timestamptz not null default now(),
  hour_points int not null default 0,
  updated_at  timestamptz not null default now()
);

alter table public.terraform enable row level security;
alter table public.terraform_contrib enable row level security;
revoke all on public.terraform, public.terraform_contrib from anon, authenticated;

-- Bidrag med varer. Point: ilt 3, vand 1, alger 1, krystal 20. Højst 3000 point pr. koloni pr. time.
create or replace function public.terraform_contribute(p_key uuid, p_ilt int, p_vand int, p_alge int, p_krystal int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  h text := public.rk_hash(p_key);
  pts int;
  c record;
  total bigint;
begin
  if coalesce(p_ilt, -1) not between 0 and 500 or coalesce(p_vand, -1) not between 0 and 500
     or coalesce(p_alge, -1) not between 0 and 500 or coalesce(p_krystal, -1) not between 0 and 50 then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  pts := p_ilt * 3 + p_vand + p_alge + p_krystal * 20;
  if pts <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  if not exists (select 1 from public.colonies where key_hash = h) then
    return jsonb_build_object('ok', false, 'reason', 'unknown');
  end if;
  insert into public.terraform_contrib (key_hash) values (h) on conflict do nothing;
  select * into c from public.terraform_contrib where key_hash = h for update;
  if c.hour_start < now() - interval '1 hour' then
    update public.terraform_contrib set hour_start = now(), hour_points = 0 where key_hash = h;
    c.hour_points := 0;
  end if;
  if c.hour_points + pts > 3000 then
    return jsonb_build_object('ok', false, 'reason', 'limit', 'left', greatest(0, 3000 - c.hour_points));
  end if;
  update public.terraform_contrib
    set points = points + pts, hour_points = hour_points + pts, updated_at = now()
    where key_hash = h;
  update public.terraform set points = points + pts, updated_at = now() where id = 1
    returning points into total;
  return jsonb_build_object('ok', true, 'points', pts, 'total', total, 'mine', c.points + pts);
end $$;

-- Status: hele planetens point, dine egne og de 10 største bidragydere.
create or replace function public.terraform_status(p_key uuid default null)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'total', (select points from public.terraform where id = 1),
    'mine', coalesce((select points from public.terraform_contrib where key_hash = public.rk_hash(p_key)), 0),
    'players', (select count(*) from public.terraform_contrib where points > 0),
    'top', coalesce((select jsonb_agg(jsonb_build_object('name', c.name, 'points', t.points,
                      'me', t.key_hash = public.rk_hash(p_key)) order by t.points desc)
                     from (select * from public.terraform_contrib where points > 0 order by points desc limit 10) t
                     join public.colonies c using (key_hash)), '[]'::jsonb)
  )
$$;

revoke all on function public.terraform_contribute(uuid, int, int, int, int) from public;
revoke all on function public.terraform_status(uuid) from public;
grant execute on function public.terraform_contribute(uuid, int, int, int, int) to anon, authenticated;
grant execute on function public.terraform_status(uuid) to anon, authenticated;
