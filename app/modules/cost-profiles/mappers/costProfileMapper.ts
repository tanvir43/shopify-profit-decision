import type { CostItem, CostProfile, CostProfilePersist } from "../types";

/**
 * Maps between Prisma records and domain types.
 * Keeps Decimal, Date, and enum wire shapes out of services/routes.
 */
export interface CostProfileMapper {
  toDomain(prismaProfile: unknown): CostProfile;
  toDomainItem(prismaItem: unknown): CostItem;
  toPersist(profile: CostProfilePersist): unknown;
}
