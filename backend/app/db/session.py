from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# Engine setup with Neon-friendly configuration
# pool_pre_ping ensures stale connections in pooled Neon DB are reconnected automatically
is_sqlite = settings.DATABASE_URL.startswith("sqlite")
connect_args = {"check_same_thread": False} if is_sqlite else {"connect_timeout": 10}
engine_options = {
    "pool_pre_ping": True,
    "echo": False,
    "connect_args": connect_args,
}

# Neon can close idle pooled connections while the development server is quiet.
# Recycle them before the provider's idle timeout and verify them on checkout.
if not is_sqlite:
    engine_options["pool_recycle"] = 300

engine = create_engine(settings.DATABASE_URL, **engine_options)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
