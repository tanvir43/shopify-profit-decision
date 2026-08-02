import prisma from "~/db.server";

import { createPrismaCostProfileRepository } from "../repositories";
import { createSellingPriceService } from "./createSellingPriceService";

/**
 * Server-only composition root for SellingPriceService.
 */
export const sellingPriceService = createSellingPriceService(
  createPrismaCostProfileRepository(prisma),
);
