export default function Toast({ title, detail, tone = "success" }: { title: string; detail?: string; tone?: "success" | "error" }) {
  const ok = tone === "success";
  return (
    <div
      role="status"
      className={`flex items-center gap-[12px] rounded-[14px] border p-[14px] ${
        ok ? "border-[rgba(22,163,74,0.4)] bg-[rgba(22,163,74,0.1)]" : "border-brand/40 bg-brand/10"
      }`}
    >
      <span
        className={`flex size-[30px] shrink-0 items-center justify-center rounded-full text-[16px] font-extrabold text-white ${
          ok ? "bg-[#16a34a]" : "bg-brand"
        }`}
      >
        {ok ? "✓" : "!"}
      </span>
      <div className="flex flex-col gap-[2px]">
        <p className={`text-[14px] font-extrabold ${ok ? "text-[#116b33]" : "text-brand"}`}>{title}</p>
        {detail && <p className={`text-[12px] font-medium ${ok ? "text-[#2e7d4b]" : "text-brand/80"}`}>{detail}</p>}
      </div>
    </div>
  );
}
