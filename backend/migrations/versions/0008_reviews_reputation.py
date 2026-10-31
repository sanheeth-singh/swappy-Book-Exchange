"""Completed-exchange reviews and audited review moderation."""

import sqlalchemy as sa
from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "reviews",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("exchange_id", sa.Uuid(), sa.ForeignKey("exchanges.id"), nullable=False),
        sa.Column("reviewer_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("reviewed_user_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("comment", sa.String(2000), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_hidden", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.UniqueConstraint("exchange_id", "reviewer_id", name="uq_reviews_exchange_reviewer"),
        sa.CheckConstraint("reviewer_id <> reviewed_user_id", name="not_self"),
        sa.CheckConstraint("rating BETWEEN 1 AND 5", name="rating"),
        sa.CheckConstraint(
            "comment IS NULL OR char_length(comment) BETWEEN 1 AND 2000", name="comment_length"
        ),
    )
    op.create_index("ix_reviews_public_user", "reviews", ["reviewed_user_id", "published_at", "id"])
    op.create_index(
        "ix_reviews_pending_publication",
        "reviews",
        ["exchange_id"],
        postgresql_where=sa.text("published_at IS NULL"),
    )
    op.create_table(
        "review_moderation_actions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("review_id", sa.Uuid(), sa.ForeignKey("reviews.id"), nullable=False),
        sa.Column("actor_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("action", sa.String(10), nullable=False),
        sa.Column("reason", sa.String(1000), nullable=False),
        sa.CheckConstraint("action IN ('HIDE','RESTORE')", name="action"),
    )
    op.create_index(
        "ix_review_moderation_review", "review_moderation_actions", ["review_id", "created_at"]
    )


def downgrade():
    op.drop_table("review_moderation_actions")
    op.drop_table("reviews")
