import type {
  CostItemInput,
  CostProfile,
  EnsureCostProfileInput,
  UpdateCostProfileMetaInput,
} from "../types";

/**
 * Business orchestration for Cost Profiles.
 *
 * Owns invariants, ensure-semantics, and decision-facing projections.
 * Does not know Prisma. Downstream modules (Pricing, Discount, etc.) depend
 * on this contract — never on CostProfileRepository.
 */
export interface CostProfileService {
  /**
   * Full profile for editing (active + inactive items, ordered by sortOrder).
   * Belongs in service: shapes the edit-facing aggregate and can attach
   * authorization / not-found policy without leaking persistence details.
   */
  getByProduct(
    shop: string,
    productId: string,
  ): Promise<CostProfile | null>;

  /**
   * Load all profiles for one Shopify product (all variant scopes).
   */
  findAllForProduct(
    shop: string,
    productId: string,
  ): Promise<CostProfile[]>;

  /**
   * Decision-facing projection: same profile with only isActive items.
   * Belongs in service: "what counts for pricing" is a business rule, not a
   * storage concern. Pricing / Discount / Break-even / Bundle / AI must not
   * each re-implement the active filter.
   */
  getDecisionProfile(
    shop: string,
    productId: string,
  ): Promise<CostProfile | null>;

  /**
   * Batch decision projection for multi-product flows.
   * Belongs in service: combines repository batching with the active-item rule.
   */
  getDecisionProfiles(
    shop: string,
    productIds: string[],
  ): Promise<CostProfile[]>;

  /**
   * Idempotent bootstrap: return existing profile or create an empty one.
   * Belongs in service: "get or create + defaults/currency" is orchestration,
   * not a single persistence primitive.
   */
  ensureForProduct(input: EnsureCostProfileInput): Promise<CostProfile>;

  /**
   * Update currency / notes without touching items.
   * Belongs in service: validates currency rules and protects item identity;
   * repository only receives a persist DTO after orchestration.
   */
  updateMeta(
    shop: string,
    productId: string,
    input: UpdateCostProfileMetaInput,
  ): Promise<CostProfile>;

  /**
   * Replace the full item set (add / update / remove / reorder / toggle active).
   * Belongs in service: enforces isSystem constraints, sortOrder integrity,
   * and value/unit invariants before calling repository.save.
   */
  replaceItems(
    shop: string,
    productId: string,
    items: CostItemInput[],
  ): Promise<CostProfile>;
}
