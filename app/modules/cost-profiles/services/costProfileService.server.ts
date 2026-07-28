import prisma from "~/db.server";

import { createPrismaCostProfileRepository } from "../repositories";
import { createCostProfileService } from "./createCostProfileService";

/**
 * Server-only composition root for CostProfileService.
 * Routes import this singleton — never Prisma or the repository.
 */
export const costProfileService = createCostProfileService(
  createPrismaCostProfileRepository(prisma),
);
