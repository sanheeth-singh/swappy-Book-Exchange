from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import DomainError
from app.modules.chat.models import ChatMessage, ChatReadPosition
from app.modules.chat.schemas import ChatPage, MessageInput, MessageResponse, ReadPosition
from app.modules.exchanges.models import Exchange
from app.modules.exchanges.policies import RESERVED_STATUSES, should_expire
from app.modules.exchanges.service import expire_if_due, locked_exchange, require_eligible
from app.modules.moderation.queries import require_interaction_allowed
from app.modules.notifications.events import NotificationKind
from app.modules.notifications.service import notify
from app.modules.users.models import User


async def participant(session: AsyncSession, actor: User, exchange_id: UUID) -> Exchange:
    row = await session.get(Exchange, exchange_id)
    if row is None or actor.id not in (row.requester_id, row.owner_id):
        raise DomainError("exchange_not_found", "Exchange not found.", 404)
    if row.accepted_at is None:
        raise DomainError("chat_not_open", "Chat opens after acceptance.", 409)
    return row


def require_open(exchange: Exchange) -> None:
    if exchange.status not in RESERVED_STATUSES or should_expire(
        exchange.status,
        exchange.expires_at,
        exchange.requester_confirmed,
        exchange.owner_confirmed,
        datetime.now(UTC),
    ):
        raise DomainError("chat_closed", "This exchange chat is read-only.", 409)


async def send(session: AsyncSession, actor: User, exchange_id: UUID, data: MessageInput):
    # Precheck denies nonparticipant administrators too. Keep the established lock order.
    await participant(session, actor, exchange_id)
    exchange, users, _, _ = await locked_exchange(session, exchange_id, actor)
    existing = await session.scalar(
        select(ChatMessage).where(
            ChatMessage.exchange_id == exchange_id,
            ChatMessage.sender_id == actor.id,
            ChatMessage.client_message_id == data.client_message_id,
        )
    )
    if existing is not None:
        if existing.body != data.body:
            raise DomainError("message_key_conflict", "This message key was already used.", 409)
        # Return an already committed message even after closure/block; never creates another.
        await session.commit()
        return existing
    if await expire_if_due(session, exchange, datetime.now(UTC)):
        await session.commit()
        raise DomainError("chat_closed", "This exchange chat is read-only.", 409)
    require_open(exchange)
    await require_eligible(session, users, exchange.campus_id)
    await require_interaction_allowed(session, exchange.requester_id, exchange.owner_id)
    sequence = (
        await session.scalar(
            select(func.max(ChatMessage.sequence)).where(
                ChatMessage.exchange_id == exchange_id,
            )
        )
        or 0
    ) + 1
    message = ChatMessage(
        exchange_id=exchange_id,
        sender_id=actor.id,
        client_message_id=data.client_message_id,
        body=data.body,
        sequence=sequence,
    )
    session.add(message)
    await session.flush()
    other = exchange.owner_id if actor.id == exchange.requester_id else exchange.requester_id
    await notify(
        session, [other], NotificationKind.CHAT_MESSAGE, exchange_id, f"chat:{message.id}:sent"
    )
    await session.commit()
    return message


async def position(session, exchange_id, user_id) -> ReadPosition:
    row = await session.get(ChatReadPosition, (exchange_id, user_id))
    return ReadPosition(sequence=row.sequence, read_at=row.read_at) if row else ReadPosition()


async def history(
    session: AsyncSession, actor: User, exchange_id: UUID, limit: int, before: int | None
) -> ChatPage:
    exchange = await participant(session, actor, exchange_id)
    query = select(ChatMessage).where(ChatMessage.exchange_id == exchange_id)
    if before is not None:
        query = query.where(ChatMessage.sequence < before)
    rows = list(
        (await session.scalars(query.order_by(ChatMessage.sequence.desc()).limit(limit + 1))).all()
    )
    more = len(rows) > limit
    rows = rows[:limit]
    mine = await position(session, exchange_id, actor.id)
    other = exchange.owner_id if actor.id == exchange.requester_id else exchange.requester_id
    unread = await session.scalar(
        select(func.count())
        .select_from(ChatMessage)
        .where(
            ChatMessage.exchange_id == exchange_id,
            ChatMessage.sender_id != actor.id,
            ChatMessage.sequence > mine.sequence,
        )
    )
    code = None
    try:
        require_open(exchange)
        # Informational only; send repeats these checks under locks.
        users = {
            uid: await session.get(User, uid) for uid in (exchange.requester_id, exchange.owner_id)
        }
        await require_eligible(session, users, exchange.campus_id)
        await require_interaction_allowed(session, exchange.requester_id, exchange.owner_id)
    except DomainError as exc:
        code = exc.code
    return ChatPage(
        items=[MessageResponse.model_validate(row) for row in rows],
        next_before=rows[-1].sequence if more else None,
        unread_count=unread,
        my_read=mine,
        other_read=await position(session, exchange_id, other),
        can_send=code is None,
        unavailable_code=code,
    )


async def mark_read(session: AsyncSession, actor: User, exchange_id: UUID, through_id: UUID):
    await participant(session, actor, exchange_id)
    # Serialize receipts with message insertion/completion; never locks users afterwards.
    await session.scalar(select(Exchange).where(Exchange.id == exchange_id).with_for_update())
    message = await session.scalar(
        select(ChatMessage).where(
            ChatMessage.id == through_id,
            ChatMessage.exchange_id == exchange_id,
        )
    )
    if message is None:
        raise DomainError("message_not_found", "Message not found.", 404)
    row = await session.get(ChatReadPosition, (exchange_id, actor.id))
    if row is None:
        row = ChatReadPosition(
            exchange_id=exchange_id,
            user_id=actor.id,
            sequence=message.sequence,
            read_at=datetime.now(UTC),
        )
        session.add(row)
    elif message.sequence > row.sequence:
        row.sequence, row.read_at = message.sequence, datetime.now(UTC)
    await session.commit()
    return ReadPosition(sequence=row.sequence, read_at=row.read_at)
