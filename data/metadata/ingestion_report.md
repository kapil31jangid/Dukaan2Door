# Ingestion Report

```json
{
  "totals": {
    "source_datasets": 4,
    "source_products": 63187,
    "source_inventory": 3732,
    "source_orders": 10000,
    "source_order_items": 97955,
    "products": 1,
    "inventory": 1,
    "orders": 1,
    "order_items": 1
  },
  "source_products_by_platform": {
    "bigbasket": 8208,
    "blinkit": 1559,
    "instacart": 49688,
    "zepto": 3732
  },
  "source_inventory_by_platform": {
    "zepto": 3732
  },
  "source_orders_by_platform": {
    "instacart": 10000
  },
  "source_order_items_by_platform": {
    "instacart": 97955
  },
  "issues": {
    "orphan_source_order_items": 0,
    "source_products_with_negative_price": 0,
    "source_inventory_with_negative_quantity": 0
  }
}
```