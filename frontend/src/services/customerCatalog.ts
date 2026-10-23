import { Product } from '../types/product';

const SHOWCASE_PRODUCT_NAMES = new Set([
  'Basmati Rice 1kg', 'Toned Milk 1L', 'Wheat Bread', 'Sunflower Oil 1L', 'Salt 1kg', 'Bananas 1 Dozen',
  'Basmati Rice 5kg', 'Sona Masoori Rice 5kg', 'Whole Wheat Flour 5kg', 'Toor Dal 1kg', 'Moong Dal 1kg',
  'Chana Dal 1kg', 'Poha 1kg', 'Sugar 1kg', 'Besan 500g', 'Rava 1kg', 'Turmeric Powder 200g', 'Curd 400g',
  'Paneer 200g', 'Butter 100g', 'Cheese Slices 200g', 'Lassi 200ml', 'Multigrain Bread', 'Burger Buns Pack',
  'Rusk 300g', 'Apples 1kg', 'Leaf Tea 250g', 'Instant Coffee 100g', 'Green Tea 25 Bags', 'Fruit Juice 1L',
  'Marie Biscuits 250g', 'Digestive Biscuits 400g', 'Potato Chips 100g', 'Namkeen Mixture 250g',
  'Roasted Chana 200g', 'Dark Chocolate 50g', 'Detergent Powder 1kg', 'Dishwash Bar 200g', 'Floor Cleaner 1L',
  'Garbage Bags 30 Pack', 'Kitchen Towel Roll', 'Bath Soap Pack', 'Shampoo 180ml', 'Toothpaste 100g',
  'Hand Wash 250ml', 'Toothbrush Pack', 'Tissue Box', 'Sanitary Pads Pack', 'Face Wash 100g', 'Bathing Soap 125g',
]);

/** Exclude internal pooling fixtures from the presentation catalogue. */
export function isCustomerCatalogProduct(product: Product): boolean {
  return SHOWCASE_PRODUCT_NAMES.has(product.name);
}

export function customerCatalogProducts(products: Product[]): Product[] {
  return products.filter(isCustomerCatalogProduct);
}
