# Instacart Deterministic Subset

Original source files are preserved in `data/raw/instacart/`.

The full Instacart source contains millions of orders/order-items and should not be blindly loaded into Neon.

Subset rule for ingestion scripts:
- Read `orders.csv` in original file order.
- Select the first 10000 real source order rows.
- Preserve each selected original `order_id` and `user_id`.
- Include only `order_products__prior.csv` and `order_products__train.csv` rows whose original `order_id` is in the selected set.
- Preserve each original `product_id`, `add_to_cart_order`, and `reordered`.
- Load all real rows from `products.csv`, `aisles.csv`, and `departments.csv` into source product records.

No synthetic orders, users, products, coordinates, prices, or stores are generated.
