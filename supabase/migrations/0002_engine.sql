-- ============================================================================
--  «مين برّة السالفة»  —  0002 : Game engine (SECURITY DEFINER RPCs)
--
--  Every mutation and every secret lives behind these functions.
--  The client can never read a word it should not know, can never pick its own
--  role, can never vote twice and can never compute the winner locally.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Internal helpers
-- ---------------------------------------------------------------------------
create or replace function public._require_player()
returns uuid
language plpgsql stable security definer set search_path = public
as $$
declare
  v uuid := auth.uid();
begin
  if v is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if not exists (select 1 from public.players p where p.id = v) then
    raise exception 'PROFILE_REQUIRED' using errcode = '28000';
  end if;
  return v;
end;
$$;

create or replace function public._normalize_word(p text)
returns text
language sql immutable
as $$
  select lower(
    btrim(
      regexp_replace(
        translate(
          regexp_replace(coalesce(p, ''), '[\u064B-\u0652\u0640]', '', 'g'),
          'أإآٱىئؤة',
          'ااااييوه'
        ),
        '\s+', ' ', 'g'
      )
    )
  );
$$;

create or replace function public._generate_room_code()
returns text
language plpgsql volatile security definer set search_path = public
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  i int;
begin
  loop
    candidate := '';
    for i in 1..6 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.rooms r where r.code = candidate);
  end loop;
  return candidate;
end;
$$;

