/**
 * How a CostItem value is interpreted by downstream decision modules.
 * FIXED      — absolute amount in the profile currency
 * PERCENTAGE — proportion of a base chosen by the consumer (price, COGS, etc.)
 */
export type CostUnit = "FIXED" | "PERCENTAGE";
