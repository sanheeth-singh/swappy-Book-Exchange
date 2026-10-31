from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session_factory


async def get_session() -> AsyncIterator[AsyncSession]:
    async with get_session_factory()() as session:
        # Services commit successful mutations; uncommitted reads/errors roll back on close.
        yield session


Session = Annotated[AsyncSession, Depends(get_session)]
