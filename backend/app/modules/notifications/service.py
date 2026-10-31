from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import func, select, tuple_, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import DomainError
from app.modules.notifications.events import (
    NotificationEvent,
    NotificationKind,
    ResourceType,
    template,
)
from app.modules.notifications.models import Notification
from app.modules.users.models import User


async def emit(session: AsyncSession, event: NotificationEvent) -> None:
    """Join the caller's transaction. Never commit or deliver over the network."""
    resource_type, title, body = template(event.kind)
    await session.execute(
        insert(Notification)
        .values(
            id=uuid4(),
            created_at=datetime.now(UTC),
            recipient_id=event.recipient_id,
            kind=event.kind.value,
            resource_type=resource_type.value,
            resource_id=event.resource_id,
            event_key=event.event_key,
            title=title,
            body=body,
            read_at=None,
        )
        .on_conflict_do_nothing(index_elements=["recipient_id", "event_key"])
    )


async def notify(
    session: AsyncSession,
    recipients: list[UUID],
    kind: NotificationKind,
    resource_id: UUID,
    event_key: str,
) -> None:
    for recipient in sorted(set(recipients)):
        await emit(session, NotificationEvent(recipient, kind, resource_id, event_key))


async def notify_admins(
    session: AsyncSession,
    kind: NotificationKind,
    resource_id: UUID,
    event_key: str,
    exclude: list[UUID],
) -> None:
    recipients = list(
        (
            await session.scalars(
                select(User.id)
                .where(
                    User.is_active.is_(True),
                    User.is_admin.is_(True),
                    User.id.not_in(exclude),
                )
                .order_by(User.id)
            )
        ).all()
    )
    await notify(session, recipients, kind, resource_id, event_key)


async def own_notification(session: AsyncSession, actor_id: UUID, item_id: UUID) -> Notification:
    row = await session.scalar(
        select(Notification).where(
            Notification.id == item_id,
            Notification.recipient_id == actor_id,
        )
    )
    if row is None:
        raise DomainError("notification_not_found", "Notification not found.", 404)
    return row


async def inbox(
    session: AsyncSession,
    actor_id: UUID,
    limit: int,
    before: UUID | None,
    unread_only: bool,
) -> tuple[list[Notification], UUID | None]:
    query = select(Notification).where(Notification.recipient_id == actor_id)
    if unread_only:
        query = query.where(Notification.read_at.is_(None))
    if before is not None:
        cursor = await own_notification(session, actor_id, before)
        query = query.where(
            tuple_(Notification.created_at, Notification.id) < tuple_(cursor.created_at, cursor.id)
        )
    rows = list(
        (
            await session.scalars(
                query.order_by(
                    Notification.created_at.desc(),
                    Notification.id.desc(),
                ).limit(limit + 1)
            )
        ).all()
    )
    next_cursor = rows[limit - 1].id if len(rows) > limit else None
    return rows[:limit], next_cursor


async def unread_count(session: AsyncSession, actor_id: UUID) -> int:
    return await session.scalar(
        select(func.count())
        .select_from(Notification)
        .where(
            Notification.recipient_id == actor_id,
            Notification.read_at.is_(None),
        )
    )


async def mark_read(session: AsyncSession, actor_id: UUID, item_id: UUID) -> Notification:
    row = await session.scalar(
        select(Notification)
        .where(
            Notification.id == item_id,
            Notification.recipient_id == actor_id,
        )
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if row is None:
        raise DomainError("notification_not_found", "Notification not found.", 404)
    if row.read_at is None:
        row.read_at = datetime.now(UTC)
    await session.commit()
    return row


async def mark_all_read(session: AsyncSession, actor_id: UUID, through_id: UUID) -> int:
    cursor = await own_notification(session, actor_id, through_id)
    ids = list(
        (
            await session.scalars(
                select(Notification.id)
                .where(
                    Notification.recipient_id == actor_id,
                    Notification.read_at.is_(None),
                    tuple_(Notification.created_at, Notification.id)
                    <= tuple_(cursor.created_at, cursor.id),
                )
                .order_by(Notification.id)
                .with_for_update()
            )
        ).all()
    )
    if ids:
        await session.execute(
            update(Notification).where(Notification.id.in_(ids)).values(read_at=datetime.now(UTC))
        )
    rows = len(ids)
    await session.commit()
    return rows


async def notify_accounts(
    session: AsyncSession, recipients: list[UUID], kind: NotificationKind, event_key: str
) -> None:
    """Bulk account notices, joining the caller's transaction; no commit or external delivery."""
    resource, title, body = template(kind)
    if resource != ResourceType.ACCOUNT or not event_key or len(event_key) > 200:
        raise ValueError("Use an account notification and a bounded event key.")
    ordered = sorted(set(recipients))
    now = datetime.now(UTC)
    for start in range(0, len(ordered), 500):
        rows = [
            dict(
                id=uuid4(),
                created_at=now,
                recipient_id=uid,
                kind=kind.value,
                resource_type=resource.value,
                resource_id=uid,
                event_key=event_key,
                title=title,
                body=body,
                read_at=None,
            )
            for uid in ordered[start : start + 500]
        ]
        await session.execute(
            insert(Notification)
            .values(rows)
            .on_conflict_do_nothing(index_elements=["recipient_id", "event_key"])
        )
