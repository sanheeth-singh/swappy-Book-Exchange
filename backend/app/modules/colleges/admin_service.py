from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from starlette.concurrency import run_in_threadpool

from app.core.errors import DomainError
from app.core.security import verify_password
from app.modules.books.models import BookListing
from app.modules.colleges.admin_schemas import (
    AdminCampusResponse,
    CampusCreate,
    CollegeCreate,
    DirectoryImpact,
)
from app.modules.colleges.directory import directory_lock, normalized
from app.modules.colleges.models import Campus, College, DirectoryAction
from app.modules.exchanges.models import Exchange
from app.modules.notifications.events import NotificationKind
from app.modules.notifications.service import notify_accounts
from app.modules.users.models import User
from app.modules.users.queries import lock_users


async def admin_write(session, actor, password=None):
    if not actor.is_admin or not actor.is_active:
        raise DomainError("admin_required", "Administrator access required.")
    # Never upgrade a shared barrier while holding user locks: exclusive barrier comes first.
    await directory_lock(session, exclusive=True)
    fresh = (await lock_users(session, [actor.id]))[actor.id]
    if not fresh.is_active or not fresh.is_admin:
        raise DomainError("admin_required", "Administrator access required.")
    if password is not None and not await run_in_threadpool(
        verify_password, password, fresh.hashed_password
    ):
        raise DomainError("password_incorrect", "Current password is incorrect.")


async def flush(session):
    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        raise DomainError(
            "directory_conflict",
            "A matching directory entry already exists. Reload the directory.",
            409,
        ) from exc


async def finish(session):
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise DomainError(
            "directory_conflict",
            "A matching directory entry already exists. Reload the directory.",
            409,
        ) from exc


async def college(session, college_id):
    row = await session.get(College, college_id, populate_existing=True)
    if row is None:
        raise DomainError("college_not_found", "College not found.", 404)
    return row


async def campus(session, campus_id):
    row = await session.get(Campus, campus_id, populate_existing=True)
    if row is None:
        raise DomainError("campus_not_found", "Campus not found.", 404)
    return row


def snapshot(row):
    data = {"id": str(row.id), "name": row.name, "is_active": row.is_active}
    if isinstance(row, Campus):
        data.update(college_id=str(row.college_id), city=row.city)
    return data


def audit(session, actor, row, action, reason, before):
    event = DirectoryAction(
        actor_id=actor.id if actor else None,
        source="ADMIN" if actor else "CLI",
        college_id=row.college_id if isinstance(row, Campus) else row.id,
        campus_id=row.id if isinstance(row, Campus) else None,
        action=action,
        reason=reason,
        before=before,
        after=snapshot(row),
    )
    session.add(event)
    return event


async def unique_college(session, name, exclude=None):
    query = select(College.id).where(normalized(College.name) == normalized(name))
    if exclude:
        query = query.where(College.id != exclude)
    if await session.scalar(query) is not None:
        raise DomainError("college_exists", "This college name already exists.", 409)


async def unique_campus(session, college_id, name, city, exclude=None):
    query = select(Campus.id).where(
        Campus.college_id == college_id,
        normalized(Campus.name) == normalized(name),
        normalized(Campus.city) == normalized(city),
    )
    if exclude:
        query = query.where(Campus.id != exclude)
    if await session.scalar(query) is not None:
        raise DomainError(
            "campus_exists", "This campus name and city already exist in the college.", 409
        )


async def campus_response(session, row):
    parent = await college(session, row.college_id)
    return AdminCampusResponse(
        id=row.id,
        college_id=row.college_id,
        college_name=parent.name,
        name=row.name,
        city=row.city,
        is_active=row.is_active,
        college_is_active=parent.is_active,
        effective_is_active=row.is_active and parent.is_active,
    )


async def create_college(session, actor, data):
    await admin_write(session, actor)
    await unique_college(session, data.name)
    row = College(name=data.name, is_active=True)
    session.add(row)
    await flush(session)
    audit(session, actor, row, "CREATE_COLLEGE", data.reason, {})
    await finish(session)
    return row


async def create_campus(session, actor, data):
    await admin_write(session, actor)
    parent = await college(session, data.college_id)
    if not parent.is_active:
        raise DomainError("college_inactive", "Activate the college before adding a campus.", 409)
    await unique_campus(session, parent.id, data.name, data.city)
    row = Campus(college_id=parent.id, name=data.name, city=data.city, is_active=True)
    session.add(row)
    await flush(session)
    audit(session, actor, row, "CREATE_CAMPUS", data.reason, {})
    await finish(session)
    return await campus_response(session, row)


