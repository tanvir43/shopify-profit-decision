import type { MetaFunction } from "react-router";

import styles from "../styles/legal-pages.module.css";

const SUPPORT_EMAIL = "support@sniporder.com";
const COMPANY_NAME = "Purple IT";
const COMPANY_WEBSITE = "https://www.sniporder.com";

export const meta: MetaFunction = () => {
  return [
    { title: "Privacy Policy | ProfitPilot" },
    {
      name: "description",
      content:
        "Privacy Policy for ProfitPilot — how we collect, use, and protect merchant information.",
    },
  ];
};

export default function PrivacyPolicyRoute() {
  return (
    <main className={styles.page}>
      <article className={styles.article}>
        <header className={styles.header}>
          <p className={styles.brand}>
            <a href="/">ProfitPilot</a>
          </p>
          <h1>Privacy Policy</h1>
          <p className={styles.updated}>Last Updated: August 2026</p>
        </header>

        <section>
          <h2>Introduction</h2>
          <p>Welcome to ProfitPilot.</p>
          <p>
            ProfitPilot is a Shopify application operated by {COMPANY_NAME} that
            helps merchants understand product profitability before launching
            marketing campaigns. By tracking product costs, pricing, and
            promotional strategies, ProfitPilot provides merchants with profit
            simulations and decision support.
          </p>
          <p>
            We respect your privacy and are committed to protecting your
            business information.
          </p>
          <p>
            This Privacy Policy explains what information we collect, how we use
            it, and the choices available to you.
          </p>
        </section>

        <section>
          <h2>Shopify Scope and Data We Access</h2>
          <p>
            ProfitPilot requests the Shopify Admin API scope{" "}
            <code>read_products</code> only.
          </p>
          <p>
            With that permission, ProfitPilot may access the following Shopify
            data as needed to provide the service:
          </p>
          <ul>
            <li>Product ID</li>
            <li>Product title</li>
            <li>Product status</li>
            <li>Featured image URL and alt text (when available)</li>
            <li>Store currency (<code>shop.currencyCode</code>)</li>
          </ul>
          <p>
            Product titles, images, and status are retrieved as needed for
            display and are not persistently stored as a full product catalog.
            Product IDs for products you choose to track are stored as described
            below.
          </p>
          <p>ProfitPilot does not modify your Shopify products.</p>
        </section>

        <section>
          <h2>Information We Do NOT Access or Store from Shopify</h2>
          <p>
            Through Shopify Admin APIs, ProfitPilot does not access or store:
          </p>
          <ul>
            <li>Customers</li>
            <li>Orders</li>
            <li>Draft orders</li>
            <li>Checkouts</li>
            <li>Inventory</li>
            <li>Shopify discounts or price rules</li>
          </ul>
          <p>
            Customer and order data are not part of ProfitPilot&apos;s Admin API
            access. ProfitPilot does not collect customer names, addresses, phone
            numbers, payment information, or credit card information as part of
            its product functionality.
          </p>
        </section>

        <section>
          <h2>Merchant-Provided Data We Store</h2>
          <p>
            Merchants manually enter costing and pricing information in
            ProfitPilot. The following merchant-provided data is stored in our
            PostgreSQL database:
          </p>
          <ul>
            <li>Product cost</li>
            <li>Packaging costs</li>
            <li>Shipping costs</li>
            <li>Payment / transaction fees</li>
            <li>Other custom costs</li>
            <li>Selling price</li>
          </ul>
          <p>
            Product IDs are also stored for tracked products and associated cost
            profiles so the app can reconnect your entered costs to the correct
            Shopify products.
          </p>
          <p>
            Selling prices and cost data used in simulations are entered by you
            in ProfitPilot; they are not written back to your Shopify catalog.
          </p>
        </section>

        <section>
          <h2>Strategy Simulation Inputs</h2>
          <p>
            Pricing and promotion strategy simulation inputs are processed
            client-side for decision support. They are not permanently stored as
            strategy records.
          </p>
        </section>

        <section>
          <h2>Authentication and Session Data</h2>
          <p>
            To authenticate your store and keep the app connected to Shopify,
            ProfitPilot stores:
          </p>
          <ul>
            <li>Shopify store domain</li>
            <li>Shopify session information</li>
            <li>Shopify access tokens</li>
            <li>API scope information</li>
            <li>Session metadata</li>
          </ul>
        </section>

        <section>
          <h2>How We Use Information</h2>
          <p>Information is used only to:</p>
          <ul>
            <li>Authenticate your Shopify store</li>
            <li>Provide ProfitPilot features</li>
            <li>Save your product costing and selling price information</li>
            <li>
              Display tracked products and generate profitability simulations
            </li>
            <li>Improve application stability</li>
            <li>Maintain application security</li>
            <li>Comply with Shopify privacy requirements</li>
          </ul>
        </section>

        <section>
          <h2>Infrastructure and Data Storage</h2>
          <p>
            ProfitPilot is hosted on Vercel. Persistently stored merchant and
            session data is kept in a PostgreSQL database hosted on Neon.
          </p>
          <p>
            This includes Shopify shop and session authentication information,
            tracked product references (product IDs), and merchant-entered cost
            and selling price information.
          </p>
          <p>
            Reasonable administrative and technical safeguards are used to
            protect stored information. No method of electronic storage is
            completely secure; however, we take reasonable measures to reduce
            risk.
          </p>
        </section>

        <section>
          <h2>Data Sharing</h2>
          <p>ProfitPilot does not sell personal information or merchant data.</p>
          <p>We only share information when required to:</p>
          <ul>
            <li>
              Operate the application (including infrastructure providers such as
              Vercel and Neon)
            </li>
            <li>Comply with applicable law</li>
            <li>Respond to lawful government requests</li>
          </ul>
          <p>
            ProfitPilot does not sell or share merchant data with advertisers or
            unrelated third parties for their marketing purposes.
          </p>
        </section>

        <section>
          <h2>Uninstall and Data Deletion</h2>
          <p>
            Merchants may stop using ProfitPilot at any time by uninstalling the
            application from Shopify.
          </p>
          <p>
            When the app is uninstalled, the <code>app/uninstalled</code> webhook
            deletes Shopify session and access-token records for the store.
          </p>
          <p>
            Cost profiles, cost items, and tracked product data are removed when
            Shopify sends the <code>shop/redact</code> compliance webhook, rather
            than necessarily at the exact moment of uninstall. There is no
            separate fixed retention period coded into the application beyond
            this Shopify-driven process.
          </p>
        </section>

        <section>
          <h2>Shopify Privacy Compliance Webhooks</h2>
          <p>
            ProfitPilot registers and authenticates Shopify&apos;s required
            privacy compliance webhooks:
          </p>
          <ul>
            <li>
              <code>customers/data_request</code> — acknowledges the request. Because
              ProfitPilot does not store customer records, it does not search for
              or export customer records in response.
            </li>
            <li>
              <code>customers/redact</code> — acknowledges the request. Because
              ProfitPilot does not store customer records, there are no customer
              records to delete.
            </li>
            <li>
              <code>shop/redact</code> — deletes store-related application data
              currently stored by ProfitPilot, including CostProfile records
              (with CostItem cascade), TrackedProduct records, and remaining
              Session records.
            </li>
          </ul>
          <p>
            Customer information that may appear in Shopify privacy webhook
            payloads is not stored by ProfitPilot as customer records.
          </p>
        </section>

        <section>
          <h2>Your Rights</h2>
          <p>Merchants may:</p>
          <ul>
            <li>Request information regarding stored data</li>
            <li>Request deletion where applicable</li>
            <li>
              Stop using the application at any time by uninstalling it from
              Shopify
            </li>
          </ul>
        </section>

        <section>
          <h2>Security</h2>
          <p>
            We work to protect merchant information using industry-standard
            security practices appropriate to the nature of the data we store.
          </p>
        </section>

        <section>
          <h2>Changes to This Policy</h2>
          <p>
            This Privacy Policy may be updated as ProfitPilot evolves.
          </p>
          <p>
            Material changes will be reflected by updating the &quot;Last
            Updated&quot; date above.
          </p>
        </section>

        <section>
          <h2>Contact</h2>
          <p>
            If you have questions regarding this Privacy Policy, please
            contact:
          </p>
          <p>
            <strong>Email</strong>
            <br />
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          </p>
          <p>
            <strong>Website</strong>
            <br />
            <a href={COMPANY_WEBSITE} target="_blank" rel="noopener noreferrer">
              {COMPANY_WEBSITE}
            </a>
          </p>
          <p>
            <strong>Company</strong>
            <br />
            {COMPANY_NAME}
          </p>
        </section>
      </article>
    </main>
  );
}
