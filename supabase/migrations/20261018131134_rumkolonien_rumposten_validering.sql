-- Valider annoncer, før de indsættes, så fejlbeskeder aldrig indeholder sælgerens hash.
create or replace function public.market_list(p_key uuid, p_item text, p_qty int, p_price int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  h text := public.rk_hash(p_key);
  n int;
  new_id bigint;
begin
  if p_item is null or p_item !~ '^[a-z]{2,20}$' or p_qty is null or p_qty not between 1 and 20
     or p_price is null or p_price not between 1 and 20000 then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
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
revoke all on function public.market_list(uuid, text, int, int) from public;
grant execute on function public.market_list(uuid, text, int, int) to anon, authenticated;
