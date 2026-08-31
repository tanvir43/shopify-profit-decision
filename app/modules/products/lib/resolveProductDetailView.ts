import { PRODUCT_LEVEL_VARIANT_ID } from "~/modules/cost-profiles/lib/variantContext";
import type { CostProfile } from "~/modules/cost-profiles/types/CostProfile";
import type { CostProfileMode } from "~/modules/cost-profiles/types/CostProfileMode";

import { hasProductCost } from "./productStatus";
import type { ShopifyProductVariantEnrichment } from "../services/shopifyProductsService.server";
import {
  toVariantContext,
  type VariantContext,
} from "./variantContext";

export type VariantSelectionOption = ShopifyProductVariantEnrichment & {
  hasProductCost: boolean;
};

export type ProductDetailView =
  | {
      kind: "variant-selection";
      trackedProductId: string;
      productTitle: string;
      imageUrl: string | null;
      imageAlt: string | null;
      currency: string;
      variants: VariantSelectionOption[];
    }
  | {
      kind: "onboarding";
      trackedProductId: string;
      currency: string;
      totalCost: string | null;
      shopifyVariantId: string;
      variant: VariantContext;
      productTitle: string;
      imageUrl: string | null;
      imageAlt: string | null;
    }
  | {
      kind: "dashboard";
      trackedProductId: string;
      mode: CostProfileMode;
      shopifyVariantId: string;
      variant: VariantContext;
      profile: CostProfile;
      productTitle: string;
      productStatus: string;
      imageUrl: string | null;
      imageAlt: string | null;
    };

function isDecisionReadyProfile(profile: CostProfile): boolean {
  return (
    (profile.mode === "QUICK_START" || profile.mode === "DETAILED") &&
    hasProductCost(profile.totalCost)
  );
}

function profilesWithCost(profiles: CostProfile[]): CostProfile[] {
  return profiles.filter(isDecisionReadyProfile);
}

function buildVariantSelectionOptions(
  variants: ShopifyProductVariantEnrichment[],
  profiles: CostProfile[],
): VariantSelectionOption[] {
  const readyProfiles = profilesWithCost(profiles);

  return variants.map((variant) => ({
    ...variant,
    hasProductCost: readyProfiles.some(
      (profile) => profile.shopifyVariantId === variant.id,
    ),
  }));
}

function buildOnboardingView(input: {
  trackedProductId: string;
  currency: string;
  profile: CostProfile | null;
  shopifyVariantId: string;
  variants: ShopifyProductVariantEnrichment[];
  productTitle: string;
  imageUrl: string | null;
  imageAlt: string | null;
}): Extract<ProductDetailView, { kind: "onboarding" }> {
  return {
    kind: "onboarding",
    trackedProductId: input.trackedProductId,
    currency: input.currency,
    totalCost: input.profile?.totalCost ?? null,
    shopifyVariantId: input.shopifyVariantId,
    variant: toVariantContext(input.shopifyVariantId, input.variants),
    productTitle: input.productTitle,
    imageUrl: input.imageUrl,
    imageAlt: input.imageAlt,
  };
}

function buildDashboardView(input: {
  trackedProductId: string;
  profile: CostProfile;
  shopifyVariantId: string;
  variants: ShopifyProductVariantEnrichment[];
  productTitle: string;
  productStatus: string;
  imageUrl: string | null;
  imageAlt: string | null;
}): Extract<ProductDetailView, { kind: "dashboard" }> {
  return {
    kind: "dashboard",
    trackedProductId: input.trackedProductId,
    mode: input.profile.mode,
    shopifyVariantId: input.shopifyVariantId,
    variant: toVariantContext(input.shopifyVariantId, input.variants),
    profile: input.profile,
    productTitle: input.productTitle,
    productStatus: input.productStatus,
    imageUrl: input.imageUrl,
    imageAlt: input.imageAlt,
  };
}

function buildVariantSelectionView(input: {
  trackedProductId: string;
  variants: ShopifyProductVariantEnrichment[];
  profiles: CostProfile[];
  currency: string;
  productTitle: string;
  imageUrl: string | null;
  imageAlt: string | null;
}): Extract<ProductDetailView, { kind: "variant-selection" }> {
  return {
    kind: "variant-selection",
    trackedProductId: input.trackedProductId,
    productTitle: input.productTitle,
    imageUrl: input.imageUrl,
    imageAlt: input.imageAlt,
    currency: input.currency,
    variants: buildVariantSelectionOptions(input.variants, input.profiles),
  };
}

export function hasValidVariantSelection(
  variants: ShopifyProductVariantEnrichment[],
  selectedShopifyVariantId: string | null,
): boolean {
  const selected = selectedShopifyVariantId?.trim();
  return Boolean(
    selected && variants.some((variant) => variant.id === selected),
  );
}

