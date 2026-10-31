import warnings
from io import BytesIO

from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.errors import DomainError

MAX_IMAGE_BYTES = 5 * 1024 * 1024
MAX_PIXELS = 20_000_000


def normalize_image(data: bytes) -> bytes:
    """Decode real image bytes, limit dimensions, strip metadata, and emit JPEG."""
    if not data or len(data) > MAX_IMAGE_BYTES:
        raise DomainError("invalid_image", "Photo must be between 1 byte and 5 MiB.", 422)
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(data)) as image:
                if (
                    image.format not in {"JPEG", "PNG", "WEBP"}
                    or image.width * image.height > MAX_PIXELS
                    or getattr(image, "is_animated", False)
                ):
                    raise ValueError("Unsupported image")
                image.load()
                clean = ImageOps.exif_transpose(image).convert("RGB")
                clean.thumbnail((2000, 2000))
                output = BytesIO()
                clean.save(output, "JPEG", quality=85)
                return output.getvalue()
    except (
        UnidentifiedImageError,
        OSError,
        ValueError,
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
    ) as exc:
        raise DomainError(
            "invalid_image", "Use a static JPEG, PNG, or WebP up to 20 megapixels.", 422
        ) from exc
