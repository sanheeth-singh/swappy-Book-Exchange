from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.router import router
from app.core.config import get_settings
from app.core.errors import DomainError
from app.modules.auth.cookies import clear_refresh_cookie
from app.modules.auth.errors import SessionError


def create_app() -> FastAPI:
    app = FastAPI(title="Swappy API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=get_settings().cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type", "X-CSRF-Token"],
    )

    @app.exception_handler(DomainError)
    async def domain_error(request: Request, exc: DomainError):
        response = JSONResponse(
            status_code=exc.status, content={"error": {"code": exc.code, "message": exc.message}}
        )
        if isinstance(exc, SessionError):
            clear_refresh_cookie(response)
            response.headers["WWW-Authenticate"] = "Bearer"
        return response

    @app.middleware("http")
    async def private_responses(request: Request, call_next):
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    @app.get("/health", tags=["health"])
    async def health():
        return {"status": "ok"}

    app.mount(
        "/assets/avatars",
        StaticFiles(directory=Path(__file__).resolve().parent / "assets" / "avatars"),
        name="avatars",
    )
    app.include_router(router)
    return app