async def edit_college(session, actor, college_id, data):
    await admin_write(session, actor)
    row = await college(session, college_id)
    await unique_college(session, data.name, row.id)
    if row.name != data.name:
        before = snapshot(row)
        row.name = data.name
        audit(session, actor, row, "EDIT_COLLEGE", data.reason, before)
    await finish(session)
    return row


async def edit_campus(session, actor, campus_id, data):
    await admin_write(session, actor)
    row = await campus(session, campus_id)
    updates = data.model_dump(exclude_unset=True, exclude={"reason"})
    await unique_campus(
        session,
        row.college_id,
        updates.get("name", row.name),
        updates.get("city", row.city),
        row.id,
    )
    if any(getattr(row, key) != value for key, value in updates.items()):
        before = snapshot(row)
        for key, value in updates.items():
            setattr(row, key, value)
        audit(session, actor, row, "EDIT_CAMPUS", data.reason, before)
    await finish(session)
    return await campus_response(session, row)


async def set_availability(session, actor, target_id, data, *, is_college):
    await admin_write(session, actor, data.current_password.get_secret_value())
    row = await college(session, target_id) if is_college else await campus(session, target_id)
    if not is_college and data.is_active and not (await college(session, row.college_id)).is_active:
        raise DomainError("college_inactive", "Activate the parent college first.", 409)
    if row.is_active != data.is_active:
        before = snapshot(row)
        row.is_active = data.is_active
        label = "COLLEGE" if is_college else "CAMPUS"
        event = audit(
            session,
            actor,
            row,
            ("ACTIVATE_" if data.is_active else "DEACTIVATE_") + label,
            data.reason,
            before,
        )
        await flush(session)
        campus_ids = (
            select(Campus.id).where(Campus.college_id == row.id) if is_college else [row.id]
        )
        recipients = list(
            (
                await session.scalars(
                    select(User.id)
                    .where(User.campus_id.in_(campus_ids), User.is_active.is_(True))
                    .order_by(User.id)
                )
            ).all()
        )
        await notify_accounts(
            session,
            recipients,
            NotificationKind.DIRECTORY_AVAILABILITY_CHANGED,
            f"directory:{event.id}:availability",
        )
    await finish(session)
    return row if is_college else await campus_response(session, row)


async def impact(session, target_id, *, is_college):
    row = await college(session, target_id) if is_college else await campus(session, target_id)
    campus_ids = select(Campus.id).where(Campus.college_id == row.id) if is_college else [row.id]
    statuses = dict(
        (
            await session.execute(
                select(Exchange.status, func.count(Exchange.id))
                .where(
                    Exchange.campus_id.in_(campus_ids),
                    Exchange.status.in_(("PENDING", "ACCEPTED", "WAITING_CONFIRMATION")),
                )
                .group_by(Exchange.status)
            )
        ).all()
    )
    return DirectoryImpact(
        college_id=row.id if is_college else row.college_id,
        campus_id=None if is_college else row.id,
        campus_count=await session.scalar(
            select(func.count()).select_from(Campus).where(Campus.id.in_(campus_ids))
        ),
        selected_users=await session.scalar(
            select(func.count()).select_from(User).where(User.campus_id.in_(campus_ids))
        ),
        live_listings=await session.scalar(
            select(func.count())
            .select_from(BookListing)
            .where(BookListing.campus_id.in_(campus_ids), BookListing.is_archived.is_(False))
        ),
        pending_exchanges=statuses.get("PENDING", 0),
        accepted_exchanges=statuses.get("ACCEPTED", 0),
        waiting_confirmation_exchanges=statuses.get("WAITING_CONFIRMATION", 0),
    )


async def bootstrap_campus(session, college_name, campus_name, city, reason):
    # Trusted operator path: shared validation/locks/audit, no fabricated admin identity.
    parent_data = CollegeCreate(name=college_name, reason=reason)
    reason = parent_data.reason
    await directory_lock(session, exclusive=True)
    parent = await session.scalar(
        select(College).where(normalized(College.name) == normalized(parent_data.name))
    )
    if parent is None:
        parent = College(name=parent_data.name, is_active=True)
        session.add(parent)
        await flush(session)
        audit(session, None, parent, "CREATE_COLLEGE", reason, {})
    if not parent.is_active:
        raise DomainError("college_inactive", "Activate the college before adding a campus.", 409)
    data = CampusCreate(college_id=parent.id, name=campus_name, city=city, reason=reason)
    existing = await session.scalar(
        select(Campus).where(
            Campus.college_id == parent.id,
            normalized(Campus.name) == normalized(data.name),
            normalized(Campus.city) == normalized(data.city),
        )
    )
    if existing:
        await finish(session)
        return existing
    row = Campus(college_id=parent.id, name=data.name, city=data.city, is_active=True)
    session.add(row)
    await flush(session)
    audit(session, None, row, "CREATE_CAMPUS", reason, {})
    await finish(session)
    return row
