import React, { useState } from 'react';
import { Delivery, DeliveryStatus } from '../../types/delivery';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Package, Truck, CheckCircle, ArrowRight } from 'lucide-react';

interface DeliveryStatusControlsProps {
  delivery: Delivery;
  onUpdateStatus: (status: DeliveryStatus) => Promise<void>;
}

export const DeliveryStatusControls: React.FC<DeliveryStatusControlsProps> = ({
  delivery,
  onUpdateStatus,
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleStatusChange = async (targetStatus: DeliveryStatus) => {
    setIsLoading(true);
    try {
      await onUpdateStatus(targetStatus);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Delivery Action</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {delivery.status === 'ASSIGNED' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-600">
              You are assigned to this order. Proceed to the merchant store to collect the items.
            </p>
            <Button
              variant="primary"
              size="lg"
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              isLoading={isLoading}
              onClick={() => handleStatusChange('PICKED_UP')}
              leftIcon={<Package className="w-5 h-5" />}
            >
              Confirm Order Picked Up
            </Button>
          </div>
        )}

        {delivery.status === 'PICKED_UP' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-600">
              Items collected from merchant. Start transit towards customer destination.
            </p>
            <Button
              variant="primary"
              size="lg"
              className="w-full bg-indigo-600 hover:bg-indigo-700"
              isLoading={isLoading}
              onClick={() => handleStatusChange('OUT_FOR_DELIVERY')}
              leftIcon={<Truck className="w-5 h-5" />}
            >
              Start Out for Delivery
            </Button>
          </div>
        )}

        {delivery.status === 'OUT_FOR_DELIVERY' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-600">
              You are delivering the package. Once handed over to the customer, confirm completion.
            </p>
            <Button
              variant="primary"
              size="lg"
              className="w-full bg-teal-600 hover:bg-teal-700"
              isLoading={isLoading}
              onClick={() => handleStatusChange('DELIVERED')}
              leftIcon={<CheckCircle className="w-5 h-5" />}
            >
              Mark Package Delivered
            </Button>
          </div>
        )}

        {delivery.status === 'DELIVERED' && (
          <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
            <CheckCircle className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
            <p className="text-sm font-bold text-emerald-800">Delivery Completed Successfully!</p>
            <p className="text-xs text-emerald-600 mt-0.5">
              Completed at {delivery.delivered_at ? new Date(delivery.delivered_at).toLocaleTimeString() : 'now'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
