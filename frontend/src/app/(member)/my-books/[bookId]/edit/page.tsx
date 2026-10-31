import { Suspense } from "react";
import { BookEditorScreen } from "@/features/books/screens/book-editor-screen";
export default async function Page({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const { bookId } = await params;
  return (
    <Suspense fallback={<p>Loading listing…</p>}>
      <BookEditorScreen id={bookId} />
    </Suspense>
  );
}
