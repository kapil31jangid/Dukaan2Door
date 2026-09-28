"""
Fast bulk seed script for Ahmedabad test stores.
"""
from app.db.session import SessionLocal
from app.models.user import User, UserRole
from app.models.retailer import Retailer
from app.models.store import Store
from app.models.product import Product
from app.models.inventory import Inventory
from app.core.security import get_password_hash

AHMEDABAD_STORES = [
    {
        "email": "khadia.retailer@example.com",
        "name": "Khadia Central Kirana & Daily Needs",
        "phone": "+91 98250 11001",
        "store_name": "Khadia Central Kirana",
        "address": "Astodia Gate, Khadia, Old City, Ahmedabad 380001",
        "lat": 23.0258,
        "lng": 72.5873,
        "operating_hours": "07:00 AM - 11:00 PM",
    },
    {
        "email": "navrangpura.retailer@example.com",
        "name": "Navrangpura Super Mart",
        "phone": "+91 98250 11002",
        "store_name": "Navrangpura Super Bazaar",
        "address": "Near Mithakhali Six Roads, Navrangpura, Ahmedabad 380009",
        "lat": 23.0365,
        "lng": 72.5611,
        "operating_hours": "08:00 AM - 10:30 PM",
    },
    {
        "email": "vastrapur.retailer@example.com",
        "name": "Vastrapur Daily Needs",
        "phone": "+91 98250 11003",
        "store_name": "Vastrapur Kirana Store",
        "address": "Near Vastrapur Lake, Vastrapur, Ahmedabad 380015",
        "lat": 23.0350,
        "lng": 72.5293,
        "operating_hours": "07:30 AM - 11:00 PM",
    },
    {
        "email": "satellite.retailer@example.com",
        "name": "Satellite Express Kirana",
        "phone": "+91 98250 11004",
        "store_name": "Satellite Express Store",
        "address": "Satellite Road, Ramdev Nagar, Ahmedabad 380015",
        "lat": 23.0276,
        "lng": 72.5076,
        "operating_hours": "08:00 AM - 10:00 PM",
    },
    {
        "email": "satellite.retailer.rahul@example.com",
        "name": "Rahul Satellite Retailer",
        "phone": "+91 98250 11006",
        "store_name": "Rahul Satellite Kirana",
        "address": "Satellite Road, Ramdev Nagar, Ahmedabad 380015",
        "lat": 23.0276,
        "lng": 72.5076,
        "operating_hours": "08:00 AM - 10:00 PM",
    },
    {
        "email": "satellite.retailer.neha@example.com",
        "name": "Neha Satellite Retailer",
        "phone": "+91 98250 11007",
        "store_name": "Neha Satellite Daily Needs",
        "address": "Jodhpur Cross Road, Satellite, Ahmedabad 380015",
        "lat": 23.0285,
        "lng": 72.5090,
        "operating_hours": "08:00 AM - 10:00 PM",
    },
    {
        "email": "bodakdev.retailer@example.com",
        "name": "Bodakdev General Store",
        "phone": "+91 98250 11005",
        "store_name": "Bodakdev & SG Mart",
        "address": "Judges Bungalow Road, Bodakdev, Ahmedabad 380054",
        "lat": 23.0450,
        "lng": 72.5180,
        "operating_hours": "08:00 AM - 11:00 PM",
    },
]

