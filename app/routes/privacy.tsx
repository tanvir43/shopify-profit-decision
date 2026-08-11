import type { MetaFunction } from "react-router";

import styles from "../styles/legal-pages.module.css";

const SUPPORT_EMAIL = "support@sniporder.com";
const COMPANY_NAME = "SnipOrder";

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
            ProfitPilot is a Shopify application that helps merchants understand
            product profitability before launching marketing campaigns. By
            tracking product costs, pricing, and promotional strategies,
            ProfitPilot provides merchants with accurate profit simulations and
            decision support.
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
          <h2>Information We Collect</h2>
          <p>
            ProfitPilot only collects the information required to provide its
            services.
          </p>
          <p>This may include:</p>

          <h3>Shopify Store Information</h3>
          <p>
            When you install ProfitPilot, we receive information from Shopify
            including:
          </p>
          <ul>
            <li>Shop domain</li>
            <li>Shop identifier</li>
            <li>Access token required to communicate with Shopify</li>
            <li>Shopify session information</li>
            <li>Shop currency code (used to display monetary values)</li>
          </ul>

          <h3>Product Information</h3>
          <p>
            With your permission, ProfitPilot reads product information from
            your Shopify store.
          </p>
          <p>Currently the application requests:</p>
          <ul>
            <li>Product title</li>
            <li>Product ID</li>
            <li>Product status</li>
            <li>Product featured image URL and alt text (when available)</li>
          </ul>
          <p>
            Selling prices and cost data used in simulations are entered by you
            in ProfitPilot; they are not written back to your Shopify catalog.
          </p>
          <p>ProfitPilot does not modify your products.</p>

          <h3>Merchant-Generated Data</h3>
          <p>
            ProfitPilot persistently stores merchant-entered information
            required for cost and pricing analysis, including:
          </p>
          <ul>
            <li>Merchant-entered product cost (including cost breakdowns)</li>
            <li>Merchant-entered selling price</li>
            <li>
              Tracked product information (references to Shopify products you
              choose to track in the app)
            </li>
          </ul>
          <p>
            Decision strategies, pricing simulations, and profit calculations
            are computed in the application session for decision support and
            are not permanently stored.
          </p>
          <p>
            This information exists solely to provide profitability analysis.
          </p>
        </section>

        <section>
          <h2>Information We Do NOT Collect</h2>
          <p>ProfitPilot does not collect or process:</p>
          <ul>
            <li>Customer personal information</li>
            <li>Customer names</li>
            <li>Customer addresses</li>
            <li>Customer phone numbers</li>
            <li>Customer payment information</li>
            <li>Shopify orders</li>
            <li>Credit card information</li>
          </ul>
          <p>
            ProfitPilot also does not sell or share merchant data with
            advertisers or unrelated third parties.
          </p>
        </section>

        <section>
          <h2>How We Use Information</h2>
          <p>Information is used only to:</p>
          <ul>
            <li>Authenticate your Shopify store</li>
            <li>Provide ProfitPilot features</li>
            <li>Save your product costing and selling price information</li>
            <li>
              Display tracked products and generate in-session profitability
              simulations
            </li>
            <li>Improve application stability</li>
            <li>Maintain application security</li>
          </ul>
        </section>

        <section>
          <h2>Data Storage</h2>
          <p>
            Persistently stored merchant data is kept using managed PostgreSQL
            infrastructure. This includes Shopify shop/session authentication
            information, tracked product references, merchant-entered product
            costs, and merchant-entered selling prices.
          </p>
          <p>
            Shopify authentication sessions are securely stored to maintain
            access between Shopify and ProfitPilot.
          </p>
          <p>
            Decision strategies, pricing simulations, and profit calculations
            are ephemeral application state and are not written to persistent
            storage.
          </p>
          <p>
            Reasonable administrative and technical safeguards are used to
            protect stored information.
          </p>
        </section>

        <section>
          <h2>Data Sharing</h2>
          <p>ProfitPilot does not sell merchant information.</p>
          <p>We only share information when required to:</p>
          <ul>
            <li>Operate the application</li>
            <li>Comply with applicable law</li>
            <li>Respond to lawful government requests</li>
          </ul>
        </section>

        <section>
          <h2>Data Retention</h2>
          <p>
            Merchant data remains available while the application is installed.
          </p>
          <p>
            If the application is uninstalled, Shopify&apos;s required data
            protection process is followed.
          </p>
          <p>
            Where required, merchant data is deleted in accordance with Shopify
            compliance requirements.
          </p>
        </section>

        <section>
          <h2>Shopify Compliance</h2>
          <p>
            ProfitPilot implements Shopify&apos;s required privacy compliance
            webhooks, including:
          </p>
          <ul>
            <li>shop/redact</li>
            <li>customers/redact</li>
            <li>customers/data_request</li>
          </ul>
          <p>
            These webhooks help us comply with Shopify&apos;s privacy
            requirements.
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
            We continuously work to protect merchant information using
            industry-standard security practices.
          </p>
          <p>
            No method of electronic storage is completely secure; however, we
            take reasonable measures to reduce risk and protect merchant
            information.
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
            <strong>Company</strong>
            <br />
            {COMPANY_NAME}
          </p>
        </section>
      </article>
    </main>
  );
}
