"""Trusted local operator commands. Never expose admin promotion through signup."""

import argparse
import asyncio

from sqlalchemy import select

from app.db.session import get_session_factory
from app.modules.colleges.admin_service import bootstrap_campus
from app.modules.users.models import User


async def run(args):
    async with get_session_factory()() as session:
        if args.command == "add-campus":
            campus = await bootstrap_campus(
                session, args.college, args.campus, args.city, args.reason
            )
            print(f"Campus ID: {campus.id}")
        elif args.command == "promote-reviewer":
            user = await session.scalar(select(User).where(User.email == args.email.lower()))
            if user is None:
                raise SystemExit("Register the reviewer account first")
            user.is_admin = True
            await session.commit()
            print("Reviewer access granted")


# Promote user to admin: python -m app.cli promote-reviewer --email your_email@example.com

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    campus = sub.add_parser("add-campus")
    campus.add_argument("--college", required=True)
    campus.add_argument("--campus", required=True)
    campus.add_argument("--city", required=True)
    campus.add_argument("--reason", default="Trusted operator campus bootstrap")
    reviewer = sub.add_parser("promote-reviewer")
    reviewer.add_argument("--email", required=True)
    asyncio.run(run(parser.parse_args()))
