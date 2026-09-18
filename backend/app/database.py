from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.engine import make_url
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import QueuePool


class Base(DeclarativeBase):
    pass


def create_database(url: str):
    parsed = make_url(url)
    options = {}
    if parsed.drivername.startswith("sqlite"):
        options["connect_args"] = {"check_same_thread": False, "timeout": 15}
        if parsed.database in (None, "", ":memory:"):
            # One connection keeps an in-memory DB alive. QueuePool lends it to only
            # one session at a time; StaticPool would share a transaction across threads.
            options.update(poolclass=QueuePool, pool_size=1, max_overflow=0)
        else:
            Path(parsed.database).parent.mkdir(parents=True, exist_ok=True)
    engine = create_engine(url, **options)
    if parsed.drivername.startswith("sqlite"):

        @event.listens_for(engine, "connect")
        def configure_sqlite(connection, _):
            cursor = connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.close()

    return engine, sessionmaker(bind=engine, expire_on_commit=False)
