import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return {};
};

export default function App() {
  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>ProfitPilot</h1>
        <p className={styles.text}>
          Track costs. Test pricing. Maximize profit.
        </p>
        <ul className={styles.list}>
          <li>
            <strong>Track product costs</strong>. Record total or itemized costs
            for tracked Shopify products so profit starts from your real numbers.
          </li>
          <li>
            <strong>Test pricing strategies</strong>. Compare price points and
            promotional scenarios in the Decision Workspace before you go live.
          </li>
          <li>
            <strong>See projected profit</strong>. Review projected profit, loss,
            and margin for each strategy you simulate.
          </li>
        </ul>
      </div>
    </div>
  );
}
