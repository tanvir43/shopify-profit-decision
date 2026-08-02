export const APP_NAME = "ProfitPilot";

/**
 * App sidebar navigation.
 * Set `enabled: true` to show an item in the MVP sidebar.
 * Disabled items stay defined so routes remain reachable by URL
 * and can be re-enabled without rewriting AppNavigation.
 */
export const ALL_NAV_ITEMS = [
  { label: "Dashboard", href: "/app", enabled: false },
  { label: "Products", href: "/app/products", enabled: true },
  { label: "Pricing", href: "/app/pricing", enabled: false },
  { label: "Discounts", href: "/app/discounts", enabled: false },
  { label: "Settings", href: "/app/settings", enabled: false },
] as const;

export const NAV_ITEMS = ALL_NAV_ITEMS.filter((item) => item.enabled);

export type NavItem = (typeof ALL_NAV_ITEMS)[number];
