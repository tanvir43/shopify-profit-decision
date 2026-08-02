import prisma from "~/db.server";

import { createPrismaCostProfileRepository } from "../repositories";
import { createDetailedSetupService } from "./createDetailedSetupService";

export const detailedSetupService = createDetailedSetupService(
  createPrismaCostProfileRepository(prisma),
);
