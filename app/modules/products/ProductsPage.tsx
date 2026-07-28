import { PageLayout } from "~/components/PageLayout";

import { ProductList } from "./components";
import type { ProductsPageData } from "./types";

type ProductsPageProps = {
  data: ProductsPageData;
};

export function ProductsPage({ data }: ProductsPageProps) {
  return (
    <PageLayout title="Products">
      <ProductList data={data} />
    </PageLayout>
  );
}
