"use client";

import { useCallback, useEffect, useState } from "react";
import { SessionGate } from "@/components/session/SessionGate";
import { useSession } from "@/components/providers/SessionProvider";
import { PageShell, TopBar, LoadingScreen, StatCard, EmptyState, Notice } from "@/components/ui/Layout";
import { Avatar } from "@/components/ui/Avatar";
import { Segmented } from "@/components/ui/Controls";
import { humanError } from "@/lib/constants";
import type { LeaderboardRow, MyStats } from "@/lib/types";

export default function StatsPage() {
  return (
    <PageShell>
      <SessionGate>
        <TopBar back={{ href: "/", label: "الرئيسية" }} />
        <Stats />
      </SessionGate>
    </PageShell>
  );
}

function Stats() {
  const { client, player } = useSession();
  const [tab, setTab] = useState<"mine" | "board">("mine");
  const [mine, setMine] = useState<MyStats | null>(null);
  const [board, setBoard] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!client || !player) return;
    // State updates live inside promise callbacks so React can tell they are
    // asynchronous (a synchronous setState in an effect body would cascade).
    return Promise.all([
      Promise.resolve(client.rpc("api_my_stats")),
      Promise.resolve(client.rpc("api_leaderboard", { p_limit: 50 })),
    ])
      .then(([statsRes, boardRes]) => {
        if (statsRes.error) throw statsRes.error;
        if (boardRes.error) throw boardRes.error;
        setMine((statsRes.data ?? {}) as MyStats);
        setBoard((boardRes.data ?? []) as LeaderboardRow[]);
        setError(null);
      })
      .catch((err) => setError(humanError(err)))
      .finally(() => setLoading(false));
  }, [client, player]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!player) {
    return <EmptyState icon="📊" title="جهّز ملفك أولًا" description="اكتب اسمك من الصفحة الرئيسية لعرض إحصائياتك." />;
  }

  if (loading) return <LoadingScreen label="جارٍ حساب إحصائياتك…" />;

  const played = mine?.games_played ?? 0;
  const wins = mine?.wins ?? 0;
  const winRate = played > 0 ? Math.round((wins / played) * 100) : 0;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">الإحصائيات</h1>
          <p className="mt-1 text-sm text-muted">سجلك الكامل عبر كل المباريات.</p>
        </div>
        <div className="w-full sm:w-72">
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: "mine", label: "إحصائياتي" },
              { value: "board", label: "لوحة الصدارة" },
            ]}
          />
        </div>
      </header>

      {error && <Notice tone="bad">{error}</Notice>}

      {tab === "mine" ? (
        <>
          <div className="flex items-center gap-3 rounded-[18px] border border-line bg-surface/80 p-4">
            <Avatar emoji={player.avatar} size="lg" ring="brand" />
            <div>
              <div className="text-lg font-bold text-ink">{player.display_name}</div>
              <div className="text-xs text-muted">
                {played === 0 ? "لم تلعب أي مباراة بعد" : `${played} مباراة · نسبة الفوز ${winRate}%`}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="مباريات" value={played} icon="🎮" />
            <StatCard label="فوز" value={wins} tone="good" icon="🏆" />
            <StatCard label="خسارة" value={mine?.losses ?? 0} tone="bad" icon="💔" />
            <StatCard label="مجموع النقاط" value={mine?.score ?? 0} tone="brand" icon="⭐" />
            <StatCard label="جولات لعبتها" value={mine?.rounds_played ?? 0} icon="🔁" />
            <StatCard label="جولات فزتها" value={mine?.rounds_won ?? 0} tone="good" icon="✅" />
            <StatCard label="كنت خارج السالفة" value={mine?.times_outlier ?? 0} tone="warn" icon="🕵️" />
            <StatCard label="فوز كخارج السالفة" value={mine?.outlier_wins ?? 0} tone="bad" icon="🎭" />
          </div>

          <Notice tone="neutral" title="تصويتات صحيحة">
            صوّتّ صحيحًا على خارج السالفة <span className="numeric font-bold">{mine?.correct_votes ?? 0}</span> مرة.
          </Notice>
        </>
      ) : (
        <div className="panel-flat overflow-hidden">
          {board.length === 0 ? (
            <EmptyState icon="🏅" title="لا ترتيب بعد" description="العب أول مباراة لتظهر في لوحة الصدارة." />
          ) : (
            <ol className="divide-y divide-[color:var(--color-line-soft)]">
              {board.map((row, index) => {
                const isMe = row.player_id === player.id;
                const medal = ["🥇", "🥈", "🥉"][index];
                return (
                  <li
                    key={row.player_id}
                    className={`flex items-center gap-3 px-4 py-3 ${isMe ? "bg-brand/8" : ""}`}
                  >
                    <span className="numeric w-6 text-center text-sm text-faint">{medal ?? index + 1}</span>
                    <Avatar emoji={row.avatar} size="sm" ring={index === 0 ? "good" : isMe ? "brand" : null} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold text-ink">
                        {row.display_name}
                        {isMe && <span className="ml-1.5 text-[10px] text-brand-soft">(أنت)</span>}
                      </div>
                      <div className="text-[11px] text-muted">
                        {row.games_played} مباراة · {row.wins} فوز · خارج السالفة {row.times_outlier}×
                      </div>
                    </div>
                    <span className="numeric text-sm font-bold text-brand-soft">{row.score}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
