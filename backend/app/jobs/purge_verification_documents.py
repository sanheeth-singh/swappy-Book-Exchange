"""Run daily using your deployment scheduler. Does not run inside a request."""

import asyncio

from app.db.session import get_session_factory
from app.modules.colleges.service import purge_expired_proof


async def main():
    total = 0
    while True:
        async with get_session_factory()() as session:
            count = await purge_expired_proof(session)
        total += count
        if count < 100:
            break
    print(f"Purged {total} expired verification documents")


if __name__ == "__main__":
    asyncio.run(main())
