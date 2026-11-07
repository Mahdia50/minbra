"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useSession } from "@/components/providers/SessionProvider";
import { useSettings } from "@/components/providers/SettingsProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { AVATARS } from "@/lib/constants";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Layout";
import { humanError } from "@/lib/constants";

export function ProfileSetup({ onDone, compact }: { onDone?: () => void; compact?: boolean }) {
  const { signIn, player } = useSession();
  const { defaultAvatar } = useSettings();
  const { push } = useToast();

  const [name, setName] = useState(player?.display_name ?? "");
  const [avatar, setAvatar] = useState(player?.avatar ?? defaultAvatar);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("اكتب اسمك أولًا.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn(trimmed, avatar);
      push(`مرحبًا ${trimmed}!`, "success");
      onDone?.();
    } catch (err) {
      setError(humanError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="panel p-5 sm:p-6">
      <h2 className="text-lg font-bold text-ink">من أنت؟</h2>
      <p className="mt-1 text-sm text-muted">
        لا حاجة لحساب أو بريد — فقط اسم ولافتة. يُحفظ الاختيار على هذا الجهاز.
      </p>

      <div className="mt-5 space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-muted">الاسم</span>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={24}
            placeholder="مثال: يوسف"
            autoComplete="off"
            autoFocus
          />
        </label>

        <div>
          <span className="mb-2 block text-xs font-semibold text-muted">اختر لافتتك</span>
          <div className={cn("grid gap-1.5", compact ? "grid-cols-8" : "grid-cols-6 sm:grid-cols-8")}>
            {AVATARS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                aria-label={`لافتة ${emoji}`}
                aria-pressed={avatar === emoji}
                onClick={() => setAvatar(emoji)}
                className={cn(
                  "grid aspect-square place-items-center rounded-[11px] border text-xl transition-all duration-200",
                  avatar === emoji
                    ? "border-brand bg-brand/15 scale-105"
                    : "border-line bg-base/50 hover:border-brand/40",
                )}
              >
                <motion.span layout>{emoji}</motion.span>
              </button>
            ))}
          </div>
        </div>

        {error && <Notice tone="bad">{error}</Notice>}

        <Button type="submit" loading={busy} block size="lg">
          {player ? "تحديث الملف" : "يلا نبدأ"}
        </Button>
      </div>
    </form>
  );
}
