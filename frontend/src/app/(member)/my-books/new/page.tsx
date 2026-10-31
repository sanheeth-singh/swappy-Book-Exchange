import { Suspense } from "react";
import { BookEditorScreen } from "@/features/books/screens/book-editor-screen";
export default function Page() {
  return (
    <Suspense fallback={<p>Loading book form…</p>}>
      <BookEditorScreen />
    </Suspense>
  );
}
