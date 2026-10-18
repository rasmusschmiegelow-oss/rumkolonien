-- Rumkolonien: sky-gemning og ranglister.
-- Klienten kender kun sin hemmelige kolonikode (uuid). Databasen gemmer en sha256-hash af den,
-- og tabellerne kan kun læses og skrives gennem funktionerne nedenfor.

create extension if not exists pgcrypto with schema extensions;

create table public.colonies (
  key_hash   text primary key,
  name       text not null default 'Kolonist' check (char_length(name) between 2 and 20),
  data       jsonb not null,
  level      int not null default 1 check (level between 1 and 99),
  saved_at   bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table public.leaderboard (
  key_hash   text not null references public.colonies(key_hash) on delete cascade,
  board      text not null check (board in ('level', 'arcade', 'medals')),
  score      int not null check (score >= 0),
  updated_at timestamptz not null default now(),
  primary key (key_hash, board)
);
create index leaderboard_board_score on public.leaderboard (board, score desc);

alter table public.colonies enable row level security;
alter table public.leaderboard enable row level security;
-- Ingen policies: direkte adgang er lukket for anon og authenticated.
revoke all on public.colonies, public.leaderboard from anon, authenticated;

create or replace function public.rk_hash(p_key uuid) returns text
language sql immutable set search_path = '' as $$
  select encode(extensions.digest(p_key::text, 'sha256'), 'hex')
$$;

-- Gem kolonien. saved_at er klientens tidsstempel, så en ældre enhed ikke overskriver en nyere gemning.
create or replace function public.save_colony(p_key uuid, p_name text, p_data jsonb, p_level int, p_saved_at bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  h text := public.rk_hash(p_key);
  cur bigint;
begin
  if pg_column_size(p_data) > 300000 then
    raise exception 'Gemningen er for stor';
  end if;
  select saved_at into cur from public.colonies where key_hash = h;
  if cur is not null and cur > p_saved_at then
    return jsonb_build_object('ok', false, 'reason', 'newer', 'saved_at', cur);
  end if;
  insert into public.colonies as c (key_hash, name, data, level, saved_at, updated_at)
  values (h, left(coalesce(nullif(trim(p_name), ''), 'Kolonist'), 20), p_data, least(greatest(p_level, 1), 99), p_saved_at, now())
  on conflict (key_hash) do update
    set name = excluded.name, data = excluded.data, level = excluded.level,
        saved_at = excluded.saved_at, updated_at = now();
  return jsonb_build_object('ok', true, 'saved_at', p_saved_at);
end $$;

create or replace function public.load_colony(p_key uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('name', name, 'data', data, 'level', level, 'saved_at', saved_at, 'updated_at', updated_at)
  from public.colonies where key_hash = public.rk_hash(p_key)
$$;

-- Indsend en score. Kun den bedste gemmes, og urealistiske værdier afvises.
create or replace function public.submit_score(p_key uuid, p_board text, p_score int)
returns void language plpgsql security definer set search_path = '' as $$
declare
  h text := public.rk_hash(p_key);
  max_score int := case p_board when 'level' then 99 when 'arcade' then 400 when 'medals' then 100 else -1 end;
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

-- Top 50 på en rangliste plus din egen placering. Nøgler og hashes sendes aldrig ud.
create or replace function public.get_leaderboard(p_board text, p_key uuid default null)
returns jsonb language sql stable security definer set search_path = '' as $$
  with ranked as (
    select l.key_hash, c.name, l.score,
           rank() over (order by l.score desc, l.updated_at asc) as place
    from public.leaderboard l join public.colonies c using (key_hash)
    where l.board = p_board
  )
  select jsonb_build_object(
    'top', coalesce((select jsonb_agg(jsonb_build_object('place', place, 'name', name, 'score', score,
                       'me', p_key is not null and key_hash = public.rk_hash(p_key)) order by place)
                     from ranked where place <= 50), '[]'::jsonb),
    'me', (select jsonb_build_object('place', place, 'score', score) from ranked
           where p_key is not null and key_hash = public.rk_hash(p_key))
  )
$$;

revoke all on function public.rk_hash(uuid) from public, anon, authenticated;
revoke all on function public.save_colony(uuid, text, jsonb, int, bigint) from public;
revoke all on function public.load_colony(uuid) from public;
revoke all on function public.submit_score(uuid, text, int) from public;
revoke all on function public.get_leaderboard(text, uuid) from public;
grant execute on function public.save_colony(uuid, text, jsonb, int, bigint) to anon, authenticated;
grant execute on function public.load_colony(uuid) to anon, authenticated;
grant execute on function public.submit_score(uuid, text, int) to anon, authenticated;
grant execute on function public.get_leaderboard(text, uuid) to anon, authenticated;
