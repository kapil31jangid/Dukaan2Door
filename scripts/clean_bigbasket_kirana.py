"""
BigBasket → Kirana Store Catalog Cleaner
=========================================
Produces:
  BigBasket_kirana_cleaned.csv   — final curated kirana catalog
  BigBasket_kirana_removed.csv   — removed records with removal_reason
  BigBasket_kirana_audit.csv     — audit summary

Does NOT touch the database or any application code.
"""

import re
import pandas as pd
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / "data" / "raw" / "bigbasket" / "BigBasket.csv"
OUT_DIR = ROOT / "data" / "processed" / "bigbasket"
OUT_DIR.mkdir(parents=True, exist_ok=True)

CLEANED_OUT = OUT_DIR / "BigBasket_kirana_cleaned.csv"
REMOVED_OUT = OUT_DIR / "BigBasket_kirana_removed.csv"
AUDIT_OUT = OUT_DIR / "BigBasket_kirana_audit.csv"

# ===========================================================================
# STEP 1 — LOAD & INSPECT
# ===========================================================================
print("=" * 60)
print("STEP 1 — LOADING BigBasket.csv")
print("=" * 60)

df = pd.read_csv(INPUT)
original_count = len(df)

print(f"Shape:           {df.shape}")
print(f"Columns:         {df.columns.tolist()}")
print(f"\nRow count:       {original_count}")
print(f"\nCategory counts:\n{df['Category'].value_counts().to_string()}")
print(f"\nSubCategory unique count: {df['SubCategory'].nunique()}")
print(f"Top SubCategories:\n{df['SubCategory'].value_counts().head(20).to_string()}")
print(f"\nBrand unique count: {df['Brand'].nunique()}")
print(f"\nMissing values:\n{df.isnull().sum().to_string()}")
print(f"\nExact duplicate rows: {df.duplicated().sum()}")
print(f"Duplicate ProductNames: {df['ProductName'].duplicated().sum()}")

# Show representative products per category
print("\n--- Representative products per category ---")
for cat, grp in df.groupby("Category"):
    print(f"\n[{cat}]  ({len(grp)} rows)")
    print(grp[["ProductName", "SubCategory", "Brand", "DiscountPrice"]].head(5).to_string(index=False))

# ===========================================================================
# STEP 2 — INITIAL CLEANING (structural)
# ===========================================================================
print("\n" + "=" * 60)
print("STEP 2 — STRUCTURAL CLEANING")
print("=" * 60)

df = df.copy()

# Remove exact duplicate rows
before_dedup = len(df)
df = df.drop_duplicates()
print(f"Exact duplicates removed: {before_dedup - len(df)}")

# Remove rows with missing ProductName
before = len(df)
df = df[df["ProductName"].notna() & (df["ProductName"].str.strip() != "")]
print(f"Missing ProductName removed: {before - len(df)}")

# Remove rows with invalid/zero/negative price (use DiscountPrice if available else Price)
df["effective_price"] = df["DiscountPrice"].fillna(df["Price"])
before = len(df)
df = df[df["effective_price"] > 0]
print(f"Zero/invalid price removed:  {before - len(df)}")

print(f"Rows after structural clean: {len(df)}")

# ===========================================================================
# STEP 3 — KIRANA RELEVANCE FILTERING
# ===========================================================================
print("\n" + "=" * 60)
print("STEP 3 — KIRANA RELEVANCE FILTERING")
print("=" * 60)

# We'll tag every row with keep=True/False + removal_reason
df["_keep"] = True
df["_removal_reason"] = ""

def flag_remove(mask, reason):
    """Mark rows matching mask as removed with the given reason (first match wins)."""
    eligible = mask & df["_keep"]
    df.loc[eligible, "_keep"] = False
    df.loc[eligible, "_removal_reason"] = reason

# ---------------------------------------------------------------------------
# 3A — Category-level full removes (entire categories that are never kirana)
# ---------------------------------------------------------------------------
# "Kitchen, Garden & Pets" is MIXED — handle product-level below
# All other categories are already kirana-relevant in this dataset

# No full category removals needed for this dataset's categories,
# but let's guard by SubCategory and product name patterns.

