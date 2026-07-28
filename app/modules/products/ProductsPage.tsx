import { PageLayout } from "~/components/PageLayout";

import { ProductList } from "./components";

export function ProductsPage() {
  return (
    <PageLayout title="Products">
      <ProductList />
    </PageLayout>
  );
}
