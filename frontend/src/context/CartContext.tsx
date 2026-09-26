import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Product } from '../types/product';

export interface CartItem {
  product_id: number;
  name: string;
  price: number;
  quantity: number;
  store_id: number;
  category?: string | null;
}

interface CartContextType {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
  addItem: (product: Product, qty?: number) => void;
  removeItem: (product_id: number) => void;
  updateQty: (product_id: number, qty: number) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_KEY = 'd2d_cart';

function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCart(items: CartItem[]): void {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(loadCart);

  useEffect(() => {
    saveCart(items);
  }, [items]);

  const addItem = useCallback((product: Product, qty = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product_id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product_id === product.id ? { ...i, quantity: i.quantity + qty } : i
        );
      }
      return [
        ...prev,
        {
          product_id: product.id,
          name: product.name,
          price: product.price,
          quantity: qty,
          store_id: product.store_id,
          category: product.category,
        },
      ];
    });
  }, []);

  const removeItem = useCallback((product_id: number) => {
    setItems((prev) => prev.filter((i) => i.product_id !== product_id));
  }, []);

  const updateQty = useCallback((product_id: number, qty: number) => {
    if (qty <= 0) {
      setItems((prev) => prev.filter((i) => i.product_id !== product_id));
    } else {
      setItems((prev) =>
        prev.map((i) => (i.product_id === product_id ? { ...i, quantity: qty } : i))
      );
    }
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, totalItems, totalPrice, addItem, removeItem, updateQty, clearCart }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = (): CartContextType => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
};
