from fastapi import APIRouter

from app.api.v1 import (
    auth,
    blocks,
    books,
    chat,
    colleges,
    directory_admin,
    exchanges,
    membership,
    moderation,
    notifications,
    profiles,
    public_books,
    reports,
    reviews,
    users,
)

router = APIRouter(prefix="/v1")
for module in (
    auth,
    users,
    colleges,
    directory_admin,
    membership,
    books,
    exchanges,
    blocks,
    chat,
    reports,
    reviews,
    moderation,
    notifications,
    profiles,
    public_books,
):
    router.include_router(module.router)
