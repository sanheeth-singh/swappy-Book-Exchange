"""Persist exchange chat and monotonic read positions."""

import sqlalchemy as sa
from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "chat_messages",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("exchange_id", sa.Uuid(), sa.ForeignKey("exchanges.id"), nullable=False),
        sa.Column("sender_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("client_message_id", sa.Uuid(), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.UniqueConstraint("exchange_id", "sequence", name="uq_chat_exchange_sequence"),
        sa.UniqueConstraint(
            "exchange_id", "sender_id", "client_message_id", name="uq_chat_sender_retry"
        ),
        sa.CheckConstraint("sequence > 0", name="positive_sequence"),
        sa.CheckConstraint("char_length(body) BETWEEN 1 AND 2000", name="body_length"),
    )
    op.create_table(
        "chat_read_positions",
        sa.Column("exchange_id", sa.Uuid(), sa.ForeignKey("exchanges.id"), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id"), primary_key=True),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("sequence > 0", name="positive_sequence"),
    )


def downgrade():
    op.drop_table("chat_read_positions")
    op.drop_table("chat_messages")
