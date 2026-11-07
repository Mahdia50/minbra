// ---------------------------------------------------------------------------
// Shared domain types. These mirror the JSON produced by the Postgres engine
// functions in supabase/migrations/0002_engine.sql
// ---------------------------------------------------------------------------

export type RoomStatus = "lobby" | "playing" | "finished";

export type RoundPhase =
  | "reveal"
  | "clues"
  | "discussion"
  | "voting"
  | "guess"
  | "result";

export type PlayerRoleKind = "civilian" | "outlier";

export type RoundOutcome = "civilians" | "outliers" | "skip";

export type GameWinner = "civilians" | "outliers" | "draw";

export type WordMode = "random" | "specific";

export type WordLanguage = "ar" | "darija" | "mixed";

export interface Category {
  id: string;
  slug: string;
  name_ar: string;
  name_darija: string;
  emoji: string;
  word_count: number;
  difficulty_avg: number | null;
}

export interface Room {
  id: string;
  code: string;
  name: string;
  host_id: string;
  is_public: boolean;
  status: RoomStatus;
  min_players: number;
  max_players: number;
  outliers_count: number;
  rounds_count: number;
  clue_seconds: number;
  discussion_seconds: number;
  vote_seconds: number;
  guess_seconds: number;
  result_seconds: number;
  reveal_seconds: number;
  word_mode: WordMode;
  language: WordLanguage;
  category_ids: string[];
  excluded_category_ids: string[];
  allow_chat: boolean;
  allow_mid_game_join: boolean;
  created_at: string;
  updated_at: string;
  last_activity_at: string;
}

export interface RoomPlayer {
  id: string;
  player_id: string;
  display_name: string;
  avatar: string;
  is_host: boolean;
  is_ready: boolean;
  is_connected: boolean;
  seat: number;
  score: number;
  joined_at: string;
}

export interface GameSummary {
  id: string;
  status: "playing" | "finished";
  winner: GameWinner | null;
  current_round: number;
  total_rounds: number;
  started_at: string;
  ended_at: string | null;
}

export interface RoundState {
  id: string;
  round_number: number;
  phase: RoundPhase;
  phase_ends_at: string | null;
  speaking_order: string[];
  current_turn: number;
  votes_count: number;
  confirmed_count: number;
  accused_id: string | null;
  outcome: RoundOutcome | null;
  outlier_guessed_correctly: boolean | null;
  started_at: string;
}

export interface MyRole {
  round_id: string;
  player_id: string;
  role: PlayerRoleKind;
  word_text: string | null;
  confirmed: boolean;
}

export interface Clue {
  id: string;
  player_id: string;
  body: string;
  turn_index: number;
  created_at: string;
}

export interface RevealPlayer {
  player_id: string;
  display_name: string;
  avatar: string;
  role: PlayerRoleKind;
  vote_target: string | null;
  vote_count: number;
}

export interface RoundReveal {
  round_id: string;
  word: string;
  word_alt: string;
  language: WordLanguage;
  category: { name_ar: string; name_darija: string; emoji: string };
  outcome: RoundOutcome | null;
  accused_id: string | null;
  outlier_guess: string | null;
  outlier_guessed_correctly: boolean | null;
  players: RevealPlayer[];
  votes: { voter_id: string; target_id: string }[];
  clues: { player_id: string; display_name: string; body: string; turn_index: number }[];
}

export interface RoomState {
  room: Room;
  is_member: boolean;
  players: RoomPlayer[];
  game: GameSummary | null;
  round: RoundState | null;
  my_role: MyRole | null;
  my_vote: string | null;
  clues: Clue[];
  reveal: RoundReveal | null;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  player_id: string | null;
  author_name: string;
  kind: "chat" | "system";
  body: string;
  created_at: string;
}

export interface PublicRoom {
  id: string;
  code: string;
  name: string;
  status: RoomStatus;
  player_count: number;
  max_players: number;
  min_players: number;
  host_name: string | null;
  rounds_count: number;
  language: WordLanguage;
}

export interface LeaderboardRow {
  player_id: string;
  display_name: string;
  avatar: string;
  games_played: number;
  wins: number;
  losses: number;
  score: number;
  times_outlier: number;
  outlier_wins: number;
  correct_votes: number;
}

export interface MyStats {
  player_id?: string;
  games_played?: number;
  wins?: number;
  losses?: number;
  rounds_played?: number;
  rounds_won?: number;
  score?: number;
  times_outlier?: number;
  outlier_wins?: number;
  correct_votes?: number;
}
