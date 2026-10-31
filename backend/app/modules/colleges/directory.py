from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import DomainError
from app.modules.colleges.models import Campus, College

# Transaction-scoped PostgreSQL barrier. Shared student mutations; exclusive directory writes.
DIRECTORY_LOCK_KEY = 734928105663


async def directory_lock(session: AsyncSession, *, exclusive: bool = False):
    function = func.pg_advisory_xact_lock if exclusive else func.pg_advisory_xact_lock_shared
    await session.execute(select(function(DIRECTORY_LOCK_KEY)))


def normalized(column):
    return func.lower(func.regexp_replace(func.btrim(column), r"[[:space:]]+", " ", "g"))


async def require_active_campus(session: AsyncSession, campus_id: UUID | None) -> Campus:
    campus = await session.scalar(
        select(Campus)
        .join(College, College.id == Campus.college_id)
        .where(Campus.id == campus_id, Campus.is_active.is_(True), College.is_active.is_(True))
        .execution_options(populate_existing=True)
    )
    if campus is None:
        raise DomainError("campus_inactive", "Campus or college is not currently available.")
    return campus
