import React, { useRef, useState } from 'react';
import { AlertCircle, Camera, CheckCircle2, FileImage, Languages, Loader2, Plus, ScanLine, Trash2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { InventoryConfirmItem, InventoryDraftItem, Product } from '../../types/product';
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

export const InventoryOnboardingModal: React.FC<Props> = ({ isOpen, onClose, products, onConfirmed }) => {
  const [mode, setMode] = useState<'choose' | 'image' | 'review' | 'manual'>('choose');
  const [items, setItems] = useState<InventoryDraftItem[]>([]);
  const [source, setSource] = useState<'IMAGE_ASSISTED' | 'MANUAL'>('MANUAL');
  const [nameLanguage, setNameLanguage] = useState<'en' | 'hi'>('en');
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const reset = () => {
    setMode('choose');
    setItems([]);
    setSource('MANUAL');
    setNameLanguage('en');
    setError(null);
    setIsWorking(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const change = (index: number, field: keyof InventoryDraftItem, value: unknown) => {
    setItems((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const updated = { ...item, [field]: value };
        updated.needs_review = !isCompleteItem(updated);
        return updated;
      })
    );
  };

  const remove = (index: number) => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));

  const analyze = async (file: File) => {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(jpe?g|png|webp|pdf)$/i)) {
      setError('Upload a JPG, PNG, WEBP, or PDF up to 5 MB.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('The file is larger than 5 MB. Please resize the image.');
      return;
    }
    setIsWorking(true);
    setError(null);
    try {
      const result = await retailerService.analyzeInventoryImage(file);
      if (!result.items.length) {
        setError("We couldn't reliably extract products from this image. You can try another photo or enter the products manually.");
        setItems([emptyItem()]);
        setSource('MANUAL');
        setMode('manual');
      } else {
        setItems(result.items);
        setNameLanguage('en');
        setSource('IMAGE_ASSISTED');
        setMode('review');
      }
    } catch (err: any) {
      setError(err.message || "We couldn't reliably extract products from this image. You can try another photo or enter the products manually.");
    } finally {
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
    const confirmed = toConfirmItems();
    if (
      !confirmed.length ||
      items.some((item) => !isCompleteItem(item))
    ) {
      setError('Every product needs a reviewed English name, whole quantity (≥ 1), unit, selling price, and category before confirmation.');
      return;
    }
    setIsWorking(true);
    setError(null);
    try {
      if (source === 'MANUAL') {
        await retailerService.addInventoryManually(confirmed);
      } else {
        await retailerService.confirmInventory(confirmed, source);
      }
      onConfirmed(confirmed.length);
      close();
    } catch (err: any) {
      setError(err.message || 'Inventory could not be saved. No stock was added.');
    } finally {
      setIsWorking(false);
    }
  };

  const title =
    mode === 'review'
      ? 'Review AI-Detected Inventory'
      : mode === 'manual'
      ? 'Add Inventory Manually'
      : 'Add Store Inventory';

  const hasHindiNames = items.some(
    (item) => item.original_product_name && /[\u0900-\u097f]/.test(item.original_product_name)
  );

  return (
    <Modal isOpen={isOpen} onClose={close} title={title} maxWidth="xl">
      <div className="space-y-5">
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <div className="flex-1">
                <p className="font-semibold">{error}</p>
                {mode === 'image' && (
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => fileInput.current?.click()}>
                      Try Another Image
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        setError(null);
                        setItems([emptyItem()]);
                        setSource('MANUAL');
                        setMode('manual');
                      }}
                    >
                      Enter Products Manually
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {mode === 'choose' && (
          <div className="grid gap-3 sm:grid-cols-2">
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
              onClick={() => {
                setItems([emptyItem()]);
                setSource('MANUAL');
                setMode('manual');
              }}
              className="rounded-xl border border-slate-200 bg-white p-5 text-left transition hover:border-slate-400"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white shadow-sm">
                <Plus className="h-5 w-5" />
              </span>
              <p className="mt-4 font-bold text-slate-900">Enter Manually</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Quickly type product and stock details yourself. Direct offline entry without image upload.
              </p>
            </button>
          </div>
        )}

        {mode === 'image' && (
          <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-10 text-center">
            <input
              ref={fileInput}
              className="hidden"
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void analyze(file);
                event.target.value = '';
              }}
            />
            <FileImage className="mx-auto h-12 w-12 text-emerald-600" />
            <p className="mt-3 text-base font-bold text-slate-900">Upload Bill or Handwritten Product List</p>
            <p className="mt-1 text-xs text-slate-500">Supports JPG, PNG, WEBP, or PDF up to 5 MB</p>
            <Button
              className="mt-5"
              onClick={() => fileInput.current?.click()}
              isLoading={isWorking}
              leftIcon={isWorking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            >
              Choose Image or Bill
            </Button>
            <button
              type="button"
              className="mt-3 block w-full text-xs font-semibold text-slate-600 hover:text-slate-900 hover:underline"
              onClick={() => {
                setItems([emptyItem()]);
                setSource('MANUAL');
                setMode('manual');
              }}
            >
              Enter products manually instead
            </button>
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

            <div className="max-h-[52vh] space-y-3 overflow-y-auto pr-1">
              {items.map((item, index) => {
                const isReady = isCompleteItem(item);
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
                          value={item.brand || ''}
                          onChange={(e) => change(index, 'brand', e.target.value)}
                          placeholder="Brand (e.g. Amul)"
                          className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500">Size / Pack</label>
                        <input
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
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <Button
                variant="outline"
                size="sm"
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
