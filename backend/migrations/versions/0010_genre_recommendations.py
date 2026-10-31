"""Classify books and support genre-based recommendations without guessing old genres."""

import sqlalchemy as sa
from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None

GENRES = (
    "FICTION",
    "FANTASY",
    "SCIENCE_FICTION",
    "MYSTERY_THRILLER",
    "ROMANCE",
    "HISTORICAL_FICTION",
    "HORROR",
    "POETRY",
    "COMICS_GRAPHIC_NOVELS",
    "BIOGRAPHY_MEMOIR",
    "HISTORY",
    "SCIENCE_TECHNOLOGY",
    "SELF_HELP",
    "BUSINESS_FINANCE",
    "PHILOSOPHY",
    "RELIGION_SPIRITUALITY",
    "TRAVEL",
    "ACADEMIC",
    "CHILDREN_YOUNG_ADULT",
    "OTHER",
)


def upgrade():
    allowed = ",".join(repr(value) for value in GENRES)
    for table in ("physical_books", "book_listings"):
        op.add_column(table, sa.Column("genre", sa.String(32), nullable=True))
        op.create_check_constraint("genre", table, "genre IS NULL OR genre IN (" + allowed + ")")
    op.create_index(
        "ix_book_listings_recommendation",
        "book_listings",
        ["campus_id", "genre", "created_at", "id"],
        postgresql_where=sa.text("NOT is_archived AND NOT is_hidden"),
    )
    op.create_index(
        "ix_book_listings_owner_history",
        "book_listings",
        ["owner_id", "physical_book_id", "created_at", "id"],
    )


def downgrade():
    op.drop_index("ix_book_listings_owner_history", table_name="book_listings")
    op.drop_index("ix_book_listings_recommendation", table_name="book_listings")
    for table in ("book_listings", "physical_books"):
        op.drop_constraint(op.f("ck_" + table + "_genre"), table, type_="check")
        op.drop_column(table, "genre")
