from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.exchanges.models import Exchange
from app.modules.notifications.events import NotificationKind
from app.modules.notifications.service import notify


async def reject_pending(
    session: AsyncSession, listing_ids: list[UUID], exclude: UUID | None = None
):
    query = select(Exchange).where(
        Exchange.status == "PENDING",
        or_(
            Exchange.requested_listing_id.in_(listing_ids),
            Exchange.offered_listing_id.in_(listing_ids),
        ),
    )
    if exclude:
        query = query.where(Exchange.id != exclude)
    rows = (
        await session.scalars(
            query.order_by(Exchange.id).with_for_update().execution_options(populate_existing=True)
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
