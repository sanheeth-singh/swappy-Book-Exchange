"""Schedule every five minutes: python -m app.jobs.publish_reviews."""

import asyncio

from app.db.session import get_session_factory
from app.modules.reviews.service import publish_batch


async def main():
    total = 0
    while True:
        async with get_session_factory()() as session:
            count = await publish_batch(session)
        total += count
        if count < 100:
            break
    print(f"Processed {total} expired review windows")


if __name__ == "__main__":
    asyncio.run(main())
