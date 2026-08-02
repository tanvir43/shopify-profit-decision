/**
 * Strategy compatibility analysis (PP-0015.3 / PP-0015.3.1).
 *
 * Runs AFTER simulation. Never mutates inputs, never blocks calculation,
 * and never disables strategies — warnings are advisory only.
 *
 * Analysis considers only field-active strategies (value > 0 / checked),
 * not every strategy present in the workspace list.
 */

import { getActiveStrategyIds } from "./strategyActivation";
import type { StrategyInputs } from "./simulateProjectedOutcome";
import {
  getStrategyDefinition,
  type StrategyCategory,
  type StrategyId,
} from "./strategyCatalog";

/** Advisory severities only — never critical / error / blocked / invalid. */
export type CompatibilitySeverity = "warning" | "recommendation";

/**
 * Data-driven rule. New strategies inherit category metadata; new rules
 * register here without strategy-name branching in the analyzer.
 */
export type CompatibilityRule = {
  id: string;
  /** Category whose overlap triggers this rule. */
  category: StrategyCategory;
  /** Fire when at least this many strategies in the category are active. */
  minCount: number;
  severity: CompatibilitySeverity;
  /** Human label for the category, used in dynamic headings. */
  categoryLabel: string;
  /** Business context — why merchants often avoid this combination. */
  rationale: string;
  /** Closing guidance for the merchant. */
  recommendation: string;
};

export type CompatibilityWarning = {
  id: string;
  severity: CompatibilitySeverity;
  heading: string;
  /** Labels of the currently active strategies that triggered the rule. */
  strategyLabels: string[];
  rationale: string;
  calculatedNote: string;
  recommendation: string;
};

const CALCULATED_NOTE =
  "Your simulation has still been calculated correctly.";

/**
 * Compatibility rules are metadata. Avoid per-strategy if branches —
 * future strategies only need a catalog category assignment.
 */
export const COMPATIBILITY_RULES: readonly CompatibilityRule[] = [
  {
    id: "multiple_price_adjustment",
    category: "price_adjustment",
    minCount: 2,
    severity: "warning",
    categoryLabel: "Price Adjustment",
    rationale:
      "Many merchants do not combine all of these strategies together because they stack multiple price reductions on the same product.",
    recommendation:
      "Verify that this combination matches your intended promotion before making a pricing decision.",
  },
];

function groupActiveByCategory(
  activeIds: readonly StrategyId[],
): Map<StrategyCategory, StrategyId[]> {
  const groups = new Map<StrategyCategory, StrategyId[]>();

  for (const strategyId of activeIds) {
    const { category } = getStrategyDefinition(strategyId);
    const existing = groups.get(category);
    if (existing) {
      existing.push(strategyId);
    } else {
      groups.set(category, [strategyId]);
    }
  }

  return groups;
}

function buildHeading(rule: CompatibilityRule): string {
  return `Multiple ${rule.categoryLabel.toLowerCase()} strategies detected.`;
}

function buildWarning(
  rule: CompatibilityRule,
  strategyIds: readonly StrategyId[],
): CompatibilityWarning {
  return {
    id: rule.id,
    severity: rule.severity,
    heading: buildHeading(rule),
    strategyLabels: strategyIds.map(
      (id) => getStrategyDefinition(id).label,
    ),
    rationale: rule.rationale,
    calculatedNote: CALCULATED_NOTE,
    recommendation: rule.recommendation,
  };
}

/**
 * Analyze field-active strategies for advisory compatibility warnings.
 * Asks each workspace strategy whether it is active, then runs rules.
 * Does not affect simulation math.
 */
export function analyzeStrategyCompatibility(
  strategies: StrategyInputs,
  rules: readonly CompatibilityRule[] = COMPATIBILITY_RULES,
): CompatibilityWarning[] {
  const activeIds = getActiveStrategyIds(strategies);

  if (activeIds.length === 0 || rules.length === 0) {
    return [];
  }

  const byCategory = groupActiveByCategory(activeIds);
  const warnings: CompatibilityWarning[] = [];

  for (const rule of rules) {
    const matching = byCategory.get(rule.category) ?? [];
    if (matching.length >= rule.minCount) {
      warnings.push(buildWarning(rule, matching));
    }
  }

  return warnings;
}
