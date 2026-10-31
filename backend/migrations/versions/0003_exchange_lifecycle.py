"""Physical ownership, proposals, reservations, and handover resolution.

Revision ID: 0003
Revises: 0002
"""

import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
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
    op.create_table(
        "physical_books",
        *identity(),
        fk("owner_id", "users.id"),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("author", sa.String(200), nullable=False),
    )
    op.create_index("ix_physical_books_owner_id", "physical_books", ["owner_id"])
    op.add_column("book_listings", sa.Column("physical_book_id", sa.Uuid(), nullable=True))
    # Each existing listing becomes a distinct physical copy. IDs are reused in
    # the new table only, preserving all listing IDs, photos, and owners.
    op.execute(
        "INSERT INTO physical_books (id, created_at, owner_id, title, author) "
        "SELECT id, created_at, owner_id, title, author FROM book_listings"
    )
    op.execute("UPDATE book_listings SET physical_book_id = id")
    op.alter_column("book_listings", "physical_book_id", nullable=False)
    op.create_foreign_key(
        "fk_book_listings_physical_book_id_physical_books",
        "book_listings",
        "physical_books",
        ["physical_book_id"],
        ["id"],
    )
    op.create_index(
        "uq_book_listings_live_physical_book",
        "book_listings",
        ["physical_book_id"],
        unique=True,
        postgresql_where=sa.text("NOT is_archived"),
    )
    op.create_table(
        "exchanges",
        *identity(),
        fk("requester_id", "users.id"),
        fk("owner_id", "users.id"),
        fk("campus_id", "campuses.id"),
        fk("requested_listing_id", "book_listings.id"),
        fk("offered_listing_id", "book_listings.id"),
        sa.Column("requested_snapshot", sa.JSON(), nullable=False),
        sa.Column("offered_snapshot", sa.JSON(), nullable=False),
        sa.Column("requester_name", sa.String(80), nullable=False),
        sa.Column("owner_name", sa.String(80), nullable=False),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("requester_confirmed", sa.Boolean(), nullable=False),
        sa.Column("owner_confirmed", sa.Boolean(), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True)),
        sa.Column("expires_at", sa.DateTime(timezone=True)),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("resolution_reason", sa.String(1000)),
        fk("resolved_by", "users.id", nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint("requester_id <> owner_id", name="different_participants"),
        sa.CheckConstraint("requested_listing_id <> offered_listing_id", name="different_listings"),
        sa.CheckConstraint(
            "status IN ('PENDING','ACCEPTED','WAITING_CONFIRMATION',"
            "'COMPLETED','REJECTED','CANCELLED','EXPIRED')",
            name="status",
        ),
        sa.CheckConstraint(
            "(status = 'PENDING' AND accepted_at IS NULL AND expires_at IS NULL "
            "AND NOT requester_confirmed AND NOT owner_confirmed) OR "
            "(status = 'ACCEPTED' AND accepted_at IS NOT NULL AND expires_at IS NOT NULL "
            "AND NOT requester_confirmed AND NOT owner_confirmed) OR "
            "(status = 'WAITING_CONFIRMATION' AND accepted_at IS NOT NULL "
            "AND expires_at IS NOT NULL AND requester_confirmed <> owner_confirmed) OR "
            "(status = 'COMPLETED' AND requester_confirmed AND owner_confirmed "
            "AND completed_at IS NOT NULL) OR "
            "(status IN ('REJECTED','CANCELLED','EXPIRED'))",
            name="state_consistency",
        ),
    )
    op.create_index("ix_exchanges_requester_id", "exchanges", ["requester_id"])
    op.create_index("ix_exchanges_owner_id", "exchanges", ["owner_id"])
    op.create_index(
        "uq_exchanges_active_pair",
        "exchanges",
        [
            sa.text("LEAST(requested_listing_id, offered_listing_id)"),
            sa.text("GREATEST(requested_listing_id, offered_listing_id)"),
        ],
        unique=True,
        postgresql_where=sa.text("status IN ('PENDING','ACCEPTED','WAITING_CONFIRMATION')"),
    )
    op.create_table(
        "book_reservations",
        sa.Column(
            "physical_book_id", sa.Uuid(), sa.ForeignKey("physical_books.id"), primary_key=True
        ),
        fk("exchange_id", "exchanges.id"),
    )
    op.create_index("ix_book_reservations_exchange_id", "book_reservations", ["exchange_id"])
    op.create_table(
        "exchange_issues",
        *identity(),
        fk("exchange_id", "exchanges.id"),
        fk("reported_by", "users.id"),
        sa.Column("explanation", sa.Text(), nullable=False),
        sa.Column("status", sa.String(10), nullable=False),
        sa.CheckConstraint("status IN ('OPEN','RESOLVED')", name="status"),
    )
    op.create_index("ix_exchange_issues_exchange_id", "exchange_issues", ["exchange_id"])
    op.create_index(
        "uq_exchange_issues_open_reporter",
        "exchange_issues",
        ["exchange_id", "reported_by"],
        unique=True,
        postgresql_where=sa.text("status = 'OPEN'"),
    )


def downgrade():
    # Listing IDs/photos survive, but ownership/exchange audit data would be lost.
    # Use database backups to reverse a deployed milestone after real handovers.
    op.drop_table("exchange_issues")
    op.drop_table("book_reservations")
    op.drop_table("exchanges")
    op.drop_index("uq_book_listings_live_physical_book", table_name="book_listings")
    op.drop_constraint(
        "fk_book_listings_physical_book_id_physical_books", "book_listings", type_="foreignkey"
    )
    op.drop_column("book_listings", "physical_book_id")
    op.drop_table("physical_books")
