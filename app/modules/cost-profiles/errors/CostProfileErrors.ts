/**
 * Application/domain errors for Cost Profile use cases.
 * Routes may map these to HTTP; they must not expose Prisma details.
 */

export class CostProfileNotFoundError extends Error {
  readonly code = "COST_PROFILE_NOT_FOUND" as const;

  constructor(shop: string, productId: string) {
    super(
      `Cost profile not found for shop "${shop}" and product "${productId}".`,
    );
    this.name = "CostProfileNotFoundError";
  }
}

export class CostProfileValidationError extends Error {
  readonly code = "COST_PROFILE_VALIDATION" as const;

  constructor(message: string) {
    super(message);
    this.name = "CostProfileValidationError";
  }
}
