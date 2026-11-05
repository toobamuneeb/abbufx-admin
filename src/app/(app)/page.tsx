"use client";

import { useEffect, useMemo, useState } from "react";
import Toast from "@/components/Toast";
import { getSupabase } from "@/lib/supabase/client";
import { DEMO_CURRENCIES, DEMO_SETTINGS, formatDateTime, formatTime, type Currency } from "@/lib/types";

type Draft = Record<string, { buy: string; sell: string }>;

const toText = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
const parse = (s: string) => {
  const n = Number(s.replace(/,/g, "").trim());
  return s.trim() && Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
};

function RateInput({
  label,
  value,
  edited,
  invalid,
  onChange,
  accent,
}: {
  label: string;
  value: string;
  edited: boolean;
  invalid: boolean;
  onChange: (v: string) => void;
  accent?: boolean;
}) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-[5px]">
      <span className={`text-[11px] font-extrabold tracking-[1.32px] ${accent ? "text-brand" : "text-ink"}`}>{label}</span>
      <span
        className={`flex items-center gap-[6px] rounded-[12px] border-[1.5px] bg-white px-[12px] py-[7px] focus-within:border-brand ${
          invalid || edited ? "border-brand" : "border-line"
        }`}
      >
        <span className="text-[18px] font-bold text-muted">₦</span>
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ""))}
          className="w-full min-w-0 bg-transparent font-num text-[28px] font-bold leading-[34px] text-ink outline-none"
        />
      </span>
    </label>
  );
}

export default function RatesPage() {
  const db = getSupabase();
  const [saved, setSaved] = useState<Currency[]>([]);
  const [draft, setDraft] = useState<Draft>({});
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ title: string; detail?: string; tone?: "error" } | null>(null);

  const reset = (list: Currency[]) => {
    setSaved(list);
    setDraft(Object.fromEntries(list.map((c) => [c.code, { buy: toText(c.buy), sell: toText(c.sell) }])));
  };

  useEffect(() => {
    if (!db) {
      reset(DEMO_CURRENCIES);
      setUpdatedAt(DEMO_SETTINGS.rates_updated_at);
      return;
    }
    (async () => {
      const [c, s] = await Promise.all([
        db.from("currencies").select("*").order("sort_order"),
        db.from("settings").select("rates_updated_at").eq("id", 1).single(),
      ]);
      if (c.error) setToast({ title: "Couldn't load rates", detail: c.error.message, tone: "error" });
      if (c.data) reset(c.data.map((r) => ({ ...r, buy: Number(r.buy), sell: Number(r.sell) })));
      if (s.data) setUpdatedAt(s.data.rates_updated_at);
    })();
  }, [db]);

  const rows = useMemo(
    () =>
      saved.map((c) => {
        const d = draft[c.code] ?? { buy: "", sell: "" };
        const buy = parse(d.buy);
        const sell = parse(d.sell);
        return { c, d, buy, sell, buyEdited: buy !== null && buy !== c.buy, sellEdited: sell !== null && sell !== c.sell };
      }),
    [saved, draft],
  );
  const changed = rows.filter((r) => r.buyEdited || r.sellEdited);
  const invalid = rows.some((r) => r.buy === null || r.sell === null);

  async function save() {
    if (!changed.length || invalid) return;
    setSaving(true);
    setToast(null);
    const now = new Date().toISOString();
    const next = saved.map((c) => {
      const r = rows.find((x) => x.c.code === c.code)!;
      return { ...c, buy: r.buy!, sell: r.sell! };
    });

    if (db) {
      const updates = changed.map((r) => ({ code: r.c.code, buy: r.buy, sell: r.sell, updated_at: now }));
      const results = await Promise.all([
        ...updates.map(({ code, ...u }) => db.from("currencies").update(u).eq("code", code).select("code")),
        db.from("settings").update({ rates_updated_at: now }).eq("id", 1).select("id"),
      ]);
      // Security rules silently skip rows a non-admin may not change, so check a row came back.
      const failed = results.find((r) => r.error || !r.data?.length);
      if (failed) {
        setToast({
          title: "Rates were not saved",
          detail: failed.error?.message ?? "This account is not allowed to change rates.",
          tone: "error",
        });
        setSaving(false);
        return;
      }
    }

    reset(next);
    setUpdatedAt(now);
    setToast({ title: `Rates updated at ${formatTime(now)}`, detail: "Sent to all TV displays" });
    setSaving(false);
  }

  return (
    <>
      <main className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col gap-[12px] px-[20px] pb-[160px] pt-[18px]">
        <div className="flex flex-col gap-[2px]">
          <h1 className="text-[22px] font-extrabold text-ink">Today’s rates</h1>
          <p className="text-[12px] font-medium text-muted">
            {updatedAt ? `Last updated ${formatDateTime(updatedAt)}` : "Loading…"}
          </p>
        </div>

        {toast && <Toast {...toast} />}

        <div className="grid grid-cols-1 gap-[12px] md:grid-cols-2 lg:grid-cols-3">
          {rows.map(({ c, d, buy, sell, buyEdited, sellEdited }) => (
            <section key={c.code} className="flex flex-col gap-[10px] rounded-[18px] border border-line bg-white px-[14px] pb-[14px] pt-[12px]">
              <div className="flex items-center gap-[10px]">
                <span className="flex size-[32px] shrink-0 items-center justify-center rounded-full bg-brand/10 text-[14px] font-extrabold text-brand">
                  {c.symbol}
                </span>
                <span className="text-[16px] font-extrabold text-ink">{c.code}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-muted">{c.name}</span>
                {(buyEdited || sellEdited) && (
                  <span className="rounded-[6px] bg-[#fdf3dc] px-[8px] py-[3px] text-[11px] font-bold text-[#b7791f]">Edited</span>
                )}
              </div>
              <div className="flex gap-[12px]">
                <RateInput
                  label="WE BUY"
                  value={d.buy}
                  edited={buyEdited}
                  invalid={buy === null}
                  onChange={(v) => setDraft((p) => ({ ...p, [c.code]: { ...p[c.code], buy: v } }))}
                />
                <RateInput
                  label="WE SELL"
                  accent
                  value={d.sell}
                  edited={sellEdited}
                  invalid={sell === null}
                  onChange={(v) => setDraft((p) => ({ ...p, [c.code]: { ...p[c.code], sell: v } }))}
                />
              </div>
            </section>
          ))}
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-white">
        <div className="mx-auto flex w-full max-w-[1100px] flex-col items-center gap-[8px] px-[20px] pb-[30px] pt-[14px] sm:flex-row-reverse sm:justify-between sm:pb-[14px]">
          <button
            onClick={save}
            disabled={!changed.length || invalid || saving}
            className="w-full rounded-[14px] bg-brand py-[16px] text-[16px] font-extrabold text-white transition hover:brightness-110 disabled:opacity-40 sm:w-[320px]"
          >
            {saving ? "Updating…" : changed.length ? `Update ${changed.length} ${changed.length === 1 ? "currency" : "currencies"}` : "Update rates"}
          </button>
          <p className="text-[12px] font-medium text-muted">
            {invalid ? "Every rate needs a number above 0" : "Changes appear on every TV within seconds"}
          </p>
        </div>
      </div>
    </>
  );
}