/** Loader payload for the variant-selection step before cost onboarding. */
export function buildVariantSelectionLoaderData(input: {
  trackedProductId: string;
  variants: ShopifyProductVariantEnrichment[];
  profiles: CostProfile[];
  currency: string;
  productTitle: string;
  imageUrl: string | null;
  imageAlt: string | null;
}): Extract<ProductDetailView, { kind: "variant-selection" }> {
  return buildVariantSelectionView(input);
}

export function resolveProductDetailView(input: {
  trackedProductId: string;
  variants: ShopifyProductVariantEnrichment[];
  profiles: CostProfile[];
  selectedShopifyVariantId: string | null;
  currency: string;
  productTitle: string;
  productStatus: string;
  imageUrl: string | null;
  imageAlt: string | null;
}): ProductDetailView {
  const {
    trackedProductId,
    variants,
    profiles,
    selectedShopifyVariantId,
    currency,
    productTitle,
    productStatus,
    imageUrl,
    imageAlt,
  } = input;

  const readyProfiles = profilesWithCost(profiles);
  const legacyProfile = readyProfiles.find(
    (profile) => profile.shopifyVariantId === PRODUCT_LEVEL_VARIANT_ID,
  );

  if (variants.length === 0) {
    const profile =
      profiles.find(
        (item) => item.shopifyVariantId === PRODUCT_LEVEL_VARIANT_ID,
      ) ?? null;

    if (profile && isDecisionReadyProfile(profile)) {
      return buildDashboardView({
        trackedProductId,
        profile,
        shopifyVariantId: PRODUCT_LEVEL_VARIANT_ID,
        variants,
        productTitle,
        productStatus,
        imageUrl,
        imageAlt,
      });
    }

    return buildOnboardingView({
      trackedProductId,
      currency: profile?.currency ?? currency,
      profile,
      shopifyVariantId: PRODUCT_LEVEL_VARIANT_ID,
      variants,
      productTitle,
      imageUrl,
      imageAlt,
    });
  }

  if (variants.length === 1) {
    const shopifyVariantId = variants[0].id;
    const variantProfile = profiles.find(
      (profile) => profile.shopifyVariantId === shopifyVariantId,
    );
    const activeProfile =
      (variantProfile && isDecisionReadyProfile(variantProfile)
        ? variantProfile
        : null) ?? legacyProfile ?? null;

    if (activeProfile) {
      return buildDashboardView({
        trackedProductId,
        profile: activeProfile,
        shopifyVariantId: activeProfile.shopifyVariantId,
        variants,
        productTitle,
        productStatus,
        imageUrl,
        imageAlt,
      });
    }

    return buildOnboardingView({
      trackedProductId,
      currency: variantProfile?.currency ?? currency,
      profile: variantProfile ?? null,
      shopifyVariantId,
      variants,
      productTitle,
      imageUrl,
      imageAlt,
    });
  }

  // Multi-variant products
  if (
    legacyProfile &&
    readyProfiles.every(
      (profile) => profile.shopifyVariantId === PRODUCT_LEVEL_VARIANT_ID,
    )
  ) {
    return buildDashboardView({
      trackedProductId,
      profile: legacyProfile,
      shopifyVariantId: PRODUCT_LEVEL_VARIANT_ID,
      variants,
      productTitle,
      productStatus,
      imageUrl,
      imageAlt,
    });
  }

  const variantReadyProfiles = readyProfiles.filter(
    (profile) => profile.shopifyVariantId !== PRODUCT_LEVEL_VARIANT_ID,
  );

  if (variantReadyProfiles.length === 1 && !legacyProfile) {
    const profile = variantReadyProfiles[0];
    return buildDashboardView({
      trackedProductId,
      profile,
      shopifyVariantId: profile.shopifyVariantId,
      variants,
      productTitle,
      productStatus,
      imageUrl,
      imageAlt,
    });
  }

  if (!hasValidVariantSelection(variants, selectedShopifyVariantId)) {
    return buildVariantSelectionView({
      trackedProductId,
      variants,
      profiles,
      currency,
      productTitle,
      imageUrl,
      imageAlt,
    });
  }

  const shopifyVariantId = selectedShopifyVariantId!.trim();
  const selectedProfile =
    profiles.find((profile) => profile.shopifyVariantId === shopifyVariantId) ??
    null;

  if (selectedProfile && isDecisionReadyProfile(selectedProfile)) {
    return buildDashboardView({
      trackedProductId,
      profile: selectedProfile,
      shopifyVariantId,
      variants,
      productTitle,
      productStatus,
      imageUrl,
      imageAlt,
    });
  }

  return buildOnboardingView({
    trackedProductId,
    currency: selectedProfile?.currency ?? currency,
    profile: selectedProfile,
    shopifyVariantId,
    variants,
    productTitle,
    imageUrl,
    imageAlt,
  });
}
