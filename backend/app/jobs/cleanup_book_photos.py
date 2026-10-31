"""Schedule periodically: python -m app.jobs.cleanup_book_photos."""

import asyncio

from app.db.session import get_session_factory
from app.modules.books.photo_cleanup import cleanup_batch


async def main():
    async with get_session_factory()() as session:
        count = await cleanup_batch(session)
    print(f"Cleaned {count} removed book photos")


if __name__ == "__main__":
    asyncio.run(main())
