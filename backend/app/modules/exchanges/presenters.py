from pydantic import JsonValue

from app.modules.books.models import BookListing
from app.modules.books.schemas import BookResponse


def snapshot(listing: BookListing) -> dict[str, JsonValue]:
    """Serialize explicitly loaded data only; never fetch or mutate records."""
    return BookResponse.model_validate(listing).model_dump(mode="json")
