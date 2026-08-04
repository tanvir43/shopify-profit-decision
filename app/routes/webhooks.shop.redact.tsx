import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

/**
 * Mandatory compliance webhook: shop/redact.
 * Erases merchant-owned application data for the shop (sent ~48h after uninstall).
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // CostItem rows cascade when CostProfile is deleted.
  await db.costProfile.deleteMany({ where: { shop } });
  await db.trackedProduct.deleteMany({ where: { shopId: shop } });
  await db.session.deleteMany({ where: { shop } });

  return new Response();
};
