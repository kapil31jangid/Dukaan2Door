from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
RAW_DIR = DATA_DIR / "raw"
METADATA_DIR = DATA_DIR / "metadata"

DATASETS = {
    "zepto": {
        "platform": "zepto",
        "provider": "Kaggle",
        "handle": "palvinder2006/zepto-inventory-dataset",
        "url": "https://www.kaggle.com/datasets/palvinder2006/zepto-inventory-dataset",
        "license": "MIT",
        "raw_dir": RAW_DIR / "zepto",
    },
    "blinkit": {
        "platform": "blinkit",
        "provider": "Kaggle",
        "handle": "lavudyaswamy/blinkit-grocery-sales-dataset-excel",
        "url": "https://www.kaggle.com/datasets/lavudyaswamy/blinkit-grocery-sales-dataset-excel",
        "license": "CC0-1.0",
        "raw_dir": RAW_DIR / "blinkit",
    },
    "instacart": {
        "platform": "instacart",
        "provider": "Kaggle",
        "handle": "psparks/instacart-market-basket-analysis",
        "url": "https://www.kaggle.com/datasets/psparks/instacart-market-basket-analysis",
        "license": "CC0-1.0",
        "raw_dir": RAW_DIR / "instacart",
    },
    "bigbasket": {
        "platform": "bigbasket",
        "provider": "Kaggle",
        "handle": "chinmayshanbhag/big-basket-products",
        "url": "https://www.kaggle.com/datasets/chinmayshanbhag/big-basket-products",
        "license": "CC0-1.0",
        "raw_dir": RAW_DIR / "bigbasket",
    },
}

INSTACART_SUBSET_ORDER_LIMIT = 10_000
