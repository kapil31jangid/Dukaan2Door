# Database Integrity Report

**Verified:** 2026-10-17 against disposable PostgreSQL 16. Operational Neon was
not migrated, reset, seeded, or mutated.

## Migration chain

The current Alembic head is `20261017_0009`. Validation performed:

1. Empty database upgrade from base through `0009`: passed.
2. Downgrade from `0009` to `20261012_0008`: passed.
3. Re-upgrade from `0008` to `0009`: passed.

Migration `0009` makes `orders.store_id` nullable until claim, adds the
customer-scoped checkout token constraint, and creates retailer offer and offer
item tables. Its downgrade maps an unclaimed order to its source product store
before restoring the old non-null constraint.

## Operational relationship chain

`users -> customers -> orders -> order_items`  
`users -> retailers -> stores -> inventory/products`  
`orders -> retailer_order_offers -> retailer_order_offer_items -> inventory`  
`orders -> deliveries -> delivery_partners -> delivery_tracking`

`delivery_rejections` records rider-specific declines. `inventory_adjustments`
records the store, product, signed delta, resulting quantity, source, actor, and
confirmation reference where applicable.

## Constraints and indexes

- One opportunity per `(order_id, store_id)`.
- One mapped line per `(offer_id, order_item_id)`.
- One checkout token per `(customer_id, checkout_token)`; null tokens remain
  compatible with older clients.
- One delivery per order and one profile per user role relationship.
- Foreign keys protect offer mappings, order items, inventory, delivery, and
  tracking ownership.
- Offer status/expiry, foreign keys, order status/store, and tracking lookup
  columns are indexed.

The schema does not currently add a database `CHECK (quantity >= 0)` to legacy
inventory. Non-negative stock is enforced in locked application transactions.
Adding a database check should first audit existing production rows.

## Transaction behavior

### Checkout

One transaction creates the order, items, offers, and mappings. There is no
inventory mutation. An integrity conflict on the checkout token rolls back and
returns the existing customer order.

### Retailer acceptance

1. `SELECT ... FOR UPDATE` the order.
2. Reject if already assigned or outside `RECEIVED`.
3. Lock the store offer and mapped inventory rows.
4. Revalidate ownership, availability, and quantity.
5. Deduct the winner only and append inventory adjustments.
6. Assign the order, accept the winner, mark other pending offers `LOST`.
7. Commit once; exceptions roll back.

The PostgreSQL race test launched two retailer acceptances concurrently and
observed one winner and one HTTP 409. It then launched two rider claims and
observed one persisted rider assignment.

### Cancellation and recovery

Customers may cancel only while `RECEIVED`, before stock is deducted. Pending
offers become unavailable. Post-accept cancellation/restoration is deliberately
not exposed. Expiry is evaluated lazily during retailer order reads. Accepted
retailer abandonment and picked-up rider reassignment require a future explicit
operational workflow.

## Inventory evidence

Automated tests verify sufficient-stock filtering, acceptance-time revalidation,
winner-only decrement, all-store rejection without mutation, duplicate
confirmation idempotency, adjustment rollback, store isolation, and frozen
capability checks. AI analysis endpoints return review drafts and do not write
stock until an authenticated retailer confirms.

## Deployment action

Before deployment, back up/branch Neon, inspect for invalid legacy quantities,
run `python -m alembic upgrade head` in a controlled release step, verify
`python -m alembic current`, and only then release frontend code that creates
retailer opportunities. Do not run this migration automatically against the
operational database during a faculty demo.
