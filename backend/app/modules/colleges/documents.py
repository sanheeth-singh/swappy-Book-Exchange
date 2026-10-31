import warnings
from io import BytesIO

from PIL import Image, UnidentifiedImageError

from app.core.errors import DomainError

MAX_DOCUMENT_BYTES = 5 * 1024 * 1024


def validate_document(data: bytes) -> str:
    if not data or len(data) > MAX_DOCUMENT_BYTES:
        raise DomainError("invalid_document_size", "Upload an image up to 5 MiB.", 413)
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(data)) as image:
                if image.format not in {"JPEG", "PNG"} or image.width * image.height > 20_000_000:
                    raise ValueError("Unsupported image")
                content_type = "image/jpeg" if image.format == "JPEG" else "image/png"
                image.verify()
                return content_type
    except (
        UnidentifiedImageError,
        OSError,
        ValueError,
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
    ):
        raise DomainError("invalid_document", "Upload a valid JPEG or PNG image.", 422)
