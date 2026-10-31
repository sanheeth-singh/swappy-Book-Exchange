from io import BytesIO

import pytest
from PIL import Image

from app.core.errors import DomainError
from app.modules.books.images import normalize_image


def photo(fmt="PNG"):
    stream = BytesIO()
    Image.new("RGB", (100, 100), "white").save(stream, fmt)
    return stream.getvalue()


def test_photo_is_reencoded_without_metadata():
    result = normalize_image(photo())
    with Image.open(BytesIO(result)) as image:
        assert image.format == "JPEG"
        assert not image.getexif()


@pytest.mark.parametrize(
    "data",
    [b"", b"fake image", b"x" * (5 * 1024 * 1024 + 1)],
    ids=["empty", "invalid-image", "over-size-limit"],
)
def test_invalid_and_oversized_images_rejected(data):
    with pytest.raises(DomainError):
        normalize_image(data)


def test_gif_is_not_supported():
    with pytest.raises(DomainError):
        normalize_image(photo("GIF"))


def test_text_contract_rejects_blank_title_and_extra_image_ids():
    from pydantic import ValidationError

    from app.modules.books.schemas import BookInput

    base = dict(
        title="Title", author="Author", description="Copy", condition="GOOD", genre="ACADEMIC"
    )
    with pytest.raises(ValidationError):
        BookInput(**{**base, "title": "  "})
    with pytest.raises(ValidationError):
        BookInput(**base, file_id="someone-elses-image")


async def test_missing_imagekit_configuration_returns_service_unavailable(monkeypatch):
    from app.core.config import get_settings
    from app.modules.books.storage import ImageStorage

    monkeypatch.setattr(get_settings(), "imagekit_private_key", None)
    from uuid import uuid4

    with pytest.raises(DomainError) as error:
        await ImageStorage().upload(b"photo", uuid4())
    assert error.value.status == 503
