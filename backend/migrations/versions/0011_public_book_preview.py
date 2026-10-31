"""Publisher opt-in for an anonymous, bounded book preview."""

import sqlalchemy as sa
from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "book_listings",
        sa.Column("allow_public_preview", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index(
        "ix_book_listings_public_preview",
        "book_listings",
        ["created_at", "id"],
        postgresql_where=sa.text("allow_public_preview AND NOT is_archived AND NOT is_hidden"),
    )


def downgrade():
    op.drop_index("ix_book_listings_public_preview", table_name="book_listings")
    op.drop_column("book_listings", "allow_public_preview")
