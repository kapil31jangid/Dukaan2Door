"""
Second-Pass BigBasket Kirana Catalog Refinement Script
=====================================================
Performs product-level refinement on data/processed/bigbasket/BigBasket_kirana_cleaned.csv
Produces:
  1. BigBasket_kirana_final.csv
  2. BigBasket_second_pass_removed.csv
  3. BigBasket_second_pass_moved.csv
"""

import os
import re
import pandas as pd
import numpy as np

CLEANED_PATH = "data/processed/bigbasket/BigBasket_kirana_cleaned.csv"
OUTPUT_DIR = "data/processed/bigbasket"
FINAL_PATH = os.path.join(OUTPUT_DIR, "BigBasket_kirana_final.csv")
REMOVED_PATH = os.path.join(OUTPUT_DIR, "BigBasket_second_pass_removed.csv")
MOVED_PATH = os.path.join(OUTPUT_DIR, "BigBasket_second_pass_moved.csv")
AUDIT_PATH = os.path.join(OUTPUT_DIR, "BigBasket_second_pass_audit.csv")

def main():
    print("=" * 60)
    print("STARTING SECOND-PASS KIRANA CATALOG REFINEMENT")
    print("=" * 60)

    df = pd.read_csv(CLEANED_PATH)
    original_count = len(df)
    print(f"Loaded {original_count} products from {CLEANED_PATH}")
    print("\nInitial Category Breakdown:")
    print(df["category"].value_counts())

    # Create tracking columns
    df["_keep"] = True
    df["_removal_reason"] = ""
    df["_original_category"] = df["category"]
    df["_original_subcategory"] = df["subcategory"]
    df["_reclassified"] = False
    df["_move_reason"] = ""

    # Helper function for removal
    def flag_remove(mask, reason):
        eligible = mask & df["_keep"]
        df.loc[eligible, "_keep"] = False
        df.loc[eligible, "_removal_reason"] = reason

    # Helper function for reclassifying category & subcategory
    def move_category(mask, new_cat, new_subcat=None, reason="Reclassified to specific category"):
        eligible = mask & df["_keep"] & (df["category"] != new_cat)
        df.loc[eligible, "_reclassified"] = True
        df.loc[eligible, "_move_reason"] = reason
        df.loc[eligible, "category"] = new_cat
        if new_subcat is not None:
            df.loc[eligible, "subcategory"] = new_subcat

    name_lower = df["product_name"].str.lower().fillna("")
    subcat_lower = df["subcategory"].str.lower().fillna("")
    brand_lower = df["brand"].str.lower().fillna("")

    # =========================================================================
    # GUARD PATTERNS: Everyday staples/consumables that must NEVER be removed
    # =========================================================================
    everyday_guards = [
        r"\bbath\s*soap\b", r"\bsoap\b", r"\bhand\s*wash\b", r"\bhandwash\b",
        r"\bshampoo\b", r"\bconditioner\b", r"\bhair\s*oil\b", r"\bhair\s*cream\b",
        r"\btoothpaste\b", r"\btoothbrush\b", r"\bmouthwash\b", r"\bface\s*wash\b",
        r"\bbody\s*wash\b", r"\bshower\s*gel\b", r"\bbody\s*lotion\b", r"\btalcum\b",
        r"\btalc\b", r"\bdeodorant\b", r"\bdeo\b", r"\bshaving\s*cream\b", r"\bshaving\s*foam\b",
        r"\bshaving\s*gel\b", r"\brazor\b", r"\bblade\b", r"\bcartridge\b",
        r"\bsanitary\s*pad\b", r"\bsanitary\s*napkin\b", r"\bpads\b", r"\bpanty\s*liner\b",
        r"\bcotton\s*buds\b", r"\bcotton\s*balls\b", r"\bcotton\s*roll\b",
        r"\bmoisturizer\b", r"\bmoisturiser\b", r"\bmoisturising\s*cream\b", r"\bcold\s*cream\b",
        r"\bpetroleum\s*jelly\b", r"\bvaseline\b", r"\bsunscreen\b", r"\bsun\s*block\b",
        r"\blip\s*balm\b", r"\bboroline\b", r"\bboroplus\b", r"\bvicks\b", r"\bzandu\b",
        r"\bmasala\b", r"\bspice\b", r"\bchicken\s*masala\b", r"\bkadhi\b", r"\bpaneer\b",
        r"\bgravy\b", r"\bcurry\b", r"\bpaan\b", r"\battar\b", r"\bbiscuit\b", r"\bcookie\b",
        r"\bnoodles\b", r"\bmaggi\b", r"\bchips\b", r"\bnamkeen\b", r"\btea\b", r"\bcoffee\b",
        r"\bdetergent\b", r"\bdishwash\b", r"\bfloor\s*cleaner\b", r"\begg\b", r"\beggs\b",
        r"\bfarm\s*eggs\b", r"\btable\s*tray\b", r"\bflavour\b", r"\bflavor\b"
    ]
    guard_regex = "|".join(everyday_guards)

    # =========================================================================
    # 1. SPECIALTY BEAUTY / COSMETIC REMOVALS
    # =========================================================================
    print("\n--- 1. Filtering Specialty Beauty, Salon & Makeup Products ---")

    makeup_keywords = [
        r"\blipstick\b", r"\blip\s*crayon\b", r"\blip\s*gloss\b", r"\blip\s*liner\b",
        r"\blip\s*tint\b", r"\blip\s*lacquer\b", r"\bliquid\s*lipstick\b", r"\bmatte\s*lip\b",
        r"\bfoundation\b", r"\bconcealer\b", r"\bcompact\s*powder\b", r"\bcompact\b",
        r"\bmascara\b", r"\beyeliner\b", r"\beye\s*shadow\b", r"\beyeshadow\b",
        r"\bkohl\b", r"\bkajal\b", r"\bblush\b", r"\bblusher\b", r"\bblushlighter\b",
        r"\bhighlighter\b", r"\bbronzer\b", r"\bcontour\b", r"\bprimer\b", r"\bsetting\s*spray\b",
        r"\bnail\s*polish\b", r"\bnail\s*enamel\b", r"\bnail\s*art\b", r"\bnail\s*lacquer\b",
        r"\bnail\s*remover\b", r"\bnail\s*paint\b", r"\bfake\s*nails\b", r"\bfalse\s*eyelashes\b",
        r"\bmicellar\s*water\b", r"\bmicellar\b", r"\bmakeup\s*remover\b", r"\bmake-up\b",
        r"\bmakeup\b", r"\bmake\s*up\b", r"\bbrow\s*pencil\b", r"\beyebrow\b",
        r"\bblemish\s*balm\b", r"\bbb\s*cream\b", r"\bcc\s*cream\b", r"\blip\s*color\b"
    ]
    makeup_regex = "|".join(makeup_keywords)

    beauty_tools_keywords = [
        r"\bmakeup\s*brush\b", r"\bcosmetic\s*brush\b", r"\bblender\s*sponge\b",
        r"\bbeauty\s*blender\b", r"\beyelash\s*curler\b", r"\btweezer\b", r"\btweezers\b",
        r"\bmanicure\b", r"\bpedicure\b", r"\bnail\s*cutter\b", r"\bnail\s*clipper\b",
        r"\bnail\s*file\b", r"\bstraightener\b", r"\bhair\s*dryer\b", r"\bcurling\s*iron\b",
        r"\bhair\s*styler\b", r"\btrimmer\b", r"\bepilator\b", r"\bshaver\s*electric\b",
        r"\belectric\s*shaver\b", r"\bderma\s*roller\b", r"\bblackhead\b", r"\bfacial\s*kit\b",
        r"\bbleach\b", r"\bbleaching\b", r"\bhair\s*color\s*brush\b", r"\bspa\s*kit\b",
        r"\bface\s*roller\b", r"\bgua\s*sha\b"
    ]
    tools_regex = "|".join(beauty_tools_keywords)

    specialty_skin_keywords = [
        r"\banti[- ]aging\s*serum\b", r"\bretinol\b", r"\bcollagen\b", r"\bpeeling\s*solution\b",
        r"\bchemical\s*peel\b", r"\baha\s*bha\b", r"\bhyaluronic\s*acid\s*serum\b",
        r"\bwhitening\s*treatment\b", r"\bnight\s*repair\b", r"\bbio-oil\b",
        r"\bessential\s*oil\b", r"\baroma\s*therapy\b", r"\baromatherapy\b"
    ]
    specialty_skin_regex = "|".join(specialty_skin_keywords)

    flag_remove(name_lower.str.contains(makeup_regex, regex=True) & ~name_lower.str.contains(guard_regex, regex=True), "Specialty beauty/cosmetic")
    flag_remove(name_lower.str.contains(tools_regex, regex=True) & ~name_lower.str.contains(guard_regex, regex=True), "Salon/cosmetic tool or equipment")
    flag_remove(name_lower.str.contains(specialty_skin_regex, regex=True) & ~name_lower.str.contains(guard_regex, regex=True), "Specialized cosmetic treatment/anti-aging")

    # =========================================================================
    # 2. HARDWARE, UTENSILS, BAKEWARE, HOME MERCHANDISE REMOVALS
    # =========================================================================
    print("\n--- 2. Filtering Cookware, Dinnerware, Bakeware & Hardware ---")

    hardware_keywords = [
        r"\bpressure\s*cooker\b", r"\bcookware\b", r"\bknife\s*set\b", r"\bcutlery\s*set\b",
        r"\bdinner\s*set\b", r"\bsteel\s*rack\b", r"\bstorage\s*rack\b", r"\bidli\s*cooker\b",
        r"\bmagic\s*pan\b", r"\bpizza\s*pan\b", r"\bbaking\s*pan\b", r"\bcake\s*pan\b",
        r"\bgunj\b", r"\bkatori\b", r"\bthali\b", r"\bcolander\b", r"\bchopping\s*board\b",
        r"\bcutting\s*board\b", r"\bspatula\b", r"\bturner\b", r"\bchopstick\b",
        r"\bshot\s*glass\b", r"\bwine\s*glass\b", r"\bchampagne\s*glass\b",
        r"\bceramic.*bowl\b", r"\bglass.*bowl\b", r"\bbowl\s*set\b", r"\bfull\s*plate\b",
        r"\bwater\s*jug\b", r"\bflask\b", r"\binsulated\s*flask\b", r"\bfrosting\s*decorating\b",
        r"\btiffin\s*set\b", r"\blunch\s*box\b", r"\bmasala\s*dabba\b", r"\bdeep\s*dabba\b",
        r"\bhammer.*container\b", r"\bwater\s*bottle\b", r"\bbottle\s*glass\b", r"\bplatter\b",
        r"\bserving\s*tray\b", r"\bsnack\s*tray\b", r"\bcutlery\s*tray\b", r"\bcutter\b",
        r"\bcookie\s*cutter\b", r"\bbiscuit\s*cutter\b", r"\bpastry.*cutter\b", r"\bcake\s*base\b",
        r"\bsteel\s*glass\b", r"\bmug\b.*ceramic", r"\bcoffee\s*mug\b", r"\bwhisker\b",
        r"\bgrater\b", r"\bpeeler\b", r"\bmasher\b", r"\blemon\s*squeezer\b", r"\bchimta\b",
        r"\btong\b", r"\btongs\b", r"\bmeasuring\s*spoon\b", r"\bmeasuring\s*cup\b",
        r"\bnon-stick\s*kadai\b", r"\bnon-stick\s*tawa\b", r"\bnon-stick\s*pan\b",
        r"\bflat\s*tawa\b", r"\bsoap\s*dish\b", r"\bbathroom\s*accessory\b", r"\btowel\s*rod\b",
        r"\bcloth\s*peg\b", r"\bmetallic\s*foil\s*curtain\b", r"\bballoon\b", r"\bbirthday\s*banner\b",
        r"\bbunting\b", r"\bplastic\s*container\b", r"\bcontainer\s*set\b", r"\bmultiutility\s*bowl\b",
        r"\bmatka\s*jar\b", r"\bwooden\s*stand\b", r"\bmodustack\b", r"\bmelamine\b",
        r"\breusable\s*ice\s*cubes\b", r"\bcasserole\b", r"\bcookpot\b", r"\bsaucepan\b",
        r"\boil\s*dispenser\b", r"\bplastic\s*storage\s*container\b", r"\bcanister\b"
    ]
    hardware_regex = "|".join(hardware_keywords)
    flag_remove(name_lower.str.contains(hardware_regex, regex=True) & ~name_lower.str.contains(guard_regex, regex=True), "Cookware/heavy hardware")

    # Fashion / Apparel / Footwear
    fashion_regex = r"\bshoe\b|\bslipper\b|\bsandal\b|\bsock\b|\bsocks\b|\bwallet\b|\bbelt\b|\bwatch\b|\bjewelry\b|\bnecklace\b|\bearring\b|\bbangles\b|\bshirt\b|\bt-shirt\b|\btshirt\b|\btrouser\b|\bpant\b|\bjeans\b|\bleggings\b|\bdress\b|\bsaree\b|\bdupatta\b|\bkurti\b|\bcap\b|\bhat\b"
    flag_remove(name_lower.str.contains(fashion_regex, regex=True) & ~name_lower.str.contains(guard_regex, regex=True), "Fashion/apparel product")

    # Electronics & Appliances (Preserve basic AA/AAA batteries and standard household bulbs)
    electronics_regex = r"\bcharger\b|\busb\b|\bcable\b|\bpower\s*bank\b|\bheadphone\b|\bearphone\b|\bearbuds\b|\bspeaker\b|\bbattery\s*charger\b|\bextension\s*cord\b|\blamp\b|\btorch\b|\btubelight\b|\bbatten\b|\biron\b.*steam|\btoaster\b|\bblender\b|\bmixer\b|\bgrinder\b|\bjuicer\b|\bkettle\b|\binduction\b|\bscale\b.*weighing"
    flag_remove(name_lower.str.contains(electronics_regex, regex=True) & ~name_lower.str.contains(r"\bbattery\b|\bcell\b|\bbatteries\b", regex=True), "Electronics/appliance")

    # Toys, Games & Gym / Whey / Specialized Dietary Supplements
    toys_gym_regex = r"\btoy\b|\bgame\b|\bpuzzle\b|\bdoll\b|\bbat\b|\bball\b.*cricket|\bdumbbell\b|\byoga\s*mat\b|\bwhey\s*protein\b|\bprotein\s*powder.*fitness|\bcreatine\b|\bmass\s*gainer\b|\bmelatonin\b|\btagara\b|\bsoftgels\b|\bsoftgel\b|\bvitamin\s*e\s*400\b"
    flag_remove(name_lower.str.contains(toys_gym_regex, regex=True), "Toy/game/sports/gym supplement")

    # Stationery / Office
    stat_regex = r"\bnotebook\b|\bpen\b.*ball|\bpencil\b|\beraser\b|\bsharpener\b|\bstapler\b|\bscissors\b.*office|\bcalculator\b|\bdiary\b|\bcalendar\b"
    flag_remove(name_lower.str.contains(stat_regex, regex=True) & ~name_lower.str.contains(guard_regex, regex=True), "Stationery/office product")

    # Pet Products (including GLENAND brand, pet collars, dental spray, dog/cat treats, Petvit)
    pet_regex = r"\bdog\b|\bcat\b|\bpet\b|\bpuppy\b|\bkitten\b|\baquarium\b|\bbird\s*food\b|\bpedigree\b|\bwhiskas\b|\bdrools\b|\bme-o\b|\bfur\b|\bcollar\b|\bdentapet\b|\bleash\b|\bharness\b|\bchew\s*bone\b|\bfor\s*dogs\s*&\s*cats\b"
    flag_remove(name_lower.str.contains(pet_regex, regex=True) | brand_lower.str.contains(r"glenand|pedigree|whiskas|drools|petvit", regex=True) | subcat_lower.str.contains(r"pet|dog|cat", regex=True), "Pet product")

    # Automotive & Gardening
    auto_gard_regex = r"\bcar\s*shampoo\b|\bcar\s*polish\b|\bcar\s*perfume\b|\bcar\s*air\b|\btyre\b|\bengine\s*oil\b|\bplanter\b|\bgarden\s*tool\b|\bfertilizer\b|\bpotting\s*soil\b"
    flag_remove(name_lower.str.contains(auto_gard_regex, regex=True), "Automotive/gardening product")

    # Clinical Medical / Prescription Pharma
    med_regex = r"\bglucometer\b|\bbp\s*monitor\b|\bthermometer\b|\bnebulizer\b|\btest\s*strip\b|\bpregnancy\s*kit\b|\bcondom\b|\bcontraceptive\b|\bloratadine\b|\bparacetamol\b|\bantibiotic\b|\bointment\b.*prescription|\beye\s*drops\b"
    flag_remove(name_lower.str.contains(med_regex, regex=True) & ~name_lower.str.contains(guard_regex, regex=True), "Medical device/clinical product")

    # Alcohol & Tobacco
    alco_regex = r"\bwhisky\b|\bwhiskey\b|\bwine\b|\bbeer\b|\bvodka\b|\brum\b|\bgin\b|\bcigarette\b|\btobacco\b|\bbidi\b|\bhookah\b|\bvape\b"
    flag_remove(name_lower.str.contains(alco_regex, regex=True) & ~name_lower.str.contains(guard_regex, regex=True), "Alcohol/tobacco product")

    print(f"Total flagged for removal in second pass: {(~df['_keep']).sum()}")

    # =========================================================================
    # 3. RECLASSIFY "OTHER KIRANA ESSENTIALS" INTO SPECIFIC CONTROLLED CATEGORIES
    # =========================================================================
    print("\n--- 3. Reclassifying 'Other Kirana Essentials' into Specific Categories ---")
    other_mask = df["category"] == "Other Kirana"

    # Avoid moving storage items/containers into food categories
    storage_guard = ~name_lower.str.contains(r"container|dabba|canister|dispenser|rack|stand|holder|set|box|tray|bottle|jug|bowl|flask|chopper", regex=True)

    # Household Cleaning
    cleaning_kw = r"detergent|dishwash|vim|surf\s*excel|ariel|tide|rin|harpic|lysol|colin|dettol.*disinfectant|phenyl|floor\s*cleaner|toilet\s*cleaner|glass\s*cleaner|bleach|scrub\s*sponge|scrubber|scotch\s*brite|broom|wiper|mop|dustbin\s*bag|air\s*freshener|odonil|godrej\s*aer|mosquito|all\s*out|good\s*knight|hit|baygon|cockroach|repellent|liquid\s*detergent|fabric\s*conditioner|comfort|surface\s*cleaner"
    move_category(other_mask & name_lower.str.contains(cleaning_kw, regex=True), "Household Cleaning", "Cleaning Supplies", "Moved from Other Kirana to Household Cleaning")

    # Groceries
    groceries_kw = r"rice|atta|wheat|flour|maida|besan|sooji|rava|dal|toor|moong|urad|chana|rajma|oil\b|ghee|mustard\s*oil|sunflower\s*oil|groundnut\s*oil|olive\s*oil|salt|sugar|jaggery|turmeric|chilli\s*powder|coriander\s*powder|garam\s*masala|jeera|cumin|mustard\s*seeds|clove|cardamom|cinnamon|pepper|hing|asafoetida|papad|pickle|achar|sauce|ketchup|soya\s*sauce|vinegar|mayonnaise|pasta|macaroni|noodle|noodles|vermicelli|sevai|cashew|almond|kismis|raisin|walnut|pista|dates|seeds"
    move_category(other_mask & storage_guard & name_lower.str.contains(groceries_kw, regex=True), "Groceries", "Cooking & Pantry", "Moved from Other Kirana to Groceries")

    # Snacks & Packaged Foods
    snacks_kw = r"biscuit|cookie|rusk|chips|namkeen|bhujia|kurkure|lays|bingo|haldiram|bikaji|snack|chocolate|cadbury|dairy\s*milk|kitkat|munch|perk|five\s*star|candy|toffee|gems|chewing\s*gum|mint|mentos|cake\b|muffin|cream\s*roll|chocos|corn\s*flakes|muesli|oats|quaker|kellogg|popcorn|peanut|chana\s*jor"
    move_category(other_mask & storage_guard & name_lower.str.contains(snacks_kw, regex=True), "Snacks & Packaged Foods", "Snacks & Biscuits", "Moved from Other Kirana to Snacks & Packaged Foods")

    # Beverages
    bev_kw = r"tea\b|chai|coffee|nescafe|bru|tata\s*tea|red\s*label|taj\s*mahal|green\s*tea|juice|real\s*fruit|tropicana|frooti|maaza|slice|coke|coca\s*cola|pepsi|thums\s*up|sprite|fanta|limca|mountain\s*dew|mirinda|appy|squash|syrup|rooh\s*afza|bournvita|horlicks|boost|complan|glucon-d|energy\s*drink|soda|packaged\s*water|mineral\s*water|aquafina|kinley|bisleri"
    move_category(other_mask & storage_guard & name_lower.str.contains(bev_kw, regex=True), "Beverages", "Tea, Coffee & Beverages", "Moved from Other Kirana to Beverages")

    # Dairy & Bakery
    dairy_kw = r"milk\b|curd|dahi|paneer|butter\b|amul\s*butter|cheese|paneer|lassi|buttermilk|chaas|bread\b|brown\s*bread|white\s*bread|pav\b|bun\b|condensed\s*milk|milkmaid|cream\s*fresh|amul\s*fresh\s*cream"
    move_category(other_mask & storage_guard & name_lower.str.contains(dairy_kw, regex=True), "Dairy & Bakery", "Dairy & Bakery", "Moved from Other Kirana to Dairy & Bakery")

    # Pooja & Daily Essentials
    pooja_kw = r"agarbatti|dhoop|incense|camphor|kapoor|pooja\s*oil|diya|cotton\s*wicks|matchbox|match\s*box|homam|sambrani|kumkum|sindoor|chandan|haldi\s*kumkum"
    move_category(other_mask & name_lower.str.contains(pooja_kw, regex=True), "Pooja & Daily Essentials", "Pooja Needs", "Moved from Other Kirana to Pooja & Daily Essentials")

    # Baby Care
    baby_kw = r"diaper|pampers|huggies|mamy\s*poko|baby\s*wipes|wipes\s*baby|cerelac|lactogen|baby\s*food|baby\s*cereal|baby\s*powder|baby\s*soap|baby\s*oil|baby\s*lotion|baby\s*shampoo|johnson.*baby|himalaya\s*baby|sebamed\s*baby|feeding\s*bottle|nipple|sipper"
    move_category(other_mask & name_lower.str.contains(baby_kw, regex=True), "Baby Care", "Baby Care", "Moved from Other Kirana to Baby Care")

    # Personal Care
    pers_kw = r"soap|dove|lux|lifebuoy|dettol\s*soap|pears|santoor|cinthol|medimix|shampoo|clinic\s*plus|head\s*&\s*shoulders|sunsilk|pantene|tresemme|dove\s*shampoo|hair\s*oil|parachute|bajaj\s*almond|dabur\s*amla|navratna|toothpaste|colgate|pepsodent|close\s*up|sensodyne|dabur\s*red|toothbrush|mouthwash|face\s*wash|fair\s*&\s*lovely|glow\s*&\s*lovely|ponds|garnier|himalaya\s*face|body\s*lotion|nivea|vaseline|boroplus|boroline|deodorant|fogg|axe|wild\s*stone|nivea\s*men|shaving|gillette|razor|blade|sanitary\s*pad|whisper|stayfree|sofy"
    move_category(other_mask & name_lower.str.contains(pers_kw, regex=True), "Personal Care", "Bath & Body", "Moved from Other Kirana to Personal Care")

    # Standardize remaining Other Kirana Essentials to legitimate consumable disposables
    df.loc[df["category"] == "Other Kirana", "category"] = "Other Kirana Essentials"
    df.loc[df["category"] == "Other Kirana Essentials", "subcategory"] = "Household Consumables & Disposables"

    # =========================================================================
    # 4. PERSONAL CARE SUBCATEGORIZATION
    # =========================================================================
    print("\n--- 4. Subcategorizing Retained Personal Care Products ---")
    pc_mask = df["_keep"] & (df["category"] == "Personal Care")

    # 1. Oral Care
    oral_regex = r"toothpaste|toothbrush|tooth\s*brush|mouthwash|tongue\s*cleaner|dental\s*floss|colgate|pepsodent|close\s*up|sensodyne|dabur\s*red|meswak|vicco"
    df.loc[pc_mask & name_lower.str.contains(oral_regex, regex=True), "subcategory"] = "Oral Care"

    # 2. Hair Care
    hair_regex = r"shampoo|conditioner|hair\s*oil|hair\s*cream|hair\s*gel|hair\s*serum|hair\s*color|hair\s*dye|mehndi|henna|parachute|sunsilk|head\s*&\s*shoulders|pantene|clinic\s*plus|tresemme|loreal\s*hair|bajaj\s*almond|dabur\s*amla|navratna|indulekha|godrej\s*expert|garnier\s*color"
    df.loc[pc_mask & name_lower.str.contains(hair_regex, regex=True), "subcategory"] = "Hair Care"

    # 3. Men's Grooming
    mens_regex = r"shaving|razor|blade|cartridge|after\s*shave|aftershave|shaving\s*cream|shaving\s*foam|shaving\s*gel|shaving\s*brush|beard\s*brush|gillette|beardo|ustraa|bombay\s*shaving|men\s*face\s*wash|men\s*deo|garnier\s*men|nivea\s*men|park\s*avenue\s*men|men\s*expert"
    df.loc[pc_mask & name_lower.str.contains(mens_regex, regex=True), "subcategory"] = "Men's Grooming"

    # 4. Feminine Hygiene
    fem_regex = r"sanitary\s*pad|sanitary\s*napkin|whisper|stayfree|sofy|kotex|carefree|panty\s*liner|tampon|intimate\s*wash|v-wash|vwash|pee\s*safe"
    df.loc[pc_mask & name_lower.str.contains(fem_regex, regex=True), "subcategory"] = "Feminine Hygiene"

    # 5. Deodorants & Fragrance
    deo_regex = r"deodorant|deo\b|body\s*spray|perfume|attar|itr\b|fogg|axe|wild\s*stone|engage|fog\b|nivea\s*deo|yardley|secret\s*temptation|layer'r|denver"
    df.loc[pc_mask & name_lower.str.contains(deo_regex, regex=True), "subcategory"] = "Deodorants & Fragrance"

    # 6. Skin Care
    skin_regex = r"face\s*wash|facewash|face\s*scrub|face\s*pack|face\s*cream|moisturizer|moisturiser|cold\s*cream|body\s*lotion|body\s*milk|sunscreen|sun\s*block|petroleum\s*jelly|vaseline|boroline|boroplus|lip\s*balm|ponds|nivea\s*body|fair\s*&\s*lovely|glow\s*&\s*lovely|garnier\s*skin|himalaya\s*skin|clean\s*&\s*clear|lacto\s*calamine|rose\s*water|gulabari|glycerin"
    df.loc[pc_mask & name_lower.str.contains(skin_regex, regex=True), "subcategory"] = "Skin Care"

    # 7. Bath & Body (Default for soap, body wash, handwash, talc, cotton, sponges)
    bath_body_regex = r"soap|bathing\s*bar|body\s*wash|shower\s*gel|hand\s*wash|handwash|sanitizer|hand\s*rub|talcum|talc\b|cotton|loofah|sponge|lifebuoy|dettol|lux|dove|pears|santoor|cinthol|medimix|fiama|palmolive|mysore\s*sandal|godrej\s*no\.?1|fem\b"
    df.loc[pc_mask & (name_lower.str.contains(bath_body_regex, regex=True) | df["subcategory"].isna() | ~df["subcategory"].isin(["Oral Care", "Hair Care", "Men's Grooming", "Feminine Hygiene", "Deodorants & Fragrance", "Skin Care"])), "subcategory"] = "Bath & Body"

    # =========================================================================
    # 5. FINAL SPLIT & DEDUPLICATION
    # =========================================================================
    print("\n--- 5. Final Split & Output Generation ---")

    kept_df = df[df["_keep"]].copy()
    removed_df = df[~df["_keep"]].copy()
    moved_df = df[df["_reclassified"] & df["_keep"]].copy()

    # Deduplicate exact rows on kept_df
    exact_dups = kept_df.duplicated().sum()
    if exact_dups > 0:
        print(f"Removing {exact_dups} exact duplicate rows...")
        kept_df = kept_df.drop_duplicates()

    # Drop intermediate helper columns for final clean output
    export_cols = [c for c in df.columns if not c.startswith("_")]
    final_df = kept_df[export_cols].copy()

    # Save output CSVs
    final_df.to_csv(FINAL_PATH, index=False)
    print(f"Saved Final Dataset: {FINAL_PATH} ({len(final_df)} rows)")

    removed_export_df = removed_df[["product_name", "brand", "_original_category", "_original_subcategory", "sale_price", "mrp", "_removal_reason"]].copy()
    removed_export_df.columns = ["product_name", "brand", "original_category", "original_subcategory", "sale_price", "mrp", "removal_reason"]
    removed_export_df.to_csv(REMOVED_PATH, index=False)
    print(f"Saved Removed Dataset: {REMOVED_PATH} ({len(removed_export_df)} rows)")

    moved_export_df = moved_df[["product_name", "brand", "_original_category", "category", "_original_subcategory", "subcategory", "_move_reason"]].copy()
    moved_export_df.columns = ["product_name", "brand", "original_category", "new_category", "original_subcategory", "new_subcategory", "move_reason"]
    moved_export_df.to_csv(MOVED_PATH, index=False)
    print(f"Saved Moved Dataset: {MOVED_PATH} ({len(moved_export_df)} rows)")

    # =========================================================================
    # 6. AUDIT & SUMMARY REPORT
    # =========================================================================
    print("\n" + "=" * 60)
    print("FINAL AUDIT REPORT — SECOND PASS REFINEMENT")
    print("=" * 60)

    print(f"Original first-pass dataset: {original_count}")
    print(f"Final retained:               {len(final_df)}")
    print(f"Removed in second pass:       {len(removed_export_df)}")
    print(f"Moved/reclassified:           {len(moved_export_df)}")
    print(f"Exact duplicates removed:     {exact_dups}")
    print()

    pc_before = (df["_original_category"] == "Personal Care").sum()
    pc_after = (final_df["category"] == "Personal Care").sum()
    print(f"Personal Care before: {pc_before}")
    print(f"Personal Care after:  {pc_after}")
    print()

    other_before = (df["_original_category"] == "Other Kirana").sum()
    other_after = (final_df["category"] == "Other Kirana Essentials").sum()
    print(f"Other Kirana before: {other_before}")
    print(f"Other Kirana after:  {other_after}")
    print()

    print("Final Category Distribution:")
    cat_counts = final_df["category"].value_counts()
    for cat, count in cat_counts.items():
        pct = (count / len(final_df)) * 100
        print(f"  {cat:<26} {count:>5} ({pct:>5.1f}%)")

    print("\nPersonal Care Subcategory Distribution:")
    pc_subcat_counts = final_df[final_df["category"] == "Personal Care"]["subcategory"].value_counts()
    for subcat, count in pc_subcat_counts.items():
        pct = (count / pc_after) * 100
        print(f"  {subcat:<26} {count:>5} ({pct:>5.1f}%)")

    print("\nTop Removal Reasons Breakdown:")
    print(removed_export_df["removal_reason"].value_counts().to_string())

if __name__ == "__main__":
    main()
