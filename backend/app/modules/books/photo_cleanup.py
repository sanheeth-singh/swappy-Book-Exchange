"""Durable cleanup: DB photo removal and queue creation commit together."""

import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.books.models import PhotoDeletionTask
from app.modules.books.storage import ImageStorage


async def process_task(session: AsyncSession, task_id: UUID, storage: ImageStorage) -> bool:
    task = await session.scalar(
        select(PhotoDeletionTask)
        .where(PhotoDeletionTask.id == task_id)
        .with_for_update(skip_locked=True)
    )
    if task is None:
        return False
    try:
        await storage.delete(task.file_id)
    except Exception:
        task.attempts += 1
        await session.commit()
        logging.getLogger(__name__).exception(
            "Photo cleanup retained for retry; task_id=%s", task_id
        )
        return False
    await session.delete(task)
    await session.commit()
    return True


async def cleanup_batch(session: AsyncSession, limit: int = 100) -> int:
    ids = list(
        (
            await session.scalars(
                select(PhotoDeletionTask.id)
                .order_by(PhotoDeletionTask.attempts, PhotoDeletionTask.created_at)
                .limit(limit)
            )
        ).all()
    )
    count = 0
    storage = ImageStorage()
    for task_id in ids:
        try:
            count += int(await process_task(session, task_id, storage))
        except Exception:
            await session.rollback()
            logging.getLogger(__name__).exception(
                "Photo cleanup transaction failed; task_id=%s", task_id
            )
    return count
