import { NAV_ITEMS } from "~/lib/navigation";

export function AppNavigation() {
  return (
    <s-app-nav>
      {NAV_ITEMS.map((item) => (
        <s-link key={item.href} href={item.href}>
          {item.label}
        </s-link>
      ))}
    </s-app-nav>
  );
}
