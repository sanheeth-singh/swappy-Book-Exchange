from io import BytesIO

import pytest
from PIL import Image

from app.core.errors import DomainError
from app.modules.colleges.documents import MAX_DOCUMENT_BYTES, validate_document


def test_image_content_determines_type():
    stream = BytesIO()
    Image.new("RGB", (50, 50)).save(stream, "JPEG")
    assert validate_document(stream.getvalue()) == "image/jpeg"


@pytest.mark.parametrize("content", [b"", b"<script>alert(1)</script>", b"%PDF-not-supported"])
def test_invalid_proof_rejected(content):
    with pytest.raises(DomainError):
        validate_document(content)


def test_oversized_proof_rejected():
    with pytest.raises(DomainError) as error:
        validate_document(b"x" * (MAX_DOCUMENT_BYTES + 1))
    assert error.value.status == 413
