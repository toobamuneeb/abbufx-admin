"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getSupabase, isDemo } from "@/lib/supabase/client";

const TABS = [
  { href: "/", label: "Rates" },
  { href: "/tv", label: "TV screens" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logOut() {
    await getSupabase()?.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="bg-brand">
        <div className="mx-auto flex w-full max-w-[1100px] items-center justify-between px-[20px] pb-[16px] pt-[54px] sm:py-[16px]">
          <div className="flex items-center gap-[12px]">
            <img src="/brand/emblem.png" alt="" className="h-[40px] w-[36px] object-contain" />
            <div className="flex flex-col">
              <span className="text-[17px] font-extrabold tracking-[0.51px] text-white">ABBUFX</span>
              <span className="text-[12px] font-medium text-[#ffd9da]">Rate Manager</span>
            </div>
          </div>
          <button
            onClick={logOut}
            className="rounded-[10px] border border-white/45 px-[12px] py-[8px] text-[12px] font-semibold text-white transition hover:bg-white/10"
          >
            Log out
          </button>
        </div>
      </header>

      {isDemo && (
        <div className="bg-[#fdf3dc] px-[20px] py-[8px] text-center text-[12px] font-semibold text-[#8a5a00]">
          Demo mode — add your Supabase keys in .env.local to save changes
        </div>
      )}

      <div className="mx-auto w-full max-w-[1100px] px-[20px] pt-[18px]">
        <nav className="flex gap-[4px] rounded-[14px] bg-[#e8e9ec] p-[4px] sm:w-[360px]">
          {TABS.map((t) => {
            const active = t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`flex-1 rounded-[10px] py-[9px] text-center text-[14px] transition ${
                  active ? "bg-white font-bold text-ink shadow-[0px_1px_3px_0px_rgba(0,0,0,0.08)]" : "font-semibold text-muted"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {children}
    </div>
  );
}
