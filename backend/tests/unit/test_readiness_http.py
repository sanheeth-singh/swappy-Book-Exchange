from httpx import ASGITransport, AsyncClient

from app.api.dependencies.database import get_session
from app.core.config import get_settings
from app.main import create_app


async def test_browser_preflight_and_private_cache_headers_without_database():
    app = create_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}
        assert response.headers["cache-control"] == "no-store"
        assert response.headers["x-content-type-options"] == "nosniff"
        response = await client.options(
            "/api/v1/users/me/profile",
            headers={
                "Origin": get_settings().cors_origins[0],
                "Access-Control-Request-Method": "PATCH",
                "Access-Control-Request-Headers": "Authorization,Content-Type,X-CSRF-Token",
            },
        )
        assert response.status_code == 200
        assert response.headers["access-control-allow-credentials"] == "true"
        assert response.headers["access-control-allow-origin"] == get_settings().cors_origins[0]
        denied = await client.options(
            "/api/v1/users/me/profile",
            headers={
                "Origin": "https://untrusted.invalid",
                "Access-Control-Request-Method": "PATCH",
            },
        )
        assert denied.status_code == 400
        assert "access-control-allow-origin" not in denied.headers


async def test_invalid_bearer_is_rejected_before_database_queries():
    app = create_app()

    class NoQueries:
        async def execute(self, *args, **kwargs):
            raise AssertionError("Invalid JWT must not reach PostgreSQL")

    async def no_database():
        yield NoQueries()

    app.dependency_overrides[get_session] = no_database
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(
            "/api/v1/users/me/profile", headers={"Authorization": "Bearer invalid"}
        )
        assert response.status_code == 401
        assert response.headers["www-authenticate"] == "Bearer"
        assert response.headers["cache-control"] == "no-store"
