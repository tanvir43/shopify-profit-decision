import type { MetaFunction } from "react-router";

import styles from "../styles/legal-pages.module.css";

const SUPPORT_EMAIL = "support@sniporder.com";
const COMPANY_NAME = "Purple IT";
const COMPANY_WEBSITE = "https://www.sniporder.com";

export const meta: MetaFunction = () => {
  return [
    { title: "Terms of Service | ProfitPilot" },
    {
      name: "description",
      content:
        "Terms of Service for ProfitPilot — rules for installing and using the application.",
    },
  ];
};

export default function TermsOfServiceRoute() {
  return (
    <main className={styles.page}>
      <article className={styles.article}>
        <header className={styles.header}>
          <p className={styles.brand}>
            <a href="/">ProfitPilot</a>
          </p>
          <h1>Terms of Service</h1>
          <p className={styles.updated}>Last Updated: August 2026</p>
        </header>

        <section>
          <h2>1. Acceptance of These Terms</h2>
          <p>Welcome to ProfitPilot.</p>
          <p>
            By installing or using ProfitPilot, you agree to these Terms of
            Service. If you do not agree with these terms, you should not
            install or use the application.
          </p>
        </section>

        <section>
          <h2>2. About ProfitPilot</h2>
          <p>
            ProfitPilot is a Shopify application designed to help merchants
            estimate product profitability by organizing product costs, pricing
            decisions, and promotional strategies before investing in
            advertising.
          </p>
          <p>ProfitPilot provides decision-support tools only.</p>
          <p>
            The application does not guarantee profits, revenue, sales
            performance, or business outcomes.
          </p>
        </section>

        <section>
          <h2>3. Merchant Responsibilities</h2>
          <p>You are responsible for:</p>
          <ul>
            <li>Providing accurate product cost information.</li>
            <li>
              Reviewing all calculated results before making business
              decisions.
            </li>
            <li>Setting final selling prices.</li>
            <li>
              Complying with all applicable laws and Shopify policies.
            </li>
          </ul>
          <p>
            ProfitPilot provides simulations based on the information you
            enter.
          </p>
          <p>
            Incorrect or incomplete data may produce inaccurate results.
          </p>
        </section>

        <section>
          <h2>4. Shopify Data Access</h2>
          <p>
            ProfitPilot only accesses Shopify data that you explicitly
            authorize during installation.
          </p>
          <p>
            Currently, the application requests permission to read product
            information required for its core functionality.
          </p>
          <p>
            ProfitPilot does not modify your Shopify products without your
            action.
          </p>
        </section>

        <section>
          <h2>5. Intellectual Property</h2>
          <p>
            ProfitPilot, including its software, interface, calculations,
            documentation, branding, and design, remains the intellectual
            property of its owners.
          </p>
          <p>
            You may use the application only as permitted by these Terms.
          </p>
        </section>

        <section>
          <h2>6. Service Availability</h2>
          <p>We work to keep ProfitPilot available and reliable.</p>
          <p>However, we cannot guarantee uninterrupted service.</p>
          <p>Temporary interruptions may occur because of:</p>
          <ul>
            <li>Maintenance</li>
            <li>Infrastructure updates</li>
            <li>Shopify platform changes</li>
            <li>Third-party service outages</li>
            <li>Internet connectivity issues</li>
          </ul>
        </section>

        <section>
          <h2>7. Limitation of Liability</h2>
          <p>
            ProfitPilot is provided as a business decision-support tool.
          </p>
          <p>
            All pricing decisions, advertising investments, and business
            actions remain your responsibility.
          </p>
          <p>
            To the maximum extent permitted by law, ProfitPilot shall not be
            liable for indirect, incidental, special, or consequential damages
            resulting from the use of the application.
          </p>
        </section>

        <section>
          <h2>8. Suspension or Termination</h2>
          <p>
            We reserve the right to suspend or terminate access if the
            application is used:
          </p>
          <ul>
            <li>In violation of these Terms</li>
            <li>In violation of Shopify policies</li>
            <li>For unlawful activities</li>
            <li>
              In a manner that threatens application security or stability
            </li>
          </ul>
          <p>
            Merchants may stop using ProfitPilot at any time by uninstalling
            the application from Shopify.
          </p>
        </section>

        <section>
          <h2>9. Changes to These Terms</h2>
          <p>We may update these Terms from time to time.</p>
          <p>
            Material changes will be reflected by updating the &quot;Last
            Updated&quot; date.
          </p>
          <p>
            Continued use of ProfitPilot after changes become effective
            constitutes acceptance of the updated Terms.
          </p>
        </section>

        <section>
          <h2>10. Contact</h2>
          <p>
            For questions regarding these Terms of Service, please contact:
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
