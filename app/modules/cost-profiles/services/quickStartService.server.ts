import prisma from "~/db.server";

import { createPrismaCostProfileRepository } from "../repositories";
import { createQuickStartService } from "./createQuickStartService";

export const quickStartService = createQuickStartService(
  createPrismaCostProfileRepository(prisma),
);
