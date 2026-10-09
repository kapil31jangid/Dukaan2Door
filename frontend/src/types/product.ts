export interface Product {
  id: number;
  store_id: number;
  name: string;
  brand?: string | null;
  description?: string | null;
  category?: string | null;
  price: number;
  image_url?: string | null;
  handling_type: 'NORMAL' | 'FROZEN' | 'FRAGILE' | 'PERISHABLE';
  requires_special_equipment: boolean;
  is_active: boolean;
  quantity: number;
  is_available: boolean;
  unit: string;
  expiry_date?: string | null;
  low_stock_threshold: number;
}

export interface PaginatedProductResponse {
  total: number;
  page: number;
  page_size: number;
  products: Product[];
}

export interface ProductCreate {
  name: string;
  brand?: string;
  description?: string;
  category?: string;
  price: number;
  image_url?: string;
  handling_type?: Product['handling_type'];
  requires_special_equipment?: boolean;
  initial_stock: number;
  is_available: boolean;
}

export interface ProductUpdate {
  name?: string;
  brand?: string;
  description?: string;
  category?: string;
  price?: number;
  image_url?: string;
  handling_type?: Product['handling_type'];
  requires_special_equipment?: boolean;
  is_active?: boolean;
}

export interface ProductAvailabilityPatch {
  is_available: boolean;
  quantity?: number;
}

export interface InventoryDraftItem {
  product_name: string;
  original_product_name?: string | null;
  brand?: string | null;
  quantity?: number | null;
  unit?: string | null;
  size?: string | null;
  price?: number | null;
  total_price?: number | null;
  category?: string | null;
  expiry_date?: string | null;
  handling_type?: Product['handling_type'] | null;
  requires_special_equipment?: boolean | null;
  confidence?: number | null;
  needs_review: boolean;
  review_reason?: string | null;
  warnings: string[];
  possible_existing_product_id?: number | null;
}

export interface InventoryConfirmItem {
  product_name: string;
  brand?: string;
  size?: string;
  quantity: number;
  unit: string;
  price: number;
  category?: string;
  expiry_date?: string;
  handling_type: Product['handling_type'];
  requires_special_equipment: boolean;
  existing_product_id?: number;
  low_stock_threshold: number;
}

export interface InventoryAnalysisResponse {
  items: InventoryDraftItem[];
  provider: string;
  raw_text_available: boolean;
  document_type?: string | null;
  warnings?: string[];
  ocr_lines: Array<{
    text: string;
    confidence?: number | null;
    bounding_box: number[][];
    page_index: number;
    order: number;
  }>;
}
