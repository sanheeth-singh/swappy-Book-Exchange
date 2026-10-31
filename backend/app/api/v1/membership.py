from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, File, HTTPException, Response, UploadFile
from sqlalchemy import select
from starlette.concurrency import run_in_threadpool

from app.api.dependencies.authentication import AdminUser, CurrentUser
from app.api.dependencies.database import Session
from app.api.dependencies.membership import CampusBrowser, VerifiedMembership
from app.modules.colleges.documents import MAX_DOCUMENT_BYTES, validate_document
from app.modules.colleges.models import Membership
from app.modules.colleges.schemas import MembershipResponse, ReviewInput, ReviewQueueResponse
from app.modules.colleges.service import review_submission, submit_proof
from app.modules.users.models import User

router = APIRouter(prefix="/membership", tags=["membership"])


@router.get("/me", response_model=MembershipResponse)
async def my_membership(user: CurrentUser, session: Session):
    membership = await session.scalar(select(Membership).where(Membership.user_id == user.id))
    if membership is None:
        raise HTTPException(404, "Complete your profile first")
    return membership


@router.get("/eligibility", response_model=MembershipResponse)
async def eligibility(membership: VerifiedMembership):
    # Informational check; future mutation services must recheck under their transaction locks.
    return membership


@router.post("/submissions", response_model=MembershipResponse, status_code=201)
async def submit(user: CampusBrowser, session: Session, document: Annotated[UploadFile, File()]):
    try:
        data = await document.read(MAX_DOCUMENT_BYTES + 1)
        content_type = await run_in_threadpool(validate_document, data)
        return await submit_proof(session, user, data, content_type)
    finally:
        await document.close()


@router.get("/submissions", response_model=list[ReviewQueueResponse])
async def review_queue(admin: AdminUser, session: Session):
    rows = (
        await session.execute(
            select(Membership, User.display_name)
            .join(User, User.id == Membership.user_id)
            .where(Membership.status == "PENDING")
            .order_by(Membership.created_at)
            .limit(100)
        )
    ).all()
    return [
        ReviewQueueResponse(
            **MembershipResponse.model_validate(membership).model_dump(),
            user_id=membership.user_id,
            display_name=name or "",
        )
        for membership, name in rows
    ]


@router.get("/submissions/{submission_id}/document")
async def download_document(submission_id: UUID, admin: AdminUser, session: Session):
    from datetime import UTC, datetime

    row = (
        await session.execute(
            select(Membership.document, Membership.document_type).where(
                Membership.submission_id == submission_id,
                Membership.document_expires_at > datetime.now(UTC),
                Membership.status == "PENDING",
            )
        )
    ).first()
    if not row or row.document is None:
        raise HTTPException(404, "Document unavailable")
    extension = "png" if row.document_type == "image/png" else "jpg"
    return Response(
        row.document,
        media_type=row.document_type,
        headers={
            "Content-Disposition": f'attachment; filename="student-proof.{extension}"',
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "no-store",
        },
    )


@router.post("/submissions/{submission_id}/review", response_model=MembershipResponse)
async def review(submission_id: UUID, data: ReviewInput, admin: AdminUser, session: Session):
    return await review_submission(session, admin, submission_id, data)
