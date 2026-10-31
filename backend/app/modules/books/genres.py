from enum import StrEnum


class Genre(StrEnum):
    FICTION = "FICTION"
    FANTASY = "FANTASY"
    SCIENCE_FICTION = "SCIENCE_FICTION"
    MYSTERY_THRILLER = "MYSTERY_THRILLER"
    ROMANCE = "ROMANCE"
    HISTORICAL_FICTION = "HISTORICAL_FICTION"
    HORROR = "HORROR"
    POETRY = "POETRY"
    COMICS_GRAPHIC_NOVELS = "COMICS_GRAPHIC_NOVELS"
    BIOGRAPHY_MEMOIR = "BIOGRAPHY_MEMOIR"
    HISTORY = "HISTORY"
    SCIENCE_TECHNOLOGY = "SCIENCE_TECHNOLOGY"
    SELF_HELP = "SELF_HELP"
    BUSINESS_FINANCE = "BUSINESS_FINANCE"
    PHILOSOPHY = "PHILOSOPHY"
    RELIGION_SPIRITUALITY = "RELIGION_SPIRITUALITY"
    TRAVEL = "TRAVEL"
    ACADEMIC = "ACADEMIC"
    CHILDREN_YOUNG_ADULT = "CHILDREN_YOUNG_ADULT"
    OTHER = "OTHER"


GENRE_LABELS = {
    Genre.FICTION: "General fiction",
    Genre.FANTASY: "Fantasy",
    Genre.SCIENCE_FICTION: "Science fiction",
    Genre.MYSTERY_THRILLER: "Mystery / thriller",
    Genre.ROMANCE: "Romance",
    Genre.HISTORICAL_FICTION: "Historical fiction",
    Genre.HORROR: "Horror",
    Genre.POETRY: "Poetry",
    Genre.COMICS_GRAPHIC_NOVELS: "Comics / graphic novels",
    Genre.BIOGRAPHY_MEMOIR: "Biography / memoir",
    Genre.HISTORY: "History",
    Genre.SCIENCE_TECHNOLOGY: "Science / technology",
    Genre.SELF_HELP: "Self-help",
    Genre.BUSINESS_FINANCE: "Business / finance",
    Genre.PHILOSOPHY: "Philosophy",
    Genre.RELIGION_SPIRITUALITY: "Religion / spirituality",
    Genre.TRAVEL: "Travel",
    Genre.ACADEMIC: "Academic / textbooks",
    Genre.CHILDREN_YOUNG_ADULT: "Children / young adult",
    Genre.OTHER: "Other",
}


def normalize(value: str) -> str:
    return "".join(char for char in value.casefold() if char.isalnum())


_INTEREST_GENRES = {
    normalize(value): genre
    for genre in Genre
    for value in (genre.value, GENRE_LABELS[genre])
    if genre != Genre.OTHER
}
_INTEREST_GENRES.update(
    {
        "scifi": Genre.SCIENCE_FICTION,
        "mystery": Genre.MYSTERY_THRILLER,
        "thriller": Genre.MYSTERY_THRILLER,
        "biography": Genre.BIOGRAPHY_MEMOIR,
        "memoir": Genre.BIOGRAPHY_MEMOIR,
        "comics": Genre.COMICS_GRAPHIC_NOVELS,
        "textbooks": Genre.ACADEMIC,
    }
)


def genres_from_interests(interests: list[str]) -> set[Genre]:
    return {
        _INTEREST_GENRES[key]
        for value in interests
        if (key := normalize(value)) in _INTEREST_GENRES
    }
