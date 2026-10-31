from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.modules.books.models import BookListing
from app.modules.colleges.models import Campus, College
from app.modules.moderation.queries import blocked_pair
from app.modules.users.models import User


def listings():
    return select(BookListing).options(selectinload(BookListing.photos))


def discoverable_listings(viewer_id):
    eligible_owner = (
        select(User.id)
        .where(
            User.id == BookListing.owner_id,
            User.is_active.is_(True),
            User.is_participation_restricted.is_(False),
        )
        .correlate_except(User)
        .exists()
    )
    active_directory = (
        select(Campus.id)
        .join(College, College.id == Campus.college_id)
        .where(
            Campus.id == BookListing.campus_id,
            Campus.is_active.is_(True),
            College.is_active.is_(True),
        )
        .correlate_except(Campus, College)
        .exists()
    )
    return listings().where(
        active_directory,
        BookListing.is_archived.is_(False),
        BookListing.is_hidden.is_(False),
        eligible_owner,
        ~blocked_pair(viewer_id, BookListing.owner_id),
    )
