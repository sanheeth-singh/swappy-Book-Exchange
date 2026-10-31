"""Run daily: retain expired/revoked session families for seven days, then purge."""

import asyncio

from app.db.session import get_session_factory
from app.modules.auth.service import purge_sessions


async def main():
    total = 0
    while True:
        async with get_session_factory()() as session:
            count = await purge_sessions(session)
        total += count
        if count < 1000:
            break
    print(f"Purged {total} expired/revoked authentication sessions")


if __name__ == "__main__":
    asyncio.run(main())
