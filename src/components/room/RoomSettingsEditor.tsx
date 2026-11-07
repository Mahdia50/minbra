"use client";

import { useMemo, useState } from "react";
import { Segmented, Stepper, Toggle } from "@/components/ui/Controls";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils/cn";
import { LANGUAGE_LABEL, type RoomSettings } from "@/lib/constants";
import type { Category, WordLanguage } from "@/lib/types";

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3">
        <h3 className="text-sm font-bold text-ink">{title}</h3>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

export function RoomSettingsEditor({
  value,
  onChange,
  categories,
  disabled,
}: {
  value: RoomSettings;
  onChange: (patch: Partial<RoomSettings>) => void;
  categories: Category[];
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [pickerMode, setPickerMode] = useState<"include" | "exclude">("include");

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return categories;
    return categories.filter(
      (c) => c.name_ar.includes(q) || c.name_darija.includes(q) || c.slug.includes(q.toLowerCase()),
    );
  }, [categories, query]);

  const key = pickerMode === "include" ? "category_ids" : "excluded_category_ids";
  const selected = pickerMode === "include" ? value.category_ids : value.excluded_category_ids;

  function toggleCategory(id: string) {
    const next = selected.includes(id) ? selected.filter((c) => c !== id) : [...selected, id];
    onChange({ [key]: next } as Partial<RoomSettings>);
  }

  const selectedWordCount = useMemo(() => {
    const pool = categories.filter((c) =>
      value.category_ids.length ? value.category_ids.includes(c.id) : true,
    );
    const usable = pool.filter((c) => !value.excluded_category_ids.includes(c.id));
    return usable.reduce((sum, c) => sum + c.word_count, 0);
  }, [categories, value.category_ids, value.excluded_category_ids]);

  return (
    <div className={cn("space-y-7", disabled && "pointer-events-none opacity-60")}>
      <Section title="اللاعبون" hint="يبدأ المضيف المباراة عند بلوغ الحد الأدنى.">
        <Stepper
          label="الحد الأدنى للاعبين"
          value={value.min_players}
          min={3}
          max={20}
          onChange={(min_players) =>
            onChange({ min_players, max_players: Math.max(min_players, value.max_players) })
          }
        />
        <Stepper
          label="الحد الأقصى للاعبين"
          value={value.max_players}
          min={Math.max(3, value.min_players)}
          max={20}
          onChange={(max_players) => onChange({ max_players })}
        />
        <Stepper
          label="عدد «خارج السالفة»"
          hint="واحد على الأقل. أكثر من واحد يزيد الصعوبة."
          value={value.outliers_count}
          min={1}
          max={Math.max(1, Math.floor(value.max_players / 2))}
          onChange={(outliers_count) => onChange({ outliers_count })}
        />
        <Stepper
          label="عدد الجولات"
          value={value.rounds_count}
          min={1}
          max={15}
          onChange={(rounds_count) => onChange({ rounds_count })}
        />
      </Section>

      <Section title="مدّة المراحل (بالثواني)" hint="0 يعني تخطّي المرحلة تلقائيًا.">
        <div className="grid gap-2.5 sm:grid-cols-2">
          <Stepper label="التلميحات" value={value.clue_seconds} min={0} max={180} unit="ث" onChange={(clue_seconds) => onChange({ clue_seconds })} />
          <Stepper label="النقاش" value={value.discussion_seconds} min={0} max={300} unit="ث" onChange={(discussion_seconds) => onChange({ discussion_seconds })} />
          <Stepper label="التصويت" value={value.vote_seconds} min={10} max={300} unit="ث" onChange={(vote_seconds) => onChange({ vote_seconds })} />
          <Stepper label="التخمين الأخير" value={value.guess_seconds} min={10} max={180} unit="ث" onChange={(guess_seconds) => onChange({ guess_seconds })} />
          <Stepper label="عرض النتيجة" value={value.result_seconds} min={5} max={120} unit="ث" onChange={(result_seconds) => onChange({ result_seconds })} />
          <Stepper label="توزيع الأدوار" value={value.reveal_seconds} min={5} max={120} unit="ث" onChange={(reveal_seconds) => onChange({ reveal_seconds })} />
        </div>
      </Section>

      <Section title="نمط الكلمات">
        <Segmented
          value={value.word_mode}
          onChange={(word_mode) => onChange({ word_mode })}
          options={[
            { value: "random", label: "عشوائي من كل الفئات" },
            { value: "specific", label: "من فئات محدّدة" },
          ]}
        />
        <Segmented
          value={value.language}
          onChange={(language) => onChange({ language })}
          options={(["ar", "darija", "mixed"] as WordLanguage[]).map((lang) => ({
            value: lang,
            label: LANGUAGE_LABEL[lang],
          }))}
        />
      </Section>

      <Section
        title="الفئات"
        hint={`الكلمات المتاحة حاليًا: ${selectedWordCount.toLocaleString("ar-MA")}`}
      >
        <Segmented
          size="sm"
          value={pickerMode}
          onChange={setPickerMode}
          options={[
            { value: "include", label: `المشمولة (${value.category_ids.length || "الكل"})` },
            { value: "exclude", label: `المستثناة (${value.excluded_category_ids.length})` },
          ]}
        />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="ابحث عن فئة…"
        />
        <div className="flex items-center justify-between gap-2 text-[11px] text-faint">
          <span>
            {pickerMode === "include"
              ? "بدون اختيار = كل الفئات متاحة"
              : "الفئات المستثناة تُحذف من السحب"}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="font-semibold text-brand-soft hover:underline"
              onClick={() =>
                onChange({
                  [key]: filtered
                    .filter((c) => !selected.includes(c.id))
                    .reduce((acc, c) => [...acc, c.id], selected),
                } as Partial<RoomSettings>)
              }
            >
              تحديد الكل
            </button>
            <button
              type="button"
              className="font-semibold text-muted hover:underline"
              onClick={() => onChange({ [key]: [] } as Partial<RoomSettings>)}
            >
              مسح
            </button>
          </div>
        </div>

        <div className="no-scrollbar max-h-72 overflow-y-auto rounded-[14px] border border-line bg-base/40 p-2">
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {filtered.map((category) => {
              const active = selected.includes(category.id);
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => toggleCategory(category.id)}
                  aria-pressed={active}
                  className={cn(
                    "flex items-center gap-2 rounded-[11px] border px-2.5 py-2 text-right transition-colors",
                    active
                      ? "border-brand/60 bg-brand/12"
                      : "border-line bg-elevated/50 hover:border-brand/35",
                  )}
                >
                  <span className="text-base">{category.emoji}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-semibold text-ink">
                      {category.name_ar}
                    </span>
                    <span className="numeric block text-[10px] text-faint">{category.word_count}</span>
                  </span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="col-span-full py-6 text-center text-xs text-faint">لا نتائج</p>
            )}
          </div>
        </div>
      </Section>

      <Section title="خيارات">
        <Toggle
          label="تفعيل الدردشة النصية"
          hint="رسائل داخل الغرفة أثناء المباراة."
          checked={value.allow_chat}
          onChange={(allow_chat) => onChange({ allow_chat })}
        />
        <Toggle
          label="السماح بالانضمام بعد البدء"
          hint="اللاعب الجديد يحصل على صف في لوحة النقاط فقط."
          checked={value.allow_mid_game_join}
          onChange={(allow_mid_game_join) => onChange({ allow_mid_game_join })}
        />
      </Section>
    </div>
  );
}
