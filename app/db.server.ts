import { Prisma, PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

function createPrismaClient() {
  return new PrismaClient();
}

function modelDelegateName(modelName: string): string {
  return `${modelName.charAt(0).toLowerCase()}${modelName.slice(1)}`;
}

/**
 * Vite HMR reuses `global.prismaGlobal`. After `prisma generate` adds models,
 * that cached instance can still be missing delegates (`savedComparison` was
 * undefined → `findMany` crashed the products page). Recreate when stale.
 */
function prismaClientHasCurrentModels(client: PrismaClient): boolean {
  const delegates = client as Record<string, { findMany?: unknown }>;
  return Prisma.dmmf.datamodel.models.every((model) => {
    return typeof delegates[modelDelegateName(model.name)]?.findMany === "function";
  });
}

function getPrismaClient(): PrismaClient {
  const cached = global.prismaGlobal;
  if (cached && prismaClientHasCurrentModels(cached)) {
    return cached;
  }

  if (cached) {
    void cached.$disconnect();
  }

  const client = createPrismaClient();
  if (process.env.NODE_ENV !== "production") {
    global.prismaGlobal = client;
  }
  return client;
}

const prisma = getPrismaClient();

export default prisma;
