from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import DomainError
from app.modules.colleges.directory import directory_lock
from app.modules.users.models import User


async def lock_users(session: AsyncSession, user_ids: list[UUID]) -> dict[UUID, User]:
    """Serialize user mutations while permitting notification FK key-share checks."""
    # SQLAlchemy key_share=True without read=True means PostgreSQL FOR NO KEY UPDATE.
    await directory_lock(session)
    result = {}
    for user_id in sorted(set(user_ids)):
        user = await session.scalar(
            select(User)
            .where(User.id == user_id)
            .with_for_update(key_share=True)
            .execution_options(populate_existing=True)
        )
        if user is None:
            raise DomainError("user_unavailable", "User not found.", 404)
        result[user_id] = user
    return result
