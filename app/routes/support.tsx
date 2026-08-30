import type { MetaFunction } from "react-router";

import styles from "../styles/legal-pages.module.css";

const SUPPORT_EMAIL = "support@sniporder.com";
const COMPANY_NAME = "Purple IT";
const COMPANY_WEBSITE = "https://www.sniporder.com";

export const meta: MetaFunction = () => {
  return [
    { title: "Support | ProfitPilot" },
    {
      name: "description",
      content:
        "ProfitPilot Support — contact help for setup, profitability questions, and technical issues.",
    },
  ];
};

export default function SupportRoute() {
  return (
    <main className={styles.page}>
      <article className={styles.article}>
        <header className={styles.header}>
          <p className={styles.brand}>
            <a href="/">ProfitPilot</a>
          </p>
          <h1>ProfitPilot Support</h1>
        </header>

        <section>
          <p>
            We&apos;re here to help merchants get the most out of ProfitPilot.
          </p>
          <p>
            Whether you&apos;re setting up your first product, reviewing
            profitability calculations, or experiencing a technical issue, our
            goal is to help you get back to work as quickly as possible.
          </p>
        </section>

        <section>
          <h2>Contact Support</h2>
          <p>If you need assistance, please contact us at:</p>
          <p>
            <strong>Email</strong>
            <br />
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          </p>
        </section>

        <section>
          <h2>Response Time</h2>
          <p>
            We aim to respond to all support requests within{" "}
            <strong>1–2 business days</strong>.
          </p>
          <p>
            Some technical issues may require additional investigation and
            therefore may take longer to resolve.
          </p>
        </section>

        <section>
          <h2>Technical Issues</h2>
          <p>When reporting a technical issue, please include:</p>
          <ul>
            <li>Your Shopify store name</li>
            <li>A clear description of the issue</li>
            <li>The steps that led to the problem</li>
            <li>Screenshots or screen recordings (if available)</li>
          </ul>
          <p>
            Providing detailed information helps us investigate and resolve
            issues more efficiently.
          </p>
        </section>

        <section>
          <h2>Feature Requests</h2>
          <p>ProfitPilot is continuously improving.</p>
          <p>
            If you have ideas that could help merchants make better pricing or
            profitability decisions, we&apos;d love to hear from you.
          </p>
          <p>
            Every suggestion is reviewed and considered for future releases.
          </p>
        </section>

        <section>
          <h2>General Questions</h2>
          <p>Need help understanding how a feature works?</p>
          <p>
            Not sure how to interpret a profitability calculation?
          </p>
          <p>Have questions before using a strategy?</p>
          <p>Please contact us and we&apos;ll be happy to help.</p>
        </section>

        <section>
          <h2>Company</h2>
          <p>{COMPANY_NAME}</p>
          <p>
            <strong>Website</strong>
            <br />
            <a href={COMPANY_WEBSITE} target="_blank" rel="noopener noreferrer">
              {COMPANY_WEBSITE}
            </a>
          </p>
        </section>

        <section>
          <h2>Thank You</h2>
          <p>Thank you for using ProfitPilot.</p>
          <p>
            We&apos;re committed to helping Shopify merchants make more
            confident pricing and profitability decisions.
          </p>
        </section>
      </article>
    </main>
  );
}
