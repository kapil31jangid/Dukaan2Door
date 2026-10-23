# A Report on

# Dukaan2Door: A Hyperlocal Delivery and Inventory Management Platform for Neighborhood Retailers

## Under Subject of

Innovation and Design Thinking - I  
Semester - III  
Department of Computer Engineering

### Submitted by

| Student name | Enrollment number |
|---|---|
| [Student 1 name] | [Enrollment number] |
| [Student 2 name] | [Enrollment number] |
| [Student 3 name] | [Enrollment number] |
| [Student 4 name] | [Enrollment number] |
| [Student 5 name] | [Enrollment number] |

| Internal guide | Head of Department |
|---|---|
| [Guide name] | Dr. Vikas Tulshyan |

> Replace every bracketed field before submitting. Apply the college Word/PDF
> formatting requirements after final pagination.

---

# Acknowledgement

We sincerely express our gratitude to our internal guide, **[Guide name]**, for
their guidance, encouragement, and constructive feedback throughout the
development of Dukaan2Door. Their support helped us convert an initial problem
observation about local retail delivery into a structured prototype.

We thank the Head of the Department, **Dr. Vikas Tulshyan**, the faculty of the
Department of Computer Engineering, and Silver Oak University for providing the
learning environment and resources required for this work. We also acknowledge
the local retailers, delivery partners, and potential customers whose everyday
workflows motivated the problem selection.

Finally, we thank our team members, friends, and families for their cooperation
and support during requirement analysis, design, implementation, testing, and
documentation.

---

# Abstract

Neighborhood kirana stores often manage stock manually while customers lack a
single reliable way to discover nearby product availability and coordinate local
delivery. Dukaan2Door is a role-based web prototype that connects customers,
retailers, and delivery partners in one hyperlocal fulfilment workflow. A
customer submits a cart and delivery location; the platform identifies stores
within the active service radius that can fulfil the complete cart and creates
an opportunity for each eligible retailer. The first retailer to accept
revalidates and reserves the relevant inventory. After preparation, eligible
delivery partners can view, decline, or atomically claim the ready order.

The prototype is implemented with React, TypeScript, and Vite on the client,
and FastAPI with PostgreSQL, SQLAlchemy, and Alembic on the server. Mapbox GL
JS renders maps, OSRM supplies road-route geometry, and authenticated
WebSockets distribute delivery status and location updates. Retailers can also
maintain store-scoped stock through manual entry or AI-assisted bill/list and
product-photo analysis; every AI result is review-only until the retailer
confirms it. For a controlled demonstration, a backend-owned route-playback
mode follows OSRM geometry from rider to store and then from store to customer;
real browser GPS remains available for operational use.

The project demonstrates a technically verifiable workflow for inventory-aware
matching, retailer and rider pooling, exclusive acceptance, and live delivery
visibility. It does not claim deployed payments, commissions, profitability, or
completed market survey results. These remain future validation activities.

**Keywords:** hyperlocal delivery, kirana retail, inventory management,
store matching, last-mile delivery, OSRM, WebSocket, role-based access.

---

# List of Figures

| Figure no. | Figure name | Page no. |
|---|---|---|
| 1 | Dukaan2Door system architecture | Update after pagination |
| 2 | Customer product browsing and checkout screen | Update after inserting screenshot |
| 3 | Retailer inventory review and adjustment screen | Update after inserting screenshot |
| 4 | Retailer order-opportunity screen | Update after inserting screenshot |
| 5 | Delivery-partner available-order screen | Update after inserting screenshot |
| 6 | Customer live-tracking screen | Update after inserting screenshot |
| 7 | Dukaan2Door mind map | Update after pagination |
| 8 | AEIOU canvas | Update after pagination |
| 9 | Ideation canvas | Update after pagination |

# List of Tables

| Table no. | Table name | Page no. |
|---|---|---|
| 1 | User characteristics | Update after pagination |
| 2 | Hardware requirements | Update after pagination |
| 3 | Software requirements | Update after pagination |
| 4 | Functional prototype modules | Update after pagination |
| 5 | AEIOU observations | Update after pagination |
| 6 | Product development canvas | Update after pagination |
| 7 | Current limitations and future enhancements | Update after pagination |

# Table of Contents

Generate this page automatically after moving the report into Word or Google
Docs and applying heading styles.

1. Introduction
2. System Requirement Study
3. Prototype
4. Mind Mapping
5. Canvas
6. Limitation and Future Enhancement
7. Conclusion
8. References
9. Appendix

