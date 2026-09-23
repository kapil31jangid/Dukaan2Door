export interface Product {
  id: number;
  store_id: number;
  name: string;
  description?: string | null;
  category?: string | null;
  price: number;
  is_active: boolean;
  quantity: number;
  is_available: boolean;
}

export interface PaginatedProductResponse {
  total: number;
  page: number;
  page_size: number;
  products: Product[];
}

export interface ProductCreate {
  name: string;
  description?: string;
  category?: string;
  price: number;
  initial_stock: number;
  is_available: boolean;
}

export interface ProductUpdate {
  name?: string;
  description?: string;
  category?: string;
  price?: number;
  is_active?: boolean;
}

export interface ProductAvailabilityPatch {
  is_available: boolean;
  quantity?: number;
}