# ---------------------------------------------------------------------------
# 3B — PETS — remove pet products (subcategory or name based)
# ---------------------------------------------------------------------------
pet_subcats = [
    "Dog", "Cat", "Fish", "Bird", "Small Animal", "Aquarium",
    "Pet Food", "Pet Care", "Pet Accessories", "Pet Grooming",
    "Munchies", "Treats"
]
pet_name_patterns = [
    r"\bdog\b", r"\bcat\b", r"\bpet\b", r"\bpuppy\b", r"\bpuppies\b",
    r"\bkitten\b", r"\bfeline\b", r"\bcanine\b", r"\baquarium\b",
    r"\bbird feed\b", r"\bhamster\b",
]

pet_subcat_mask = df["SubCategory"].str.contains(
    "|".join(pet_subcats), case=False, na=False
)
pet_name_mask = df["ProductName"].str.contains(
    "|".join(pet_name_patterns), case=False, na=False, regex=True
)
# Specifically for "Munchies" subcategory in Kitchen,Garden & Pets
munchies_mask = (
    df["SubCategory"].str.contains("Munchies|Treats for Dog|Treats for Cat", case=False, na=False)
    & df["Category"].str.contains("Kitchen|Garden|Pet", case=False, na=False)
)

flag_remove(pet_subcat_mask | pet_name_mask | munchies_mask, "Pet product")

# ---------------------------------------------------------------------------
# 3C — GARDENING — remove gardening tools/planters/equipment
# ---------------------------------------------------------------------------
gardening_subcats = [
    "Gardening Tools", "Planters", "Seeds", "Pots", "Garden Accessories",
    "Fertilizers", "Soil", "Plant"
]
# NOTE: "Seeds" in Groceries context (cooking seeds) should NOT be removed.
# Only remove when in Garden context.
gardening_mask = (
    df["SubCategory"].str.contains(
        "Gardening|Planters|Garden Tool|Garden Accessory",
        case=False, na=False
    )
    | (
        df["SubCategory"].str.contains("Seeds|Plant|Pot|Soil", case=False, na=False)
        & df["Category"].str.contains("Garden|Kitchen.*Garden", case=False, na=False)
    )
)
flag_remove(gardening_mask, "Gardening/outdoor product")

# ---------------------------------------------------------------------------
# 3D — LARGE KITCHEN EQUIPMENT / COOKWARE (hardware, not consumables)
# ---------------------------------------------------------------------------
large_kitchen_subcats_patterns = [
    r"cookware", r"knife.*set", r"knife", r"cutlery", r"utensil.*set",
    r"pressure cooker", r"induction", r"mixer grinder", r"blender",
    r"juicer", r"toaster", r"oven", r"iron\b", r"steam iron",
    r"electric.*kettle", r"rice cooker", r"slow cooker", r"air fryer",
    r"food processor", r"hand blender", r"stand mixer",
]
# Only remove KITCHEN HARDWARE subcategories, not consumable items
kitchen_hw_name_mask = df["ProductName"].str.contains(
    "|".join(large_kitchen_subcats_patterns), case=False, na=False, regex=True
)
kitchen_hw_subcat_mask = df["SubCategory"].str.contains(
    "Cookware|Knife|Cutlery|Kitchen Tool|Appliance|Iron|Mixer|Blender|Juicer",
    case=False, na=False
)
kitchen_hw_mask = (
    (kitchen_hw_name_mask | kitchen_hw_subcat_mask)
    & df["Category"].str.contains("Kitchen|Garden", case=False, na=False)
    # Do not remove if product is clearly a consumable
    & ~df["ProductName"].str.contains(
        r"foil|wrap|bag|tissue|wipe|scrub|sponge|glove|liner|sheet|towel|plate|cup|bowl|straw",
        case=False, na=False, regex=True
    )
)
flag_remove(kitchen_hw_mask, "Large kitchen hardware/equipment")

# ---------------------------------------------------------------------------
# 3E — ELECTRONICS / TECH — not in this dataset but guard anyway
# ---------------------------------------------------------------------------
electronics_patterns = [
    r"\bphone\b", r"\bearbuds\b", r"\bheadphone\b", r"\bspeaker\b",
    r"\bcharger\b", r"\bpower bank\b", r"\bUSB\b", r"\bHDMI\b",
    r"\blaptop\b", r"\btablet\b", r"\bcamera\b", r"\bTV\b", r"\btelevision\b"
]
elec_mask = df["ProductName"].str.contains(
    "|".join(electronics_patterns), case=False, na=False, regex=True
)
flag_remove(elec_mask, "Electronics/tech product")