---

# 1. Introduction

## 1.1 Problem Summary

Independent neighborhood retailers provide convenient access to essential
products, but their operations are commonly coordinated through manual stock
records, phone calls, and in-person visits. A customer may not know whether a
nearby store has every item in a cart. A retailer may not have a simple way to
publish current stock, accept online orders, or coordinate a delivery partner.
The delivery partner, in turn, needs a clear pickup location, a destination,
and an unambiguous assignment process.

These issues create three connected problems:

1. **Inventory uncertainty:** an order should not be offered to a retailer
   whose store cannot fulfil the requested quantities.
2. **Fulfilment coordination:** when several retailers have sufficient stock,
   the platform must prevent multiple stores from preparing the same order.
3. **Last-mile visibility:** a delivery request must be assigned to only one
   eligible rider, and the customer should receive clear status and location
   updates.

Research on omni-channel grocery fulfilment identifies inventory, store
fulfilment, and last-mile distribution as linked planning concerns [1], [2].
Last-mile systems also require operational decisions about assignment, routing,
and delivery execution [3]. Dukaan2Door addresses these concerns at a
prototype scale for local retailers.

## 1.2 Purpose

The purpose of Dukaan2Door is to design and implement a hyperlocal platform
that digitizes the interaction among customers, local retailers, and delivery
partners without treating inventory or delivery assignment as a purely
front-end decision.

The objectives are:

- provide customers with a role-specific interface to browse products, manage
  a cart, place an order, and track delivery progress;
- provide retailers with store-scoped catalog and inventory management,
  order-opportunity acceptance, preparation, and ready-for-pickup actions;
- provide delivery partners with an eligible ready-order pool, decline and
  exclusive-claim actions, pickup progression, and route visibility;
- match the complete customer cart to stock-qualified stores in a 2 km radius,
  with a 5 km fallback when necessary;
- preserve consistency through backend authorization, state transitions,
  database transactions, and record locking; and
- evaluate the prototype through automated backend/frontend tests and a
  supervised multi-role demonstration.

## 1.3 Scope

### In scope

- Customer, retailer, and delivery-partner authentication and role-based
  portals.
- Product browsing, cart, checkout, address/location handling, and order
  history.
- Store-scoped inventory, manual adjustments, and retailer-reviewed image
  analysis for bills, stock lists, and product photos.
- Complete-cart store eligibility and a shared retailer-offer pool.
- Retailer acceptance, rejection, preparation, and ready-for-pickup workflow.
- Shared eligible-rider pool, decline, exclusive claim, pickup, delivery, and
  status progression.
- Mapbox map display, OSRM road routing, persisted tracking records, and
  authenticated WebSocket delivery updates.
- Controlled OSRM route playback for a supervised local demonstration.

### Out of scope

- Production payment gateway, commission collection, retailer subscription,
  settlement, or rider payout.
- Guaranteed real-time inventory synchronization with a retailer's point of
  sale system.
- Multi-instance WebSocket scaling with shared pub/sub infrastructure.
- Automatic product creation or automatic stock updates from unreviewed AI
  output.
- Claims of completed commercial validation, profitability, or survey findings
  without genuine participant data.

## 1.4 Technical and Literature Review

Hübner, Kuhn, and Wollenburg describe grocery fulfilment as a joint problem of
order fulfilment and last-mile distribution [1]. Melacini et al. similarly
highlight the importance of assortment availability, store logistics, and
distribution coordination in omni-channel retailing [2]. Boysen, Fedtke, and
Schwerdfeger review the operational decisions involved in last-mile systems,
including routing and delivery execution [3]. These studies support the choice
to connect inventory validation, retailer acceptance, rider assignment, and
route progress in one workflow.

Technically, the prototype uses React for component-based client interfaces [4]
and FastAPI for typed REST and WebSocket APIs [5]. PostgreSQL provides durable
operational data and transactional consistency [6]. Mapbox GL JS renders the
browser map [7], while OSRM returns road-network geometry, distance, and
duration for route display and controlled playback [8]. Gemini is used only to
extract reviewable inventory candidates; confirmation remains retailer
controlled [9].

---

# 2. System Requirement Study

## 2.1 User Characteristics

