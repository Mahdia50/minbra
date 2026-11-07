"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SessionGate } from "@/components/session/SessionGate";
import { ProfileSetup } from "@/components/session/ProfileSetup";
import { useSession } from "@/components/providers/SessionProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { PageShell, TopBar, Notice } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { humanError } from "@/lib/constants";

export default function JoinRoomPage() {
  return (
    <PageShell>
      <SessionGate>
        <TopBar back={{ href: "/", label: "الرئيسية" }} />
        <Suspense fallback={null}>
          <JoinRoom />
        </Suspense>
      </SessionGate>
    </PageShell>
  );
}

function JoinRoom() {
  const router = useRouter();
  const params = useSearchParams();
  const { player, client } = useSession();
  const { push } = useToast();

  const [code, setCode] = useState((params.get("code") ?? "").toUpperCase().slice(0, 6));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!player) return <ProfileSetup />;

  async function join(event: React.FormEvent) {
    event.preventDefault();
    if (!client) return;
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) {
      setError("الرمز قصير جدًا.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { data, error: rpcError } = await client.rpc("api_join_room_by_code", { p_code: trimmed });
      if (rpcError) throw rpcError;
      const room = data as { code: string };
      push("انضممت إلى الغرفة", "success");
      router.push(`/room/${room.code}`);
    } catch (err) {
      setError(humanError(err));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-ink">الانضمام برمز</h1>
        <p className="mt-1 text-sm text-muted">أدخل رمز الغرفة المكوّن من 6 أحرف.</p>
      </header>

      <form onSubmit={join} className="panel p-5 sm:p-6">
        <Input
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
          placeholder="ABC123"
          dir="ltr"
          autoComplete="off"
          autoFocus
          className="numeric h-16 text-center text-3xl font-bold tracking-[0.45em]"
          maxLength={6}
        />

        {error && (
          <div className="mt-4">
            <Notice tone="bad">{error}</Notice>
          </div>
        )}

        <Button type="submit" block size="lg" loading={busy} className="mt-5" disabled={code.length < 4}>
          دخول الغرفة
        </Button>
      </form>

      <p className="mt-5 text-center text-xs text-muted">
        هل لديك رابط دعوة؟ افتحه مباشرة وسينقلك إلى الغرفة.
      </p>
    </div>
  );
}
