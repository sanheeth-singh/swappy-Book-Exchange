from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.db.base import Base


@pytest.mark.parametrize("target", ["college", "campus"])
async def test_legacy_duplicates_stop_migration_without_merging_ids(session_factory, target):
    engine = session_factory.kw["bind"]
    config = Config(str(Path(__file__).resolve().parents[2] / "alembic.ini"))
    config.set_main_option(
        "script_location", str(Path(__file__).resolve().parents[2] / "migrations")
    )

    def upgrade(connection, revision):
        config.attributes["connection"] = connection
        command.upgrade(config, revision)

    one, two, parent = uuid4(), uuid4(), uuid4()
    now = datetime.now(UTC)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
        await connection.execute(text("DROP TABLE IF EXISTS alembic_version"))
        await connection.run_sync(upgrade, "0011")
        if target == "college":
            await connection.execute(
                text(
                    "INSERT INTO colleges (id,created_at,name) VALUES (:one,:now,:a),(:two,:now,:b)"
                ),
                dict(one=one, two=two, now=now, a="Same College", b="  SAME   COLLEGE "),
            )
        else:
            await connection.execute(
                text("INSERT INTO colleges (id,created_at,name) VALUES (:id,:now,'Parent')"),
                dict(id=parent, now=now),
            )
            await connection.execute(
                text(
                    "INSERT INTO campuses (id,created_at,college_id,name,city,is_active) "
                    "VALUES (:one,:now,:parent,:a,:city,true),(:two,:now,:parent,:b,:city,true)"
                ),
                dict(
                    one=one,
                    two=two,
                    now=now,
                    parent=parent,
                    a="Main Campus",
                    b="  MAIN   CAMPUS ",
                    city="City",
                ),
            )
    with pytest.raises(DBAPIError, match="Resolve duplicate"):
        async with engine.begin() as connection:
            await connection.run_sync(upgrade, "0012")
    async with engine.connect() as connection:
        assert await connection.scalar(text("SELECT version_num FROM alembic_version")) == "0011"
        table = "colleges" if target == "college" else "campuses"
        ids = (await connection.execute(text(f"SELECT id FROM {table}"))).scalars().all()
        assert one in ids and two in ids
