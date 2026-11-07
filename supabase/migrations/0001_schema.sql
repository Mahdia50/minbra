-- ============================================================================
--  «مين برّة السالفة»  —  0001 : Schema, indexes, RLS, realtime
--  Run order: 0001_schema -> 0002_engine -> 0003_seed
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Generic trigger helper
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ===========================================================================
-- 1. players  (one guest identity per anonymous auth user)
-- ===========================================================================
create table public.players (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text        not null check (char_length(display_name) between 1 and 24),
  avatar       text        not null default 'fox',
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- ===========================================================================
-- 2. player_statistics
-- ===========================================================================
create table public.player_statistics (
  player_id       uuid primary key references public.players (id) on delete cascade,
  games_played    integer not null default 0 check (games_played >= 0),
  wins            integer not null default 0 check (wins >= 0),
  losses          integer not null default 0 check (losses >= 0),
  rounds_played   integer not null default 0 check (rounds_played >= 0),
  rounds_won      integer not null default 0 check (rounds_won >= 0),
  score           integer not null default 0,
  times_outlier   integer not null default 0 check (times_outlier >= 0),
  outlier_wins    integer not null default 0 check (outlier_wins >= 0),
  correct_votes   integer not null default 0 check (correct_votes >= 0),
  updated_at      timestamptz not null default now()
);

create trigger players_statistics_touch
  before update on public.player_statistics
  for each row execute function public.touch_updated_at();

-- ===========================================================================
-- 3. categories + words  (the word bank — never readable by clients)
-- ===========================================================================
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text        not null unique,
  name_ar     text        not null,
  name_darija text        not null,
  emoji       text        not null default '🎯',
  sort_order  integer     not null default 0,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now()
);

create table public.words (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid        not null references public.categories (id) on delete cascade,
  text_ar     text        not null check (char_length(text_ar) between 1 and 60),
  text_darija text        not null check (char_length(text_darija) between 1 and 60),
  difficulty  smallint    not null default 2 check (difficulty between 1 and 3),
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  constraint words_unique_per_category unique (category_id, text_ar)
);

create index words_category_active_idx on public.words (category_id) where is_active;
create index words_difficulty_idx      on public.words (difficulty) where is_active;

-- ===========================================================================
-- 4. rooms
-- ===========================================================================
create table public.rooms (
  id                   uuid primary key default gen_random_uuid(),
  code                 text        not null unique,
  name                 text        not null default 'غرفة',
  host_id              uuid        not null references public.players (id) on delete cascade,
  is_public            boolean     not null default false,
  status               text        not null default 'lobby'
                                   check (status in ('lobby', 'playing', 'finished')),

  -- host-configurable match settings -----------------------------------------
  min_players          smallint    not null default 3   check (min_players between 2 and 20),
  max_players          smallint    not null default 10  check (max_players between 3 and 20),
  outliers_count       smallint    not null default 1   check (outliers_count between 1 and 5),
  rounds_count         smallint    not null default 3   check (rounds_count between 1 and 10),
  clue_seconds         smallint    not null default 40  check (clue_seconds between 10 and 180),
  discussion_seconds   smallint    not null default 45  check (discussion_seconds between 0 and 300),
  vote_seconds         smallint    not null default 45  check (vote_seconds between 10 and 180),
  guess_seconds        smallint    not null default 30  check (guess_seconds between 10 and 120),
  result_seconds       smallint    not null default 15  check (result_seconds between 5 and 120),
  reveal_seconds       smallint    not null default 12  check (reveal_seconds between 5 and 60),
  word_mode            text        not null default 'random'
                                   check (word_mode in ('random', 'specific')),
  language             text        not null default 'mixed'
                                   check (language in ('ar', 'darija', 'mixed')),
  category_ids         uuid[]      not null default '{}',
  excluded_category_ids uuid[]     not null default '{}',
  allow_chat           boolean     not null default true,
  allow_mid_game_join  boolean     not null default false,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  last_activity_at     timestamptz not null default now(),

  constraint rooms_size_sane check (max_players >= min_players)
);

create index rooms_public_idx on public.rooms (is_public, status);
create index rooms_activity_idx on public.rooms (last_activity_at);

create trigger rooms_touch
  before update on public.rooms
  for each row execute function public.touch_updated_at();

-- ===========================================================================
-- 5. room_players  (lobby membership + score board)
-- ===========================================================================
create table public.room_players (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid        not null references public.rooms (id) on delete cascade,
  player_id    uuid        not null references public.players (id) on delete cascade,
  display_name text        not null,
  avatar       text        not null default 'fox',
  is_host      boolean     not null default false,
  is_ready     boolean     not null default false,
  is_connected boolean     not null default true,
  seat         smallint    not null default 0,
  score        integer     not null default 0,
  joined_at    timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (room_id, player_id)
);

create index room_players_room_idx   on public.room_players (room_id);
create index room_players_player_idx on public.room_players (player_id);

