import React from 'react';
import { Product } from '../../types/product';
import { ProductCard } from './ProductCard';

interface ProductGridProps {
  products: Product[];
  className?: string;
}

export const ProductGrid: React.FC<ProductGridProps> = ({ products, className = '' }) => {
  return (
    <div className={`product-grid ${className}`}>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
};

export default ProductGrid;

export const ProductGridSkeleton: React.FC = () => (
  <div role="status" aria-label="Loading products" className="product-grid">
    {Array.from({ length: 6 }, (_, index) => <div key={index} aria-hidden="true" className="animate-pulse rounded-lg border border-slate-200 bg-white p-3">
      <div className="aspect-square rounded-lg bg-slate-100" />
      <div className="mt-4 h-4 w-3/4 rounded bg-slate-100" />
      <div className="mt-2 h-4 w-1/2 rounded bg-slate-100" />
      <div className="mt-5 h-10 rounded bg-slate-100" />
    </div>)}
  </div>
);
