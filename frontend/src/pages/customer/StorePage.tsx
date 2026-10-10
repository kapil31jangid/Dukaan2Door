import React from 'react';
import { ProductListingPage } from './ProductListingPage';

// The store and catalogue share the configured single-store data source.
export const StorePage: React.FC = () => <ProductListingPage />;