# ---------------------------------------------------------------------------
# 3F — TOYS / GAMES
# ---------------------------------------------------------------------------
toy_patterns = [r"\btoy\b", r"\bgame\b", r"\bpuzzle\b", r"\bdoll\b", r"\blego\b"]
toy_subcat_mask = df["SubCategory"].str.contains("Toy|Game|Puzzle", case=False, na=False)
toy_name_mask = df["ProductName"].str.contains(
    "|".join(toy_patterns), case=False, na=False, regex=True
)
flag_remove(toy_subcat_mask | toy_name_mask, "Toy/game product")

# ---------------------------------------------------------------------------
# 3G — STATIONERY
# ---------------------------------------------------------------------------
stat_patterns = [r"\bnotebook\b", r"\bschool bag\b"]
stat_subcat_mask = df["SubCategory"].str.contains(
    "Stationary|Stationery|Office Supply", case=False, na=False
)
# Pencil/marker — only if NOT a cosmetic (kajal, eyeliner, lip liner are Personal Care)
cosmetic_pencil_guard = df["ProductName"].str.contains(
    r"kajal|kohl|eyeliner|lip.*liner|eye.*pencil|eyebrow",
    case=False, na=False, regex=True
)
stat_name_mask = (
    df["ProductName"].str.contains(
        "|".join(stat_patterns), case=False, na=False, regex=True
    )
    & ~cosmetic_pencil_guard
)
flag_remove(stat_subcat_mask | stat_name_mask, "Stationery/office product")

# ---------------------------------------------------------------------------
# 3H — CLOTHING / FASHION
# ---------------------------------------------------------------------------
cloth_patterns = [
    r"\bshirt\b", r"\btrouser\b", r"\bdress\b", r"\bsaree\b",
    r"\blegging\b", r"\bjeans\b", r"\bsock\b", r"\bsandal\b",
    r"\bshoe\b", r"\bslipper\b", r"\bwallet\b", r"\bbag\b.*fashion",
    r"\bwatch\b", r"\bjewel\b", r"\bnecklace\b",
]
cloth_mask = df["ProductName"].str.contains(
    "|".join(cloth_patterns), case=False, na=False, regex=True
)
flag_remove(cloth_mask, "Clothing/fashion product")

# ---------------------------------------------------------------------------
# 3I — AUTOMOTIVE
# ---------------------------------------------------------------------------
auto_patterns = [r"\bcar\b", r"\bbike\b", r"\bautomotive\b", r"\btyre\b",
                 r"\bhelmet\b", r"\bwipers\b"]
auto_mask = df["ProductName"].str.contains(
    "|".join(auto_patterns), case=False, na=False, regex=True
)
flag_remove(auto_mask, "Automotive product")

# ---------------------------------------------------------------------------
# 3J — ALCOHOL / TOBACCO
# ---------------------------------------------------------------------------
alco_patterns = [
    r"\bwhisky\b", r"\bwhiskey\b", r"\bwine\b", r"\bbeer\b",
    r"\bvodka\b", r"\brum\b", r"\bgin\b", r"\bcigarette\b",
    r"\btobacco\b", r"\bbidi\b",
]
# Guard: do not flag products where the keyword is part of a personal care product
alco_mask = (
    df["ProductName"].str.contains(
        "|".join(alco_patterns), case=False, na=False, regex=True
    )
    & ~df["ProductName"].str.contains(
        r"shampoo|hair|soap|lotion|cream|serum|conditioner|body wash|face|skin|foam|gel",
        case=False, na=False, regex=True
    )
    & ~df["Category"].str.contains("Beauty|Hygiene|Personal|Baby", case=False, na=False)
)
flag_remove(alco_mask, "Alcohol/tobacco product")

# ---------------------------------------------------------------------------
# 3K — MEDICAL DEVICES / PHARMA
# ---------------------------------------------------------------------------
medical_patterns = [
    r"\bglucometer\b", r"\bblood pressure\b", r"\bBP monitor\b",
    r"\bnebulizer\b", r"\bthermometer\b", r"\bprescription\b",
    r"\bblood glucose\b", r"\bdiabetic\b",
]
# Only remove genuinely medical devices — NOT ayurvedic supplements or vitamins
medical_mask = (
    df["ProductName"].str.contains(
        "|".join(medical_patterns), case=False, na=False, regex=True
    )
    & ~df["Category"].str.contains("Beauty|Hygiene|Baby", case=False, na=False)
)
flag_remove(medical_mask, "Medical device/pharmaceutical")

