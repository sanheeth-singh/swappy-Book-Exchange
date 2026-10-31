"""Initial users, campus directory, membership review, and read-only listings.

Revision ID: 0001
Revises: None
"""

import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def identity_columns():
    return [
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    ]


def upgrade():
    op.create_table(
        "colleges",
        *identity_columns(),
        sa.Column("name", sa.String(200), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_colleges"),
        sa.UniqueConstraint("name", name="uq_colleges_name"),
    )
    op.create_table(
        "campuses",
        *identity_columns(),
        sa.Column("college_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("city", sa.String(120), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(
            ["college_id"], ["colleges.id"], name="fk_campuses_college_id_colleges"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_campuses"),
    )
    op.create_table(
        "users",
        *identity_columns(),
        sa.Column("email", sa.String(254), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("display_name", sa.String(80), nullable=True),
        sa.Column("campus_id", sa.Uuid(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("is_admin", sa.Boolean(), nullable=False),
        sa.CheckConstraint("email = lower(email)", name=op.f("ck_users_email_lowercase")),
        sa.ForeignKeyConstraint(["campus_id"], ["campuses.id"], name="fk_users_campus_id_campuses"),
        sa.PrimaryKeyConstraint("id", name="pk_users"),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_table(
        "memberships",
        *identity_columns(),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("campus_id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("submission_id", sa.Uuid(), nullable=True),
        sa.Column("document", sa.LargeBinary(), nullable=True),
        sa.Column("document_type", sa.String(30), nullable=True),
        sa.Column("document_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reviewed_by", sa.Uuid(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("review_reason", sa.String(500), nullable=True),
        sa.CheckConstraint(
            "status IN ('NOT_SUBMITTED','PENDING','VERIFIED','REJECTED','REVOKED')",
            name=op.f("ck_memberships_status"),
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_memberships_user_id_users"),
        sa.ForeignKeyConstraint(
            ["campus_id"], ["campuses.id"], name="fk_memberships_campus_id_campuses"
        ),
        sa.ForeignKeyConstraint(
            ["reviewed_by"], ["users.id"], name="fk_memberships_reviewed_by_users"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_memberships"),
        sa.UniqueConstraint("user_id", name="uq_memberships_user_id"),
        sa.UniqueConstraint("submission_id", name="uq_memberships_submission_id"),
    )
    op.create_table(
        "book_listings",
        *identity_columns(),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("campus_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("author", sa.String(200), nullable=False),
        sa.Column("description", sa.String(2000), nullable=False),
        sa.Column("condition", sa.String(20), nullable=False),
        sa.Column("condition_notes", sa.String(1000), nullable=False),
        sa.Column("is_archived", sa.Boolean(), nullable=False),
        sa.CheckConstraint(
            "condition IN ('NEW','LIKE_NEW','GOOD','FAIR','POOR')",
            name=op.f("ck_book_listings_condition"),
        ),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], name="fk_book_listings_owner_id_users"),
        sa.ForeignKeyConstraint(
            ["campus_id"], ["campuses.id"], name="fk_book_listings_campus_id_campuses"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_book_listings"),
    )
    op.create_index("ix_book_listings_campus_id", "book_listings", ["campus_id"])


def downgrade():
    op.drop_index("ix_book_listings_campus_id", table_name="book_listings")
    op.drop_table("book_listings")
    op.drop_table("memberships")
    op.drop_table("users")
    op.drop_table("campuses")
    op.drop_table("colleges")
