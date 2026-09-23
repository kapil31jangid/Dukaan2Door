# Frontend 2 Architecture & Operational Guide

Frontend 2 of Dukaan2Door provides dedicated portals for **Local Retailers** and **Delivery Partners**, consuming the existing FastAPI and Neon PostgreSQL backend.

## 1. Stack & Architecture

- **Framework**: React 18 with TypeScript and Vite
- **Styling**: Tailwind CSS with custom palette for merchants and riders
- **Routing**: React Router v6 with Role-Based Route Protection (`ProtectedRoute`)
- **State Management**: React Context (`AuthProvider`) and localized hook state
- **Maps & Navigation**: Leaflet with OpenStreetMap tiles and OSRM Route Geometry visualization
- **Real-Time Communication**: Native WebSocket client (`/api/ws/deliveries/{id}`)

```text
frontend/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── types/                 # Auth, User, Product, Order, Delivery types
    ├── services/              # API, Auth, Retailer, Delivery, WebSocket clients
    ├── context/               # AuthContext (Role auth state & JWT persistence)
    ├── components/
    │   ├── ui/                # Badge, Button, Card, Modal, Alert, Spinner, Tabs
    │   ├── layout/            # Navbar, Sidebar, PageHeader, ProtectedRoute, AppLayout
    │   ├── maps/              # Leaflet DeliveryMap (Pickup, Dropoff, Live Rider, OSRM Polyline)
    │   ├── retailer/          # OrderCard, OrderDetailModal, ProductModal, StoreStatusToggle
    │   └── delivery/          # ActiveDeliveryCard, DeliveryStatusControls, PartnerLocationTracker
    └── pages/
        ├── auth/              # LoginPage with 1-click Demo Account selectors
        ├── retailer/          # Dashboard, Orders Management, Catalog/Inventory, Store Settings
        └── delivery/          # Console (Live Map & Controls), Delivery History
```

## 2. Portals & Features

### A. Retailer Portal (`/retailer`)
- **Dashboard Overview (`/retailer`)**:
  - Live KPI statistics: New Incoming Orders, Preparing Orders, Ready for Pickup, Delivered Trips, Total Revenue.
  - Store status toggle (Open / Closed for new order matching).
  - Quick action card list for incoming orders.
- **Order Lifecycle Management (`/retailer/orders`)**:
  - Status tabs: `RECEIVED` -> `ACCEPTED` -> `PREPARING` -> `READY_FOR_PICKUP` -> `OUT_FOR_DELIVERY` -> `DELIVERED`, plus `REJECTED` and `CANCELLED`.
  - Actions per state: Accept/Reject, Start Preparing, Mark Ready for Pickup, Assign Delivery Partner (`POST /api/deliveries/{order_id}/assign`).
  - Search by Order #, customer address, or product title.
  - Order details modal with line items, unit prices, subtotals, notes, and coordinates.
- **Catalog & Inventory (`/retailer/inventory`)**:
  - Full product list with stock counts and availability flags.
  - In-line stock updating (`PATCH /api/products/{id}/availability`).
  - Add product modal (`POST /api/products`) and edit product modal (`PUT /api/products/{id}`).
  - Deactivate / soft-delete (`DELETE /api/products/{id}`).
- **Store Settings (`/retailer/store`)**:
  - Physical store name, address, latitude, longitude, and operating hours.
  - Merchant contact name and phone number.

### B. Delivery Partner App (`/delivery`)
- **Live Delivery Console (`/delivery`)**:
  - Rider profile & Availability toggle (Online / Offline).
  - Active delivery assignment details: Pickup store address/coordinates, customer dropoff address/coordinates, package items, timestamps.
  - Interactive Leaflet map displaying pickup pin, customer dropoff pin, live rider position marker, and OSRM route polyline.
  - Step-by-step lifecycle controls: `ASSIGNED` -> `PICKED_UP` -> `OUT_FOR_DELIVERY` -> `DELIVERED`.
  - Live GPS location broadcaster via browser Geolocation API or manual coordinate updates (`POST /api/deliveries/{id}/location`).
  - Real-time WebSocket connection to `/api/ws/deliveries/{id}?token={JWT}` with event feed.
- **Delivery History (`/delivery/history`)**:
  - Lifetime assignment log, completed deliveries list, and estimated trip payouts.

## 3. Local Setup & Execution

### Start the Frontend:
```bash
cd frontend
npm install
npm run dev -- --port 3000
```

### Build for Production:
```bash
cd frontend
npm run build
```

### Automated Integration Verification:
```bash
python scripts/verify_frontend2_integration.py
```
