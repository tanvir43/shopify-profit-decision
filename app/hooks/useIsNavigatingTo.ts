import { useNavigation } from "react-router";

/**
 * True while React Router is navigating to the given href.
 * Use with `s-button loading` for link buttons that wait on a loader.
 */
export function useIsNavigatingTo(href: string | undefined): boolean {
  const navigation = useNavigation();

  if (!href || navigation.state === "idle" || navigation.location == null) {
    return false;
  }

  const target = new URL(href, "https://example.invalid");
  const next = navigation.location;

  if (next.pathname !== target.pathname) {
    return false;
  }

  const targetParams = new URLSearchParams(target.search);
  if ([...targetParams.keys()].length === 0) {
    return true;
  }

  const nextParams = new URLSearchParams(next.search);
  for (const [key, value] of targetParams) {
    if (nextParams.get(key) !== value) {
      return false;
    }
  }

  return true;
}
