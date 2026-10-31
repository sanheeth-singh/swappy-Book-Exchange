"""Book photos attached only by server-authorized uploads."""

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "book_photos",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("book_id", sa.Uuid(), sa.ForeignKey("book_listings.id"), nullable=False),
        sa.Column("file_id", sa.String(255), nullable=False, unique=True),
        sa.Column("url", sa.String(2000), nullable=False),
    )
    op.create_index("ix_book_photos_book_id", "book_photos", ["book_id"])


def downgrade():
    op.drop_table("book_photos")