-- ===========================================================================
-- 6. games
-- ===========================================================================
create table public.games (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid        not null references public.rooms (id) on delete cascade,
  status        text        not null default 'playing'
                            check (status in ('playing', 'finished')),
  current_round smallint    not null default 1,
  total_rounds  smallint    not null default 3,
  winner        text        check (winner in ('civilians', 'outliers', 'draw')),
  settings      jsonb       not null default '{}'::jsonb,
  used_word_ids uuid[]      not null default '{}',
  started_at    timestamptz not null default now(),
  ended_at      timestamptz
);

create index games_room_idx on public.games (room_id, status);

-- ---------------------------------------------------------------------------
-- game_players : per-game scoreboard (survives room score resets)
-- ---------------------------------------------------------------------------
create table public.game_players (
  id               uuid primary key default gen_random_uuid(),
  game_id          uuid    not null references public.games (id) on delete cascade,
  room_id          uuid    not null references public.rooms (id) on delete cascade,
  player_id        uuid    not null references public.players (id) on delete cascade,
  score            integer not null default 0,
  rounds_won       integer not null default 0,
  correct_votes    integer not null default 0,
  times_outlier    integer not null default 0,
  unique (game_id, player_id)
);

create index game_players_game_idx on public.game_players (game_id);

-- ===========================================================================
-- 7. game_rounds  (only NON-secret round state — safe for realtime broadcast)
-- ===========================================================================
create table public.game_rounds (
  id               uuid primary key default gen_random_uuid(),
  game_id          uuid        not null references public.games (id) on delete cascade,
  room_id          uuid        not null references public.rooms (id) on delete cascade,
  round_number     smallint    not null,
  phase            text        not null default 'reveal'
                               check (phase in ('reveal','clues','discussion','voting','guess','result')),
  phase_ends_at    timestamptz,
  speaking_order   uuid[]      not null default '{}',
  current_turn     smallint    not null default 0,
  votes_count      smallint    not null default 0,
  confirmed_count  smallint    not null default 0,
  accused_id       uuid        references public.players (id) on delete set null,
  outcome          text        check (outcome in ('civilians','outliers','skip')),
  outlier_guess    text,
  outlier_guessed_correctly boolean,
  started_at       timestamptz not null default now(),
  ended_at         timestamptz,
  unique (game_id, round_number)
);

create index game_rounds_room_idx on public.game_rounds (room_id);
create index game_rounds_game_idx on public.game_rounds (game_id);

-- ===========================================================================
-- 8. round_secrets  (the hidden word — NO client access whatsoever)
-- ===========================================================================
create table public.round_secrets (
  round_id     uuid primary key references public.game_rounds (id) on delete cascade,
  word_id      uuid not null references public.words (id) on delete cascade,
  category_id  uuid not null references public.categories (id) on delete cascade,
  word_text    text not null,
  word_text_alt text not null,
  language     text not null
);

-- ===========================================================================
-- 9. player_roles  (private per-player role + word)
-- ===========================================================================
create table public.player_roles (
  id          uuid primary key default gen_random_uuid(),
  round_id    uuid    not null references public.game_rounds (id) on delete cascade,
  player_id   uuid    not null references public.players (id) on delete cascade,
  role        text    not null check (role in ('civilian','outlier')),
  word_text   text,
  confirmed   boolean not null default false,
  unique (round_id, player_id)
);

create index player_roles_round_idx  on public.player_roles (round_id);
create index player_roles_player_idx on public.player_roles (player_id);

-- ===========================================================================
-- 10. clues
-- ===========================================================================
create table public.clues (
  id         uuid primary key default gen_random_uuid(),
  round_id   uuid        not null references public.game_rounds (id) on delete cascade,
  room_id    uuid        not null references public.rooms (id) on delete cascade,
  player_id  uuid        not null references public.players (id) on delete cascade,
  body       text        not null check (char_length(body) between 1 and 120),
  turn_index smallint    not null default 0,
  created_at timestamptz not null default now()
);

create index clues_room_idx  on public.clues (room_id, created_at);
create index clues_round_idx on public.clues (round_id);

