# Dataset Profile

Generated at: 2026-09-22T14:22:42.599172+00:00

## Zepto

### zepto_v1.xlsx
- Size: 197657 bytes
- Sheet `Sheet1` rows: 3732
- Sheet `Sheet1` columns: ['Category', 'name', 'mrp', 'discountPercent', 'availableQuantity', 'discountedSellingPrice', 'weightInGms', 'outOfStock', 'quantity']
- Sheet `Sheet1` null counts: {'Category': 0, 'name': 0, 'mrp': 0, 'discountPercent': 0, 'availableQuantity': 0, 'discountedSellingPrice': 0, 'weightInGms': 0, 'outOfStock': 0, 'quantity': 0}
- Sheet `Sheet1` duplicate rows: 2
- Detected fields: {'price_fields': ['mrp', 'discountedSellingPrice'], 'product_fields': ['name'], 'category_fields': ['Category'], 'inventory_fields': ['availableQuantity', 'quantity', 'outOfStock'], 'order_fields': [], 'customer_fields': [], 'store_fields': [], 'geographic_fields': []}

### zepto_v2.csv
- Size: 300179 bytes
- Rows: 3732
- Columns: ['Category', 'name', 'mrp', 'discountPercent', 'availableQuantity', 'discountedSellingPrice', 'weightInGms', 'outOfStock', 'quantity']
- Null counts: {'Category': 0, 'name': 0, 'mrp': 0, 'discountPercent': 0, 'availableQuantity': 0, 'discountedSellingPrice': 0, 'weightInGms': 0, 'outOfStock': 0, 'quantity': 0}
- Duplicate rows: 2
- Detected fields: {'price_fields': ['mrp', 'discountedSellingPrice'], 'product_fields': ['name'], 'category_fields': ['Category'], 'inventory_fields': ['availableQuantity', 'quantity', 'outOfStock'], 'order_fields': [], 'customer_fields': [], 'store_fields': [], 'geographic_fields': []}

## Blinkit

### BlinkIT Grocery Data Excel (1).xlsx
- Size: 612577 bytes
- Sheet `BlinkIT Grocery Data` rows: 8523
- Sheet `BlinkIT Grocery Data` columns: ['Item Fat Content', 'Item Identifier', 'Item Type', 'Outlet Establishment Year', 'Outlet Identifier', 'Outlet Location Type', 'Outlet Size', 'Outlet Type', 'Item Visibility', 'Item Weight', 'Sales', 'Rating']
- Sheet `BlinkIT Grocery Data` null counts: {'Item Fat Content': 0, 'Item Identifier': 0, 'Item Type': 0, 'Outlet Establishment Year': 0, 'Outlet Identifier': 0, 'Outlet Location Type': 0, 'Outlet Size': 0, 'Outlet Type': 0, 'Item Visibility': 0, 'Item Weight': 1463, 'Sales': 0, 'Rating': 0}
- Sheet `BlinkIT Grocery Data` duplicate rows: 0
- Detected fields: {'price_fields': ['Sales'], 'product_fields': ['Item Identifier'], 'category_fields': ['Item Type'], 'inventory_fields': [], 'order_fields': [], 'customer_fields': [], 'store_fields': ['Outlet Identifier', 'Outlet Location Type', 'Outlet Size', 'Outlet Type'], 'geographic_fields': []}

## Instacart

### aisles.csv
- Size: 2603 bytes
- Rows: 134
- Columns: ['aisle_id', 'aisle']
- Null counts: {'aisle_id': 0, 'aisle': 0}
- Duplicate rows: 0
- Detected fields: {'price_fields': [], 'product_fields': [], 'category_fields': ['aisle'], 'inventory_fields': [], 'order_fields': [], 'customer_fields': [], 'store_fields': [], 'geographic_fields': []}

### departments.csv
- Size: 270 bytes
- Rows: 21
- Columns: ['department_id', 'department']
- Null counts: {'department_id': 0, 'department': 0}
- Duplicate rows: 0
- Detected fields: {'price_fields': [], 'product_fields': [], 'category_fields': ['department'], 'inventory_fields': [], 'order_fields': [], 'customer_fields': [], 'store_fields': [], 'geographic_fields': []}

### order_products__prior.csv
- Size: 577550706 bytes
- Rows: 32434489
- Columns: ['order_id', 'product_id', 'add_to_cart_order', 'reordered']
- Null counts: skipped_for_large_file
- Duplicate rows: skipped_for_large_file
- Detected fields: {'price_fields': [], 'product_fields': [], 'category_fields': [], 'inventory_fields': [], 'order_fields': ['order_id'], 'customer_fields': [], 'store_fields': [], 'geographic_fields': []}

### order_products__train.csv
- Size: 24680147 bytes
- Rows: 1384617
- Columns: ['order_id', 'product_id', 'add_to_cart_order', 'reordered']
- Null counts: skipped_for_large_file
- Duplicate rows: skipped_for_large_file
- Detected fields: {'price_fields': [], 'product_fields': [], 'category_fields': [], 'inventory_fields': [], 'order_fields': ['order_id'], 'customer_fields': [], 'store_fields': [], 'geographic_fields': []}

### orders.csv
- Size: 108968645 bytes
- Rows: 3421083
- Columns: ['order_id', 'user_id', 'eval_set', 'order_number', 'order_dow', 'order_hour_of_day', 'days_since_prior_order']
- Null counts: skipped_for_large_file
- Duplicate rows: skipped_for_large_file
- Detected fields: {'price_fields': [], 'product_fields': [], 'category_fields': [], 'inventory_fields': [], 'order_fields': ['order_id', 'user_id', 'order_number', 'eval_set'], 'customer_fields': ['user_id'], 'store_fields': [], 'geographic_fields': []}

### products.csv
- Size: 2166953 bytes
- Rows: 49688
- Columns: ['product_id', 'product_name', 'aisle_id', 'department_id']
- Null counts: {'product_id': 0, 'product_name': 0, 'aisle_id': 0, 'department_id': 0}
- Duplicate rows: 0
- Detected fields: {'price_fields': [], 'product_fields': ['product_name'], 'category_fields': [], 'inventory_fields': [], 'order_fields': [], 'customer_fields': [], 'store_fields': [], 'geographic_fields': []}

## Bigbasket

### BigBasket.csv
- Size: 2709656 bytes
- Rows: 8208
- Columns: ['ProductName', 'Brand', 'Price', 'DiscountPrice', 'Image_Url', 'Quantity', 'Category', 'SubCategory', 'Absolute_Url']
- Null counts: {'ProductName': 0, 'Brand': 0, 'Price': 0, 'DiscountPrice': 0, 'Image_Url': 0, 'Quantity': 0, 'Category': 0, 'SubCategory': 0, 'Absolute_Url': 0}
- Duplicate rows: 0
- Detected fields: {'price_fields': ['Price', 'DiscountPrice'], 'product_fields': ['ProductName'], 'category_fields': ['Category', 'SubCategory'], 'inventory_fields': ['Quantity'], 'order_fields': [], 'customer_fields': [], 'store_fields': [], 'geographic_fields': []}
