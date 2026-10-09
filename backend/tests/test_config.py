from app.core.config import Settings


def test_standard_postgresql_url_uses_installed_psycopg2_driver():
    configured = Settings(
        DATABASE_URL="postgresql://user:password@example.test/database",
        _env_file=None,
    )

    assert configured.DATABASE_URL == (
        "postgresql+psycopg2://user:password@example.test/database"
    )


def test_explicit_database_driver_is_preserved():
    database_url = "postgresql+psycopg2://user:password@example.test/database"
    configured = Settings(DATABASE_URL=database_url, _env_file=None)

    assert configured.DATABASE_URL == database_url
