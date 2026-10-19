import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Camera, CheckCircle2, FileImage, Languages, Loader2, Minus, PackageSearch, Plus, ScanLine, Trash2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { InventoryAdjustmentDirection, InventoryAdjustmentReason, InventoryConfirmItem, InventoryDraftItem, Product } from '../../types/product';
import { retailerService } from '../../services/retailerService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onConfirmed: (count: number) => void;
}

const categories = [
  'Groceries',
  'Dairy & Bakery',
  'Beverages',
  'Snacks & Packaged Foods',
  'Fruits & Vegetables',
  'Household Cleaning',
  'Personal Care',
  'Baby Care',
  'Pooja & Daily Essentials',
  'Frozen',
  'Other Kirana',
];

const adjustmentReasons: Array<{ value: InventoryAdjustmentReason; label: string }> = [
  { value: 'NEW_STOCK_RECEIVED', label: 'New stock received' },
  { value: 'OFFLINE_SALE', label: 'Offline sale' },
  { value: 'DAMAGED_PRODUCT', label: 'Damaged product' },
  { value: 'EXPIRED_PRODUCT', label: 'Expired product' },
  { value: 'MANUAL_CORRECTION', label: 'Manual correction' },
];

const emptyItem = (): InventoryDraftItem => ({
  product_name: '',
  quantity: 1,
  unit: 'unit',
  price: null,
  category: null,
  handling_type: 'NORMAL',
  requires_special_equipment: false,
  confidence: null,
  needs_review: true,
  warnings: [],
});

const isCompleteItem = (item: InventoryDraftItem): boolean =>
  Boolean(
    item.product_name.trim() &&
      /[A-Za-z]/.test(item.product_name) &&
      !/[\u0900-\u097f]/.test(item.product_name) &&
      Number.isInteger(Number(item.quantity)) &&
      Number(item.quantity) >= 1 &&
      item.unit?.trim() &&
      Number.isFinite(Number(item.price)) &&
      Number(item.price) > 0 &&
      item.category
  );

