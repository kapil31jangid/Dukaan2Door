import React, { useState, useEffect } from 'react';
import { retailerService } from '../../services/retailerService';
import { Order } from '../../types/order';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Spinner } from '../ui/Spinner';
import { Alert } from '../ui/Alert';
import {
  Truck,
  Zap,
  MapPin,
  Phone,
  CheckCircle2,
  Navigation,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';

interface PartnerCandidate {
  id: number;
  name: string;
  phone: string;
  vehicle_info: string;
  distance_km: number;
  is_available: boolean;
}

interface AssignDeliveryPartnerModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onAssigned: (orderId: number, partnerName?: string) => void;
}

export const AssignDeliveryPartnerModal: React.FC<AssignDeliveryPartnerModalProps> = ({
  order,
  isOpen,
  onClose,
  onAssigned,
}) => {
  const [partners, setPartners] = useState<PartnerCandidate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAssigning, setIsAssigning] = useState<number | 'auto' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !order) return;

    const fetchPartners = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const list = await retailerService.getAvailablePartners(order.id);
        setPartners(list);
      } catch (err: any) {
        // Fallback if endpoint not available or returns error
        setPartners([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPartners();
  }, [isOpen, order]);

  if (!order) return null;

  const handleDispatch = async (partnerId?: number, partnerName?: string) => {
    setIsAssigning(partnerId || 'auto');
    setError(null);
    try {
      const res = await retailerService.assignDelivery(order.id, partnerId);
      if (res.assigned) {
        onAssigned(order.id, partnerName || 'Assigned Rider');
        onClose();
      } else {
        setError(res.reason || 'Failed to dispatch delivery partner');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to assign delivery partner');
    } finally {
      setIsAssigning(null);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !isAssigning && onClose()}
      title="Dispatch & Assign Delivery Partner"
    >
      <div className="space-y-5">
        {/* Order Details Banner */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold text-purple-950">Order #{order.id}</span>
              <Badge variant="secondary" size="sm">
                Ready for Pickup
              </Badge>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-purple-800 font-medium mt-1">
              <MapPin className="w-3.5 h-3.5 text-purple-600 shrink-0" />
              <span className="truncate max-w-sm">{order.delivery_address}</span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[11px] uppercase tracking-wider text-purple-600 block font-bold">Order Value</span>
            <span className="text-base font-black text-purple-950">₹{order.total_amount.toFixed(2)}</span>
          </div>
        </div>

        {error && (
          <Alert variant="error" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* 1-Click Auto Dispatch Button */}
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-sm">
              <Zap className="w-5 h-5 fill-white" />
            </div>
            <div>
              <p className="text-sm font-black text-emerald-950">1-Click Instant Auto-Dispatch</p>
              <p className="text-xs text-emerald-800">
                Automatically assigns the closest active rider within 2km radius
              </p>
            </div>
          </div>
          <Button
            variant="primary"
            size="md"
            isLoading={isAssigning === 'auto'}
            onClick={() => handleDispatch()}
            className="w-full sm:w-auto font-bold bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20"
            leftIcon={<Zap className="w-4 h-4 fill-white" />}
          >
            Auto-Dispatch Nearest
          </Button>
        </div>

        {/* Available Riders List */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Nearby Active Riders ({partners.length})
            </h4>
            <span className="text-xs font-semibold text-slate-400">Sorted by proximity</span>
          </div>

          {isLoading ? (
            <div className="py-8 text-center">
              <Spinner size="md" label="Searching for nearby riders..." />
            </div>
          ) : partners.length === 0 ? (
            <div className="p-6 text-center bg-slate-50 rounded-2xl border border-slate-200/80">
              <Truck className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">No active riders found nearby</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                You can still use <b>Auto-Dispatch</b> to assign the fleet's standby rider, or ask your local delivery partner to switch online.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {partners.map((p) => (
                <div
                  key={p.id}
                  className="p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-purple-300 hover:shadow-xs transition-all flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-black text-sm">
                      🛵
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-black text-slate-900">{p.name}</p>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold">
                          {p.vehicle_info}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                        <span className="flex items-center gap-1 font-semibold text-emerald-700">
                          <Navigation className="w-3 h-3 text-emerald-600" />
                          {p.distance_km} km away
                        </span>
                        {p.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {p.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    isLoading={isAssigning === p.id}
                    onClick={() => handleDispatch(p.id, p.name)}
                    className="border-purple-200 text-purple-700 hover:bg-purple-50 font-bold"
                  >
                    Assign Rider
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={!!isAssigning}
          >
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
