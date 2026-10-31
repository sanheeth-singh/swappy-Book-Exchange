from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import text

from app.db.base import Base


async def test_populated_0002_database_upgrades_without_losing_listings_or_photos(session_factory):
    # session_factory is an isolated PostgreSQL schema, never the public schema.
    engine = session_factory.kw["bind"]
    config = Config(str(Path(__file__).resolve().parents[2] / "alembic.ini"))
    config.set_main_option(
        "script_location", str(Path(__file__).resolve().parents[2] / "migrations")
    )

    def upgrade(connection, revision):
        config.attributes["connection"] = connection
        command.upgrade(config, revision)

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
        await connection.execute(text("DROP TABLE IF EXISTS alembic_version"))
        await connection.run_sync(upgrade, "0002")
        ids = {key: uuid4() for key in ["college", "campus", "owner", "listing", "photo"]}
        now = datetime.now(UTC)
        await connection.execute(
            text("INSERT INTO colleges (id, created_at, name) VALUES (:college, :now, 'College')"),
            {**ids, "now": now},
        )
        await connection.execute(
            text(
                "INSERT INTO campuses (id, created_at, college_id, name, city, is_active) "
                "VALUES (:campus, :now, :college, 'Campus', 'City', true)"
            ),
            {**ids, "now": now},
        )
        await connection.execute(
            text(
                "INSERT INTO users (id, created_at, email, hashed_password, is_active, is_admin) "
                "VALUES (:owner, :now, 'migration@example.com', 'unused', true, false)"
            ),
            {**ids, "now": now},
        )
        await connection.execute(
            text(
                "INSERT INTO book_listings (id, created_at, owner_id, campus_id, title, author, "
                "description, condition, condition_notes, is_archived) "
                "VALUES (:listing, :now, :owner, :campus, "
                "'Original', 'Author', 'Copy', 'GOOD', '', false)"
            ),
            {**ids, "now": now},
        )
        await connection.execute(
            text(
                "INSERT INTO book_photos (id, created_at, book_id, file_id, url) "
                "VALUES (:photo, :now, :listing, 'existing-imagekit-id', 'https://example.com/photo.jpg')"
            ),
            {**ids, "now": now},
        )
        await connection.run_sync(upgrade, "head")
        row = (
            await connection.execute(
                text(
                    "SELECT b.id, b.physical_book_id, p.owner_id, b.title FROM book_listings b "
                    "JOIN physical_books p ON p.id = b.physical_book_id"
                )
            )
        ).one()
        assert row.id == ids["listing"]
        assert row.physical_book_id == ids["listing"]
        assert row.owner_id == ids["owner"]
        assert row.title == "Original"
        assert (
            await connection.scalar(
                text("SELECT is_hidden FROM book_listings WHERE id = :listing"), ids
            )
            is False
        )
        assert (
            await connection.scalar(
                text("SELECT is_participation_restricted FROM users WHERE id = :owner"), ids
            )
            is False
        )
        assert (
            await connection.scalar(text("SELECT file_id FROM book_photos WHERE id = :photo"), ids)
        ) == "existing-imagekit-id"

        assert (
            await connection.scalar(
                text("SELECT allow_public_preview FROM book_listings WHERE id = :listing"), ids
            )
            is False
        )

        # Old classifications are unknown, not inferred or rewritten by the genre migration.
        assert (
            await connection.scalar(
                text("SELECT genre FROM book_listings WHERE id = :listing"), ids
            )
            is None
        )
        assert (
            await connection.scalar(
                text("SELECT genre FROM physical_books WHERE id = :listing"), ids
            )
            is None
        )

        assert (
            await connection.scalar(text("SELECT is_active FROM colleges WHERE id = :college"), ids)
            is True
        )

        def differences(sync_connection):
            context = MigrationContext.configure(sync_connection, opts={"compare_type": True})
            return compare_metadata(context, Base.metadata)

        assert await connection.run_sync(differences) == []
