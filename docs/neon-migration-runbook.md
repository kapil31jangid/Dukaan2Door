# Neon Migration Runbook

This runbook applies Alembic revision `20261009_0006` safely. It adds the nullable
`inventory_adjustments.batch_id` column and a partial `(store_id, batch_id)`
index. It does not rewrite existing values or make legacy rows invalid.

## Before Deployment

1. Announce a write-maintenance window and stop new inventory confirmations.
2. In the Neon Console, verify the project, branch, database, and role. Never
   infer the target from a saved shell history entry.
3. Create a Neon test branch from the production branch and apply this procedure
   there first. Neon branches are isolated copies intended for migration testing:
   <https://neon.com/docs/get-started-with-neon/workflow-primer>.
4. Record the current production timestamp and confirm that it is inside the
   project's restore-history window. Review Branch Restore before proceeding:
   <https://neon.com/blog/announcing-point-in-time-restore>.
5. Use a direct Neon connection for this controlled DDL operation (hostname does
   not contain `-pooler`). Keep the pooled URL for normal application traffic.
6. From `backend/`, verify the target without printing its password:

```bash
export DATABASE_URL='postgresql+psycopg2://USER:PASSWORD@DIRECT_HOST/DB?sslmode=require'
python - <<'PY'
import os
from sqlalchemy.engine import make_url
url = make_url(os.environ["DATABASE_URL"])
print({"driver": url.drivername, "host": url.host, "database": url.database, "user": url.username})
PY
python -m alembic current
python -m alembic heads
```

Expected head: `20261009_0006`. Stop if there is more than one head, the target
is unexpected, or the current revision is unknown.

## Test Branch Migration

```bash
cd backend
source .venv/bin/activate
export DATABASE_URL='DIRECT_TEST_BRANCH_URL'
python -m alembic upgrade head
python -m alembic current
```

Run the PostgreSQL verifier only on the disposable/test branch:

```bash
TEST_DATABASE_URL="$DATABASE_URL" python ../scripts/verify_postgres_inventory.py --allow-remote
```

The verifier checks schema shape, legacy rows, confirmation replay, store
isolation, and rollback. Never point it at the production branch.

## Production Migration

1. Put the API into maintenance mode or stop instances that can confirm stock.
2. Keep customer/order writes stopped for the short migration window.
3. Set `DATABASE_URL` to the verified direct production URL.
4. Run exactly:

```bash
cd backend
source .venv/bin/activate
python -m alembic current
python -m alembic upgrade head
python -m alembic current
```

The final command must report `20261009_0006 (head)`.

## Post-Migration Checks

Run read-only schema checks:

```sql
SELECT version_num FROM alembic_version;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'inventory_adjustments' AND column_name = 'batch_id';

SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'inventory_adjustments'
  AND indexname = 'ix_inventory_adjustments_store_batch';
```

Expected: nullable `character varying(100)` and a partial index whose predicate
is `batch_id IS NOT NULL`. Then:

1. Start one API instance and verify `/health`.
2. Read existing inventory and adjustment history.
3. In an approved test store, confirm one small inventory batch and retry the
   same request with the same `confirmation_id`; stock must increase once.
4. Check application and Postgres logs, then restore normal traffic.

## Failure And Recovery

- If Alembic fails, keep writes stopped. Capture the error and run
  `python -m alembic current`; do not repeatedly rerun commands blindly.
- PostgreSQL transactional DDL should roll back this revision as one unit. Verify
  the actual schema before deciding the next action.
- Do not use `alembic downgrade` as an emergency reflex after application writes
  have begun; it removes `batch_id` and its replay evidence.
- For unintended committed changes, use Neon's Time Travel Assist to validate a
  pre-migration timestamp, then perform Branch Restore according to the verified
  project recovery procedure. Restoring causes a brief reconnect window.
- Escalate if the revision and schema disagree. Keep the API read-only/offline
  until the schema and application version are compatible.

## Evidence From Repository Validation

On 2026-10-10 the inventory migration chain was applied from an empty PostgreSQL
16 database through `20261009_0006`. `scripts/verify_postgres_inventory.py`
passed schema, legacy-read, replay, isolation, and rollback checks. The current
repository head is `20261011_0007`, which adds delivery tracking source labels.
Run `python -m alembic current` and `python -m alembic heads` before deployment;
operational Neon was not modified during the recorded inventory validation.
