from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.api import router
from app.config import settings
from app.database import Base, create_database
from app.domain import DomainError
from app.seed import seed_demo


def create_app(database_url: str | None = None, seed: bool | None = None) -> FastAPI:
    engine, sessions = create_database(database_url or settings.database_url)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        Base.metadata.create_all(engine)
        if settings.seed_demo if seed is None else seed:
            with sessions.begin() as db:
                seed_demo(db)
        yield
        engine.dispose()

    app = FastAPI(title="ServiceFlow · дополнительные работы", version="0.1.0", lifespan=lifespan)
    app.state.sessions = sessions
    app.include_router(router)

    @app.exception_handler(DomainError)
    async def domain_error(_: Request, error: DomainError):
        return JSONResponse(status_code=error.status_code, content={"detail": error.message})

    return app


app = create_app()
