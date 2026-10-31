"""Persistent, transactionally-created user notifications."""

import sqlalchemy as sa
from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "notifications",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("recipient_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("kind", sa.String(40), nullable=False),
        sa.Column("resource_type", sa.String(20), nullable=False),
        sa.Column("resource_id", sa.Uuid(), nullable=False),
        sa.Column("event_key", sa.String(200), nullable=False),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("body", sa.String(500), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("recipient_id", "event_key", name="uq_notifications_recipient_event"),
        sa.CheckConstraint(
            "resource_type IN ('EXCHANGE','MEMBERSHIP','REPORT','LISTING','ACCOUNT')",
            name="resource_type",
        ),
    )
    op.create_index("ix_notifications_inbox", "notifications", ["recipient_id", "created_at", "id"])
    op.create_index(
        "ix_notifications_unread",
        "notifications",
        ["recipient_id"],
        postgresql_where=sa.text("read_at IS NULL"),
    )


def downgrade():
    op.drop_table("notifications")
