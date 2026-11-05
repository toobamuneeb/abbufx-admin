"use client";

import { useEffect, useState } from "react";
import Toast from "@/components/Toast";
import { getSupabase } from "@/lib/supabase/client";
import { DEMO_CODES, DEMO_SETTINGS, type AccessCode, type Settings } from "@/lib/types";

const TV_URL = process.env.NEXT_PUBLIC_TV_URL;

// Screen rotation settings are hidden for now. Set to true to show them again.
const SHOW_ROTATION_SETTINGS = false;

function randomCode() {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return String(n).padStart(6, "0");
}

const card = "rounded-[18px] border border-line bg-white p-[16px] sm:p-[20px]";

function DisplaySettings() {
  const db = getSupabase();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [seconds, setSeconds] = useState("");
  const [msg, setMsg] = useState<{ title: string; tone?: "error" } | null>(null);

  useEffect(() => {
    const apply = (s: Settings) => {
      setSettings(s);
      setSeconds(String(s.rotate_seconds));
    };
    if (!db) return apply(DEMO_SETTINGS);
    db.from("settings")
      .select("auto_rotate, rotate_seconds, rates_updated_at")
      .eq("id", 1)
      .single()
      .then(({ data }) => data && apply(data));
  }, [db]);

  async function save(patch: Partial<Settings>) {
    if (!settings) return;
    setMsg(null);
    if (db) {
      const { data, error } = await db.from("settings").update(patch).eq("id", 1).select("id");
      if (error || !data?.length)
        return setMsg({ title: error?.message ?? "This account is not allowed to change settings.", tone: "error" });
    }
    setSettings({ ...settings, ...patch });
    setMsg({ title: "Saved — TVs updated" });
  }

  const secs = Number(seconds);
  const secondsValid = Number.isInteger(secs) && secs >= 5 && secs <= 600;

  return (
    <section className={`${card} flex flex-col gap-[16px]`}>
      <div>
        <h2 className="text-[16px] font-extrabold text-ink">Screen rotation</h2>
        <p className="mt-[2px] text-[13px] font-medium text-muted">
          Screen 1 shows USD, GBP and EUR. Screen 2 shows all currencies. The arrows on the TV (or remote) switch
          screens at any time.
        </p>
      </div>

      <div className="flex items-center justify-between gap-[12px]">
        <span className="text-[14px] font-bold text-ink">Rotate automatically</span>
        <button
          role="switch"
          aria-checked={!!settings?.auto_rotate}
          disabled={!settings}
          onClick={() => settings && save({ auto_rotate: !settings.auto_rotate })}
          className={`relative h-[30px] w-[52px] shrink-0 rounded-full transition ${settings?.auto_rotate ? "bg-brand" : "bg-[#d0d2d6]"}`}
        >
          <span
            className={`absolute top-[3px] size-[24px] rounded-full bg-white shadow transition-all ${
              settings?.auto_rotate ? "left-[25px]" : "left-[3px]"
            }`}
          />
        </button>
      </div>

      <form
        className={`flex flex-wrap items-end gap-[12px] ${settings?.auto_rotate ? "" : "opacity-50"}`}
        onSubmit={(e) => {
          e.preventDefault();
          if (secondsValid) save({ rotate_seconds: secs });
        }}
      >
        <label className="flex flex-col gap-[5px]">
          <span className="text-[11px] font-extrabold tracking-[1.32px] text-ink">SECONDS PER SCREEN</span>
          <input
            inputMode="numeric"
            value={seconds}
            onChange={(e) => setSeconds(e.target.value.replace(/\D/g, ""))}
            className={`w-[140px] rounded-[12px] border-[1.5px] px-[12px] py-[7px] font-num text-[28px] font-bold leading-[34px] outline-none focus:border-brand ${
              secondsValid ? "border-line" : "border-brand"
            }`}
          />
        </label>
        <button
          type="submit"
          disabled={!settings || !secondsValid || secs === settings.rotate_seconds}
          className="rounded-[12px] bg-ink px-[18px] py-[14px] text-[14px] font-extrabold text-white disabled:opacity-30"
        >
          Save
        </button>
        {!secondsValid && <p className="w-full text-[12px] font-semibold text-brand">Use 5 to 600 seconds</p>}
      </form>

      {msg && <Toast title={msg.title} tone={msg.tone} />}
    </section>
  );
}

