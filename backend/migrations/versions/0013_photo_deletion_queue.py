"""Persist storage-cleanup work for removed listing photos."""

import sqlalchemy as sa
from alembic import op

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "photo_deletion_tasks",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("file_id", sa.String(255), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.UniqueConstraint("file_id"),
    )


def downgrade():
    op.execute("""
    DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM photo_deletion_tasks) THEN
            RAISE EXCEPTION 'Run photo cleanup before downgrading 0013; pending tasks preserved.';
        END IF;
    END $$;
    """)
    op.drop_table("photo_deletion_tasks")