const createConfirmationId = () =>
  globalThis.crypto?.randomUUID?.() ?? `inventory-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const InventoryOnboardingModal: React.FC<Props> = ({ isOpen, onClose, products, onConfirmed }) => {
  const [mode, setMode] = useState<'choose' | 'image' | 'product-photo' | 'photo-review' | 'adjust' | 'review' | 'manual'>('choose');
  const [items, setItems] = useState<InventoryDraftItem[]>([]);
  const [source, setSource] = useState<'IMAGE_ASSISTED' | 'MANUAL'>('MANUAL');
  const [nameLanguage, setNameLanguage] = useState<'en' | 'hi'>('en');
  const [isWorking, setIsWorking] = useState(false);
  const working = useRef(false);
  const confirmationId = useRef(createConfirmationId());
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [adjustProductId, setAdjustProductId] = useState<number | null>(null);
  const [adjustDirection, setAdjustDirection] = useState<InventoryAdjustmentDirection>('ADD');
  const [adjustQuantity, setAdjustQuantity] = useState(1);
  const [adjustReason, setAdjustReason] = useState<InventoryAdjustmentReason>('NEW_STOCK_RECEIVED');
  useEffect(() => {
    if (!selectedFile || !selectedFile.type.startsWith('image/')) { setPreview(null); return; }
    const url = URL.createObjectURL(selectedFile);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  const reset = () => {
    setMode('choose');
    setItems([]);
    setSource('MANUAL');
    setNameLanguage('en');
    setError(null);
    setIsWorking(false);
    setSelectedFile(null);
    setAdjustProductId(null);
    setAdjustDirection('ADD');
    setAdjustQuantity(1);
    setAdjustReason('NEW_STOCK_RECEIVED');
    confirmationId.current = createConfirmationId();
  };

  const close = () => {
    if (isWorking) return;
    reset();
    onClose();
  };

  const change = (index: number, field: keyof InventoryDraftItem, value: unknown) => {
    setItems((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const updated = { ...item, [field]: value };
        if (source === 'MANUAL') updated.needs_review = !isCompleteItem(updated);
        return updated;
      })
    );
  };

  const remove = (index: number) => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));

  const analyze = async (file: File, kind: 'document' | 'product-photo') => {
    if (working.current) return;
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(jpe?g|png|webp|pdf)$/i)) {
      setError('Upload a JPG, PNG, WEBP, or PDF up to 5 MB.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('The file is larger than 5 MB. Please resize the image.');
      return;
    }
    working.current = true;
    setIsWorking(true);
    setError(null);
    try {
      const result = kind === 'product-photo'
        ? await retailerService.analyzeProductPhoto(file)
        : await retailerService.analyzeInventoryImage(file);
      if (!result.items.length) {
        setError("We couldn't reliably extract products from this image. You can try another photo or enter the products manually.");
        setItems([emptyItem()]);
        setSource('MANUAL');
        setMode('manual');
      } else {
        setItems(result.items.map((item) => ({
          ...item,
          adjustment_direction: 'ADD',
          adjustment_reason: 'NEW_STOCK_RECEIVED',
        })));
        setNameLanguage('en');
        setSource('IMAGE_ASSISTED');
        setMode(kind === 'product-photo' ? 'photo-review' : 'review');
      }
    } catch (err: any) {
      setError(err.message || "We couldn't reliably extract products from this image. You can try another photo or enter the products manually.");
    } finally {
      working.current = false;
      setIsWorking(false);
    }
  };

  const confirmAdjustment = async (
    productId: number,
    direction: InventoryAdjustmentDirection,
    quantity: number,
    reason: InventoryAdjustmentReason,
    sourceType: 'PRODUCT_PHOTO' | 'MANUAL_ADJUSTMENT',
    confirmationKey: string,
  ) => retailerService.adjustInventory({
    product_id: productId,
    direction,
    quantity,
    reason,
    source: sourceType,
    confirmation_id: confirmationKey,
  });

  const confirmPhotoAdjustments = async () => {
    if (working.current) return;
    const invalid = items.some((item) => {
      const product = products.find((value) => value.id === item.possible_existing_product_id);
      const quantity = Number(item.quantity);
      return !product || !Number.isInteger(quantity) || quantity < 1 ||
        (item.adjustment_direction === 'REDUCE' && quantity > product.quantity);
    });
    if (!items.length || invalid) {
      setError('Select an existing catalogue product and enter a valid quantity for every adjustment. Stock cannot go below zero.');
      return;
    }
    working.current = true;
    setIsWorking(true);
    setError(null);
    try {
      for (const [index, item] of items.entries()) {
        await confirmAdjustment(
          item.possible_existing_product_id!,
          item.adjustment_direction || 'ADD',
          Number(item.quantity),
          item.adjustment_reason || 'NEW_STOCK_RECEIVED',
          'PRODUCT_PHOTO',
          `${confirmationId.current}-${index}`,
        );
      }
      onConfirmed(items.length);
      reset();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Stock adjustments could not be confirmed. Refresh inventory before retrying.');
    } finally {
      working.current = false;
      setIsWorking(false);
    }
  };

  const confirmManualAdjustment = async () => {
    if (working.current) return;
    const product = products.find((value) => value.id === adjustProductId);
    if (!product || !Number.isInteger(adjustQuantity) || adjustQuantity < 1) {
      setError('Choose a catalogue product and enter a positive whole quantity.');
      return;
    }
    if (adjustDirection === 'REDUCE' && adjustQuantity > product.quantity) {
      setError(`Cannot reduce ${adjustQuantity}; current stock is ${product.quantity}.`);
      return;
    }
    working.current = true;
    setIsWorking(true);
    setError(null);
    try {
      await confirmAdjustment(
        product.id,
        adjustDirection,
        adjustQuantity,
        adjustReason,
        'MANUAL_ADJUSTMENT',
        confirmationId.current,
      );
      onConfirmed(1);
      reset();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Stock adjustment could not be saved.');
    } finally {
      working.current = false;
      setIsWorking(false);
    }
  };

  const toConfirmItems = (): InventoryConfirmItem[] =>
    items.map((item) => ({
      product_name: item.product_name.trim(),
      brand: item.brand?.trim() || undefined,
      size: item.size?.trim() || undefined,
      quantity: Number(item.quantity),
      unit: item.unit?.trim() || '',
      price: Number(item.price),
      category: item.category || undefined,
      expiry_date: item.expiry_date || undefined,
      handling_type: item.handling_type || 'NORMAL',
      requires_special_equipment: Boolean(item.requires_special_equipment),
      existing_product_id: item.possible_existing_product_id || undefined,
      low_stock_threshold: 5,
    }));

  const confirm = async () => {
    if (working.current) return;
    const confirmed = toConfirmItems();
    if (
      !confirmed.length ||
      items.some((item) => !isCompleteItem(item))
    ) {
      setError('Every product needs a reviewed English name, whole quantity (≥ 1), unit, selling price, and category before confirmation.');
      return;
    }
    working.current = true;
    setIsWorking(true);
    setError(null);
    try {
      if (source === 'MANUAL') {
        await retailerService.addInventoryManually(confirmed, confirmationId.current);
      } else {
        await retailerService.confirmInventory(confirmed, source, confirmationId.current);
      }
      onConfirmed(confirmed.length);
      reset();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Inventory could not be saved. No stock was added.');
    } finally {
      working.current = false;
      setIsWorking(false);
    }
  };

  const title =
    mode === 'photo-review'
      ? 'Review Product Photo Matches'
      : mode === 'adjust'
      ? 'Adjust Existing Stock'
      : mode === 'review'
      ? 'Review AI-Detected Inventory'
      : mode === 'manual'
      ? 'Add Inventory Manually'
      : 'Add Store Inventory';

  const hasHindiNames = items.some(
    (item) => item.original_product_name && /[\u0900-\u097f]/.test(item.original_product_name)
  );
  const selectedAdjustmentProduct = products.find((product) => product.id === adjustProductId);
  const expectedAdjustmentStock = selectedAdjustmentProduct
    ? selectedAdjustmentProduct.quantity + (adjustDirection === 'ADD' ? adjustQuantity : -adjustQuantity)
    : null;

  return (
    <Modal isOpen={isOpen} onClose={close} title={title} maxWidth="2xl">
      <div className="space-y-5">
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <div className="flex-1">
                <p className="font-semibold">{error}</p>
                {(mode === 'image' || mode === 'product-photo') && (
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => fileInput.current?.click()}>
                      Try Another Image
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        setError(null);
                        if (mode === 'product-photo') {
                          setMode('adjust');
                        } else {
                          setItems([emptyItem()]);
                          setSource('MANUAL');
                          setMode('manual');
                        }
                      }}
                    >
                      {mode === 'product-photo' ? 'Adjust Existing Stock' : 'Enter Products Manually'}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {mode === 'choose' && (
          <div className="grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => setMode('image')}
              className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-5 text-left transition hover:border-emerald-400 hover:bg-emerald-50"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
                <ScanLine className="h-5 w-5" />
              </span>
              <p className="mt-4 font-bold text-slate-900">Upload Bill / Handwritten List</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                AI extracts product candidates from printed bills or handwritten kirana registers. Mandatory review before saving.
              </p>
            </button>
            <button
              type="button"
              onClick={() => setMode('product-photo')}
              className="rounded-xl border border-blue-200 bg-blue-50/60 p-5 text-left transition hover:border-blue-400 hover:bg-blue-50"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
                <PackageSearch className="h-5 w-5" />
              </span>
              <p className="mt-4 font-bold text-slate-900">Scan Product Photo</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Identify visible packaging, choose the exact catalogue match, then review an add or reduce adjustment.
              </p>
            </button>
            <button
              type="button"
              onClick={() => setMode('adjust')}
              className="rounded-xl border border-amber-200 bg-amber-50/60 p-5 text-left transition hover:border-amber-400 hover:bg-amber-50"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-600 text-white shadow-sm">
                <Minus className="h-5 w-5" />
              </span>
              <p className="mt-4 font-bold text-slate-900">Add / Reduce Stock</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Record received stock, offline sales, damaged items, expiry, or a manual correction.
              </p>
            </button>
            <button
              type="button"
              onClick={() => {
                setItems([emptyItem()]);
                setSource('MANUAL');
                setMode('manual');
              }}
              className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-slate-400 sm:col-span-3"
            >
              <span className="flex items-center gap-3"><Plus className="h-4 w-4 text-slate-600" /><span><span className="block text-sm font-bold text-slate-900">Enter a new product manually</span><span className="block text-xs text-slate-500">Use the existing authorized product creation fallback without an image.</span></span></span>
            </button>
          </div>
        )}

        {(mode === 'image' || mode === 'product-photo') && (
          <div onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (!isWorking && event.dataTransfer.files[0]) setSelectedFile(event.dataTransfer.files[0]); }} className="rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-5 sm:p-8 text-center">
            <input
              ref={fileInput}
              className="hidden"
              type="file"
              accept={mode === 'image' ? 'image/jpeg,image/jpg,image/png,image/webp,application/pdf' : 'image/jpeg,image/jpg,image/png,image/webp'}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) setSelectedFile(file);
                event.target.value = '';
              }}
            />
            <FileImage className="mx-auto h-12 w-12 text-emerald-600" />
            <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) setSelectedFile(file); event.target.value = ''; }} />
            {preview && <img src={preview} alt={mode === 'product-photo' ? 'Selected product photo' : 'Selected inventory document'} className="mx-auto mt-4 max-h-48 max-w-full rounded-lg object-contain" />}
            {selectedFile && <p className="mt-3 break-all text-sm font-semibold">{selectedFile.name}</p>}
            <p className="mt-3 text-base font-bold text-slate-900">{mode === 'product-photo' ? 'Capture Product Packaging' : 'Upload Bill or Handwritten Product List'}</p>
            <p className="mt-1 text-xs text-slate-500">{mode === 'product-photo' ? 'One or multiple visible products · JPG, PNG, or WEBP up to 5 MB' : 'Supports JPG, PNG, WEBP, or PDF up to 5 MB'}</p>
            <Button
              className="mt-5"
              onClick={() => fileInput.current?.click()}
              disabled={isWorking}
              isLoading={isWorking}
              leftIcon={isWorking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            >
              {mode === 'product-photo' ? 'Choose Product Photo' : 'Choose Image or Bill'}
            </Button>
            <Button variant="outline" className="ml-2 mt-5" disabled={isWorking} onClick={() => cameraInput.current?.click()} leftIcon={<Camera className="h-4 w-4" />}>Take photo</Button>
            {selectedFile && <Button className="ml-2 mt-5" isLoading={isWorking} onClick={() => void analyze(selectedFile, mode === 'product-photo' ? 'product-photo' : 'document')}>Analyze with AI</Button>}
            <button
              type="button"
              disabled={isWorking}
              className="mt-3 block w-full text-xs font-semibold text-slate-600 hover:text-slate-900 hover:underline"
              onClick={() => {
                if (mode === 'product-photo') {
                  setMode('adjust');
                } else {
                  setItems([emptyItem()]);
                  setSource('MANUAL');
                  setMode('manual');
                }
              }}
            >
              {mode === 'product-photo' ? 'Adjust an existing product without a photo' : 'Enter products manually instead'}
            </button>
          </div>
        )}

        {mode === 'adjust' && (
          <div className="space-y-5">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-900">Choose an existing catalogue product</p>
              <p className="mt-1 text-xs text-slate-600">This workflow never creates products and writes stock only after confirmation.</p>
            </div>
            <label className="block text-xs font-bold text-slate-600">
              Catalogue product
              <select
                aria-label="Catalogue product"
                value={adjustProductId || ''}
                onChange={(event) => setAdjustProductId(event.target.value ? Number(event.target.value) : null)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"
              >
                <option value="">Select product</option>
                {products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.quantity} {product.unit}</option>)}
              </select>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-bold text-slate-600">Adjustment direction</p>
                <div className="mt-1.5 grid grid-cols-2 rounded-lg border border-slate-200 bg-slate-50 p-1" role="group" aria-label="Adjustment direction">
                  {(['ADD', 'REDUCE'] as InventoryAdjustmentDirection[]).map((direction) => (
                    <button key={direction} type="button" aria-pressed={adjustDirection === direction} onClick={() => setAdjustDirection(direction)} className={`min-h-10 rounded-md px-3 text-sm font-bold ${adjustDirection === direction ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>{direction === 'ADD' ? 'Add stock' : 'Reduce stock'}</button>
                  ))}
                </div>
              </div>
              <label className="text-xs font-bold text-slate-600">
                Quantity
                <input type="number" min="1" step="1" aria-label="Adjustment quantity" value={adjustQuantity} onChange={(event) => setAdjustQuantity(Number(event.target.value))} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" />
              </label>
            </div>
            <label className="block text-xs font-bold text-slate-600">
              Reason
              <select aria-label="Adjustment reason" value={adjustReason} onChange={(event) => setAdjustReason(event.target.value as InventoryAdjustmentReason)} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm">
                {adjustmentReasons.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}
              </select>
            </label>
            {selectedAdjustmentProduct && (
              <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2 rounded-lg border border-slate-200 bg-white p-4 text-center">
                <div><p className="text-[10px] font-bold uppercase text-slate-400">Current</p><p className="mt-1 text-lg font-extrabold">{selectedAdjustmentProduct.quantity}</p></div>
                <span className="text-lg font-bold text-slate-400">{adjustDirection === 'ADD' ? '+' : '-'}</span>
                <div><p className="text-[10px] font-bold uppercase text-slate-400">Quantity</p><p className="mt-1 text-lg font-extrabold">{Number.isFinite(adjustQuantity) ? adjustQuantity : 0}</p></div>
                <span className="text-lg font-bold text-slate-400">=</span>
                <div><p className="text-[10px] font-bold uppercase text-slate-400">Expected</p><p className={`mt-1 text-lg font-extrabold ${(expectedAdjustmentStock ?? 0) < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>{expectedAdjustmentStock}</p></div>
              </div>
            )}
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <Button variant="outline" size="sm" onClick={close}>Cancel</Button>
              <Button size="sm" onClick={() => void confirmManualAdjustment()} isLoading={isWorking} disabled={!selectedAdjustmentProduct || adjustQuantity < 1 || (expectedAdjustmentStock ?? -1) < 0}>Confirm Adjustment</Button>
            </div>
          </div>
        )}

        {mode === 'photo-review' && (
          <div className="space-y-4">
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-xs text-blue-900">
              <p className="font-bold">AI identified visible packaging only.</p>
              <p className="mt-1">Select the exact catalogue product and verify quantity. A photo never changes stock by itself.</p>
            </div>
            <fieldset disabled={isWorking} className="space-y-3">
              {items.map((item, index) => {
                const matchedProduct = products.find((product) => product.id === item.possible_existing_product_id);
                const direction = item.adjustment_direction || 'ADD';
                const quantity = Number(item.quantity) || 0;
                const expected = matchedProduct ? matchedProduct.quantity + (direction === 'ADD' ? quantity : -quantity) : null;
                const suggestedIds = new Set((item.catalog_matches || []).map((match) => match.product_id));
                return (
                  <div key={`${item.product_name}-${index}`} className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div><p className="text-xs font-bold text-blue-700">VISIBLE PRODUCT CANDIDATE</p><p className="mt-1 font-extrabold text-slate-900">{item.product_name} {item.size || ''}</p><p className="mt-1 text-xs text-slate-500">{item.brand || 'Brand not confirmed'}{item.printed_mrp ? ` · Printed MRP ₹${item.printed_mrp}` : ''}</p></div>
                      <button type="button" aria-label="Remove product candidate" onClick={() => remove(index)} className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
                    </div>
                    <label className="mt-4 block text-xs font-bold text-slate-600">
                      Catalogue match *
                      <select value={item.possible_existing_product_id || ''} onChange={(event) => change(index, 'possible_existing_product_id', event.target.value ? Number(event.target.value) : null)} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm">
                        <option value="">Select the exact product and pack size</option>
                        {products.map((product) => <option key={product.id} value={product.id}>{suggestedIds.has(product.id) ? 'Suggested · ' : ''}{product.name} · {product.quantity} {product.unit}</option>)}
                      </select>
                    </label>
                    {!item.catalog_matches?.length && <p className="mt-2 text-xs font-semibold text-amber-700">No reliable catalogue match found. Close this dialog and use Add product manually before adjusting stock.</p>}
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div>
                        <p className="text-xs font-bold text-slate-600">Direction</p>
                        <div className="mt-1.5 grid grid-cols-2 rounded-lg border border-slate-200 bg-slate-50 p-1">
                          {(['ADD', 'REDUCE'] as InventoryAdjustmentDirection[]).map((value) => <button key={value} type="button" aria-pressed={direction === value} onClick={() => change(index, 'adjustment_direction', value)} className={`min-h-9 rounded-md text-xs font-bold ${direction === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>{value === 'ADD' ? 'Add' : 'Reduce'}</button>)}
                        </div>
                      </div>
                      <label className="text-xs font-bold text-slate-600">Quantity *<input type="number" min="1" step="1" value={item.quantity ?? ''} onChange={(event) => change(index, 'quantity', event.target.value ? Number(event.target.value) : null)} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" /></label>
                      <label className="text-xs font-bold text-slate-600">Reason<select value={item.adjustment_reason || 'NEW_STOCK_RECEIVED'} onChange={(event) => change(index, 'adjustment_reason', event.target.value as InventoryAdjustmentReason)} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm">{adjustmentReasons.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}</select></label>
                    </div>
                    {matchedProduct && <p className={`mt-3 rounded-lg px-3 py-2 text-xs font-bold ${(expected ?? -1) < 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-800'}`}>Current {matchedProduct.quantity} {matchedProduct.unit} {direction === 'ADD' ? '+' : '-'} {quantity} = expected {expected} {matchedProduct.unit}</p>}
                    {item.warnings.map((warning) => <p key={warning} className="mt-2 text-[11px] text-amber-700">{warning}</p>)}
                  </div>
                );
              })}
            </fieldset>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <Button variant="outline" size="sm" onClick={close}>Cancel</Button>
              <Button size="sm" onClick={() => void confirmPhotoAdjustments()} isLoading={isWorking} disabled={!items.length}>Confirm Stock Adjustments</Button>
            </div>
          </div>
        )}

        {(mode === 'review' || mode === 'manual') && (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <p className="text-xs font-semibold text-slate-600">
                  Review and edit every field. Stock is <strong>only updated</strong> when you confirm below.
                </p>
                {hasHindiNames && (
                  <p className="mt-1 text-[11px] text-slate-500">
                    The reviewed English name is saved to the catalogue. Hindi remains available here for comparison.
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {hasHindiNames && (
                  <div
                    className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5"
                    role="group"
                    aria-label="Product name language"
                  >
                    <span className="flex h-7 w-7 items-center justify-center text-slate-500" title="Product name language">
                      <Languages className="h-3.5 w-3.5" />
                    </span>
                    <button
                      type="button"
                      aria-pressed={nameLanguage === 'en'}
                      onClick={() => setNameLanguage('en')}
                      className={`h-7 min-w-16 rounded-md px-2 text-[11px] font-bold transition ${
                        nameLanguage === 'en' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      English
                    </button>
                    <button
                      type="button"
                      aria-pressed={nameLanguage === 'hi'}
                      onClick={() => setNameLanguage('hi')}
                      className={`h-7 min-w-14 rounded-md px-2 text-[11px] font-bold transition ${
                        nameLanguage === 'hi' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      हिंदी
                    </button>
                  </div>
                )}
                {source === 'IMAGE_ASSISTED' && (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                    AI-Assisted Inventory Extraction
                  </span>
                )}
              </div>
            </div>

            <fieldset disabled={isWorking} className="space-y-3">
              {items.map((item, index) => {
                const isReady = isCompleteItem(item) && !item.needs_review;
                return (
                  <div key={index} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {isReady ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                            <CheckCircle2 className="h-3 w-3" /> Ready
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                            <AlertCircle className="h-3 w-3" /> ⚠ Verify
                          </span>
                        )}
                        <span className="text-xs font-bold text-slate-900">
                          {(nameLanguage === 'hi' ? item.original_product_name : item.product_name) || item.product_name || 'Item'}{' '}
                          {item.size || ''}
                        </span>
                      </div>
                      <button
                        type="button"
                        aria-label="Remove product"
                        onClick={() => remove(index)}
                        className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500">
                          {nameLanguage === 'hi' ? 'उत्पाद का नाम' : 'English Product Name'} *
                        </label>
                        <input
                          aria-label="Product name"
                          value={nameLanguage === 'hi' ? item.original_product_name || item.product_name : item.product_name}
                          onChange={(e) =>
                            change(index, nameLanguage === 'hi' ? 'original_product_name' : 'product_name', e.target.value)
                          }
                          placeholder={nameLanguage === 'hi' ? 'उत्पाद का नाम' : 'English product name *'}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500">Brand</label>
                        <input
                          aria-label="Brand"
                          value={item.brand || ''}
                          onChange={(e) => change(index, 'brand', e.target.value)}
                          placeholder="Brand (e.g. Amul)"
                          className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500">Size / Pack</label>
                        <input
                          aria-label="Size or pack"
                          value={item.size || ''}
                          onChange={(e) => change(index, 'size', e.target.value)}
                          placeholder="Size (e.g. 500ml)"
                          className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500">Quantity *</label>
                        <input
                          type="number"
                          min="1"
                          aria-label="Quantity"
                          value={item.quantity ?? ''}
                          onChange={(e) => change(index, 'quantity', e.target.value ? Number(e.target.value) : null)}
                          placeholder="Qty *"
                          className={`mt-1 w-full rounded-lg border px-2.5 py-1.5 text-xs outline-none ${
                            !item.quantity ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200 focus:border-emerald-500'
                          }`}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500">Unit *</label>
                        <input
                          aria-label="Unit"
                          value={item.unit || ''}
                          onChange={(e) => change(index, 'unit', e.target.value)}
                          placeholder="Unit (e.g. pcs, kg)"
                          className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500">Selling Price (₹) *</label>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          aria-label="Selling price"
                          value={item.price ?? ''}
                          onChange={(e) => change(index, 'price', e.target.value ? Number(e.target.value) : null)}
                          placeholder="Price *"
                          className={`mt-1 w-full rounded-lg border px-2.5 py-1.5 text-xs outline-none ${
                            !item.price ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200 focus:border-emerald-500'
                          }`}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500">Category *</label>
                        <select
                          aria-label="Category"
                          value={item.category || ''}
                          onChange={(e) => change(index, 'category', e.target.value || null)}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-emerald-500"
                        >
                          <option value="">Choose category</option>
                          {categories.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500">Special Handling</label>
                        <select
                          aria-label="Special handling"
                          value={item.handling_type || 'NORMAL'}
                          onChange={(e) => {
                            const handling = e.target.value as Product['handling_type'];
                            change(index, 'handling_type', handling);
                            change(index, 'requires_special_equipment', handling === 'FROZEN');
                          }}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-emerald-500"
                        >
                          <option value="NORMAL">Normal</option>
                          <option value="FROZEN">Frozen (Ice Cream)</option>
                          <option value="FRAGILE">Fragile (Glass / Eggs)</option>
                          <option value="PERISHABLE">Perishable (Milk / Curd)</option>
                        </select>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="text-xs font-semibold text-slate-600">Expiry date
                        <input type="date" value={item.expiry_date || ''} onChange={event => change(index, 'expiry_date', event.target.value || null)} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2" />
                      </label>
                      <label className="text-xs font-semibold text-slate-600">Catalogue match
                        <select value={item.possible_existing_product_id || ''} onChange={event => change(index, 'possible_existing_product_id', event.target.value ? Number(event.target.value) : null)} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2">
                          <option value="">Match reviewed details automatically</option>
                          {products.map(product => <option key={product.id} value={product.id}>{product.name} ({product.unit})</option>)}
                        </select>
                      </label>
                    </div>

                    {item.review_reason && (
                      <p className="mt-2 text-[11px] font-semibold text-amber-700">
                        Notice: {item.review_reason}
                      </p>
                    )}
                    {item.warnings &&
                      item.warnings
                        .filter((w) => w !== item.review_reason)
                        .map((warning) => (
                          <p key={warning} className="mt-1 text-[11px] text-amber-600">
                            {warning}
                          </p>
                        ))}
                    {item.possible_existing_product_id && (
                      <p className="mt-2 text-[11px] font-semibold text-blue-700">
                        Matching catalogue product:{' '}
                        {products.find((p) => p.id === item.possible_existing_product_id)?.name || 'existing item'}; stock will be added.
                      </p>
                    )}
                  </div>
                );
              })}
            </fieldset>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={isWorking}
                onClick={() => setItems((current) => [...current, emptyItem()])}
                leftIcon={<Plus className="h-4 w-4" />}
              >
                Add Missing Product
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={close}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => void confirm()}
                  isLoading={isWorking}
                  disabled={!items.length || items.some((item) => !isCompleteItem(item))}
                  title={items.some((item) => !isCompleteItem(item)) ? 'Complete every required field before confirming' : undefined}
                >
                  Confirm & Add Inventory
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
