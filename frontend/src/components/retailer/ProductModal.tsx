import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Product, ProductCreate, ProductUpdate } from '../../types/product';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { retailerService } from '../../services/retailerService';
import { Upload, X, ImageIcon, Loader2, CheckCircle2 } from 'lucide-react';

interface ProductModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: ProductCreate | ProductUpdate, productId?: number) => Promise<void>;
}

const BACKEND_URL = import.meta.env.VITE_API_URL || '';

function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  // Already absolute (BigBasket CDN or external)
  if (url.startsWith('http')) return url;
  // Local upload — prefix with backend origin
  return `${BACKEND_URL}${url}`;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  product,
  isOpen,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState<number>(0);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // Upload state
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [stock, setStock] = useState<number>(10);
  const [isAvailable, setIsAvailable] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (product) {
      setName(product.name);
      setDescription(product.description || '');
      setCategory(product.category || '');
      setPrice(product.price);
      setImageUrl(product.image_url || null);
    } else {
      setName('');
      setDescription('');
      setCategory('');
      setPrice(0);
      setImageUrl(null);
      setStock(10);
      setIsAvailable(true);
    }
    setError(null);
    setUploadStatus('idle');
    setUploadError(null);
  }, [product, isOpen]);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select an image file (JPEG, PNG, WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File is too large. Maximum allowed size is 5 MB.');
      return;
    }
    setUploadStatus('uploading');
    setUploadError(null);
    try {
      const result = await retailerService.uploadProductImage(file);
      setImageUrl(result.url);
      setUploadStatus('done');
    } catch (err: any) {
      setUploadStatus('error');
      setUploadError(err.message || 'Upload failed. Please try again.');
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const clearImage = () => {
    setImageUrl(null);
    setUploadStatus('idle');
    setUploadError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Product title is required'); return; }
    if (price <= 0) { setError('Price must be greater than 0'); return; }

    setIsLoading(true);
    setError(null);
    try {
      if (product) {
        await onSave(
          { name: name.trim(), description: description.trim() || undefined, category: category.trim() || undefined, price: Number(price), image_url: imageUrl || undefined },
          product.id
        );
      } else {
        await onSave({
          name: name.trim(), description: description.trim() || undefined, category: category.trim() || undefined,
          price: Number(price), image_url: imageUrl || undefined,
          initial_stock: Number(stock), is_available: isAvailable,
        });
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save product');
    } finally {
      setIsLoading(false);
    }
  };

  const previewSrc = resolveImageUrl(imageUrl);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={product ? 'Edit Product' : 'Add New Product'} maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-xs bg-rose-50 text-rose-700 border border-rose-200 rounded-lg">{error}</div>
        )}

        {/* Product Name */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Product Name *</label>
          <input type="text" required value={name} onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Basmati Rice 1kg"
            className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
        </div>

        {/* Category & Price */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
            <input type="text" value={category} onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Dairy, Snacks"
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Price (₹) *</label>
            <input type="number" step="0.01" min="0.01" required value={price || ''} onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
              placeholder="0.00"
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
          </div>
        </div>

        {/* Product Image Upload */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Product Photo</label>

          {previewSrc ? (
            /* ── Image preview with remove button ── */
            <div className="relative w-full h-44 rounded-xl overflow-hidden border-2 border-emerald-200 bg-slate-50 group">
              <img src={previewSrc} alt="Product preview" className="w-full h-full object-contain" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
              <button
                type="button"
                onClick={clearImage}
                className="absolute top-2 right-2 bg-white/90 hover:bg-white text-slate-700 rounded-full p-1.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-4 h-4" />
              </button>
              {uploadStatus === 'done' && (
                <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-emerald-600 text-white text-[10px] font-semibold px-2 py-1 rounded-full">
                  <CheckCircle2 className="w-3 h-3" /> Uploaded
                </div>
              )}
            </div>
          ) : (
            /* ── Drag-and-drop upload zone ── */
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                relative w-full h-44 rounded-xl border-2 border-dashed cursor-pointer
                flex flex-col items-center justify-center gap-2 transition-all select-none
                ${isDragging
                  ? 'border-emerald-400 bg-emerald-50 scale-[1.01]'
                  : 'border-slate-200 bg-slate-50 hover:border-emerald-300 hover:bg-emerald-50/40'}
              `}
            >
              {uploadStatus === 'uploading' ? (
                <div className="flex flex-col items-center gap-2 text-emerald-600">
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <p className="text-xs font-medium">Uploading photo…</p>
                </div>
              ) : (
                <>
                  <div className={`p-3 rounded-full ${isDragging ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                    <Upload className={`w-6 h-6 ${isDragging ? 'text-emerald-600' : 'text-slate-400'}`} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-slate-600">
                      {isDragging ? 'Drop to upload' : 'Tap to upload photo'}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">or drag and drop here</p>
                    <p className="text-[10px] text-slate-300 mt-1">JPEG · PNG · WebP · max 5 MB</p>
                  </div>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleFileInput}
                className="hidden"
              />
            </div>
          )}

          {uploadError && (
            <p className="text-[11px] text-rose-500 mt-1.5 flex items-center gap-1">
              <X className="w-3 h-3 flex-shrink-0" /> {uploadError}
            </p>
          )}
        </div>

        {/* Stock & Availability (create only) */}
        {!product && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Initial Stock Count</label>
              <input type="number" min="0" value={stock} onChange={(e) => setStock(parseInt(e.target.value) || 0)}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
            </div>
            <div className="flex flex-col justify-center pt-5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isAvailable} onChange={(e) => setIsAvailable(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4" />
                <span className="text-xs font-semibold text-slate-700">Available in store</span>
              </label>
            </div>
          </div>
        )}

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief product description..."
            className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
        </div>

        <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" size="sm" isLoading={isLoading}>
            {product ? 'Update Product' : 'Create Product'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
