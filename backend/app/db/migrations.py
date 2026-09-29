"""Minimal versioned schema bootstrapper for environments without Alembic."""
from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.db.models import Base


MIGRATIONS = [
    ("001_initial_schema", "Create all SQLAlchemy tables defined by the application."),
]


def apply_migrations(engine: Engine) -> None:
    """Create missing tables and record the schema baseline exactly once."""
    Base.metadata.create_all(bind=engine)

    with engine.begin() as connection:
        connection.execute(text("""
            CREATE TABLE IF NOT EXISTS schema_migrations (
                revision VARCHAR(100) PRIMARY KEY,
                description TEXT NOT NULL,
                applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """))
        applied = {
            row[0]
            for row in connection.execute(text("SELECT revision FROM schema_migrations"))
        }
        for revision, description in MIGRATIONS:
            if revision not in applied:
                connection.execute(
                    text("INSERT INTO schema_migrations (revision, description) VALUES (:revision, :description)"),
                    {"revision": revision, "description": description},
                )
