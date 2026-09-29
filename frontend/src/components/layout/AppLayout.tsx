import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { useAuth } from '../../context/AuthContext';
import { DeliveryPartnerLayout } from '../delivery/DeliveryPartnerLayout';
import { RetailerLayout } from '../retailer/RetailerLayout';

export const AppLayout: React.FC = () => {
  const { role } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  if (role === 'delivery_partner') return <DeliveryPartnerLayout />;
  if (role === 'retailer') return <RetailerLayout />;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
      />
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-full overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
