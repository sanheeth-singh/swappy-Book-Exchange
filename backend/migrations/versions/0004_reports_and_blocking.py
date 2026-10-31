"""General reports, directional blocks, reversible moderation, and action history.

Revision ID: 0004
Revises: 0003
"""

import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def identity():
    return [
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    ]


def fk(name, target, *, nullable=False):
    return sa.Column(name, sa.Uuid(), sa.ForeignKey(target), nullable=nullable)


def upgrade():
    op.add_column(
        "users",
        sa.Column(
            "is_participation_restricted", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
    )
    op.add_column(
        "book_listings",
        sa.Column("is_hidden", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_table(
        "user_blocks",
        *identity(),
        fk("blocker_id", "users.id"),
        fk("blocked_id", "users.id"),
        sa.UniqueConstraint("blocker_id", "blocked_id", name="uq_user_blocks_pair"),
        sa.CheckConstraint("blocker_id <> blocked_id", name="not_self"),
    )
    op.create_index("ix_user_blocks_blocked_id", "user_blocks", ["blocked_id"])
    op.create_table(
        "reports",
        *identity(),
        fk("reporter_id", "users.id"),
        fk("target_user_id", "users.id"),
        sa.Column("target_type", sa.String(10), nullable=False),
        fk("listing_id", "book_listings.id", nullable=True),
        sa.Column("reason", sa.String(30), nullable=False),
        sa.Column("details", sa.String(2000), nullable=False),
        sa.Column("target_snapshot", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(12), nullable=False),
        fk("reviewed_by", "users.id", nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True)),
        sa.Column("action", sa.String(20)),
        sa.Column("review_summary", sa.String(1000)),
        sa.CheckConstraint("reporter_id <> target_user_id", name="not_self"),
        sa.CheckConstraint(
            "(target_type = 'USER' AND listing_id IS NULL) OR "
            "(target_type = 'LISTING' AND listing_id IS NOT NULL)",
            name="target",
        ),
        sa.CheckConstraint(
            "reason IN ('SPAM','HARASSMENT','INAPPROPRIATE_CONTENT','MISLEADING_LISTING','OTHER')",
            name="reason",
        ),
        sa.CheckConstraint("status IN ('OPEN','RESOLVED','DISMISSED')", name="status"),
        sa.CheckConstraint(
            "(status = 'OPEN' AND reviewed_at IS NULL AND reviewed_by IS NULL AND action IS NULL) "
            "OR (status <> 'OPEN' AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL "
            "AND action IS NOT NULL)",
            name="review_state",
        ),
        sa.CheckConstraint(
            "action IS NULL OR action IN ('DISMISS','RESOLVE','HIDE_LISTING','RESTRICT_USER')",
            name="action",
        ),
    )
    op.create_index("ix_reports_reporter_id", "reports", ["reporter_id"])
    op.create_index("ix_reports_status_created_at", "reports", ["status", "created_at"])
    op.create_index(
        "uq_reports_open_user",
        "reports",
        ["reporter_id", "target_user_id"],
        unique=True,
        postgresql_where=sa.text("status = 'OPEN' AND target_type = 'USER'"),
    )
    op.create_index(
        "uq_reports_open_listing",
        "reports",
        ["reporter_id", "listing_id"],
        unique=True,
        postgresql_where=sa.text("status = 'OPEN' AND target_type = 'LISTING'"),
    )
    op.create_table(
        "moderation_actions",
        *identity(),
        fk("actor_id", "users.id"),
        fk("target_user_id", "users.id"),
        fk("listing_id", "book_listings.id", nullable=True),
        fk("report_id", "reports.id", nullable=True),
        sa.Column("action", sa.String(20), nullable=False),
        sa.Column("note", sa.String(1000), nullable=False),
        sa.CheckConstraint(
            "action IN ('DISMISS','RESOLVE','HIDE_LISTING','RESTRICT_USER',"
            "'RESTORE_LISTING','RESTORE_USER')",
            name="action",
        ),
    )
    op.create_index(
        "ix_moderation_actions_target_user_id", "moderation_actions", ["target_user_id"]
    )


def downgrade():
    op.drop_table("moderation_actions")
    op.drop_table("reports")
    op.drop_table("user_blocks")
    op.drop_column("book_listings", "is_hidden")
    op.drop_column("users", "is_participation_restricted")
