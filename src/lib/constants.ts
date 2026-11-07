import type { RoundPhase, WordLanguage } from "./types";

// ---------------------------------------------------------------------------
// Avatars — emoji only, so there are no image downloads and no broken images.
// ---------------------------------------------------------------------------
export const AVATARS = [
  "🦊", "🐼", "🐯", "🦁", "🐺", "🐸", "🐙", "🦉",
  "🐲", "🦄", "🐧", "🐨", "🐹", "🦖", "🦈", "🐝",
  "👽", "🤖", "👻", "🎃", "🧙", "🥷", "🧛", "🤠",
] as const;

export type AvatarEmoji = (typeof AVATARS)[number];

export const DEFAULT_AVATAR = "🦊";

export function avatarFor(index: number) {
  return AVATARS[index % AVATARS.length];
}

// ---------------------------------------------------------------------------
// Game phases
// ---------------------------------------------------------------------------
export const PHASE_ORDER: RoundPhase[] = [
  "reveal",
  "clues",
  "discussion",
  "voting",
  "guess",
  "result",
];

export const PHASE_LABEL: Record<RoundPhase, string> = {
  reveal: "توزيع الأدوار",
  clues: "مرحلة التلميحات",
  discussion: "النقاش",
  voting: "التصويت",
  guess: "التخمين الأخير",
  result: "نتيجة الجولة",
};

export const PHASE_HINT: Record<RoundPhase, string> = {
  reveal: "اطّلع على كلمتك السرية ودورك. لا تُظهر شاشتك لأحد.",
  clues: "أعطِ تلميحًا واحدًا يصف الكلمة دون ذكرها مباشرة.",
  discussion: "ناقشوا التلميحات وحاولوا كشف من هو خارج السالفة.",
  voting: "صوّت على اللاعب الذي تظنه خارج السالفة. لا يمكنك التصويت لنفسك.",
  guess: "تم كشف خارج السالفة! لديه فرصة واحدة لتخمين الكلمة.",
  result: "نتيجة الجولة — انظر من كان خارج السالفة وما كانت الكلمة.",
};

export const LANGUAGE_LABEL: Record<WordLanguage, string> = {
  ar: "العربية الفصحى",
  darija: "الدارجة المغربية",
  mixed: "عربي + دارجة",
};

// ---------------------------------------------------------------------------
// Error codes raised by the Postgres engine → Arabic UI copy
// ---------------------------------------------------------------------------
export const RPC_ERROR_MESSAGE: Record<string, string> = {
  AUTH_REQUIRED: "انتهت الجلسة، أعد تحميل الصفحة.",
  PROFILE_REQUIRED: "لم يتم تجهيز ملفك بعد، أعد المحاولة.",
  INVALID_NAME: "الاسم يجب أن يكون بين حرف واحد و24 حرفًا.",
  ROOM_NOT_FOUND: "لا توجد غرفة بهذا الرمز.",
  ROOM_FULL: "الغرفة ممتلئة.",
  GAME_IN_PROGRESS: "المباراة انطلقت، لا يمكن الانضمام الآن.",
  NO_PUBLIC_ROOM: "لا توجد غرفة عامة متاحة حاليًا، أنشئ واحدة.",
  NOT_MEMBER: "أنت لست في هذه الغرفة.",
  NOT_HOST: "هذه العملية متاحة لمضيف الغرفة فقط.",
  CANNOT_KICK_SELF: "لا يمكنك إخراج نفسك.",
  PLAYER_NOT_IN_ROOM: "اللاعب غير موجود في الغرفة.",
  ROOM_NOT_IN_LOBBY: "عدّل الإعدادات قبل بدء المباراة فقط.",
  ALREADY_PLAYING: "المباراة قائمة بالفعل.",
  NOT_ENOUGH_PLAYERS: "عدد اللاعبين غير كافٍ لبدء المباراة.",
  TOO_MANY_PLAYERS: "عدد اللاعبين أكبر من الحد الأقصى.",
  TOO_MANY_OUTLIERS: "عدد الخارجين كبير مقارنة بعدد اللاعبين.",
  NO_CATEGORIES: "لم يتم اختيار أي فئة متاحة.",
  NO_WORDS_AVAILABLE: "لا توجد كلمات متاحة في الفئات المحددة.",
  GAME_NOT_FOUND: "المباراة غير موجودة.",
  ROUND_NOT_FOUND: "الجولة غير موجودة.",
  ROUND_NOT_REVEALED: "لم يتم كشف هذه الجولة بعد.",
  WRONG_PHASE: "لا يمكن تنفيذ هذا الإجراء في هذه المرحلة.",
  NOT_YOUR_TURN: "ليس دورك الآن.",
  INVALID_CLUE: "التلميح يجب أن يكون بين 1 و60 حرفًا.",
  CLUE_REVEALS_WORD: "لا يمكنك ذكر الكلمة نفسها!",
  CANNOT_VOTE_SELF: "لا يمكنك التصويت لنفسك.",
  INVALID_TARGET: "اللاعب غير موجود في هذه الجولة.",
  NOT_OUTLIER: "هذا الإجراء خاص بخارج السالفة.",
  CHAT_DISABLED: "الدردشة معطّلة في هذه الغرفة.",
  INVALID_MESSAGE: "الرسالة يجب أن تكون بين 1 و240 حرفًا.",
  SUPABASE_NOT_CONFIGURED: "لم يتم ربط Supabase بعد.",
};

export function humanError(error: unknown): string {
  const raw =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : ((error as { message?: string })?.message ?? "");
  for (const [code, message] of Object.entries(RPC_ERROR_MESSAGE)) {
    if (raw.includes(code)) return message;
  }
  if (raw.includes("Failed to fetch") || raw.includes("NetworkError")) {
    return "تعذّر الاتصال بالخادم، تحقّق من الإنترنت.";
  }
  return raw || "حدث خطأ غير متوقع.";
}

// ---------------------------------------------------------------------------
// Default match settings used by the create-room form
// ---------------------------------------------------------------------------
export interface RoomSettings {
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
  word_mode: "random" | "specific";
  language: WordLanguage;
  category_ids: string[];
  excluded_category_ids: string[];
  allow_chat: boolean;
  allow_mid_game_join: boolean;
}

export const DEFAULT_SETTINGS: RoomSettings = {
  min_players: 3,
  max_players: 10,
  outliers_count: 1,
  rounds_count: 3,
  clue_seconds: 40,
  discussion_seconds: 45,
  vote_seconds: 45,
  guess_seconds: 30,
  result_seconds: 15,
  reveal_seconds: 12,
  word_mode: "random",
  language: "mixed",
  category_ids: [],
  excluded_category_ids: [],
  allow_chat: true,
  allow_mid_game_join: false,
};

export const SCORE_RULES = [
  { label: "الفريق يعرف الكلمة", value: "+2 لكل فرد في الفريق" },
  { label: "تصويت صحيح على خارج السالفة", value: "+1 إضافية" },
  { label: "خارج السالفة يفوز بالجولة", value: "+3 له" },
  { label: "تخمين أخير صحيح", value: "+2 إضافية" },
];