function AccessCodes() {
  const db = getSupabase();
  const [codes, setCodes] = useState<AccessCode[] | null>(null);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!db) return setCodes(DEMO_CODES);
    db.from("access_codes")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(error.message);
        setCodes(data ?? []);
      });
  }, [db]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const row = { code: randomCode(), label: label.trim() || null };

    let created: AccessCode | null = null;
    if (db) {
      // Retry on the rare chance the random code already exists.
      for (let i = 0; i < 3 && !created; i++) {
        const { data, error } = await db.from("access_codes").insert(row).select().single();
        if (data) created = data;
        else if (error?.code === "23505") row.code = randomCode();
        else {
          setError(error?.message ?? "Could not create code");
          break;
        }
      }
    } else {
      created = { ...row, id: crypto.randomUUID(), created_at: new Date().toISOString() };
    }

    if (created) {
      setCodes((c) => [created!, ...(c ?? [])]);
      setLabel("");
    }
    setBusy(false);
  }

  async function remove(c: AccessCode) {
    if (!confirm(`Delete code ${c.code}? Any TV using it will be locked right away.`)) return;
    if (db) {
      const { data, error } = await db.from("access_codes").delete().eq("id", c.id).select("id");
      if (error || !data?.length) return setError(error?.message ?? "This account is not allowed to delete codes.");
    }
    setCodes((list) => list?.filter((x) => x.id !== c.id) ?? null);
  }

  return (
    <section className={`${card} flex flex-col gap-[16px]`}>
      <div>
        <h2 className="text-[16px] font-extrabold text-ink">TV access codes</h2>
        <p className="mt-[2px] text-[13px] font-medium text-muted">
          Type a code on a TV to unlock the rate board. It stays unlocked until you delete the code.
        </p>
      </div>

      <form onSubmit={create} className="flex flex-col gap-[10px] sm:flex-row">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={60}
          placeholder="Name (optional), e.g. Front window TV"
          className="min-w-0 flex-1 rounded-[12px] border-[1.5px] border-line p-[14px] text-[15px] font-medium outline-none focus:border-brand"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-[14px] bg-brand px-[22px] py-[14px] text-[15px] font-extrabold text-white transition hover:brightness-110 disabled:opacity-60"
        >
          {busy ? "Creating…" : "+ New code"}
        </button>
      </form>

      {error && <Toast title="Something went wrong" detail={error} tone="error" />}

      {codes === null ? (
        <p className="text-[13px] font-medium text-muted">Loading…</p>
      ) : codes.length === 0 ? (
        <p className="rounded-[12px] bg-canvas p-[14px] text-center text-[13px] font-medium text-muted">
          No codes yet. Create one, then enter it on your TV.
        </p>
      ) : (
        <ul className="flex flex-col gap-[10px]">
          {codes.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-[12px] rounded-[14px] border border-line px-[16px] py-[12px]">
              <div className="min-w-0">
                <p className="font-num text-[32px] font-bold leading-[36px] tracking-[4px] text-ink">{c.code}</p>
                <p className="text-[12px] font-medium text-muted">
                  {c.label ? `${c.label} · ` : ""}Created {new Date(c.created_at).toLocaleDateString("en-GB")}
                </p>
              </div>
              <button
                onClick={() => remove(c)}
                className="shrink-0 rounded-[10px] border border-brand/40 px-[12px] py-[8px] text-[12px] font-bold text-brand transition hover:bg-brand/5"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      {TV_URL && (
        <p className="rounded-[12px] bg-canvas px-[14px] py-[12px] text-[12px] font-medium text-muted">
          TV URL: <span className="font-bold text-ink">{TV_URL}</span>
        </p>
      )}
    </section>
  );
}

export default function TvPage() {
  return (
    <main className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col gap-[12px] px-[20px] pb-[40px] pt-[18px]">
      <div className="flex flex-col gap-[2px]">
        <h1 className="text-[22px] font-extrabold text-ink">TV screens</h1>
        <p className="text-[12px] font-medium text-muted">
          {SHOW_ROTATION_SETTINGS ? "Access codes and how the TVs rotate between screens" : "Access codes for your TVs"}
        </p>
      </div>
      <div className={`grid grid-cols-1 gap-[12px] ${SHOW_ROTATION_SETTINGS ? "lg:grid-cols-[1fr_380px]" : "max-w-[720px]"}`}>
        <AccessCodes />
        {SHOW_ROTATION_SETTINGS && <DisplaySettings />}
      </div>
    </main>
  );
}
