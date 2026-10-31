"""Schedule every five minutes: python -m app.jobs.expire_exchanges."""

import asyncio

from app.db.session import get_session_factory
from app.modules.exchanges.service import expire_batch


async def main():
    total = 0
    while True:
        async with get_session_factory()() as session:
            count = await expire_batch(session)
        total += count
        if count < 100:
            break
    print(f"Expired {total} exchanges")


if __name__ == "__main__":
    asyncio.run(main())
