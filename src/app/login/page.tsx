"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getSupabase, isDemo } from "@/lib/supabase/client";

const field =
  "w-full rounded-[12px] border-[1.5px] border-line bg-white p-[14px] text-[16px] font-medium text-ink outline-none focus:border-brand";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const db = getSupabase();
    if (db) {
      const { error } = await db.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        setError(error.message === "Invalid login credentials" ? "Wrong email or password." : error.message);
        setBusy(false);
        return;
      }
      // A valid login isn't enough: the account must be in the admins table.
      const { data: admin } = await db.rpc("is_admin");
      if (admin !== true) {
        await db.auth.signOut();
        setError("This account is not an ABBUFX admin.");
        setBusy(false);
        return;
      }
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-dvh flex-col items-center gap-[36px] border-t-8 border-brand bg-gradient-to-b from-[#1e2026] to-[#0a0b0d] px-[24px] pb-[40px] pt-[140px] sm:justify-center sm:pt-[40px]">
      <div className="flex flex-col items-center gap-[14px]">
        <img src="/brand/logo.png" alt="ABBUFX Bureau de Change" className="h-[55px] w-[320px] object-contain" />
        <p className="text-[14px] font-medium text-[#a3a9b4]">Rate Manager · Owner access</p>
      </div>

      <form onSubmit={signIn} className="flex w-full max-w-[400px] flex-col gap-[16px] rounded-[22px] bg-white px-[20px] py-[24px] sm:px-[28px] sm:py-[32px]">
        <h1 className="text-[22px] font-extrabold text-ink">Sign in</h1>

        <label className="flex flex-col gap-[6px]">
          <span className="text-[13px] font-semibold text-muted">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="owner@abbufx.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={field}
          />
        </label>

        <label className="flex flex-col gap-[6px]">
          <span className="text-[13px] font-semibold text-muted">Password</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={field}
          />
        </label>

        {error && <p className="text-[13px] font-semibold text-brand">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-[14px] bg-brand py-[16px] text-[16px] font-extrabold text-white transition hover:brightness-110 disabled:opacity-60"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>

        {isDemo && <p className="text-center text-[12px] font-medium text-muted">Demo mode — any email/password works</p>}
      </form>

      <p className="text-center text-[12px] font-medium text-[#7b818c]">Only authorised ABBUFX staff can change rates.</p>
    </main>
  );
}
