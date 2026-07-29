import prisma from "~/db.server";

import { createPrismaTrackedProductRepository } from "../repositories/prismaTrackedProductRepository";
import { createTrackedProductService } from "./createTrackedProductService";

/**
 * Server-only composition root for TrackedProductService.
 * Routes import this singleton — never Prisma or the repository.
 */
export const trackedProductService = createTrackedProductService(
  createPrismaTrackedProductRepository(prisma),
);