def run_seed():
    db = SessionLocal()
    try:
        print("1. Updating all existing stores to be open with valid coords...")
        db.query(Store).filter(Store.id == 10).update({
            Store.is_open: True,
            Store.lat: 23.0258,
            Store.lng: 72.5873,
            Store.store_name: "Demo Central Kirana Mart",
            Store.address: "Khadia, Astodia & Central Ahmedabad 380001"
        })
        db.query(Store).filter(Store.id == 1).update({
            Store.is_open: True,
            Store.lat: 23.0365,
            Store.lng: 72.5611,
            Store.store_name: "Amit General Store (Navrangpura)",
            Store.address: "Navrangpura, Ahmedabad 380009"
        })
        db.query(Store).filter(Store.id == 4).update({
            Store.is_open: True,
            Store.lat: 23.0350,
            Store.lng: 72.5293,
            Store.store_name: "Demo Central Mart (Vastrapur)",
            Store.address: "Near Vastrapur Lake, Ahmedabad 380015"
        })
        db.query(Store).filter(Store.id == 5).update({
            Store.is_open: True,
            Store.lat: 23.0276,
            Store.lng: 72.5076,
            Store.store_name: "Demo West Grocery (Satellite)",
            Store.address: "Satellite Road, Ahmedabad 380015"
        })
        db.commit()

        print("2. Ensuring all products in Store #10, #1, #4, #5 are active with inventory...")
        db.query(Product).update({Product.is_active: True})
        db.query(Inventory).update({Inventory.is_available: True, Inventory.quantity: 100})
        db.commit()

        print("3. Upserting neighborhood stores...")
        for data in AHMEDABAD_STORES:
            user = db.query(User).filter(User.email == data["email"]).first()
            if not user:
                user = User(
                    email=data["email"],
                    hashed_password=get_password_hash("DemoPassword123!"),
                    role=UserRole.RETAILER,
                    is_active=True,
                )
                db.add(user)
                db.flush()
            else:
                user.hashed_password = get_password_hash("DemoPassword123!")
                user.role = UserRole.RETAILER
                user.is_active = True

            retailer = db.query(Retailer).filter(Retailer.user_id == user.id).first()
            if not retailer:
                retailer = Retailer(
                    user_id=user.id,
                    name=data["name"],
                    phone=data["phone"],
                )
                db.add(retailer)
                db.flush()

            store = db.query(Store).filter(Store.retailer_id == retailer.id).first()
            if not store:
                store = Store(
                    retailer_id=retailer.id,
                    store_name=data["store_name"],
                    address=data["address"],
                    lat=data["lat"],
                    lng=data["lng"],
                    operating_hours=data["operating_hours"],
                    is_open=True,
                )
                db.add(store)
                db.flush()
            else:
                store.store_name = data["store_name"]
                store.address = data["address"]
                store.lat = data["lat"]
                store.lng = data["lng"]
                store.operating_hours = data["operating_hours"]
                store.is_open = True
                db.flush()

        db.commit()

        print("4. Guaranteeing all open stores stock active catalog products...")
        from sqlalchemy import text
        db.execute(text("""
            INSERT INTO inventory (store_id, product_id, quantity, is_available, created_at, updated_at)
            SELECT s.id, p.id, 100, true, NOW(), NOW()
            FROM stores s
            JOIN products p ON p.store_id = s.id
            WHERE s.is_open = true AND p.is_active = true
            ON CONFLICT (store_id, product_id)
            DO UPDATE SET quantity = GREATEST(inventory.quantity, 100), is_available = true;
        """))
        db.commit()

        print("5. Upserting available delivery partners in Ahmedabad...")
        from app.models.delivery_partner import DeliveryPartner
        RIDERS = [
            {"email": "demo.rider1@example.com", "name": "Rider Amit (Khadia)", "phone": "+91 98250 20001", "vehicle": "Honda Activa (GJ-01-AB-1001)", "lat": 23.0258, "lng": 72.5873},
            {"email": "demo.rider2@example.com", "name": "Rider Rahul (Navrangpura)", "phone": "+91 98250 20002", "vehicle": "Hero Splendor (GJ-01-CD-1002)", "lat": 23.0365, "lng": 72.5611},
            {"email": "demo.rider3@example.com", "name": "Rider Suresh (Vastrapur)", "phone": "+91 98250 20003", "vehicle": "TVS Jupiter (GJ-01-EF-1003)", "lat": 23.0350, "lng": 72.5293},
            {"email": "demo.rider4@example.com", "name": "Rider Jayesh (Satellite)", "phone": "+91 98250 20004", "vehicle": "Bajaj Pulsar (GJ-01-GH-1004)", "lat": 23.0276, "lng": 72.5076},
            {"email": "demo.rider5@example.com", "name": "Rider Vikram (Bodakdev)", "phone": "+91 98250 20005", "vehicle": "Ather 450X (GJ-01-JK-1005)", "lat": 23.0450, "lng": 72.5180},
            {"email": "satellite.rider.rahul@example.com", "name": "Rider Rahul (Satellite)", "phone": "+91 98250 20006", "vehicle": "Hero Splendor (GJ-01-KL-1006)", "lat": 23.0276, "lng": 72.5076},
            # Approximately 3 km east of the Satellite store for routing simulation.
            {"email": "satellite.rider.arjun.3km@example.com", "name": "Rider Arjun (3 km from Satellite)", "phone": "+91 98250 20007", "vehicle": "TVS Jupiter (GJ-01-MN-1007)", "lat": 23.0276, "lng": 72.5368},
        ]
        for rdata in RIDERS:
            ruser = db.query(User).filter(User.email == rdata["email"]).first()
            if not ruser:
                ruser = User(
                    email=rdata["email"],
                    hashed_password=get_password_hash("DemoPassword123!"),
                    role=UserRole.DELIVERY_PARTNER,
                    is_active=True,
                )
                db.add(ruser)
                db.flush()
            else:
                ruser.hashed_password = get_password_hash("DemoPassword123!")
                ruser.role = UserRole.DELIVERY_PARTNER
                ruser.is_active = True
            
            rpartner = db.query(DeliveryPartner).filter(DeliveryPartner.user_id == ruser.id).first()
            if not rpartner:
                rpartner = DeliveryPartner(
                    user_id=ruser.id,
                    name=rdata["name"],
                    phone=rdata["phone"],
                    vehicle_info=rdata["vehicle"],
                    current_lat=rdata["lat"],
                    current_lng=rdata["lng"],
                    is_available=True,
                )
                db.add(rpartner)
            else:
                rpartner.name = rdata["name"]
                rpartner.phone = rdata["phone"]
                rpartner.vehicle_info = rdata["vehicle"]
                rpartner.current_lat = rdata["lat"]
                rpartner.current_lng = rdata["lng"]
                rpartner.is_available = True
                db.flush()
        
        db.commit()
        print("Done! All test stores and delivery partners ready and stocked.")
    except Exception as e:
        db.rollback()
        print("Error:", e)
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    run_seed()
