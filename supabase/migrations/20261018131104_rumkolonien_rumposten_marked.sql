-- Rumkolonien: Rumposten, en markedsplads hvor spillere sælger varer til hinanden.
-- Varerne trækkes fra sælgerens lager, når de sættes til salg. Køberen betaler, og
-- sælgeren henter pengene, næste gang han eller hun spiller.

create table public.market (
  id          bigserial primary key,
  seller_hash text not null references public.colonies(key_hash) on delete cascade,
  item        text not null check (item ~ '^[a-z]{2,20}$'),
  qty         int not null check (qty between 1 and 20),
  price       int not null check (price between 1 and 20000),
  created_at  timestamptz not null default now(),
  buyer_hash  text references public.colonies(key_hash) on delete set null,
  sold_at     timestamptz,
  collected   boolean not null default false
);
create index market_open on public.market (created_at desc) where sold_at is null;
create index market_seller on public.market (seller_hash);
alter table public.market enable row level security;
revoke all on public.market from anon, authenticated;

-- (market_list erstattes af den validerende udgave i 20261018131134)
create or replace function public.market_list(p_key uuid, p_item text, p_qty int, p_price int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  h text := public.rk_hash(p_key);
  n int;
  new_id bigint;
begin
  if not exists (select 1 from public.colonies where key_hash = h) then
    return jsonb_build_object('ok', false, 'reason', 'unknown');
  end if;
  select count(*) into n from public.market where seller_hash = h and sold_at is null;
  if n >= 6 then
    return jsonb_build_object('ok', false, 'reason', 'full');
  end if;
  insert into public.market (seller_hash, item, qty, price) values (h, p_item, p_qty, p_price)
  returning id into new_id;
  return jsonb_build_object('ok', true, 'id', new_id);
end $$;

-- De nyeste 40 aktive annoncer fra andre spillere.
create or replace function public.market_browse(p_key uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x order by created_at desc), '[]'::jsonb) from (
    select m.id, m.item, m.qty, m.price, m.created_at, c.name as seller, c.public_id as seller_id
    from public.market m join public.colonies c on c.key_hash = m.seller_hash
    where m.sold_at is null and m.created_at > now() - interval '2 days'
      and m.seller_hash <> public.rk_hash(p_key)
    order by m.created_at desc
    limit 40
  ) x
$$;

-- Køb en annonce. Kun én køber kan få den.
create or replace function public.market_buy(p_key uuid, p_id bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  h text := public.rk_hash(p_key);
  r record;
begin
  if not exists (select 1 from public.colonies where key_hash = h) then
    return jsonb_build_object('ok', false, 'reason', 'unknown');
  end if;
  update public.market set buyer_hash = h, sold_at = now()
  where id = p_id and sold_at is null and seller_hash <> h and created_at > now() - interval '2 days'
  returning item, qty, price into r;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'gone');
  end if;
  return jsonb_build_object('ok', true, 'item', r.item, 'qty', r.qty, 'price', r.price);
end $$;

-- Dine egne annoncer: aktive, udløbne og solgte, der ikke er hentet.
create or replace function public.market_mine(p_key uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'item', item, 'qty', qty, 'price', price,
           'sold', sold_at is not null, 'expired', sold_at is null and created_at <= now() - interval '2 days',
           'created_at', created_at) order by created_at desc), '[]'::jsonb)
  from public.market
  where seller_hash = public.rk_hash(p_key) and not collected
$$;

-- Hent pengene for solgte varer.
create or replace function public.market_collect(p_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare total int; cnt int;
begin
  with done as (
    update public.market set collected = true
    where seller_hash = public.rk_hash(p_key) and sold_at is not null and not collected
    returning price
  )
  select coalesce(sum(price), 0), count(*) into total, cnt from done;
  return jsonb_build_object('credits', total, 'count', cnt);
end $$;

-- Tag en usolgt vare tilbage (også når annoncen er udløbet).
create or replace function public.market_cancel(p_key uuid, p_id bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  delete from public.market
  where id = p_id and seller_hash = public.rk_hash(p_key) and sold_at is null
  returning item, qty into r;
  if not found then
    return jsonb_build_object('ok', false);
  end if;
  return jsonb_build_object('ok', true, 'item', r.item, 'qty', r.qty);
end $$;

revoke all on function public.market_list(uuid, text, int, int) from public;
revoke all on function public.market_browse(uuid) from public;
revoke all on function public.market_buy(uuid, bigint) from public;
revoke all on function public.market_mine(uuid) from public;
revoke all on function public.market_collect(uuid) from public;
revoke all on function public.market_cancel(uuid, bigint) from public;
grant execute on function public.market_list(uuid, text, int, int) to anon, authenticated;
grant execute on function public.market_browse(uuid) to anon, authenticated;
grant execute on function public.market_buy(uuid, bigint) to anon, authenticated;
grant execute on function public.market_mine(uuid) to anon, authenticated;
grant execute on function public.market_collect(uuid) to anon, authenticated;
grant execute on function public.market_cancel(uuid, bigint) to anon, authenticated;