# ---------------------------------------------------------------------------
# 3L — GIFT / SPECIALTY MERCHANDISE
# ---------------------------------------------------------------------------
gift_patterns = [
    r"\bgift hamper\b", r"\bgift card\b", r"\bgreeting card\b",
    r"\bbouquet\b", r"\bgift set\b.*luxury",
]
gift_mask = df["ProductName"].str.contains(
    "|".join(gift_patterns), case=False, na=False, regex=True
)
flag_remove(gift_mask, "Specialty gift product")

# ---------------------------------------------------------------------------
# 3M — FURNITURE / LARGE HOME GOODS
# ---------------------------------------------------------------------------
furn_patterns = [
    r"\bsofa\b", r"\bmattress\b", r"\bcurtain\b", r"\bblinds\b",
    r"\bfurniture\b", r"\bwardrobe\b", r"\bshelf\b",
]
furn_mask = df["ProductName"].str.contains(
    "|".join(furn_patterns), case=False, na=False, regex=True
)
flag_remove(furn_mask, "Furniture/large home goods")

# ---------------------------------------------------------------------------
# Final split
# ---------------------------------------------------------------------------
removed_mask = ~df["_keep"]
kept_mask = df["_keep"]

removed_df = df[removed_mask].copy()
kept_df = df[kept_mask].copy()

print(f"\nRows flagged for removal: {removed_mask.sum()}")
print(f"Rows retained:            {kept_mask.sum()}")
print(f"\nRemoval reasons breakdown:")
print(removed_df["_removal_reason"].value_counts().to_string())

# ===========================================================================
# STEP 4 — CATEGORY NORMALIZATION on kept_df
# ===========================================================================
print("\n" + "=" * 60)
print("STEP 4 — CATEGORY NORMALIZATION")
print("=" * 60)

CATEGORY_MAP = {
    "Foodgrains, Oil & Masala": "Groceries",
    "Gourmet & World Food": "Groceries",
    "Snacks & Branded Foods": "Snacks & Packaged Foods",
    "Beverages": "Beverages",
    "Bakery, Cakes & Dairy": "Dairy & Bakery",
    "Eggs, Meat & Fish": "Groceries",
    "Fruits & Vegetables": "Fruits & Vegetables",
    "Cleaning & Household": "Household Cleaning",
    "Beauty & Hygiene": "Personal Care",
    "Baby Care": "Baby Care",
    "Kitchen, Garden & Pets": "Other Kirana",
}

