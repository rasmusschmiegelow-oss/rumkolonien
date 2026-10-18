-- Rumkolonien: naboer (besøg og hjælp) og ugens konkurrence.

-- Et offentligt id, så andre kan besøge kolonien uden at kende den hemmelige kode.
alter table public.colonies add column public_id uuid not null default gen_random_uuid();
alter table public.colonies add constraint colonies_public_id_key unique (public_id);
-- Hjælp fra naboer, der venter på at blive hentet.
alter table public.colonies add column gifts int not null default 0 check (gifts >= 0);

create table public.helps (
  helper_hash text not null references public.colonies(key_hash) on delete cascade,
  target      uuid not null references public.colonies(public_id) on delete cascade,
  day         date not null default current_date,
  primary key (helper_hash, target, day)
);
alter table public.helps enable row level security;
revoke all on public.helps from anon, authenticated;

-- Ugeranglister hedder 'week:ÅÅÅÅ-U'.
alter table public.leaderboard drop constraint leaderboard_board_check;
alter table public.leaderboard add constraint leaderboard_board_check
  check (board in ('level', 'arcade', 'medals') or board ~ '^week:[0-9]{4}-[0-9]{1,2}$');

create or replace function public.submit_score(p_key uuid, p_board text, p_score int)
returns void language plpgsql security definer set search_path = '' as $$
declare
  h text := public.rk_hash(p_key);
  max_score int := case
    when p_board = 'level' then 99
    when p_board = 'arcade' then 400
    when p_board = 'medals' then 100
    when p_board ~ '^week:[0-9]{4}-[0-9]{1,2}$' then 3000
    else -1 end;
begin
  if max_score < 0 or p_score < 0 or p_score > max_score then
    raise exception 'Ugyldig score';
  end if;
  if not exists (select 1 from public.colonies where key_hash = h) then
    raise exception 'Kolonien findes ikke';
  end if;
  insert into public.leaderboard as l (key_hash, board, score, updated_at)
  values (h, p_board, p_score, now())
  on conflict (key_hash, board) do update
    set score = greatest(l.score, excluded.score),
        updated_at = case when excluded.score > l.score then now() else l.updated_at end;
end $$;

-- Ranglisten sender nu også det offentlige id med, så man kan besøge kolonierne.
create or replace function public.get_leaderboard(p_board text, p_key uuid default null)
returns jsonb language sql stable security definer set search_path = '' as $$
  with ranked as (
    select l.key_hash, c.name, c.public_id, l.score,
           rank() over (order by l.score desc, l.updated_at asc) as place
    from public.leaderboard l join public.colonies c using (key_hash)
    where l.board = p_board
  )
  select jsonb_build_object(
    'top', coalesce((select jsonb_agg(jsonb_build_object('place', place, 'name', name, 'score', score, 'id', public_id,
                       'me', p_key is not null and key_hash = public.rk_hash(p_key)) order by place)
                     from ranked where place <= 50), '[]'::jsonb),
    'me', (select jsonb_build_object('place', place, 'score', score) from ranked
           where p_key is not null and key_hash = public.rk_hash(p_key))
  )
$$;

-- Op til 12 tilfældige kolonier, der har været aktive de sidste 14 dage.
create or replace function public.list_neighbors(p_key uuid)
returns jsonb language sql volatile security definer set search_path = '' as $$
  select coalesce(jsonb_agg(n), '[]'::jsonb) from (
    select jsonb_build_object(
      'id', c.public_id, 'name', c.name, 'level', c.level,
      'helped', exists (select 1 from public.helps h where h.helper_hash = public.rk_hash(p_key)
                        and h.target = c.public_id and h.day = current_date)) as n
    from public.colonies c
    where c.key_hash <> public.rk_hash(p_key) and c.updated_at > now() - interval '14 days'
    order by random()
    limit 12
  ) s
$$;

-- Besøg: kun navn, niveau og kortet. Lager, kreditter og koder sendes ikke ud.
create or replace function public.visit_colony(p_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', public_id, 'name', name, 'level', level,
                            'tiles', data->'tiles', 'specials', data->'specials')
  from public.colonies where public_id = p_id
$$;

-- Hjælp en nabo én gang om dagen, højst 10 naboer pr. dag.
create or replace function public.help_colony(p_key uuid, p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  h text := public.rk_hash(p_key);
  n int;
begin
  if not exists (select 1 from public.colonies where key_hash = h) then
    return jsonb_build_object('ok', false, 'reason', 'unknown');
  end if;
  if exists (select 1 from public.colonies where key_hash = h and public_id = p_id) then
    return jsonb_build_object('ok', false, 'reason', 'self');
  end if;
  select count(*) into n from public.helps where helper_hash = h and day = current_date;
  if n >= 10 then
    return jsonb_build_object('ok', false, 'reason', 'limit');
  end if;
  insert into public.helps (helper_hash, target) values (h, p_id) on conflict do nothing;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'already');
  end if;
  update public.colonies set gifts = gifts + 1 where public_id = p_id;
  return jsonb_build_object('ok', true, 'left', 9 - n);
end $$;

-- Hent hjælp fra naboer, og nulstil tælleren.
create or replace function public.claim_gifts(p_key uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare g int;
begin
  update public.colonies c set gifts = 0
  from (select gifts from public.colonies where key_hash = public.rk_hash(p_key) for update) old
  where c.key_hash = public.rk_hash(p_key)
  returning old.gifts into g;
  return coalesce(g, 0);
end $$;

revoke all on function public.list_neighbors(uuid) from public;
revoke all on function public.visit_colony(uuid) from public;
revoke all on function public.help_colony(uuid, uuid) from public;
revoke all on function public.claim_gifts(uuid) from public;
grant execute on function public.list_neighbors(uuid) to anon, authenticated;
grant execute on function public.visit_colony(uuid) to anon, authenticated;
grant execute on function public.help_colony(uuid, uuid) to anon, authenticated;
grant execute on function public.claim_gifts(uuid) to anon, authenticated;
grant execute on function public.submit_score(uuid, text, int) to anon, authenticated;
grant execute on function public.get_leaderboard(text, uuid) to anon, authenticated;