create or replace function public._system_message(p_room_id uuid, p_body text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.chat_messages (room_id, player_id, author_name, kind, body)
  values (p_room_id, null, 'النظام', 'system', p_body);
end;
$$;

create or replace function public._touch_room(p_room_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.rooms set last_activity_at = now() where id = p_room_id;
end;
$$;

-- ===========================================================================
-- Bootstrap: create / refresh the guest identity
-- ===========================================================================
create or replace function public.api_bootstrap(p_display_name text, p_avatar text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v uuid := auth.uid();
  v_name text := btrim(coalesce(p_display_name, ''));
  v_player public.players;
begin
  if v is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  if char_length(v_name) < 1 or char_length(v_name) > 24 then
    raise exception 'INVALID_NAME' using errcode = '22023';
  end if;

  insert into public.players (id, display_name, avatar)
  values (v, v_name, coalesce(nullif(p_avatar, ''), 'fox'))
  on conflict (id) do update
    set display_name = excluded.display_name,
        avatar       = excluded.avatar,
        last_seen_at = now()
  returning * into v_player;

  insert into public.player_statistics (player_id) values (v)
  on conflict (player_id) do nothing;

  return to_jsonb(v_player);
end;
$$;

-- ===========================================================================
-- Reference data
-- ===========================================================================
create or replace function public.api_list_categories()
returns table (
  id uuid, slug text, name_ar text, name_darija text,
  emoji text, word_count bigint, difficulty_avg numeric
)
language sql stable security definer set search_path = public
as $$
  select c.id, c.slug, c.name_ar, c.name_darija, c.emoji,
         count(w.id) filter (where w.is_active) as word_count,
         round(avg(w.difficulty) filter (where w.is_active), 2) as difficulty_avg
  from public.categories c
  left join public.words w on w.category_id = c.id
  where c.is_active
  group by c.id
  order by c.sort_order, c.slug;
$$;

create or replace function public.api_leaderboard(p_limit integer default 50)
returns table (
  player_id uuid, display_name text, avatar text,
  games_played integer, wins integer, losses integer,
  score integer, times_outlier integer, outlier_wins integer, correct_votes integer
)
language sql stable security definer set search_path = public
as $$
  select s.player_id, p.display_name, p.avatar,
         s.games_played, s.wins, s.losses,
         s.score, s.times_outlier, s.outlier_wins, s.correct_votes
  from public.player_statistics s
  join public.players p on p.id = s.player_id
  where s.games_played > 0
  order by s.score desc, s.wins desc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

create or replace function public.api_my_stats()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v uuid := public._require_player();
  v jsonb;
begin
  select to_jsonb(s) into v from public.player_statistics s where s.player_id = v;
  return coalesce(v, '{}'::jsonb);
end;
$$;

-- ===========================================================================
-- Rooms: create / list / join / leave
-- ===========================================================================
create or replace function public.api_list_public_rooms()
returns table (
  id uuid, code text, name text, status text,
  player_count bigint, max_players smallint, min_players smallint,
  host_name text, rounds_count smallint, language text
)
language sql stable security definer set search_path = public
as $$
  select r.id, r.code, r.name, r.status,
         (select count(*) from public.room_players rp where rp.room_id = r.id) as player_count,
         r.max_players, r.min_players,
         (select rp.display_name from public.room_players rp
           where rp.room_id = r.id and rp.is_host limit 1) as host_name,
         r.rounds_count, r.language
  from public.rooms r
  where r.is_public
    and r.last_activity_at > now() - interval '2 hours'
  order by (r.status = 'lobby') desc, player_count desc, r.created_at desc
  limit 60;
$$;

create or replace function public.api_create_room(
  p_is_public boolean default false,
  p_name      text    default null,
  p_settings  jsonb   default '{}'::jsonb
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_player uuid := public._require_player();
  v_room public.rooms;
  v_name text := coalesce(nullif(btrim(coalesce(p_name, '')), ''), 'غرفة');
  s jsonb := coalesce(p_settings, '{}'::jsonb);
  v_cats uuid[];
  v_excluded uuid[];
begin
  -- a player may only host one live room at a time
  perform 1 from public.rooms r
   where r.host_id = v_player and r.last_activity_at > now() - interval '2 hours';
  if found then
    delete from public.rooms r
     where r.host_id = v_player
       and r.last_activity_at < now() - interval '2 hours';
  end if;

  v_cats := coalesce(
    (select array_agg((value)::uuid) from jsonb_array_elements_text(s -> 'category_ids')),
    '{}'::uuid[]
  );
  v_excluded := coalesce(
    (select array_agg((value)::uuid) from jsonb_array_elements_text(s -> 'excluded_category_ids')),
    '{}'::uuid[]
  );

  insert into public.rooms (
    code, name, host_id, is_public,
    min_players, max_players, outliers_count, rounds_count,
    clue_seconds, discussion_seconds, vote_seconds, guess_seconds, result_seconds, reveal_seconds,
    word_mode, language, category_ids, excluded_category_ids, allow_chat, allow_mid_game_join
  ) values (
    public._generate_room_code(),
    left(v_name, 40),
    v_player,
    coalesce(p_is_public, false),
    coalesce(nullif(s->>'min_players','')::smallint, 3),
    coalesce(nullif(s->>'max_players','')::smallint, 10),
    coalesce(nullif(s->>'outliers_count','')::smallint, 1),
    coalesce(nullif(s->>'rounds_count','')::smallint, 3),
    coalesce(nullif(s->>'clue_seconds','')::smallint, 40),
    coalesce(nullif(s->>'discussion_seconds','')::smallint, 45),
    coalesce(nullif(s->>'vote_seconds','')::smallint, 45),
    coalesce(nullif(s->>'guess_seconds','')::smallint, 30),
    coalesce(nullif(s->>'result_seconds','')::smallint, 15),
    coalesce(nullif(s->>'reveal_seconds','')::smallint, 12),
    coalesce(nullif(s->>'word_mode',''), 'random'),
    coalesce(nullif(s->>'language',''), 'mixed'),
    v_cats,
    v_excluded,
    coalesce((s->>'allow_chat')::boolean, true),
    coalesce((s->>'allow_mid_game_join')::boolean, false)
  )
  returning * into v_room;

  insert into public.room_players (room_id, player_id, display_name, avatar, is_host, seat)
  select v_room.id, p.id, p.display_name, p.avatar, true,
         coalesce((select max(rp.seat) + 1 from public.room_players rp where rp.room_id = v_room.id), 0)
  from public.players p where p.id = v_player;

  perform public._system_message(v_room.id, 'أُنشئت الغرفة — شارك الرمز ' || v_room.code);

  return to_jsonb(v_room);
end;
$$;

create or replace function public._join_room(p_room public.rooms)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_player uuid := public._require_player();
  v_count int;
  v_profile public.players;
begin
  select * into v_profile from public.players where id = v_player;

  if exists (select 1 from public.room_players rp where rp.room_id = p_room.id and rp.player_id = v_player) then
    update public.room_players
       set is_connected = true, last_seen_at = now(), display_name = v_profile.display_name, avatar = v_profile.avatar
     where room_id = p_room.id and player_id = v_player;
    perform public._touch_room(p_room.id);
    return to_jsonb(p_room);
  end if;

  if p_room.status <> 'lobby' and not p_room.allow_mid_game_join then
    raise exception 'GAME_IN_PROGRESS' using errcode = 'P0001';
  end if;

  select count(*) into v_count from public.room_players rp where rp.room_id = p_room.id;
  if v_count >= p_room.max_players then
    raise exception 'ROOM_FULL' using errcode = 'P0001';
  end if;

  insert into public.room_players (room_id, player_id, display_name, avatar, is_host, seat)
  values (p_room.id, v_player, v_profile.display_name, v_profile.avatar, false,
          coalesce((select max(rp.seat) + 1 from public.room_players rp where rp.room_id = p_room.id), 0));

  perform public._system_message(p_room.id, v_profile.display_name || ' انضم إلى الغرفة');
  perform public._touch_room(p_room.id);

  -- late joiners of an in-progress game get a scoreboard row
  if p_room.status = 'playing' then
    insert into public.game_players (game_id, room_id, player_id)
    select g.id, g.room_id, v_player
    from public.games g
    where g.room_id = p_room.id and g.status = 'playing'
    on conflict (game_id, player_id) do nothing;
  end if;

  return to_jsonb(p_room);
end;
$$;

create or replace function public.api_join_room_by_code(p_code text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_room public.rooms;
begin
  select * into v_room from public.rooms where upper(btrim(p_code)) = code;
  if v_room.id is null then
    raise exception 'ROOM_NOT_FOUND' using errcode = 'P0001';
  end if;
  return public._join_room(v_room);
end;
$$;

create or replace function public.api_join_room(p_room_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_room public.rooms;
begin
  select * into v_room from public.rooms where id = p_room_id;
  if v_room.id is null then
    raise exception 'ROOM_NOT_FOUND' using errcode = 'P0001';
  end if;
  return public._join_room(v_room);
end;
$$;

create or replace function public.api_join_random_room()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_room public.rooms;
begin
  select r.* into v_room
  from public.rooms r
  where r.is_public
    and r.last_activity_at > now() - interval '2 hours'
    and (select count(*) from public.room_players rp where rp.room_id = r.id) < r.max_players
  order by (r.status = 'lobby') desc, random()
  limit 1;

  if v_room.id is null then
    raise exception 'NO_PUBLIC_ROOM' using errcode = 'P0001';
  end if;

  return public._join_room(v_room);
end;
$$;

create or replace function public.api_leave_room(p_room_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_player uuid := public._require_player();
  v_was_host boolean;
  v_next uuid;
  v_left int;
begin
  select rp.is_host into v_was_host
  from public.room_players rp where rp.room_id = p_room_id and rp.player_id = v_player;

  if v_was_host is null then
    return;
  end if;

  delete from public.room_players rp where rp.room_id = p_room_id and rp.player_id = v_player;

  select count(*) into v_left from public.room_players rp where rp.room_id = p_room_id;

  if v_left = 0 then
    delete from public.rooms r where r.id = p_room_id;
    return;
  end if;

  if v_was_host then
    select rp.player_id into v_next
    from public.room_players rp where rp.room_id = p_room_id
    order by rp.joined_at asc limit 1;

    update public.room_players rp set is_host = true where rp.room_id = p_room_id and rp.player_id = v_next;
    update public.rooms r set host_id = v_next where r.id = p_room_id;
    perform public._system_message(p_room_id, 'انتقلت صلاحيات المضيف إلى لاعب آخر');
  end if;

  -- if the game can no longer continue, roll the room back to the lobby
  if exists (select 1 from public.rooms r where r.id = p_room_id and r.status = 'playing') then
    if v_left < (select r.min_players from public.rooms r where r.id = p_room_id) then
      update public.games g set status = 'finished', ended_at = now(), winner = 'draw'
       where g.room_id = p_room_id and g.status = 'playing';
      update public.rooms r set status = 'lobby' where r.id = p_room_id;
      perform public._system_message(p_room_id, 'توقفت المباراة: عدد اللاعبين لم يعد كافيًا');
    end if;
  end if;

  perform public._touch_room(p_room_id);
end;
$$;

create or replace function public.api_kick_player(p_room_id uuid, p_player_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public._require_player();
  if not public.is_room_host(p_room_id) then
    raise exception 'NOT_HOST' using errcode = '42501';
  end if;
  if p_player_id = auth.uid() then
    raise exception 'CANNOT_KICK_SELF' using errcode = 'P0001';
  end if;
  delete from public.room_players rp where rp.room_id = p_room_id and rp.player_id = p_player_id;
  perform public._touch_room(p_room_id);
end;
$$;

create or replace function public.api_transfer_host(p_room_id uuid, p_player_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public._require_player();
  if not public.is_room_host(p_room_id) then
    raise exception 'NOT_HOST' using errcode = '42501';
  end if;
  if not exists (select 1 from public.room_players rp where rp.room_id = p_room_id and rp.player_id = p_player_id) then
    raise exception 'PLAYER_NOT_IN_ROOM' using errcode = 'P0001';
  end if;
  update public.room_players rp set is_host = false where rp.room_id = p_room_id;
  update public.room_players rp set is_host = true  where rp.room_id = p_room_id and rp.player_id = p_player_id;
  update public.rooms r set host_id = p_player_id where r.id = p_room_id;
  perform public._system_message(p_room_id, 'تم نقل صلاحيات المضيف');
end;
$$;

-- ===========================================================================
-- Lobby settings / readiness / presence
-- ===========================================================================
create or replace function public.api_update_settings(p_room_id uuid, p_settings jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_room public.rooms;
  s jsonb := coalesce(p_settings, '{}'::jsonb);
  v_cats uuid[];
  v_excluded uuid[];
begin
  perform public._require_player();
  if not public.is_room_host(p_room_id) then
    raise exception 'NOT_HOST' using errcode = '42501';
  end if;

  select * into v_room from public.rooms where id = p_room_id;
  if v_room.status <> 'lobby' then
    raise exception 'ROOM_NOT_IN_LOBBY' using errcode = 'P0001';
  end if;

  v_cats := case when s ? 'category_ids'
    then coalesce((select array_agg((value)::uuid) from jsonb_array_elements_text(s -> 'category_ids')), '{}'::uuid[])
    else v_room.category_ids end;
  v_excluded := case when s ? 'excluded_category_ids'
    then coalesce((select array_agg((value)::uuid) from jsonb_array_elements_text(s -> 'excluded_category_ids')), '{}'::uuid[])
    else v_room.excluded_category_ids end;

  update public.rooms r set
    name             = coalesce(nullif(btrim(coalesce(s->>'name', '')), ''), r.name),
    is_public        = coalesce((s->>'is_public')::boolean, r.is_public),
    min_players      = coalesce(nullif(s->>'min_players','')::smallint, r.min_players),
    max_players      = coalesce(nullif(s->>'max_players','')::smallint, r.max_players),
    outliers_count   = coalesce(nullif(s->>'outliers_count','')::smallint, r.outliers_count),
    rounds_count     = coalesce(nullif(s->>'rounds_count','')::smallint, r.rounds_count),
    clue_seconds     = coalesce(nullif(s->>'clue_seconds','')::smallint, r.clue_seconds),
    discussion_seconds = coalesce(nullif(s->>'discussion_seconds','')::smallint, r.discussion_seconds),
    vote_seconds     = coalesce(nullif(s->>'vote_seconds','')::smallint, r.vote_seconds),
    guess_seconds    = coalesce(nullif(s->>'guess_seconds','')::smallint, r.guess_seconds),
    result_seconds   = coalesce(nullif(s->>'result_seconds','')::smallint, r.result_seconds),
    reveal_seconds   = coalesce(nullif(s->>'reveal_seconds','')::smallint, r.reveal_seconds),
    word_mode        = coalesce(nullif(s->>'word_mode',''), r.word_mode),
    language         = coalesce(nullif(s->>'language',''), r.language),
    category_ids     = v_cats,
    excluded_category_ids = v_excluded,
    allow_chat       = coalesce((s->>'allow_chat')::boolean, r.allow_chat),
    allow_mid_game_join = coalesce((s->>'allow_mid_game_join')::boolean, r.allow_mid_game_join),
    last_activity_at = now()
  where r.id = p_room_id
  returning * into v_room;

  return to_jsonb(v_room);
end;
$$;

create or replace function public.api_set_ready(p_room_id uuid, p_ready boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_player uuid := public._require_player();
begin
  if not public.is_room_member(p_room_id) then
    raise exception 'NOT_MEMBER' using errcode = '42501';
  end if;
  update public.room_players rp
     set is_ready = coalesce(p_ready, false), last_seen_at = now()
   where rp.room_id = p_room_id and rp.player_id = v_player;
  perform public._touch_room(p_room_id);
end;
$$;

create or replace function public.api_heartbeat(p_room_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_player uuid := public._require_player();
begin
  if not public.is_room_member(p_room_id) then
    return;
  end if;
  update public.room_players rp
     set is_connected = true, last_seen_at = now()
   where rp.room_id = p_room_id and rp.player_id = v_player;

  -- presence sweep for the same room (cheap, bounded)
  update public.room_players rp
     set is_connected = (rp.last_seen_at > now() - interval '25 seconds')
   where rp.room_id = p_room_id and rp.is_connected is distinct from (rp.last_seen_at > now() - interval '25 seconds');

  perform public._touch_room(p_room_id);
end;
$$;

create or replace function public.api_cleanup()
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_deleted int;
begin
  with gone as (
    delete from public.rooms r
    where r.last_activity_at < now() - interval '3 hours'
       or (not exists (select 1 from public.room_players rp where rp.room_id = r.id))
    returning 1
  )
  select count(*) into v_deleted from gone;
  return v_deleted;
end;
$$;

-- ===========================================================================
-- Game start
-- ===========================================================================
create or replace function public._start_round(p_game_id uuid, p_round_number smallint)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_game    public.games;
  v_room    public.rooms;
  v_players uuid[];
  v_order   uuid[];
  v_outliers uuid[];
  v_n       int;
  v_cats    uuid[];
  v_word    record;
  v_lang    text;
  v_text    text;
  v_alt     text;
  v_round   uuid;
  v_names   text;
begin
  select * into v_game from public.games where id = p_game_id;
  if v_game.id is null then
    raise exception 'GAME_NOT_FOUND' using errcode = 'P0001';
  end if;
  select * into v_room from public.rooms where id = v_game.room_id;

  select array_agg(gp.player_id) into v_players
  from public.game_players gp where gp.game_id = p_game_id;

  if coalesce(array_length(v_players, 1), 0) < 3 then
    raise exception 'NOT_ENOUGH_PLAYERS' using errcode = 'P0001';
  end if;

  -- allowed categories
  if v_room.word_mode = 'specific' and coalesce(array_length(v_room.category_ids, 1), 0) > 0 then
    v_cats := v_room.category_ids;
  else
    select coalesce(array_agg(c.id), '{}'::uuid[]) into v_cats
    from public.categories c where c.is_active;
  end if;

  if coalesce(array_length(v_room.excluded_category_ids, 1), 0) > 0 then
    v_cats := array(select x from unnest(v_cats) x
                    where not (x = any (v_room.excluded_category_ids)));
  end if;

  if coalesce(array_length(v_cats, 1), 0) = 0 then
    raise exception 'NO_CATEGORIES' using errcode = 'P0001';
  end if;

  -- pick an unused word
  select w.id, w.text_ar, w.text_darija, w.category_id into v_word
  from public.words w
  where w.is_active
    and w.category_id = any (v_cats)
    and not (w.id = any (v_game.used_word_ids))
  order by random()
  limit 1;

  if v_word.id is null then
    select w.id, w.text_ar, w.text_darija, w.category_id into v_word
    from public.words w
    where w.is_active and w.category_id = any (v_cats)
    order by random() limit 1;
  end if;

  if v_word.id is null then
    raise exception 'NO_WORDS_AVAILABLE' using errcode = 'P0001';
  end if;

  v_lang := v_room.language;
  if v_lang = 'mixed' then
    v_lang := case when random() < 0.5 then 'ar' else 'darija' end;
  end if;
  if v_lang = 'ar' then
    v_text := v_word.text_ar;
    v_alt  := v_word.text_darija;
  else
    v_text := coalesce(nullif(v_word.text_darija, ''), v_word.text_ar);
    v_alt  := v_word.text_ar;
  end if;

  -- speaker order + outliers (shuffled independently)
  v_order := v_players;
  select array_agg(x order by random()) into v_order from unnest(v_order) x;

  v_n := least(v_room.outliers_count, greatest(1, coalesce(array_length(v_players, 1), 3) - 2));
  select array_agg(x) into v_outliers from unnest(v_order) with ordinality as t(x, i) where i <= v_n;

  insert into public.game_rounds (
    game_id, room_id, round_number, phase, phase_ends_at, speaking_order
  ) values (
    p_game_id, v_room.id, p_round_number, 'reveal',
    now() + make_interval(secs => v_room.reveal_seconds),
    v_order
  ) returning id into v_round;

  insert into public.round_secrets (round_id, word_id, category_id, word_text, word_text_alt, language)
  values (v_round, v_word.id, v_word.category_id, v_text, v_alt, v_lang);

  insert into public.player_roles (round_id, player_id, role, word_text)
  select v_round, p,
         case when p = any (v_outliers) then 'outlier' else 'civilian' end,
         case when p = any (v_outliers) then null else v_text end
  from unnest(v_players) as p;

  update public.games g
     set current_round = p_round_number,
         used_word_ids = array_append(g.used_word_ids, v_word.id)
   where g.id = p_game_id;

  update public.game_players gp
     set times_outlier = gp.times_outlier + 1
   where gp.game_id = p_game_id and gp.player_id = any (v_outliers);

  select string_agg('«' || rp.display_name || '»', ' ← ' order by t.i)
    into v_names
  from unnest(v_order) with ordinality as t(pid, i)
  join public.room_players rp on rp.room_id = v_room.id and rp.player_id = t.pid;

  perform public._system_message(v_room.id, 'الجولة ' || p_round_number || ' — اطّلعوا على كلماتكم السرية');
  perform public._system_message(v_room.id, 'ترتيب التلميحات: ' || coalesce(v_names, ''));

  return v_round;
end;
$$;

create or replace function public.api_start_game(p_room_id uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_player uuid := public._require_player();
  v_room   public.rooms;
  v_count  int;
  v_game   uuid;
  v_round  uuid;
begin
  if not public.is_room_host(p_room_id) then
    raise exception 'NOT_HOST' using errcode = '42501';
  end if;

  select * into v_room from public.rooms where id = p_room_id;
  if v_room.id is null then raise exception 'ROOM_NOT_FOUND' using errcode = 'P0001'; end if;
  if v_room.status = 'playing' then raise exception 'ALREADY_PLAYING' using errcode = 'P0001'; end if;

  select count(*) into v_count from public.room_players rp where rp.room_id = p_room_id;
  if v_count < v_room.min_players then
    raise exception 'NOT_ENOUGH_PLAYERS' using errcode = 'P0001';
  end if;
  if v_count > v_room.max_players then
    raise exception 'TOO_MANY_PLAYERS' using errcode = 'P0001';
  end if;
  if v_room.outliers_count > v_count - 2 then
    raise exception 'TOO_MANY_OUTLIERS' using errcode = 'P0001';
  end if;

  -- close any previous game
  update public.games g set status = 'finished', ended_at = now(), winner = coalesce(g.winner, 'draw')
   where g.room_id = p_room_id and g.status = 'playing';

  insert into public.games (room_id, status, current_round, total_rounds, settings)
  values (
    p_room_id, 'playing', 1, v_room.rounds_count,
    jsonb_build_object(
      'outliers_count', v_room.outliers_count,
      'rounds_count', v_room.rounds_count,
      'language', v_room.language,
      'word_mode', v_room.word_mode
    )
  ) returning id into v_game;

  insert into public.game_players (game_id, room_id, player_id)
  select v_game, p_room_id, rp.player_id from public.room_players rp where rp.room_id = p_room_id
  on conflict (game_id, player_id) do nothing;

  update public.room_players rp set score = 0, is_ready = false where rp.room_id = p_room_id;
  update public.rooms r set status = 'playing', last_activity_at = now() where r.id = p_room_id;

  perform public._system_message(p_room_id, 'بدأت المباراة — ' || v_room.rounds_count || ' جولات');

  v_round := public._start_round(v_game, 1);
  return v_game;
end;
$$;

create or replace function public.api_restart_game(p_room_id uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
begin
  perform public._require_player();
  if not public.is_room_host(p_room_id) then
    raise exception 'NOT_HOST' using errcode = '42501';
  end if;

  update public.games g set status = 'finished', ended_at = now(), winner = coalesce(g.winner, 'draw')
   where g.room_id = p_room_id and g.status = 'playing';

  update public.rooms r set status = 'lobby', last_activity_at = now() where r.id = p_room_id;
  update public.room_players rp set score = 0, is_ready = false where rp.room_id = p_room_id;

  return public.api_start_game(p_room_id);
end;
$$;

create or replace function public.api_stop_game(p_room_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public._require_player();
  if not public.is_room_host(p_room_id) then
    raise exception 'NOT_HOST' using errcode = '42501';
  end if;

  update public.game_rounds gr set phase = 'result', phase_ends_at = null
   where gr.game_id in (select g.id from public.games g where g.room_id = p_room_id and g.status = 'playing');

  update public.games g set status = 'finished', ended_at = now(), winner = 'draw'
   where g.room_id = p_room_id and g.status = 'playing';

  update public.rooms r set status = 'lobby' where r.id = p_room_id;
  update public.room_players rp set score = 0, is_ready = false where rp.room_id = p_room_id;
  perform public._system_message(p_room_id, 'أوقف المضيف المباراة');
end;
$$;

-- ===========================================================================
-- Round: role confirmation, clues, votes, guess, phase machine
-- ===========================================================================
create or replace function public.api_my_role(p_round_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_player uuid := public._require_player();
  v jsonb;
begin
  if not public.is_round_visible(p_round_id) then
    raise exception 'NOT_MEMBER' using errcode = '42501';
  end if;
  select to_jsonb(pr) - 'id' into v
  from public.player_roles pr
  where pr.round_id = p_round_id and pr.player_id = v_player;
  return v;
end;
$$;

create or replace function public.api_confirm_role(p_round_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_player uuid := public._require_player();
  v_room uuid;
  v_changed int;
  v_total int;
  v_conf int;
begin
  select gr.room_id into v_room from public.game_rounds gr where gr.id = p_round_id;
  if v_room is null or not public.is_room_member(v_room) then
    raise exception 'NOT_MEMBER' using errcode = '42501';
  end if;

  update public.player_roles pr set confirmed = true
   where pr.round_id = p_round_id and pr.player_id = v_player and not pr.confirmed;
  get diagnostics v_changed = row_count;

  if v_changed > 0 then
    update public.game_rounds gr set confirmed_count = gr.confirmed_count + 1 where gr.id = p_round_id;
  end if;

  select count(*) into v_total from public.player_roles pr where pr.round_id = p_round_id;
  select gr.confirmed_count into v_conf from public.game_rounds gr where gr.id = p_round_id;

  if v_conf >= v_total then
    perform public.api_advance(p_round_id, false);
  end if;
end;
$$;

create or replace function public._turn_player(p_round_id uuid)
returns uuid
language sql stable security definer set search_path = public
as $$
  select gr.speaking_order[gr.current_turn + 1] from public.game_rounds gr where gr.id = p_round_id;
$$;

create or replace function public.api_submit_clue(p_round_id uuid, p_text text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_player uuid := public._require_player();
  v_round  public.game_rounds;
  v_body   text := btrim(coalesce(p_text, ''));
  v_secret text;
  v_next   int;
  v_room   public.rooms;
begin
  select * into v_round from public.game_rounds where id = p_round_id;
  if v_round.id is null or not public.is_room_member(v_round.room_id) then
    raise exception 'NOT_MEMBER' using errcode = '42501';
  end if;
  if v_round.phase <> 'clues' then
    raise exception 'WRONG_PHASE' using errcode = 'P0001';
  end if;
  if public._turn_player(p_round_id) is distinct from v_player then
    raise exception 'NOT_YOUR_TURN' using errcode = 'P0001';
  end if;
  if char_length(v_body) < 1 or char_length(v_body) > 60 then
    raise exception 'INVALID_CLUE' using errcode = '22023';
  end if;

  select rs.word_text into v_secret from public.round_secrets rs where rs.round_id = p_round_id;
  if v_secret is not null and public._normalize_word(v_body) = public._normalize_word(v_secret) then
    raise exception 'CLUE_REVEALS_WORD' using errcode = 'P0001';
  end if;

  insert into public.clues (round_id, room_id, player_id, body, turn_index)
  values (p_round_id, v_round.room_id, v_player, left(v_body, 60), v_round.current_turn);

  v_next := v_round.current_turn + 1;
  select * into v_room from public.rooms where id = v_round.room_id;

  if v_next >= coalesce(array_length(v_round.speaking_order, 1), 0) then
    update public.game_rounds gr
       set current_turn = v_next, phase = 'discussion',
           phase_ends_at = now() + make_interval(secs => v_room.discussion_seconds)
     where gr.id = p_round_id;
    perform public._system_message(v_round.room_id, 'انتهت التلميحات — ابدأ النقاش');
    if v_room.discussion_seconds <= 0 then
      perform public.api_advance(p_round_id, true);
    end if;
  else
    update public.game_rounds gr
       set current_turn = v_next,
           phase_ends_at = now() + make_interval(secs => v_room.clue_seconds)
     where gr.id = p_round_id;
  end if;

  perform public._touch_room(v_round.room_id);
end;
$$;

create or replace function public.api_cast_vote(p_round_id uuid, p_target_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_player uuid := public._require_player();
  v_round  public.game_rounds;
  v_total  int;
begin
  select * into v_round from public.game_rounds where id = p_round_id;
  if v_round.id is null or not public.is_room_member(v_round.room_id) then
    raise exception 'NOT_MEMBER' using errcode = '42501';
  end if;
  if v_round.phase <> 'voting' then
    raise exception 'WRONG_PHASE' using errcode = 'P0001';
  end if;
  if p_target_id is null then
    raise exception 'INVALID_TARGET' using errcode = '22023';
  end if;
  if p_target_id = v_player then
    raise exception 'CANNOT_VOTE_SELF' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.player_roles pr
    where pr.round_id = p_round_id and pr.player_id = p_target_id
  ) then
    raise exception 'INVALID_TARGET' using errcode = '22023';
  end if;

  insert into public.votes (round_id, room_id, voter_id, target_id)
  values (p_round_id, v_round.room_id, v_player, p_target_id);

  update public.game_rounds gr set votes_count = gr.votes_count + 1 where gr.id = p_round_id;

  select count(*) into v_total from public.player_roles pr where pr.round_id = p_round_id;

  if v_round.votes_count + 1 >= v_total then
    perform public._tally_votes(p_round_id);
  end if;

  perform public._touch_room(v_round.room_id);
end;
$$;

create or replace function public._tally_votes(p_round_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_round public.game_rounds;
  v_room  public.rooms;
  v_top   uuid;
  v_best  bigint;
  v_tied  boolean;
  v_role  text;
  v_name  text;
begin
  select * into v_round from public.game_rounds where id = p_round_id;
  if v_round.id is null or v_round.phase <> 'voting' then
    return;
  end if;
  select * into v_room from public.rooms where id = v_round.room_id;

  -- top target + whether that top score is shared (-> tie)
  select t.target_id, t.c
    into v_top, v_best
  from (
    select v.target_id, count(*) as c
    from public.votes v
    where v.round_id = p_round_id
    group by v.target_id
  ) t
  order by t.c desc
  limit 1;

  if v_top is null then
    perform public._system_message(v_round.room_id, 'لم يصوّت أحد — تنتقل الجولة بدون حسم');
    perform public._end_round(p_round_id, 'skip', null);
    return;
  end if;

  select count(*) > 1 into v_tied
  from (
    select v2.target_id, count(*) as c
    from public.votes v2
    where v2.round_id = p_round_id
    group by v2.target_id
  ) g
  where g.c = v_best;

  select rp.display_name into v_name from public.room_players rp
   where rp.room_id = v_round.room_id and rp.player_id = v_top;

  if v_tied then
    perform public._system_message(v_round.room_id, 'تعادل في التصويت — لا حسم في هذه الجولة');
    perform public._end_round(p_round_id, 'skip', null);
    return;
  end if;

  select pr.role into v_role from public.player_roles pr
   where pr.round_id = p_round_id and pr.player_id = v_top;

  perform public._system_message(v_round.room_id, 'أكثر اللاعبين تصويتًا: «' || coalesce(v_name, '?') || '»');

  if v_role = 'outlier' then
    update public.game_rounds gr
       set accused_id = v_top, phase = 'guess',
           phase_ends_at = now() + make_interval(secs => v_room.guess_seconds)
     where gr.id = p_round_id;
    perform public._system_message(v_round.room_id, 'تم كشف خارج السالفة! لديه فرصة أخيرة لتخمين الكلمة');
  else
    perform public._end_round(p_round_id, 'outliers', v_top);
  end if;
end;
$$;

create or replace function public.api_submit_guess(p_round_id uuid, p_guess text)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_player uuid := public._require_player();
  v_round  public.game_rounds;
  v_secret text;
  v_ok     boolean;
  v_role   text;
begin
  select * into v_round from public.game_rounds where id = p_round_id;
  if v_round.id is null or not public.is_room_member(v_round.room_id) then
    raise exception 'NOT_MEMBER' using errcode = '42501';
  end if;
  if v_round.phase <> 'guess' then
    raise exception 'WRONG_PHASE' using errcode = 'P0001';
  end if;

  select pr.role into v_role from public.player_roles pr
   where pr.round_id = p_round_id and pr.player_id = v_player;
  if v_role <> 'outlier' then
    raise exception 'NOT_OUTLIER' using errcode = '42501';
  end if;

  select rs.word_text into v_secret from public.round_secrets rs where rs.round_id = p_round_id;
  v_ok := public._normalize_word(coalesce(p_guess, '')) = public._normalize_word(v_secret);

  update public.game_rounds gr
     set outlier_guess = left(coalesce(p_guess, ''), 60),
         outlier_guessed_correctly = v_ok
   where gr.id = p_round_id;

  perform public._end_round(p_round_id, case when v_ok then 'outliers' else 'civilians' end, v_round.accused_id);
  return v_ok;
end;
$$;

-- ---------------------------------------------------------------------------
-- Phase machine — driven by the client clock, but validated server side.
-- `p_force` is only honoured for the host.
-- ---------------------------------------------------------------------------
create or replace function public.api_advance(p_round_id uuid, p_force boolean default false)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_player uuid := public._require_player();
  v_round  public.game_rounds;
  v_room   public.rooms;
  v_host   boolean;
  v_next   int;
  v_order  uuid[];
  v_me     uuid;
  v_guess  text;
  v_secret text;
  v_ok     boolean;
begin
  select * into v_round from public.game_rounds where id = p_round_id;
  if v_round.id is null then
    raise exception 'ROUND_NOT_FOUND' using errcode = 'P0001';
  end if;
  if not public.is_room_member(v_round.room_id) then
    raise exception 'NOT_MEMBER' using errcode = '42501';
  end if;

  select * into v_room from public.rooms where id = v_round.room_id;
  v_host := public.is_room_host(v_round.room_id);

  if p_force and not v_host then
    raise exception 'NOT_HOST' using errcode = '42501';
  end if;

  -- non-host callers may only advance an expired phase
  if not v_host and v_round.phase <> 'result'
     and v_round.phase_ends_at is not null and now() < v_round.phase_ends_at then
    return;
  end if;

  case v_round.phase
    when 'reveal' then
      update public.game_rounds gr
         set phase = 'clues', current_turn = 0,
             phase_ends_at = now() + make_interval(secs => v_room.clue_seconds)
       where gr.id = p_round_id;

    when 'clues' then
      v_order := v_round.speaking_order;
      v_next := v_round.current_turn + 1;
      if v_next >= coalesce(array_length(v_order, 1), 0) then
        update public.game_rounds gr
           set current_turn = v_next, phase = 'discussion',
               phase_ends_at = now() + make_interval(secs => v_room.discussion_seconds)
         where gr.id = p_round_id;
        perform public._system_message(v_round.room_id, 'انتهت التلميحات — ابدأ النقاش');
        if v_room.discussion_seconds <= 0 then
          update public.game_rounds gr
             set phase = 'voting', votes_count = 0,
                 phase_ends_at = now() + make_interval(secs => v_room.vote_seconds)
           where gr.id = p_round_id;
        end if;
      else
        update public.game_rounds gr
           set current_turn = v_next,
               phase_ends_at = now() + make_interval(secs => v_room.clue_seconds)
         where gr.id = p_round_id;
      end if;

    when 'discussion' then
      update public.game_rounds gr
         set phase = 'voting', votes_count = 0,
             phase_ends_at = now() + make_interval(secs => v_room.vote_seconds)
       where gr.id = p_round_id;
      perform public._system_message(v_round.room_id, 'بدأ التصويت');

    when 'voting' then
      perform public._tally_votes(p_round_id);

    when 'guess' then
      -- the outlier ran out of time
      select rs.word_text into v_secret from public.round_secrets rs where rs.round_id = p_round_id;
      update public.game_rounds gr
         set outlier_guess = coalesce(gr.outlier_guess, ''),
             outlier_guessed_correctly = false
       where gr.id = p_round_id;
      perform public._end_round(p_round_id, 'civilians', v_round.accused_id);

    when 'result' then
      -- _end_round keeps the round alive during the result screen; here we move on
      perform public._close_round(p_round_id);

    else
      return;
  end case;

  perform public._touch_room(v_round.room_id);
end;
$$;

-- ===========================================================================
-- Round resolution + scoring
-- ===========================================================================
create or replace function public._end_round(p_round_id uuid, p_outcome text, p_accused uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_round public.game_rounds;
  v_room  public.rooms;
  v_secret public.round_secrets;
  v_cat   public.categories;
  v_acc_name text;
begin
  select * into v_round from public.game_rounds where id = p_round_id;
  if v_round.id is null then return; end if;
  select * into v_room from public.rooms where id = v_round.room_id;
  select * into v_secret from public.round_secrets rs where rs.round_id = p_round_id;
  select * into v_cat from public.categories c where c.id = v_secret.category_id;

  if p_accused is not null then
    select rp.display_name into v_acc_name from public.room_players rp
     where rp.room_id = v_round.room_id and rp.player_id = p_accused;
  end if;

  -- scoring ---------------------------------------------------------------
  if p_outcome = 'civilians' then
    update public.game_players gp
       set score = gp.score + 2, rounds_won = gp.rounds_won + 1
     where gp.game_id = v_round.game_id
       and gp.player_id in (select pr.player_id from public.player_roles pr
                             where pr.round_id = p_round_id and pr.role = 'civilian');

    update public.game_players gp
       set score = gp.score + 1, correct_votes = gp.correct_votes + 1
     where gp.game_id = v_round.game_id
       and gp.player_id in (
         select v.voter_id from public.votes v
         join public.player_roles pr on pr.round_id = v.round_id and pr.player_id = v.target_id
         where v.round_id = p_round_id and pr.role = 'outlier'
       );
  elsif p_outcome = 'outliers' then
    update public.game_players gp
       set score = gp.score + 3, rounds_won = gp.rounds_won + 1
     where gp.game_id = v_round.game_id
       and gp.player_id in (select pr.player_id from public.player_roles pr
                             where pr.round_id = p_round_id and pr.role = 'outlier');

    if v_round.outlier_guessed_correctly then
      update public.game_players gp
         set score = gp.score + 2
       where gp.game_id = v_round.game_id
         and gp.player_id in (select pr.player_id from public.player_roles pr
                               where pr.round_id = p_round_id and pr.role = 'outlier');
    end if;
  end if;

  -- mirror the game scoreboard onto the room scoreboard
  update public.room_players rp
     set score = coalesce((
       select gp.score from public.game_players gp
        where gp.game_id = v_round.game_id and gp.player_id = rp.player_id
     ), rp.score)
   where rp.room_id = v_round.room_id;

  update public.game_rounds gr
     set phase = 'result',
         outcome = p_outcome,
         accused_id = p_accused,
         ended_at = now(),
         phase_ends_at = now() + make_interval(secs => v_room.result_seconds)
   where gr.id = p_round_id;

  perform public._system_message(
    v_round.room_id,
    'نتيجة الجولة: ' ||
    case p_outcome
      when 'civilians' then 'فاز الفريق — الكلمة كانت «' || v_secret.word_text || '»'
      when 'outliers'  then 'فاز خارج السالفة — الكلمة كانت «' || v_secret.word_text || '»'
      else 'انتهت الجولة بدون حسم'
    end
  );
end;
$$;

create or replace function public._close_round(p_round_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_round public.game_rounds;
  v_game  public.games;
begin
  select * into v_round from public.game_rounds where id = p_round_id;
  if v_round.id is null then return; end if;
  select * into v_game from public.games where id = v_round.game_id;

  if v_round.round_number >= v_game.total_rounds then
    perform public._finish_game(v_game.id);
  else
    perform public._start_round(v_game.id, (v_round.round_number + 1)::smallint);
  end if;
end;
$$;

create or replace function public._finish_game(p_game_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_game public.games;
  v_civ  int;
  v_out  int;
  v_winner text;
begin
  select * into v_game from public.games where id = p_game_id;
  if v_game.id is null then return; end if;

  select
    count(*) filter (where gr.outcome = 'civilians'),
    count(*) filter (where gr.outcome = 'outliers')
  into v_civ, v_out
  from public.game_rounds gr
  where gr.game_id = p_game_id;

  if v_civ > v_out then v_winner := 'civilians';
  elsif v_out > v_civ then v_winner := 'outliers';
  else v_winner := 'draw';
  end if;

  update public.games g
     set status = 'finished', ended_at = now(), winner = v_winner
   where g.id = p_game_id;

  update public.rooms r set status = 'finished', last_activity_at = now() where r.id = v_game.room_id;

  -- lifetime statistics
  insert into public.player_statistics (player_id)
  select gp.player_id from public.game_players gp where gp.game_id = p_game_id
  on conflict (player_id) do nothing;

  update public.player_statistics s
     set games_played  = s.games_played + 1,
         wins          = s.wins   + (case when gp.rounds_won * 2 > v_game.total_rounds then 1 else 0 end),
         losses        = s.losses + (case when gp.rounds_won * 2 > v_game.total_rounds then 0 else 1 end),
         score         = s.score  + gp.score,
         rounds_played = s.rounds_played
                         + (select count(*) from public.game_rounds gr
                             where gr.game_id = p_game_id
                               and exists (select 1 from public.player_roles pr
                                            where pr.round_id = gr.id and pr.player_id = gp.player_id)),
         rounds_won    = s.rounds_won    + gp.rounds_won,
         times_outlier = s.times_outlier + gp.times_outlier,
         correct_votes = s.correct_votes + gp.correct_votes
  from public.game_players gp
  where gp.game_id = p_game_id and gp.player_id = s.player_id;

  update public.player_statistics s
     set outlier_wins = s.outlier_wins + 1
  from public.game_players gp
  where gp.game_id = p_game_id
    and gp.player_id = s.player_id
    and exists (
      select 1 from public.game_rounds gr
      join public.player_roles pr on pr.round_id = gr.id and pr.player_id = gp.player_id
      where gr.game_id = p_game_id and gr.outcome = 'outliers' and pr.role = 'outlier'
    );

  perform public._system_message(
    v_game.room_id,
    case v_winner
      when 'civilians' then 'انتهت المباراة — فاز الفريق بمعرفة الكلمة'
      when 'outliers'  then 'انتهت المباراة — فاز من كان خارج السالفة'
      else 'انتهت المباراة بالتعادل'
    end
  );
end;
$$;

-- ===========================================================================
-- Reveal (only after the round is resolved)
-- ===========================================================================
create or replace function public.api_round_reveal(p_round_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_round public.game_rounds;
  v_secret public.round_secrets;
  v_cat public.categories;
  v_roles jsonb;
  v_votes jsonb;
  v_clues jsonb;
begin
  select * into v_round from public.game_rounds where id = p_round_id;
  if v_round.id is null or not public.is_room_member(v_round.room_id) then
    raise exception 'NOT_MEMBER' using errcode = '42501';
  end if;
  if v_round.phase <> 'result' then
    raise exception 'ROUND_NOT_REVEALED' using errcode = 'P0001';
  end if;

  select * into v_secret from public.round_secrets rs where rs.round_id = p_round_id;
  select * into v_cat from public.categories c where c.id = v_secret.category_id;

  select jsonb_agg(jsonb_build_object(
           'player_id', pr.player_id,
           'display_name', rp.display_name,
           'avatar', rp.avatar,
           'role', pr.role,
           'vote_target', (select v.target_id from public.votes v
                            where v.round_id = p_round_id and v.voter_id = pr.player_id),
           'vote_count', (select count(*) from public.votes v2
                           where v2.round_id = p_round_id and v2.target_id = pr.player_id)
         ) order by rp.seat)
    into v_roles
  from public.player_roles pr
  join public.room_players rp on rp.room_id = v_round.room_id and rp.player_id = pr.player_id
  where pr.round_id = p_round_id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'voter_id', v.voter_id, 'target_id', v.target_id) ), '[]'::jsonb)
    into v_votes
  from public.votes v where v.round_id = p_round_id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'player_id', c.player_id,
           'display_name', rp.display_name,
           'body', c.body,
           'turn_index', c.turn_index
         ) order by c.turn_index), '[]'::jsonb)
    into v_clues
  from public.clues c
  join public.room_players rp on rp.room_id = v_round.room_id and rp.player_id = c.player_id
  where c.round_id = p_round_id;

  return jsonb_build_object(
    'round_id', p_round_id,
    'word', v_secret.word_text,
    'word_alt', v_secret.word_text_alt,
    'language', v_secret.language,
    'category', jsonb_build_object('name_ar', v_cat.name_ar, 'name_darija', v_cat.name_darija, 'emoji', v_cat.emoji),
    'outcome', v_round.outcome,
    'accused_id', v_round.accused_id,
    'outlier_guess', v_round.outlier_guess,
    'outlier_guessed_correctly', v_round.outlier_guessed_correctly,
    'players', coalesce(v_roles, '[]'::jsonb),
    'votes', v_votes,
    'clues', v_clues
  );
end;
$$;

-- ===========================================================================
-- Chat
-- ===========================================================================
create or replace function public.api_send_chat(p_room_id uuid, p_body text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_player uuid := public._require_player();
  v_body text := btrim(coalesce(p_body, ''));
  v_name text;
  v_chat boolean;
begin
  if not public.is_room_member(p_room_id) then
    raise exception 'NOT_MEMBER' using errcode = '42501';
  end if;
  select r.allow_chat into v_chat from public.rooms r where r.id = p_room_id;
  if not coalesce(v_chat, true) then
    raise exception 'CHAT_DISABLED' using errcode = 'P0001';
  end if;
  if char_length(v_body) < 1 or char_length(v_body) > 240 then
    raise exception 'INVALID_MESSAGE' using errcode = '22023';
  end if;

  select rp.display_name into v_name from public.room_players rp
   where rp.room_id = p_room_id and rp.player_id = v_player;

  insert into public.chat_messages (room_id, player_id, author_name, kind, body)
  values (p_room_id, v_player, coalesce(v_name, 'لاعب'), 'chat', left(v_body, 240));

  -- keep the backlog bounded
  delete from public.chat_messages cm
   where cm.room_id = p_room_id
     and cm.id not in (
       select cm2.id from public.chat_messages cm2
        where cm2.room_id = p_room_id
        order by cm2.created_at desc limit 200
     );

  perform public._touch_room(p_room_id);
end;
$$;

-- ===========================================================================
-- Full room snapshot — used on mount and after every reconnect
-- ===========================================================================
create or replace function public.api_room_state(p_code text)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_player uuid := public._require_player();
  v_room   public.rooms;
  v_game   public.games;
  v_round  public.game_rounds;
  v_is_member boolean;
  v_players jsonb;
  v_my_role jsonb;
  v_my_vote uuid;
  v_clues jsonb;
  v_reveal jsonb := null;
begin
  select * into v_room from public.rooms where id::text = p_code or upper(p_code) = code;
  if v_room.id is null then
    raise exception 'ROOM_NOT_FOUND' using errcode = 'P0001';
  end if;

  v_is_member := public.is_room_member(v_room.id);
  if not v_is_member and not v_room.is_public then
    raise exception 'NOT_MEMBER' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', rp.id, 'player_id', rp.player_id, 'display_name', rp.display_name,
           'avatar', rp.avatar, 'is_host', rp.is_host, 'is_ready', rp.is_ready,
           'is_connected', rp.is_connected, 'seat', rp.seat, 'score', rp.score,
           'joined_at', rp.joined_at
         ) order by rp.seat), '[]'::jsonb)
    into v_players
  from public.room_players rp where rp.room_id = v_room.id;

  if v_is_member then
    select * into v_game from public.games g
     where g.room_id = v_room.id order by g.started_at desc limit 1;

    if v_game.id is not null then
      select * into v_round from public.game_rounds gr
       where gr.game_id = v_game.id order by gr.round_number desc limit 1;

      if v_round.id is not null then
        select to_jsonb(pr) - 'id' into v_my_role
        from public.player_roles pr
        where pr.round_id = v_round.id and pr.player_id = v_player;

        select v.target_id into v_my_vote from public.votes v
         where v.round_id = v_round.id and v.voter_id = v_player;

        select coalesce(jsonb_agg(jsonb_build_object(
                 'id', c.id, 'player_id', c.player_id, 'body', c.body,
                 'turn_index', c.turn_index, 'created_at', c.created_at
               ) order by c.turn_index), '[]'::jsonb)
          into v_clues
        from public.clues c where c.round_id = v_round.id;

        if v_round.phase = 'result' then
          v_reveal := public.api_round_reveal(v_round.id);
        end if;
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'room', to_jsonb(v_room),
    'is_member', v_is_member,
    'players', v_players,
    'game', case when v_game.id is null then null else
      jsonb_build_object(
        'id', v_game.id, 'status', v_game.status, 'winner', v_game.winner,
        'current_round', v_game.current_round, 'total_rounds', v_game.total_rounds,
        'started_at', v_game.started_at, 'ended_at', v_game.ended_at
      ) end,
    'round', case when v_round.id is null then null else
      jsonb_build_object(
        'id', v_round.id, 'round_number', v_round.round_number, 'phase', v_round.phase,
        'phase_ends_at', v_round.phase_ends_at, 'speaking_order', v_round.speaking_order,
        'current_turn', v_round.current_turn, 'votes_count', v_round.votes_count,
        'confirmed_count', v_round.confirmed_count, 'accused_id', v_round.accused_id,
        'outcome', v_round.outcome, 'outlier_guessed_correctly', v_round.outlier_guessed_correctly,
        'started_at', v_round.started_at
      ) end,
    'my_role', v_my_role,
    'my_vote', v_my_vote,
    'clues', coalesce(v_clues, '[]'::jsonb),
    'reveal', v_reveal
  );
end;
$$;

-- ===========================================================================
-- Grants — authenticated may only call the api_* surface
-- ===========================================================================
revoke all on all functions in schema public from anon, authenticated;

grant execute on function
  public.api_bootstrap(text, text),
  public.api_list_categories(),
  public.api_leaderboard(integer),
  public.api_my_stats(),
  public.api_list_public_rooms(),
  public.api_create_room(boolean, text, jsonb),
  public.api_join_room_by_code(text),
  public.api_join_room(uuid),
  public.api_join_random_room(),
  public.api_leave_room(uuid),
  public.api_kick_player(uuid, uuid),
  public.api_transfer_host(uuid, uuid),
  public.api_update_settings(uuid, jsonb),
  public.api_set_ready(uuid, boolean),
  public.api_heartbeat(uuid),
  public.api_cleanup(),
  public.api_start_game(uuid),
  public.api_restart_game(uuid),
  public.api_stop_game(uuid),
  public.api_my_role(uuid),
  public.api_confirm_role(uuid),
  public.api_submit_clue(uuid, text),
  public.api_cast_vote(uuid, uuid),
  public.api_submit_guess(uuid, text),
  public.api_advance(uuid, boolean),
  public.api_round_reveal(uuid),
  public.api_send_chat(uuid, text),
  public.api_room_state(text)
to authenticated;