-- ===========================================================================
-- 11. votes
-- ===========================================================================
create table public.votes (
  id         uuid primary key default gen_random_uuid(),
  round_id   uuid        not null references public.game_rounds (id) on delete cascade,
  room_id    uuid        not null references public.rooms (id) on delete cascade,
  voter_id   uuid        not null references public.players (id) on delete cascade,
  target_id  uuid        not null references public.players (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint votes_one_per_player unique (round_id, voter_id),
  constraint votes_no_self check (voter_id <> target_id)
);

create index votes_round_idx on public.votes (round_id);

-- ===========================================================================
-- 12. chat_messages
-- ===========================================================================
create table public.chat_messages (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid        not null references public.rooms (id) on delete cascade,
  player_id   uuid        references public.players (id) on delete set null,
  author_name text        not null default 'النظام',
  kind        text        not null default 'chat' check (kind in ('chat','system')),
  body        text        not null check (char_length(body) between 1 and 400),
  created_at  timestamptz not null default now()
);

create index chat_messages_room_idx on public.chat_messages (room_id, created_at desc);

-- ===========================================================================
-- 13. Row Level Security helpers (SECURITY DEFINER -> bypass RLS, no recursion)
-- ===========================================================================
create or replace function public.is_room_member(p_room_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.room_players rp
    where rp.room_id = p_room_id and rp.player_id = auth.uid()
  );
$$;

create or replace function public.is_room_host(p_room_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.room_players rp
    where rp.room_id = p_room_id and rp.player_id = auth.uid() and rp.is_host
  );
$$;

create or replace function public.is_round_visible(p_round_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.game_rounds gr
    where gr.id = p_round_id and public.is_room_member(gr.room_id)
  );
$$;

-- votes become public only after the tally is done
create or replace function public.round_votes_revealed(p_round_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.game_rounds gr
    where gr.id = p_round_id and gr.phase = 'result'
  );
$$;

-- ===========================================================================
-- 14. RLS
-- ===========================================================================
alter table public.players           enable row level security;
alter table public.player_statistics enable row level security;
alter table public.categories        enable row level security;
alter table public.words             enable row level security;
alter table public.rooms             enable row level security;
alter table public.room_players      enable row level security;
alter table public.games             enable row level security;
alter table public.game_players      enable row level security;
alter table public.game_rounds       enable row level security;
alter table public.round_secrets     enable row level security;
alter table public.player_roles      enable row level security;
alter table public.clues             enable row level security;
alter table public.votes             enable row level security;
alter table public.chat_messages     enable row level security;

-- players: only your own row ------------------------------------------------
create policy players_select_self on public.players
  for select to authenticated using (id = auth.uid());

-- statistics: global leaderboard is public to signed-in guests --------------
create policy stats_select_all on public.player_statistics
  for select to authenticated using (true);

-- categories: readable (no words inside) ------------------------------------
create policy categories_select_all on public.categories
  for select to authenticated using (is_active);

-- words: completely locked. Counts are exposed through api_list_categories().
-- (RLS on + no policy = deny all)

-- rooms ---------------------------------------------------------------------
create policy rooms_select_visible on public.rooms
  for select to authenticated
  using (is_public or public.is_room_member(id));

-- room_players --------------------------------------------------------------
create policy room_players_select_member on public.room_players
  for select to authenticated
  using (public.is_room_member(room_id));

-- games --------------------------------------------------------------------
create policy games_select_member on public.games
  for select to authenticated using (public.is_room_member(room_id));

create policy game_players_select_member on public.game_players
  for select to authenticated using (public.is_room_member(room_id));

-- game_rounds: safe columns only, members only ------------------------------
create policy game_rounds_select_member on public.game_rounds
  for select to authenticated using (public.is_room_member(room_id));

-- round_secrets / player_roles: no policy at all → clients read nothing.
-- Everything goes through the SECURITY DEFINER engine functions.

-- clues --------------------------------------------------------------------
create policy clues_select_member on public.clues
  for select to authenticated using (public.is_room_member(room_id));

-- votes: your own vote, or everyone's once the tally is public --------------
create policy votes_select_limited on public.votes
  for select to authenticated
  using (
    public.is_room_member(room_id)
    and (voter_id = auth.uid() or public.round_votes_revealed(round_id))
  );

-- chat ---------------------------------------------------------------------
create policy chat_select_member on public.chat_messages
  for select to authenticated using (public.is_room_member(room_id));

-- ===========================================================================
-- 15. Grants — writes only happen inside SECURITY DEFINER functions
-- ===========================================================================
revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;

grant select on public.players           to authenticated;
grant select on public.player_statistics to authenticated;
grant select on public.categories        to authenticated;
grant select on public.rooms             to authenticated;
grant select on public.room_players      to authenticated;
grant select on public.games             to authenticated;
grant select on public.game_players      to authenticated;
grant select on public.game_rounds       to authenticated;
grant select on public.clues             to authenticated;
grant select on public.votes             to authenticated;
grant select on public.chat_messages     to authenticated;

-- ===========================================================================
-- 16. Realtime
-- ===========================================================================
alter table public.rooms           replica identity full;
alter table public.room_players    replica identity full;
alter table public.games           replica identity full;
alter table public.game_players    replica identity full;
alter table public.game_rounds     replica identity full;
alter table public.clues           replica identity full;
alter table public.votes           replica identity full;
alter table public.chat_messages   replica identity full;

alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.room_players;
alter publication supabase_realtime add table public.games;
alter publication supabase_realtime add table public.game_players;
alter publication supabase_realtime add table public.game_rounds;
alter publication supabase_realtime add table public.clues;
alter publication supabase_realtime add table public.votes;
alter publication supabase_realtime add table public.chat_messages;
