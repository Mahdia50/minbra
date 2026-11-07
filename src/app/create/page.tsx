"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SessionGate } from "@/components/session/SessionGate";
import { ProfileSetup } from "@/components/session/ProfileSetup";
import { useSession } from "@/components/providers/SessionProvider";
import { useSettings } from "@/components/providers/SettingsProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { useCategories } from "@/lib/hooks/useCategories";
import { RoomSettingsEditor } from "@/components/room/RoomSettingsEditor";
import { PageShell, TopBar, Notice, LoadingScreen } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Segmented } from "@/components/ui/Controls";
import { humanError, type RoomSettings } from "@/lib/constants";

export default function CreateRoomPage() {
  return (
    <PageShell>
      <SessionGate>
        <TopBar back={{ href: "/", label: "الرئيسية" }} />
        <CreateRoom />
      </SessionGate>
    </PageShell>
  );
}

function CreateRoom() {
  const router = useRouter();
  const { player, client } = useSession();
  const { defaults } = useSettings();
  const { push } = useToast();
  const { categories, loading, totalWords } = useCategories();

  const [settings, setSettings] = useState<RoomSettings>(defaults);
  const [name, setName] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!player) return <ProfileSetup />;

  function patch(next: Partial<RoomSettings>) {
    setSettings((prev) => ({ ...prev, ...next }));
  }

  async function create() {
    if (!client) return;
    setBusy(true);
    try {
      const { data, error } = await client.rpc("api_create_room", {
        p_is_public: isPublic,
        p_name: name.trim() || null,
        p_settings: settings,
      });
      if (error) throw error;
      const room = data as { code: string };
      push("تم إنشاء الغرفة", "success");
      router.push(`/room/${room.code}`);
    } catch (err) {
      push(humanError(err), "error");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-ink">إنشاء غرفة</h1>
        <p className="mt-1 text-sm text-muted">
          اضبط القواعد كما تشاء — يمكنك تعديلها لاحقًا من اللوبي قبل بدء المباراة.
        </p>
      </header>

      {loading ? (
        <LoadingScreen label="جارٍ تحميل الفئات…" />
      ) : (
        <>
          <div className="panel space-y-5 p-5 sm:p-6">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-muted">اسم الغرفة</span>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={40}
                placeholder={`غرفة ${player.display_name}`}
              />
            </label>

            <div>
              <span className="mb-2 block text-xs font-semibold text-muted">نوع الغرفة</span>
              <Segmented
                value={isPublic ? "public" : "private"}
                onChange={(value) => setIsPublic(value === "public")}
                options={[
                  { value: "private", label: "خاصة — بالرمز فقط" },
                  { value: "public", label: "عامة — تظهر للجميع" },
                ]}
              />
            </div>
          </div>

          <div className="panel p-5 sm:p-6">
            <RoomSettingsEditor value={settings} onChange={patch} categories={categories} />
          </div>

          <Notice tone="neutral" title="بنك الكلمات">
            {totalWords.toLocaleString("ar-MA")} كلمة موزّعة على {categories.length} فئة، بالفصحى والدارجة
            المغربية. لا يُرسَل أي شيء إلى المتصفح قبل بدء الجولة.
          </Notice>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => router.push("/")}>
              إلغاء
            </Button>
            <Button onClick={create} loading={busy} size="lg">
              إنشاء الغرفة والدخول
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
