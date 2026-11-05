export type Currency = {
  code: string;
  name: string;
  symbol: string;
  buy: number;
  sell: number;
  sort_order: number;
  featured: boolean;
};

export type Settings = {
  auto_rotate: boolean;
  rotate_seconds: number;
  rates_updated_at: string;
};

export type AccessCode = {
  id: string;
  code: string;
  label: string | null;
  created_at: string;
};

export const DEMO_CURRENCIES: Currency[] = [
  { code: "USD", name: "US Dollar", symbol: "$", buy: 1373, sell: 1383, sort_order: 1, featured: true },
  { code: "GBP", name: "British Pound", symbol: "£", buy: 1830, sell: 1850, sort_order: 2, featured: true },
  { code: "EUR", name: "Euro", symbol: "€", buy: 1560, sell: 1575, sort_order: 3, featured: true },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$", buy: 985, sell: 1005, sort_order: 4, featured: false },
  { code: "AED", name: "UAE Dirham", symbol: "د.إ", buy: 372, sell: 380, sort_order: 5, featured: false },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥", buy: 186, sell: 193, sort_order: 6, featured: false },
];

export const DEMO_SETTINGS: Settings = {
  auto_rotate: false,
  rotate_seconds: 15,
  rates_updated_at: new Date().toISOString(),
};

export const DEMO_CODES: AccessCode[] = [
  { id: "demo-1", code: "482913", label: "Front window TV", created_at: new Date().toISOString() },
];

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${formatTime(iso)} · ${d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}`;
}
