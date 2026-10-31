import { Suspense } from "react";
import { CatalogScreen } from "@/features/books/screens/catalog-screen";
export default function Page() {
  return (
    <Suspense fallback={<p>Loading catalog…</p>}>
      <CatalogScreen />
    </Suspense>
  );
}
