from uuid import UUID

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import DomainError
from app.modules.exchanges.models import Exchange
from app.modules.moderation.models import UserBlock
from app.modules.notifications.events import NotificationKind
from app.modules.notifications.service import notify


def blocked_pair(first, second):
    return (
        select(UserBlock.id)
        .where(
            or_(
                and_(UserBlock.blocker_id == first, UserBlock.blocked_id == second),
                and_(UserBlock.blocker_id == second, UserBlock.blocked_id == first),
            )
        )
        .correlate_except(UserBlock)
        .exists()
    )


async def require_interaction_allowed(session: AsyncSession, first: UUID, second: UUID) -> None:
    if await session.scalar(select(blocked_pair(first, second))):
        raise DomainError("interaction_unavailable", "This interaction is unavailable.")


async def reject_pair_pending(session: AsyncSession, first: UUID, second: UUID) -> None:
    rows = (
        await session.scalars(
            select(Exchange)
            .where(
                Exchange.status == "PENDING",
                or_(
                    and_(Exchange.requester_id == first, Exchange.owner_id == second),
                    and_(Exchange.requester_id == second, Exchange.owner_id == first),
                ),
            )
            .order_by(Exchange.id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
    ).all()
    for row in rows:
        row.status = "REJECTED"
        await notify(
            session,
            [row.requester_id, row.owner_id],
            NotificationKind.EXCHANGE_REJECTED,
            row.id,
            f"exchange:{row.id}:rejected",
        )


async def reject_user_pending(session: AsyncSession, target_id: UUID) -> None:
    rows = (
        await session.scalars(
            select(Exchange)
            .where(
                Exchange.status == "PENDING",
                or_(Exchange.requester_id == target_id, Exchange.owner_id == target_id),
            )
            .order_by(Exchange.id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
    ).all()
    for row in rows:
        row.status = "REJECTED"
        await notify(
            session,
            [row.requester_id, row.owner_id],
            NotificationKind.EXCHANGE_REJECTED,
            row.id,
            f"exchange:{row.id}:rejected",
        )
