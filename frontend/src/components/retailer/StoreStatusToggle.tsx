import React, { useState } from 'react';
import { StoreProfile } from '../../types/user';
import { retailerService } from '../../services/retailerService';
import { Power, CheckCircle2, AlertCircle } from 'lucide-react';

interface StoreStatusToggleProps {
  store: StoreProfile;
  onUpdated: (updated: StoreProfile) => void;
}

export const StoreStatusToggle: React.FC<StoreStatusToggleProps> = ({ store, onUpdated }) => {
  const [isUpdating, setIsUpdating] = useState(false);

  const toggleOpenStatus = async () => {
    setIsUpdating(true);
    try {
      const updated = await retailerService.updateStore({
        is_open: !store.is_open,
      });
      onUpdated(updated);
    } catch (err) {
      console.error('Failed to toggle store status', err);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs">
      <div
        className={`w-3 h-3 rounded-full ${
          store.is_open ? 'bg-emerald-500 animate-pulse' : 'bg-rose-400'
        }`}
      />
      <div className="text-left pr-2">
        <span className="text-xs font-bold text-slate-800 block leading-tight">
          {store.store_name}
        </span>
        <span
          className={`text-[10px] font-semibold uppercase tracking-wider ${
            store.is_open ? 'text-emerald-600' : 'text-rose-500'
          }`}
        >
          {store.is_open ? 'Open for Orders' : 'Store Closed'}
        </span>
      </div>

      <button
        onClick={toggleOpenStatus}
        disabled={isUpdating}
        className={`ml-auto px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs ${
          store.is_open
            ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
            : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
        }`}
      >
        <Power className="w-3.5 h-3.5" />
        <span>{store.is_open ? 'Close Store' : 'Open Store'}</span>
      </button>
    </div>
  );
};
