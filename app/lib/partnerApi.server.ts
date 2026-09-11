/**
 * Server-only Shopify Partner API helpers for Shopify App Pricing.
 * Never import this module from client/browser code.
 */

const PARTNER_API_VERSION = "2026-07";

const ACTIVE_SUBSCRIPTION_QUERY = `#graphql
  query ActiveSubscription($appId: ID!, $shopId: ID!) {
    activeSubscription(appId: $appId, shopId: $shopId) {
      billingPeriod
      cancelAtEndOfCycle
      trialEndsAt
      currentBillingCycle {
        startTime
        endTime
      }
      items {
        handle
      }
      pendingUpdate {
        billingPeriod
        items {
          handle
        }
      }
    }
  }
`;

export type PartnerActiveSubscription = {
  billingPeriod: string;
  cancelAtEndOfCycle: boolean;
  trialEndsAt: string | null;
  currentBillingCycle: {
    startTime: string;
    endTime: string;
  } | null;
  items: Array<{ handle: string }>;
  pendingUpdate: {
    billingPeriod: string;
    items: Array<{ handle: string }>;
  } | null;
};

export type ActiveSubscriptionCheckResult = {
  hasActiveSubscription: boolean;
  subscription: PartnerActiveSubscription | null;
};

type PartnerEnv = {
  token: string;
  organizationId: string;
  appId: string;
  appHandle: string;
};

type PartnerGraphqlResponse = {
  data?: {
    activeSubscription?: PartnerActiveSubscription | null;
  };
  errors?: Array<{ message?: string }>;
};

function requirePartnerEnv(): PartnerEnv {
  const token = process.env.SHOPIFY_PARTNER_API_TOKEN?.trim();
  const organizationId = process.env.SHOPIFY_PARTNER_ORGANIZATION_ID?.trim();
  const appId = process.env.SHOPIFY_PARTNER_APP_ID?.trim();
  const appHandle = process.env.SHOPIFY_APP_HANDLE?.trim();

  const missing: string[] = [];
  if (!token) missing.push("SHOPIFY_PARTNER_API_TOKEN");
  if (!organizationId) missing.push("SHOPIFY_PARTNER_ORGANIZATION_ID");
  if (!appId) missing.push("SHOPIFY_PARTNER_APP_ID");
  if (!appHandle) missing.push("SHOPIFY_APP_HANDLE");

  if (missing.length > 0) {
    throw new Response(
      `Partner API is not configured. Missing: ${missing.join(", ")}.`,
      { status: 500 },
    );
  }

  return {
    token: token!,
    organizationId: organizationId!,
    appId: appId!,
    appHandle: appHandle!,
  };
}

function partnerApiEndpoint(organizationId: string): string {
  return `https://partners.shopify.com/${organizationId}/api/${PARTNER_API_VERSION}/graphql.json`;
}

/**
 * Query Partner API for the shop's active Shopify App Pricing subscription.
 *
 * Failures (config / network / HTTP / GraphQL) throw a Response and must NOT
 * be treated as "no subscription".
 */
export async function checkActiveSubscription(
  shopId: string,
): Promise<ActiveSubscriptionCheckResult> {
  const env = requirePartnerEnv();
  const endpoint = partnerApiEndpoint(env.organizationId);

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": env.token,
      },
      body: JSON.stringify({
        query: ACTIVE_SUBSCRIPTION_QUERY,
        variables: {
          appId: env.appId,
          shopId,
        },
      }),
    });
  } catch {
    throw new Response(
      "Unable to reach Shopify Partner API to verify subscription.",
      { status: 502 },
    );
  }

  if (!response.ok) {
    throw new Response(
      `Partner API returned HTTP ${response.status} while verifying subscription.`,
      { status: 502 },
    );
  }

  let payload: PartnerGraphqlResponse;
  try {
    payload = (await response.json()) as PartnerGraphqlResponse;
  } catch {
    throw new Response(
      "Partner API returned an unreadable response while verifying subscription.",
      { status: 502 },
    );
  }

  if (payload.errors?.length) {
    throw new Response(
      "Partner API reported an error while verifying subscription.",
      { status: 502 },
    );
  }

  if (!("data" in payload) || typeof payload.data === "undefined") {
    throw new Response(
      "Partner API returned an unexpected response while verifying subscription.",
      { status: 502 },
    );
  }

  const subscription = payload.data.activeSubscription ?? null;

  return {
    hasActiveSubscription: subscription !== null,
    subscription,
  };
}

/**
 * Build the Shopify-hosted App Pricing plans URL for an embedded top-level redirect.
 * shopDomain examples: "campaign-os-dev.myshopify.com"
 */
export function buildHostedPricingPlansUrl(shopDomain: string): string {
  const env = requirePartnerEnv();
  const storeHandle = shopDomain.replace(/\.myshopify\.com$/i, "");

  if (!storeHandle || storeHandle.includes(".") || storeHandle.includes("/")) {
    throw new Response("Unable to derive store handle for pricing redirect.", {
      status: 500,
    });
  }

  return `https://admin.shopify.com/store/${storeHandle}/charges/${env.appHandle}/pricing_plans`;
}
