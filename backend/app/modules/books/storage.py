import logging
from uuid import UUID, uuid4

from imagekitio import APIError, AsyncImageKit

from app.core.config import get_settings
from app.core.errors import DomainError


class ImageStorage:
    async def delete(self, file_id: str) -> None:
        """Strict deletion; queue metadata is retained until storage confirms success."""
        key = get_settings().imagekit_private_key
        if key is None:
            raise DomainError("image_storage_unavailable", "Photo storage is not configured.", 503)
        try:
            async with AsyncImageKit(
                private_key=key.get_secret_value(), timeout=5, max_retries=0
            ) as client:
                await client.files.delete(file_id)
        except APIError as exc:
            if getattr(exc, "status_code", None) != 404:
                raise DomainError(
                    "image_delete_failed", "Storage cleanup will be retried.", 502
                ) from exc

    async def cleanup(self, file_id: str) -> None:
        key = get_settings().imagekit_private_key
        try:
            async with AsyncImageKit(
                private_key=key.get_secret_value(), timeout=15, max_retries=0
            ) as client:
                await client.files.delete(file_id)
        except Exception:
            logging.getLogger(__name__).exception(
                "ImageKit cleanup failed for file_id=%s; reconcile manually", file_id
            )

    async def upload(self, data: bytes, book_id: UUID) -> tuple[str, str]:
        key = get_settings().imagekit_private_key
        if key is None:
            raise DomainError("image_storage_unavailable", "Photo storage is not configured.", 503)
        try:
            async with AsyncImageKit(
                private_key=key.get_secret_value(), timeout=30, max_retries=0
            ) as client:
                result = await client.files.upload(
                    file=data,
                    file_name=f"{uuid4().hex}.jpg",
                    folder=f"/swappy/books/{book_id}",
                )
                if not result.file_id or not result.url:
                    raise DomainError("image_upload_failed", "Photo upload failed.", 502)
                return result.file_id, result.url
        except APIError as exc:
            raise DomainError(
                "image_upload_failed", "Photo upload failed. Try again.", 502
            ) from exc


def get_image_storage() -> ImageStorage:
    return ImageStorage()
