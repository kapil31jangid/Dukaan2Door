# Dukaan2Door Business Model

## Status and purpose

This document is a commercial hypothesis for academic evaluation. It is not a
claim that Dukaan2Door currently charges commissions, collects payments, pays
riders, has paying retailers, or is profitable.

| Label | Meaning |
|---|---|
| **Implemented** | Working product capability supported by the repository |
| **Proposed** | Commercial capability that is not implemented |
| **Validate** | Assumption that requires genuine field research or operating data |

## Value proposition

### Customers

- **Implemented:** Browse real inventory from the operational local store, place
  orders, and follow fulfillment and delivery progress.
- **Implemented:** Inventory-aware matching reduces orders sent to stores that
  cannot satisfy the requested quantities.
- **Validate:** Customers prefer ordering from a nearby kirana store and will pay
  a delivery fee for the convenience.

### Retailers

- **Implemented:** A digital catalog, store-scoped inventory, order fulfillment,
  and coordinated delivery workflow.
- **Implemented:** Gemini-assisted bill/list and product-photo onboarding with
  mandatory review, plus manual entry and auditable stock adjustment.
- **Validate:** Reduced catalog-entry effort and access to online demand provide
  enough value for commission or subscription pricing.

### Delivery partners

- **Implemented:** Nearby eligible orders, exclusive backend-authoritative
  claiming, decline/rejection controls, routing, and delivery progress.
- **Validate:** Local order density can provide useful delivery opportunities
  while supporting acceptable rider compensation and wait time.

## Revenue model options

| Revenue stream | Status | Commercial hypothesis | Validation needed |
|---|---|---|---|
| Commission per completed order | Proposed | Percentage of completed order value paid by the retailer | Retailer willingness, category margins, refund treatment |
| Customer delivery fee | Proposed | Distance or service-level fee shown before checkout | Customer willingness and rider payout coverage |
| Retailer subscription | Proposed | Optional monthly plan for enhanced catalog and operating tools | Feature value, store size, preferred billing interval |
| Premium retailer services | Proposed | Optional onboarding, catalog digitization, or analytics support | Demand, delivery cost, and ability to serve consistently |

The first field pilot should test one simple model at a time. Payment,
subscription, commission, settlement, and payout systems are intentionally not
implemented merely for this document.

## Cost structure

### Variable costs

- Rider compensation per completed delivery
- Payment processing charges if digital payment is introduced
- Gemini/API use attributable to inventory onboarding
- Map, geocoding, routing, messaging, and support use that scales with activity
- Refunds, failed-delivery handling, and promotional spend if later introduced

### Fixed or step-fixed costs

- Backend, frontend, database, storage, monitoring, and security operations
- Customer and retailer support
- Retailer onboarding and catalog quality operations
- Sales, local marketing, legal, accounting, and administration
- Engineering and product maintenance

## Editable unit economics

Enter field-validated assumptions; do not substitute GMV for platform revenue.

| Variable | Symbol | Assumption | Evidence source |
|---|---:|---:|---|
| Average order value (GMV) | `AOV` | _Enter value_ | Completed pilot orders |
| Platform commission rate | `c` | _Enter percentage_ | Retailer pricing interviews |
| Customer delivery fee | `DF` | _Enter value_ | Customer survey/pilot |
| Other attributable revenue | `OR` | _Enter value_ | Defined commercial offer |
| Rider payout | `RP` | _Enter value_ | Rider operating study |
| Payment processing cost | `PC` | _Enter value_ | Payment provider quote |
| AI/API cost per order | `AI` | _Enter value_ | Measured provider usage |
| Variable infrastructure allocation | `VI` | _Enter value_ | Hosting and traffic measurements |
| Variable support/refund provision | `SR` | _Enter value_ | Pilot operating records |
| Customer acquisition cost | `CAC` | _Enter value_ | Campaign spend / acquired customers |
| Expected completed orders per acquired customer | `N` | _Enter value_ | Cohort retention data |

```text
Commission revenue         = AOV × c
Platform revenue per order = (AOV × c) + DF + OR
Variable cost per order    = RP + PC + AI + VI + SR
Contribution per order     = Platform revenue per order − Variable cost per order
CAC allocation per order   = CAC / N
Post-acquisition contribution per order = Contribution per order − (CAC / N)
```

An order may have positive GMV while producing negative contribution. No
profitability conclusion should be made until the inputs come from real pilot
transactions and provider invoices.

## Business Model Canvas

| Canvas block | Current evidence and proposed model |
|---|---|
| Customer segments | **Validate:** neighborhood grocery customers, independent kirana retailers, and eligible local delivery partners |
| Value propositions | **Implemented:** inventory-aware local ordering, retailer inventory/fulfillment tools, and controlled delivery workflow |
| Channels | **Implemented:** role-specific web portals. **Proposed:** assisted retailer onboarding and local community outreach |
| Customer relationships | **Implemented:** self-service ordering and status visibility. **Proposed:** retailer onboarding and customer support processes |
| Revenue streams | **Proposed:** order commission, delivery fee, optional subscription, and optional premium services |
| Key resources | **Implemented:** application, catalog/inventory data model, matching, AI-assisted onboarding, delivery workflow, and deployment stack |
| Key activities | Catalog quality, retailer acquisition, order operations, delivery coordination, support, reliability, and compliance |
| Key partnerships | **Validate:** kirana retailers and delivery partners. **Proposed:** payment provider, cloud/API vendors, and local institutions |
| Cost structure | Rider payout, cloud/API usage, payment fees, onboarding, support, marketing, engineering, and administration |

## Validation plan

1. Collect genuine shopkeeper and customer survey responses using the prepared
   questionnaires.
2. Interview a small set of willing retailers about margins, current delivery
   costs, and preferred fee structure.
3. Run a supervised pilot with clearly recorded completed orders and costs.
4. Replace every unit-economics placeholder with measured values and cite the
   source and date.
5. Test pricing in controlled stages; do not infer willingness to pay from
   feature interest alone.

## Current limitations

- No production payment, commission, subscription, settlement, or payout system
  exists.
- No genuine survey responses or pilot transaction economics are available in
  the repository at the time of writing.
- Revenue, retention, acquisition cost, rider utilization, and profitability
  therefore remain unvalidated.
