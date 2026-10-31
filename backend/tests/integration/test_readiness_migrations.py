"""Destructive migration rehearsal limited to the per-test isolated schema."""

from pathlib import Path
from uuid import uuid4

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, text

from app.db.base import Base


async def test_full_migration_round_trip_and_model_consistency(session_factory):
    engine = session_factory.kw["bind"]
    root = Path(__file__).resolve().parents[2]
    config = Config(str(root / "alembic.ini"))
    config.set_main_option("script_location", str(root / "migrations"))

    def run(connection, operation, *args):
        config.attributes["connection"] = connection
        operation(config, *args)

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
        await connection.execute(text("DROP TABLE IF EXISTS alembic_version"))
        await connection.run_sync(run, command.upgrade, "head")
        assert await connection.scalar(text("SELECT version_num FROM alembic_version")) == "0013"
        await connection.run_sync(run, command.check)
        await connection.run_sync(run, command.downgrade, "base")
        tables = await connection.run_sync(lambda sync: inspect(sync).get_table_names())
        assert set(tables) <= {"alembic_version"}
        await connection.run_sync(run, command.upgrade, "head")
        await connection.run_sync(run, command.check)


async def test_directory_rollback_does_not_reopen_closed_campuses(session_factory):
    engine = session_factory.kw["bind"]
    root = Path(__file__).resolve().parents[2]
    config = Config(str(root / "alembic.ini"))
    config.set_main_option("script_location", str(root / "migrations"))

    def run(connection, operation, revision):
        config.attributes["connection"] = connection
        operation(config, revision)

    college_id, campus_id = uuid4(), uuid4()
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
        await connection.execute(text("DROP TABLE IF EXISTS alembic_version"))
        await connection.run_sync(run, command.upgrade, "head")
        await connection.execute(
            text(
                "INSERT INTO colleges (id,created_at,name,is_active) "
                "VALUES (:id,now(),'Closed',false)"
            ),
            {"id": college_id},
        )
        await connection.execute(
            text(
                "INSERT INTO campuses (id,created_at,college_id,name,city,is_active) "
                "VALUES (:id,now(),:parent,'Main','City',true)"
            ),
            {"id": campus_id, "parent": college_id},
        )
        await connection.run_sync(run, command.downgrade, "0011")
        assert await connection.scalar(text("SELECT is_active FROM campuses")) is False
        await connection.run_sync(run, command.upgrade, "head")
        assert await connection.scalar(text("SELECT id FROM campuses")) == campus_id
        assert await connection.scalar(text("SELECT id FROM colleges")) == college_id
        assert await connection.scalar(text("SELECT is_active FROM campuses")) is False