SUBCATEGORY_MAP = {
    # Groceries
    "Rice": "Rice, Atta & Flour",
    "Atta & Flours": "Rice, Atta & Flour",
    "Dals & Pulses": "Dal & Pulses",
    "Edible Oils": "Oil & Ghee",
    "Ghee": "Oil & Ghee",
    "Masalas & Spices": "Masala & Spices",
    "Dry Fruits": "Dry Fruits & Nuts",
    "Nuts & Seeds": "Dry Fruits & Nuts",
    "Pickles & Chutneys": "Pickles & Papad",
    "Papad": "Pickles & Papad",
    "Salt, Sugar & Jaggery": "Salt, Sugar & Jaggery",
    "Ready to Cook": "Ready-to-Cook",
    "Breakfast Cereals": "Breakfast Foods",

    # Beverages
    "Tea": "Tea & Coffee",
    "Coffee": "Tea & Coffee",
    "Soft Drinks": "Soft Drinks",
    "Juices": "Juices",
    "Packaged Water": "Packaged Water",
    "Energy Drinks": "Health & Energy Drinks",
    "Health Drinks": "Health & Energy Drinks",

    # Dairy & Bakery
    "Milk": "Milk & Dairy",
    "Curd": "Milk & Dairy",
    "Butter": "Milk & Dairy",
    "Paneer": "Paneer & Cheese",
    "Cheese": "Paneer & Cheese",
    "Bread": "Bread & Bakery",
    "Rusk": "Bread & Bakery",
    "Cakes": "Bread & Bakery",
    "Ice Cream": "Ice Cream & Frozen",

    # Personal Care
    "Shampoo & Conditioner": "Hair Care",
    "Hair Color": "Hair Care",
    "Hair Oil": "Hair Care",
    "Face Care": "Skin Care",
    "Skin Care": "Skin Care",
    "Body Care": "Bath & Body",
    "Bathing": "Bath & Body",
    "Oral Care": "Oral Care",
    "Deodorant": "Deodorant",
    "Men's Grooming": "Men's Grooming",
    "Sanitary Pads": "Feminine Hygiene",
    "Feminine Hygiene": "Feminine Hygiene",

    # Baby Care
    "Baby Food": "Baby Food",
    "Diapers": "Diapers",
    "Baby Bath": "Baby Hygiene",
    "Baby Skin Care": "Baby Hygiene",

    # Household
    "Detergents": "Laundry",
    "Fabric Care": "Laundry",
    "Dishwashing": "Dishwashing",
    "Floor Cleaner": "Floor & Surface Cleaning",
    "Bathroom Cleaners": "Floor & Surface Cleaning",
    "Toilet Cleaners": "Floor & Surface Cleaning",
    "Scrubs & Sponges": "Household Essentials",
    "Garbage Bags": "Household Essentials",
    "Tissue": "Household Essentials",
    "Wipes": "Household Essentials",

    # Snacks
    "Chips": "Chips & Namkeen",
    "Namkeen": "Chips & Namkeen",
    "Biscuits": "Biscuits",
    "Chocolates": "Chocolates & Candy",
    "Candy": "Chocolates & Candy",
    "Instant Food": "Instant Foods",
    "Noodles": "Instant Foods",
    "Pasta": "Instant Foods",
}

def normalize_category(row):
    orig = row["Category"]
    return CATEGORY_MAP.get(orig, "Other Kirana")

def normalize_subcategory(row):
    orig = str(row["SubCategory"]) if pd.notna(row["SubCategory"]) else ""
    # Try direct match first
    for key, val in SUBCATEGORY_MAP.items():
        if key.lower() in orig.lower():
            return val
    # Contextual fallback
    cat = row["_kirana_category"]
    if cat == "Groceries":
        return "General Groceries"
    elif cat == "Beverages":
        return "Other Beverages"
    elif cat == "Personal Care":
        return "General Personal Care"
    elif cat == "Household Cleaning":
        return "Household Essentials"
    elif cat == "Baby Care":
        return "Baby Care"
    elif cat == "Dairy & Bakery":
        return "Dairy Products"
    elif cat == "Snacks & Packaged Foods":
        return "Other Snacks"
    elif cat == "Fruits & Vegetables":
        return "Fresh Produce"
    else:
        return "General"

# Pooja product detection
def is_pooja_product(row):
    pooja_keywords = [
        "agarbatti", "incense", "camphor", "dhoop", "pooja", "puja",
        "diya", "oil lamp", "wick", "kumkum", "sindoor", "havan",
        "sandalwood", "tulsi", "gangajal",
    ]
    text = f"{row['ProductName']} {row.get('SubCategory', '')}".lower()
    return any(kw in text for kw in pooja_keywords)

kept_df["_kirana_category"] = kept_df.apply(normalize_category, axis=1)
# Override with Pooja where applicable
pooja_mask_kept = kept_df.apply(is_pooja_product, axis=1)
kept_df.loc[pooja_mask_kept, "_kirana_category"] = "Pooja & Daily Essentials"
# Normalize subcategory
kept_df["_kirana_subcategory"] = kept_df.apply(normalize_subcategory, axis=1)

print(f"\nKirana category distribution (kept):")
print(kept_df["_kirana_category"].value_counts().to_string())

# ===========================================================================
# STEP 5 — DUPLICATE PRODUCT NAME HANDLING
# ===========================================================================
print("\n" + "=" * 60)
print("STEP 5 — DUPLICATE PRODUCT NAME DEDUPLICATION")
print("=" * 60)

dup_before = kept_df["ProductName"].duplicated().sum()
print(f"Duplicate ProductNames before dedup: {dup_before}")
print("(Preserving all variants — different pack size / brand / flavor)")
# We keep ALL rows — different packs/brands are legitimate variants
# Only flag truly identical rows
kept_df = kept_df.drop_duplicates(subset=["ProductName", "Brand", "Quantity"])
print(f"Rows after variant-aware dedup: {len(kept_df)}")