| User | Characteristics | Primary needs | Dukaan2Door support |
|---|---|---|---|
| Customer | Purchases grocery and essential items; may use a phone or desktop browser | Product availability, simple checkout, delivery visibility | Catalog, cart, checkout, order status, live map |
| Retailer | Owns or operates a local store; may maintain stock manually | Store inventory, order decisions, preparation controls | Store-scoped stock, photo/bill review, retailer offer pool, fulfilment actions |
| Delivery partner | Performs local pickup and delivery; needs mobile-friendly controls | Nearby eligible work, clear pickup/drop-off, route and status actions | Available-order pool, capability checks, exclusive claim, route/tracking workflow |
| Administrator/developer | Maintains the prototype and demo environment | Configuration, migration, validation, observability | Environment configuration, Alembic migrations, tests, operational guides |

## 2.2 Hardware and Software Characteristics

### 2.2.1 Hardware Requirements

| Category | Minimum requirement | Recommended for demonstration |
|---|---|---|
| Developer machine | Dual-core CPU, 8 GB RAM, internet access | Quad-core CPU, 16 GB RAM |
| Retailer/customer device | Modern Android/iOS phone or desktop browser | Recent Chrome/Firefox browser with stable internet |
| Rider device | GPS-capable smartphone for real location mode | GPS-capable smartphone with location permission enabled |
| Backend runtime | 1 GB RAM for standard Gemini-only configuration | 2 GB RAM if the optional PaddleOCR fallback is installed |

### 2.2.2 Software Requirements

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS | Role-based responsive web interfaces |
| Backend | Python 3.11, FastAPI, Pydantic | REST APIs, WebSockets, validation, business rules |
| Database | PostgreSQL/Neon, SQLAlchemy, Alembic | Persistent users, stores, inventory, offers, orders, deliveries, tracking |
| Maps and routes | Mapbox GL JS, OSRM | Map rendering, route geometry, distance, duration |
| Inventory analysis | Gemini API; optional PaddleOCR fallback | Review-only bill/list/product-photo extraction |
| Testing | Pytest, Node test runner, TypeScript/Vite build | Regression and contract verification |

---

# 3. Prototype

## 3.1 Details of Prototype

Dukaan2Door is a three-portal web prototype. The architecture is summarized in
the project architecture artifact at `docs/dukaan2door-architecture.html`.
The main runtime flow is:

```text
Customer checkout
  -> stock-qualified retailer offers
  -> first valid retailer acceptance
  -> preparation and READY_FOR_PICKUP
  -> eligible rider pool
  -> one rider claim
  -> rider-to-store route
  -> pickup confirmation
  -> store-to-customer route
  -> delivered
```

### Customer portal

The customer can select a location, browse/search products, manage a cart,
provide a delivery address, place an order, review order history, and observe
status and tracking updates. Checkout uses an idempotency token and creates
retailer opportunities only for stores that can fulfil the complete cart.

### Retailer portal

The retailer can manage products and inventory, including low-stock visibility,
manual entry, confirmed stock addition/reduction, and an adjustment history.
Image analysis supports bills, lists, and product photographs, but detected
items are drafts. The retailer must review a catalog match, direction,
quantity, and reason before stock changes. Eligible retailers receive a shared
order opportunity; the first backend-verified acceptance wins, while other
offers close.

### Delivery-partner portal

The delivery partner sees nearby ready orders that match availability,
location, and required handling capabilities. A rider can decline an order or
claim it; backend locking ensures that only one claim persists. Once accepted,
the route workflow progresses from rider to store, waits for pickup
confirmation, then progresses from store to the customer. Live status and
location updates are persisted and broadcast through authenticated WebSockets.

### Data integrity and safety

The prototype uses role checks, ownership checks, state-machine validation,
idempotency keys, and transactional updates. Inventory is decremented only when
the winning retailer accepts. An AI analysis request does not write inventory.
The rider claim is backend-authoritative, so two browser sessions cannot both
claim the same order successfully.

## 3.2 Images of Prototype

Insert screenshots from the running application here. Use the same demo order
across the figures where possible and blur any personal credentials or tokens.

| Figure | Screenshot to insert | Suggested route |
|---|---|---|
| Figure 2 | Customer catalog/cart or checkout | `/customer/home` or `/customer/cart` |
| Figure 3 | Retailer inventory review/adjustment | `/retailer/inventory` |
| Figure 4 | Retailer order opportunity and status action | `/retailer/orders` |
| Figure 5 | Rider available-order pool | `/delivery/orders` |
| Figure 6 | Customer or rider live route tracking | `/customer/tracking/:id` or `/delivery/current` |

**Figure 1. System architecture of Dukaan2Door.** Insert the approved
architecture PNG/SVG from `docs/research-poster/` or a clear screenshot of the
interactive architecture after the final commit.

---

