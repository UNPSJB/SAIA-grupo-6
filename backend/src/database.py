from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from src.common import texto as _texto  # noqa: F401  (registra `sin_tildes` en SQLite)
from src.config import settings


connect_args = {}
if settings.DB_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(settings.DB_URL, connect_args=connect_args)


@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_connection, connection_record):
    if settings.DB_URL.startswith("sqlite"):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys = ON")
        cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
