"""Audited administrator-managed directory with effective parent availability."""

import sqlalchemy as sa
from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade():
    # Preserve every referenced UUID. Existing normalized duplicates need an operator decision.
    op.execute(r"""
    DO $$ BEGIN
        IF EXISTS (
            SELECT 1 FROM colleges
            GROUP BY lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g'))
            HAVING count(*) > 1
        ) THEN
            RAISE EXCEPTION 'Resolve duplicate college names before 0012; no IDs merged.';
        END IF;
        IF EXISTS (
            SELECT 1 FROM campuses
            GROUP BY college_id,
                lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g')),
                lower(regexp_replace(btrim(city), '[[:space:]]+', ' ', 'g')) HAVING count(*) > 1
        ) THEN
            RAISE EXCEPTION 'Resolve duplicate campus name/city entries before 0012.';
        END IF;
    END $$;
    """)
    op.add_column(
        "colleges", sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true())
    )
    op.create_index(
        "uq_colleges_normalized_name",
        "colleges",
        [sa.text("lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g'))")],
        unique=True,
    )
    op.create_index(
        "uq_campuses_normalized_location",
        "campuses",
        [
            "college_id",
            sa.text("lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g'))"),
            sa.text("lower(regexp_replace(btrim(city), '[[:space:]]+', ' ', 'g'))"),
        ],
        unique=True,
    )
    op.create_table(
        "directory_actions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("actor_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("source", sa.String(10), nullable=False),
        sa.Column("college_id", sa.Uuid(), sa.ForeignKey("colleges.id"), nullable=False),
        sa.Column("campus_id", sa.Uuid(), sa.ForeignKey("campuses.id"), nullable=True),
        sa.Column("action", sa.String(24), nullable=False),
        sa.Column("reason", sa.String(1000), nullable=False),
        sa.Column("before", sa.JSON(), nullable=False),
        sa.Column("after", sa.JSON(), nullable=False),
        sa.CheckConstraint("source IN ('ADMIN','CLI')", name="source"),
        sa.CheckConstraint(
            "(source = 'ADMIN' AND actor_id IS NOT NULL) OR (source = 'CLI' AND actor_id IS NULL)",
            name="actor_source",
        ),
        sa.CheckConstraint(
            "action IN ('CREATE_COLLEGE','EDIT_COLLEGE','ACTIVATE_COLLEGE','DEACTIVATE_COLLEGE',"
            "'CREATE_CAMPUS','EDIT_CAMPUS','ACTIVATE_CAMPUS','DEACTIVATE_CAMPUS')",
            name="action",
        ),
    )
    op.create_index(
        "ix_directory_actions_college", "directory_actions", ["college_id", "created_at"]
    )
    op.create_index("ix_directory_actions_campus", "directory_actions", ["campus_id", "created_at"])


def downgrade():
    # Preserve effective shutdown when removing the separate parent flag.
    op.execute(
        "UPDATE campuses SET is_active = false WHERE college_id IN "
        "(SELECT id FROM colleges WHERE NOT is_active)"
    )
    op.execute("DELETE FROM notifications WHERE kind = 'DIRECTORY_AVAILABILITY_CHANGED'")
    op.drop_table("directory_actions")
    op.drop_index("uq_campuses_normalized_location", table_name="campuses")
    op.drop_index("uq_colleges_normalized_name", table_name="colleges")
    op.drop_column("colleges", "is_active")