# 4. Mind Mapping

## 4.1 Mind Mapping Canvas

Use this structure to create a colored mind map in Word, Canva, or draw.io.

```text
Dukaan2Door
├── People
│   ├── Customer
│   ├── Retailer
│   └── Delivery partner
├── Customer problem
│   ├── Product availability uncertainty
│   ├── Multiple calls/visits
│   └── No delivery visibility
├── Retailer problem
│   ├── Manual stock records
│   ├── Online-order coordination
│   └── Delivery dependence
├── Core solution
│   ├── Store-scoped inventory
│   ├── Complete-cart store matching
│   ├── Retailer opportunity pool
│   └── Rider opportunity pool
├── Delivery experience
│   ├── Pickup and drop-off route legs
│   ├── OSRM route geometry
│   └── WebSocket tracking
└── Validation
    ├── Automated tests
    ├── Supervised multi-role demo
    └── Pending genuine surveys/pilot
```

**Figure 7. Dukaan2Door mind map.** Recreate the above as a visual canvas and
insert it here.

---

# 5. Canvas

## 5.1 AEIOU Canvas

| Element | Observation for Dukaan2Door |
|---|---|
| Activities | Customers browse/order; retailers update stock and prepare orders; riders claim, pick up, and deliver. |
| Environments | Neighborhood stores, customer homes, local roads, and browser/mobile interfaces. |
| Interactions | Customer-to-platform checkout; retailer acceptance; rider claim; status and location updates. |
| Objects | Product catalog, inventory records, store offers, orders, delivery records, maps, route geometry, and phones. |
| Users | Customers, kirana retailers/store staff, delivery partners, and project administrators. |

**Figure 8. AEIOU canvas.** Convert this table into the institution's preferred
canvas layout.

## 5.2 Ideation Canvas

| Stage | Design decision | Reason |
|---|---|---|
| Identify | Local stock and delivery coordination are disconnected | Customers may order unavailable products; retailers and riders need clarity |
| Explore | Single-store checkout, broadcast retailer offers, and manual coordination | Broadcast offers best supports multiple eligible local stores |
| Select | Complete-cart stock matching with first valid retailer acceptance | Prevents duplicate fulfilment and postpones stock deduction until a winner exists |
| Prototype | Role-specific portals with orders, inventory, claims, maps, and tracking | Makes each participant's workflow visible and testable |
| Validate | Automated tests, race checks, and supervised multi-role demo | Verifies technical invariants before commercial or market claims |

**Figure 9. Ideation canvas.** Recreate using sticky-note style sections if a
visual canvas is required.

## 5.3 Empathy Canvas

| Stakeholder | Thinks/feels | Sees | Says/does | Pain points | Gains |
|---|---|---|---|---|---|
| Customer | Wants essentials quickly and reliably | Nearby stores with uncertain online stock | Searches, compares, orders, tracks | Unavailable items, unclear delivery status | Convenience and visibility |
| Retailer | Wants more demand without operational confusion | Manual records and incoming requests | Updates stock, accepts/prepares orders | Duplicate work, stock mismatch, delivery coordination | Digital catalog and controlled fulfilment |
| Rider | Wants clear, eligible delivery work | Pickup/drop-off details and route | Claims, navigates, updates status | Duplicate offers, unsuitable orders, unclear handover | Exclusive assignment and route clarity |

## 5.4 Product Development Canvas

| Area | Dukaan2Door decision |
|---|---|
| Target users | Customers, independent local retailers, and eligible delivery partners |
| Problem | Lack of coordinated inventory-aware local ordering and delivery visibility |
| Value proposition | Nearby-store fulfilment with verified stock workflow and trackable local delivery |
| Key features | Complete-cart matching, retailer/rider pools, reviewed inventory onboarding, OSRM routes, WebSocket updates |
| Technical feasibility | Implemented as React/TypeScript frontend, FastAPI backend, PostgreSQL persistence, Mapbox, and OSRM |
| Validation | Automated backend/frontend tests and local supervised demonstration |
| Business hypothesis | Commission, delivery fee, retailer subscription, and premium services are proposed only |
| Evidence gap | Genuine survey responses, pilot economics, payments, and multi-instance scaling |

---

# 6. Limitation and Future Enhancement