# ===========================================================================
# STEP 6 — BUILD OUTPUT DATAFRAMES
# ===========================================================================
print("\n" + "=" * 60)
print("STEP 6 — BUILDING OUTPUT FILES")
print("=" * 60)

# --- CLEANED OUTPUT ---
cleaned_df = kept_df[[
    "ProductName", "Brand", "DiscountPrice", "Price",
    "Quantity", "_kirana_category", "_kirana_subcategory",
    "Image_Url", "Absolute_Url"
]].copy()

cleaned_df = cleaned_df.rename(columns={
    "ProductName": "product_name",
    "Brand": "brand",
    "DiscountPrice": "sale_price",
    "Price": "mrp",
    "Quantity": "pack_size",
    "_kirana_category": "category",
    "_kirana_subcategory": "subcategory",
    "Image_Url": "image_url",
    "Absolute_Url": "source_url",
})

cleaned_df.to_csv(CLEANED_OUT, index=False)
print(f"Saved CLEANED:  {CLEANED_OUT}")
print(f"  Rows: {len(cleaned_df)}")

# --- REMOVED OUTPUT ---
removed_out_df = removed_df[[
    "ProductName", "Brand", "Category", "SubCategory",
    "DiscountPrice", "Price", "_removal_reason"
]].copy()
removed_out_df = removed_out_df.rename(columns={
    "ProductName": "product_name",
    "Brand": "brand",
    "Category": "original_category",
    "SubCategory": "original_subcategory",
    "DiscountPrice": "sale_price",
    "Price": "mrp",
    "_removal_reason": "removal_reason",
})
removed_out_df.to_csv(REMOVED_OUT, index=False)
print(f"Saved REMOVED:  {REMOVED_OUT}")
print(f"  Rows: {len(removed_out_df)}")

# --- AUDIT OUTPUT ---
audit_rows = []

# Summary stats
audit_rows.append({"metric": "original_row_count", "value": original_count})
audit_rows.append({"metric": "retained_row_count", "value": len(cleaned_df)})
audit_rows.append({"metric": "removed_row_count", "value": len(removed_out_df)})
audit_rows.append({
    "metric": "retention_percentage",
    "value": f"{len(cleaned_df)/original_count*100:.1f}%"
})

# Category counts before
for cat, cnt in df["Category"].value_counts().items():
    audit_rows.append({"metric": f"before_category::{cat}", "value": cnt})

# Category counts after
for cat, cnt in cleaned_df["category"].value_counts().items():
    audit_rows.append({"metric": f"after_category::{cat}", "value": cnt})

# Removal reasons
for reason, cnt in removed_out_df["removal_reason"].value_counts().items():
    audit_rows.append({"metric": f"removal_reason::{reason}", "value": cnt})

# Missing values in cleaned
for col in cleaned_df.columns:
    missing = cleaned_df[col].isna().sum()
    if missing > 0:
        audit_rows.append({"metric": f"missing_in_cleaned::{col}", "value": missing})

audit_df = pd.DataFrame(audit_rows)
audit_df.to_csv(AUDIT_OUT, index=False)
print(f"Saved AUDIT:    {AUDIT_OUT}")

# ===========================================================================
# STEP 7 — FINAL REPORT
# ===========================================================================
print("\n" + "=" * 60)
print("FINAL REPORT")
print("=" * 60)
print(f"\nOriginal records:    {original_count}")
print(f"Retained records:    {len(cleaned_df)}")
print(f"Removed records:     {len(removed_out_df)}")
print(f"Retention rate:      {len(cleaned_df)/original_count*100:.1f}%")

print("\nFinal kirana categories:")
for cat, cnt in cleaned_df["category"].value_counts().items():
    print(f"  {cat:<30} {cnt:>5} products")

print("\nMajor removal groups:")
for reason, cnt in removed_out_df["removal_reason"].value_counts().items():
    print(f"  {reason:<35} {cnt:>4} removed")

print("""
NOTE: This is a curated general-purpose local-kirana catalog
based on the provided BigBasket dataset. It does not claim to
represent every Indian kirana store's full product range.
""")
