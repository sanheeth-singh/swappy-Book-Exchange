"""Public profiles, avatar selection and account deactivation timestamp."""

import sqlalchemy as sa
from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "users", sa.Column("avatar_id", sa.String(32), nullable=False, server_default="reader_01")
    )
    op.add_column("users", sa.Column("bio", sa.String(300), nullable=True))
    op.add_column(
        "users",
        sa.Column("reading_interests", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
    )
    op.add_column("users", sa.Column("deactivated_at", sa.DateTime(timezone=True), nullable=True))
    op.create_check_constraint(
        "avatar_id",
        "users",
        "avatar_id IN ('reader_01','reader_02','reader_03','reader_04','reader_05',"
        "'reader_06','reader_07','reader_08','reader_09','reader_10',"
        "'reader_11','reader_12','reader_13','reader_14','reader_15')",
    )
    op.create_check_constraint(
        "reading_interests",
        "users",
        "json_typeof(reading_interests) = 'array' AND json_array_length(reading_interests) <= 8",
    )


def downgrade():
    op.drop_constraint(op.f("ck_users_reading_interests"), "users", type_="check")
    op.drop_constraint(op.f("ck_users_avatar_id"), "users", type_="check")
    op.drop_column("users", "deactivated_at")
    op.drop_column("users", "reading_interests")
    op.drop_column("users", "bio")
    op.drop_column("users", "avatar_id")