| Current limitation | Future enhancement |
|---|---|
| WebSocket connection manager is in-memory and suited to one backend process | Add shared pub/sub infrastructure such as Redis for multi-instance deployment |
| Retailer and rider opportunities refresh through polling | Add authorized push notifications or real-time opportunity events |
| AI product recognition is review-only and best effort | Improve catalog metadata, optional barcode workflow, and measured recognition evaluation |
| Real stock may still change through offline sales | Integrate authorized point-of-sale synchronization where feasible |
| No payment, settlement, subscription, or payout system is implemented | Integrate a compliant payment provider after requirements, security review, and business validation |
| Survey package is prepared but contains no genuine responses | Collect approved voluntary responses and report only measured findings |
| Route playback is for supervised demonstration | Use rider GPS in real operation and retain playback only for controlled demos |
| No unrestricted post-pickup cancellation/reassignment | Design custody-aware exception handling with retailer, rider, and customer communication |

---

# 7. Conclusion

Dukaan2Door demonstrates an inventory-aware hyperlocal delivery prototype for
neighborhood retailers. The project connects three roles through a single
backend-authoritative workflow: a customer order becomes opportunities for
stock-qualified retailers, one retailer accepts and prepares the order, eligible
riders compete safely for the ready delivery, and the selected rider's progress
is visible on a map.

The prototype's contribution is not merely a set of separate dashboards. It
preserves operational rules across those dashboards: inventory is store-scoped,
AI analysis requires review, stock is deducted only by the winning retailer,
one rider can claim a delivery, and location/status updates are persisted and
shared through authenticated channels. Automated test results provide technical
evidence for these controls.

The prototype is appropriate for a supervised academic demonstration. Before a
commercial deployment, the team must collect genuine market evidence, validate
unit economics, complete payment and operational policies, and extend the
single-instance real-time design for scale.

---

# References

[1] A. H. Hübner, H. Kuhn, and J. Wollenburg, “Last mile fulfilment and
distribution in omni-channel grocery retailing: A strategic planning
framework,” *International Journal of Retail & Distribution Management*, vol.
44, no. 3, pp. 228-247, 2016, doi: 10.1108/IJRDM-11-2014-0154.

[2] M. Melacini, S. Perotti, M. Rasini, and E. Tappia, “E-fulfilment and
distribution in omni-channel retailing: A systematic literature review,”
*International Journal of Physical Distribution & Logistics Management*, 2018.

[3] N. Boysen, S. Fedtke, and S. Schwerdfeger, “Last-mile delivery concepts: A
survey from an operational research perspective,” *OR Spectrum*, vol. 43, pp.
1-58, 2021, doi: 10.1007/s00291-020-00607-8.

[4] Meta Open Source, “React documentation.” [Online]. Available:
https://react.dev/. [Accessed: 19-Oct-2026].

[5] S. Ramírez, “FastAPI documentation.” [Online]. Available:
https://fastapi.tiangolo.com/. [Accessed: 19-Oct-2026].

[6] PostgreSQL Global Development Group, “PostgreSQL documentation.” [Online].
Available: https://www.postgresql.org/docs/. [Accessed: 19-Oct-2026].

[7] Mapbox, “Mapbox GL JS documentation.” [Online]. Available:
https://docs.mapbox.com/mapbox-gl-js/. [Accessed: 19-Oct-2026].

[8] Project OSRM, “Open Source Routing Machine.” [Online]. Available:
https://project-osrm.org/. [Accessed: 19-Oct-2026].

[9] Google AI for Developers, “Gemini API documentation.” [Online]. Available:
https://ai.google.dev/gemini-api/docs. [Accessed: 19-Oct-2026].

---

# Appendix

## Appendix A: Demonstration flow

1. Sign in as a customer and add products to the cart.
2. Place an order using the customer checkout flow.
3. Sign in as two eligible retailers in separate browser profiles.
4. Show that each receives the same store-specific opportunity.
5. Accept with one retailer; show that the other cannot proceed with the same
   order.
6. Prepare the order and mark it ready for pickup.
7. Sign in as two eligible riders; show the shared ready-order pool.
8. Claim with one rider; show the conflict/absence for the other rider.
9. Demonstrate rider-to-store progress, pickup confirmation, and
   store-to-customer progress.
10. Show customer tracking and final delivery completion.

## Appendix B: Current verification record

At the time of writing, the repository recorded:

| Validation | Result |
|---|---|
| Backend regression suite | 122 passed, 1 PostgreSQL-only test skipped |
| Frontend regression suite | 23 passed |
| Frontend TypeScript/Vite production build | Passed |
| PostgreSQL retailer/rider race verification | Passed separately on disposable PostgreSQL |

Re-run the project validation commands before submitting the final report so
this table remains accurate.
