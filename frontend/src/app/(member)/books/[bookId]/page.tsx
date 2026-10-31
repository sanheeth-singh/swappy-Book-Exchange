import { BookDetailScreen } from "@/features/books/screens/book-detail-screen";
export default async function Page({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const { bookId } = await params;
  return <BookDetailScreen id={bookId} />;
}
