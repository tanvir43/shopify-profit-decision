import type { LoaderFunctionArgs } from "react-router";

import { authenticate } from "~/shopify.server";

export async function requireAdminAuth({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);
  return null;
}
