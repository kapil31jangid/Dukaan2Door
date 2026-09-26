import React from 'react';
import { Check, XCircle, Ban } from 'lucide-react';
import { OrderStatus, OrderStatusHistoryItem, ORDER_STATUS_LABELS } from '../../types/order';

const TIMELINE_STEPS: OrderStatus[] = [
  'RECEIVED',
  'ACCEPTED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
];

interface OrderStatusTimelineProps {
  currentStatus: OrderStatus;
  history?: OrderStatusHistoryItem[];
}

export const OrderStatusTimeline: React.FC<OrderStatusTimelineProps> = ({
  currentStatus,
  history,
}) => {
  const isTerminal = currentStatus === 'REJECTED' || currentStatus === 'CANCELLED';
  const currentIdx = TIMELINE_STEPS.indexOf(currentStatus);

  return (
    <div>
      {isTerminal ? (
        <div className="flex items-start gap-3 p-4 bg-rose-50 rounded-2xl border border-rose-200">
          <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
            {currentStatus === 'REJECTED' ? (
              <XCircle className="w-5 h-5 text-rose-600" />
            ) : (
              <Ban className="w-5 h-5 text-rose-600" />
            )}
          </div>
          <div>
            <p className="text-sm font-bold text-rose-800">
              Order {ORDER_STATUS_LABELS[currentStatus]}
            </p>
            <p className="text-xs text-rose-600 mt-0.5">
              {currentStatus === 'REJECTED'
                ? 'Your order was rejected by the store. No payment was charged.'
                : 'Your order has been cancelled.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-0">
          {TIMELINE_STEPS.map((step, idx) => {
            const isCompleted = currentIdx > idx;
            const isCurrent = currentIdx === idx;
            const isPending = currentIdx < idx;

            return (
              <div key={step} className="flex items-start gap-4">
                {/* Icon column */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all z-10 ${
                      isCompleted
                        ? 'bg-emerald-600 border-emerald-600'
                        : isCurrent
                        ? 'bg-white border-emerald-600 ring-4 ring-emerald-100'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="w-4 h-4 text-white" />
                    ) : isCurrent ? (
                      <div className="w-3 h-3 rounded-full bg-emerald-600 animate-pulse" />
                    ) : (
                      <div className="w-2.5 h-2.5 rounded-full bg-slate-200" />
                    )}
                  </div>
                  {/* Vertical connector */}
                  {idx < TIMELINE_STEPS.length - 1 && (
                    <div
                      className={`w-0.5 h-8 ${
                        isCompleted ? 'bg-emerald-400' : 'bg-slate-200'
                      }`}
                    />
                  )}
                </div>

                {/* Label column */}
                <div className="pb-6 pt-1 flex-1 min-w-0">
                  <p
                    className={`text-sm font-semibold leading-none ${
                      isCompleted
                        ? 'text-emerald-700'
                        : isCurrent
                        ? 'text-slate-900'
                        : 'text-slate-400'
                    }`}
                  >
                    {ORDER_STATUS_LABELS[step]}
                  </p>
                  {isCurrent && (
                    <p className="text-xs text-slate-500 mt-1">In progress…</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
