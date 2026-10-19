# API Verification Matrix

Generated from actual FastAPI decorators under `backend/app/api/v1/endpoints`.
All `/api` routes use Pydantic validation. `A` means directly covered by the
automated suite; `T` means source-traced/build-verified but not independently
exercised in this audit. Failure coverage includes validation, role, ownership,
state, or conflict cases where applicable.

## Service and authentication

| Method / path | Auth | Request -> response | Data / frontend | Verification |
|---|---|---|---|---|
| `GET /` | Public | none -> root message | none / service discovery | T success |
| `GET /health` | Public | none -> health object | DB `SELECT 1` / hosting probe | A success; disconnected branch traced |
| `POST /api/auth/register` | Public | `RegisterRequest` -> `TokenResponse` | users + role profile / registration | A success/failure |
| `POST /api/auth/login` | Public | `LoginRequest` -> `TokenResponse` | users / role login | A success/failure |
| `GET /api/auth/me` | JWT | none -> `UserMeResponse` | users + profile / auth context | A success/failure |

## Profiles and stores

| Method / path | Auth | Request -> response | Data / frontend | Verification |
|---|---|---|---|---|
| `GET /api/customers/me` | Customer | none -> `CustomerProfile` | customers / profile, checkout | A success/failure |
| `PUT /api/customers/me` | Customer | `CustomerUpdate` -> profile | customers / location/profile | A success/failure |
| `GET /api/retailers/me` | Retailer | none -> `RetailerProfile` | retailers / retailer account | A success/failure |
| `PUT /api/retailers/me` | Retailer | `RetailerUpdate` -> profile | retailers / account | A success; ownership traced |
| `GET /api/retailers/me/store` | Retailer | none -> `StoreProfile` | stores / settings, overview | A success/failure |
| `PUT /api/retailers/me/store` | Retailer | `StoreUpdate` -> store | stores / status and location | A success/failure |
| `GET /api/retailers/me/products` | Retailer | none -> product list | products + inventory / inventory | A success/failure |
| `GET /api/delivery-partners/me` | Rider | none -> `DeliveryPartnerProfile` | delivery_partners / rider profile | A success/failure |
| `PUT /api/delivery-partners/me` | Rider | update -> profile | partner availability/location/capability | A success/failure |

## Catalog, inventory, and matching

| Method / path | Auth | Request -> response | Data / frontend | Verification |
|---|---|---|---|---|
| `POST /api/products` | Retailer | `ProductCreate` -> `ProductResponse` | products, inventory, adjustments / product modal | A success/failure |
| `GET /api/products/search` | Public | query/page -> paginated products | products, stores, inventory / search | A success/validation |
| `GET /api/products` | Public | filters/page -> paginated products | products + inventory / catalog | A success/validation |
| `GET /api/products/{id}` | Public | path -> product | products + inventory / detail | A success/404 |
| `PUT /api/products/{id}` | Retailer owner | `ProductUpdate` -> product | products / product modal | A success/ownership |
| `DELETE /api/products/{id}` | Retailer owner | path -> 204 | products soft-delete / catalog | A success/ownership |
| `PATCH /api/products/{id}/availability` | Retailer owner | availability patch -> product | inventory + adjustment / stock controls | A success/ownership |
| `POST /api/retailer/inventory/analyze` | Retailer | multipart image/PDF -> `InventoryAnalysisResponse` | no stock write / onboarding modal | A success/failure |
| `POST /api/retailer/inventory/analyze-product-photo` | Retailer | multipart image -> analysis + catalog matches | read-only products/inventory / onboarding | A success/failure |
| `POST /api/retailer/inventory/confirm` | Retailer | reviewed items + confirmation -> results | products, inventory, adjustments | A success/idempotency/failure |
| `POST /api/retailer/inventory/manual` | Retailer | reviewed items -> results | products, inventory, adjustments | A success/ownership |
| `POST /api/retailer/inventory/adjust` | Retailer | product, direction, quantity, reason -> result | inventory + adjustment | A add/reduce/rollback/isolation |
| `GET /api/retailer/inventory/history` | Retailer | none -> adjustment list | inventory_adjustments / history | A success/isolation |
| `POST /api/matching/store` | Customer | coordinates + items -> match | stores, products, inventory | A eligible/none/validation |
| `POST /api/uploads/product-image` | Retailer | image -> upload result | local upload path / product modal | T success; type/size checks traced |

