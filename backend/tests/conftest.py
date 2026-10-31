import os
from pathlib import Path
from uuid import uuid4

# No development defaults in production configuration. Tests get isolated values explicitly.
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://swappy:swappy@localhost:5434/swappy_test"
)
os.environ.setdefault("JWT_SECRET", "test-only-secret-with-more-than-32-characters")

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.api.dependencies.database import get_session
from app.core.config import get_settings
from app.db import models  # noqa: F401
from app.db.base import Base
from app.main import create_app
from app.modules.books.models import BookListing, PhysicalBook
from app.modules.colleges.models import Campus, College
from app.modules.users.models import User


def pytest_addoption(parser):
    parser.addoption(
        "--require-postgres",
        action="store_true",
        help="Fail without PostgreSQL or on skipped tests",
    )
    parser.addoption(
        "--migrated-schema", action="store_true", help="Build test schemas through Alembic"
    )


def pytest_configure(config):
    if config.getoption("--require-postgres"):
        url = os.environ.get("TEST_DATABASE_URL", "")
        if not url.startswith("postgresql+asyncpg://"):
            raise pytest.UsageError(
                "--require-postgres requires a dedicated TEST_DATABASE_URL (postgresql+asyncpg://)"
            )


def pytest_sessionfinish(session, exitstatus):
    if session.config.getoption("--require-postgres"):
        reporter = session.config.pluginmanager.get_plugin("terminalreporter")
        if reporter and reporter.stats.get("skipped"):
            session.exitstatus = pytest.ExitCode.TESTS_FAILED


@pytest_asyncio.fixture
async def session_factory(request):
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("Set TEST_DATABASE_URL to run real PostgreSQL API tests")
    if not url.startswith("postgresql+asyncpg://"):
        pytest.fail("Tests require PostgreSQL with asyncpg")
    # Each test uses its own schema. No drop_all or shared production tables.
    schema = "test_" + uuid4().hex
    admin_engine = create_async_engine(url)
    async with admin_engine.begin() as connection:
        await connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    engine = create_async_engine(url, connect_args={"server_settings": {"search_path": schema}})
    try:
        async with engine.begin() as connection:
            if request.config.getoption("--migrated-schema"):
                from alembic import command
                from alembic.config import Config

                root = Path(__file__).resolve().parents[1]
                config = Config(str(root / "alembic.ini"))
                config.set_main_option("script_location", str(root / "migrations"))

                def migrate(sync_connection):
                    config.attributes["connection"] = sync_connection
                    command.upgrade(config, "head")

                await connection.run_sync(migrate)
            else:
                await connection.run_sync(Base.metadata.create_all)
        yield async_sessionmaker(engine, expire_on_commit=False)
    finally:
        await engine.dispose()
        async with admin_engine.begin() as connection:
            await connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        await admin_engine.dispose()


@pytest_asyncio.fixture
async def client(session_factory):
    app = create_app()

    async def override_session():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        headers={"Origin": get_settings().api_origin},
    ) as client:
        yield client
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def campuses(session_factory):
    async with session_factory() as session:
        college = College(name="Test College")
        session.add(college)
        await session.flush()
        a = Campus(name="Campus A", city="City", college_id=college.id)
        b = Campus(name="Campus B", city="City", college_id=college.id)
        session.add_all([a, b])
        await session.flush()
        owner = User(
            email="owner@example.com",
            hashed_password="unused",
            campus_id=a.id,
            display_name="Owner",
        )
        session.add(owner)
        await session.flush()
        physical_a = PhysicalBook(owner_id=owner.id, title="Campus A book", author="Author")
        physical_b = PhysicalBook(owner_id=owner.id, title="Campus B book", author="Author")
        session.add_all([physical_a, physical_b])
        await session.flush()
        book_a = BookListing(
            physical_book_id=physical_a.id,
            owner_id=owner.id,
            campus_id=a.id,
            title="Campus A book",
            author="Author",
            description="Test",
            condition="GOOD",
        )
        book_b = BookListing(
            physical_book_id=physical_b.id,
            owner_id=owner.id,
            campus_id=b.id,
            title="Campus B book",
            author="Author",
            description="Test",
            condition="GOOD",
        )
        session.add_all([book_a, book_b])
        await session.commit()
        return a.id, b.id, book_a.id, book_b.id


@pytest_asyncio.fixture
async def students(client, campuses, session_factory):
    from tests.api.test_books import PAYLOAD, verify
    from tests.api.test_onboarding import setup, signup

    result = []
    for i in range(3):
        email = f"student{i}@example.com"
        headers = await signup(client, email)
        await setup(client, headers, campuses[0])
        await verify(session_factory, email, campuses[0])
        response = await client.post(
            "/api/v1/books",
            headers=headers,
            json={
                **PAYLOAD,
                "title": f"Book {i}",
            },
        )
        assert response.status_code == 201, response.text
        result.append((headers, response.json()))
    return result
