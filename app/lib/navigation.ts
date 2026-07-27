export const APP_NAME = "ProfitPilot";

export const NAV_ITEMS = [
  { label: "Dashboard", href: "/app" },
  { label: "Products", href: "/app/products" },
  { label: "Pricing", href: "/app/pricing" },
  { label: "Discounts", href: "/app/discounts" },
  { label: "Settings", href: "/app/settings" },
] as const;

export type NavItem = (typeof NAV_ITEMS)[number];