Analysis endpoints never mutate stock. Confirmation and adjustment endpoints
lock store inventory and append an audit record. Gemini is attempted first when
configured; provider errors can use the installed PaddleOCR fallback, and the
manual route remains available.

## Orders

| Method / path | Auth | Request -> response | Data / frontend | Verification |
|---|---|---|---|---|
| `POST /api/orders` | Customer | `OrderCreate` -> `OrderResponse` | orders, items, retailer offers/mappings / checkout | A success, invalid, no stock, duplicate |
| `GET /api/orders` | JWT role scoped | filters/page -> order list | role-owned orders/offers/deliveries / all portals | A success/filter/isolation |
| `GET /api/orders/{id}` | Owner/eligible role | path -> order | order graph / detail modal/pages | A success/403/404 |
| `POST /api/orders/{id}/retailer-accept` | Eligible retailer | none -> order | order, offer, inventory, adjustments | A winner/conflict/stock; PostgreSQL race |
| `POST /api/orders/{id}/retailer-reject` | Eligible retailer | none -> order | offer; final order status when last | A single/all rejection |
| `PATCH /api/orders/{id}/status` | Authorized role | `OrderStatusUpdate` -> order | order + delivery state checks | A allowed/forbidden/conflict |
| `PUT /api/orders/{id}` | Authorized owner | `OrderUpdate` -> order | order notes / detail | A ownership; update traced |
| `GET /api/orders/{id}/status` | Authorized owner | path -> tracking response | order/store/delivery graph / customer tracking | A success/isolation |

`POST /orders` returns the existing order when the same customer repeats a
non-null checkout token. Store assignment and stock mutation happen only in the
accept endpoint. The old `PATCH ... status=ACCEPTED/REJECTED` client contract is
retained and delegates to the new claim functions.

## Delivery, routing, and tracking

| Method / path | Auth | Request -> response | Data / frontend | Verification |
|---|---|---|---|---|
| `GET /api/deliveries/available-orders` | Rider | none -> eligible orders | orders, delivery, rejections, capabilities / requests | A eligibility/isolation |
| `POST /api/deliveries/available-orders/{order_id}/decline` | Eligible rider | optional reason -> message | delivery + rejection | A decline/no claim/no cancel |
| `POST /api/deliveries/available-orders/{order_id}/claim` | Eligible rider | none -> assignment | order, delivery, partner | A winner/conflict; PostgreSQL race |
| `POST /api/deliveries/{delivery_id}/reject` | Assigned unaccepted rider | reason -> delivery | delivery, partner, rejection | A state/authorization |
| `GET /api/deliveries/{order_id}/available-partners` | Owning retailer | path -> partner list | partners, order requirements | A eligibility/authorization |
| `POST /api/deliveries/{order_id}/assign` | Owning retailer | optional partner -> assignment | order, delivery, partner | A state/capability/conflict |
| `GET /api/deliveries/{delivery_id}` | Delivery participant | path -> delivery | delivery + order / trip/tracking | A success/403/404 |
| `PATCH /api/deliveries/{delivery_id}/status` | Assigned rider | `DeliveryStatusUpdate` -> delivery | delivery, order, partner | A transitions/forbidden |
| `POST /api/deliveries/{delivery_id}/location` | Assigned rider | `DeliveryLocationUpdate` -> tracking point | tracking + partner; WS broadcast | A GPS/demo gate/invalid/unauthorized |
| `GET /api/deliveries/{delivery_id}/route` | Delivery participant | optional origin -> `RouteResponse` | delivery; OSRM read / both maps | A stage/origin/errors; external call mocked |
| `GET /api/deliveries/{delivery_id}/tracking` | Delivery participant | path -> tracking list | delivery_tracking / customer fallback | A success/isolation |
| `WS /api/ws/deliveries/{delivery_id}` | JWT query token + participant | events/snapshot | tracking + in-memory room / customer pages | A auth/status/location/snapshot |

## Known API limitations

- Retailer and rider opportunity arrival is polling/query based; there is no
  global push channel for new opportunities.
- The notifier in `app/integrations/notifier.py` is a logging hook, not a
  customer order-status push service. Customer status polling remains active.
- Pagination responses for order history are lists rather than total-count
  envelopes.
- WebSocket fan-out is process-local and requires shared pub/sub for more than
  one Render worker/instance.
- Product image upload stores files on the service filesystem; persistent object
  storage is needed for horizontally scaled or ephemeral production hosting.
