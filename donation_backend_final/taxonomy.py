"""Single source of truth for donation item category normalization."""

from __future__ import annotations

from typing import Any


CATEGORIES = {"clothing", "food", "books", "electronics", "furniture", "utensils"}

# These are the classes read from the currently installed custom model.  The
# model's ``names`` remain authoritative; this mapping only supplies the
# application's parent category for each returned model class.
MODEL_CLASS_TO_TAXONOMY = {
    # Books
    "book": {"category": "books", "subcategory": "book"},

    # Clothing
    "sunglass": {"category": "clothing", "subcategory": "sunglass"},
    "hat": {"category": "clothing", "subcategory": "hat"},
    "jacket": {"category": "clothing", "subcategory": "jacket"},
    "shirt": {"category": "clothing", "subcategory": "shirt"},
    "pants": {"category": "clothing", "subcategory": "pants"},
    "shorts": {"category": "clothing", "subcategory": "shorts"},
    "skirt": {"category": "clothing", "subcategory": "skirt"},
    "dress": {"category": "clothing", "subcategory": "dress"},
    "bag": {"category": "clothing", "subcategory": "bag"},
    "shoe": {"category": "clothing", "subcategory": "shoe"},

    # Food
    "apple": {"category": "food", "subcategory": "apple"},
    "banana": {"category": "food", "subcategory": "banana"},
    "carrot": {"category": "food", "subcategory": "carrot"},
    "cucumber": {"category": "food", "subcategory": "cucumber"},
    "lemon": {"category": "food", "subcategory": "lemon"},
    "onion": {"category": "food", "subcategory": "onion"},
    "orange": {"category": "food", "subcategory": "orange"},
    "pepper": {"category": "food", "subcategory": "pepper"},
    "potato": {"category": "food", "subcategory": "potato"},
    "tomato": {"category": "food", "subcategory": "tomato"},

    # Electronics
    "air conditioner": {"category": "electronics", "subcategory": "air conditioner"},
    "computer": {"category": "electronics", "subcategory": "computer"},
    "monitor": {"category": "electronics", "subcategory": "monitor"},

    # Furniture
    "bed": {"category": "furniture", "subcategory": "bed"},
    "cabinet": {"category": "furniture", "subcategory": "cabinet"},
    "carpet": {"category": "furniture", "subcategory": "carpet"},
    "ceiling fan": {"category": "furniture", "subcategory": "ceiling fan"},
    "chair": {"category": "furniture", "subcategory": "chair"},
    "closet": {"category": "furniture", "subcategory": "closet"},
    "cupboard": {"category": "furniture", "subcategory": "cupboard"},
    "dining table": {"category": "furniture", "subcategory": "dining table"},
    "drawer": {"category": "furniture", "subcategory": "drawer"},
    "frame": {"category": "furniture", "subcategory": "frame"},
    "lamp": {"category": "furniture", "subcategory": "lamp"},
    "shelf": {"category": "furniture", "subcategory": "shelf"},
    "sofa": {"category": "furniture", "subcategory": "sofa"},
    "stool": {"category": "furniture", "subcategory": "stool"},
    "table": {"category": "furniture", "subcategory": "table"},
    "wardrobe": {"category": "furniture", "subcategory": "wardrobe"},

    # Footwear
    # Kept under the existing clothing parent category so the
    # database's existing six-category structure does not need to change.
    "boots": {"category": "clothing", "subcategory": "boots"},
    "heels": {"category": "clothing", "subcategory": "heels"},
    "sandals": {"category": "clothing", "subcategory": "sandals"},
    "shoes": {"category": "clothing", "subcategory": "shoes"},
    "slipers": {"category": "clothing", "subcategory": "slipers"},
    "sneakers": {"category": "clothing", "subcategory": "sneakers"},

    # Utensils / kitchen items
    "can-opener": {"category": "utensils", "subcategory": "can-opener"},
    "chopping-board": {"category": "utensils", "subcategory": "chopping-board"},
    "circular-food-container": {"category": "utensils", "subcategory": "circular-food-container"},
    "cooking-pot": {"category": "utensils", "subcategory": "cooking-pot"},
    "cooking-strainer": {"category": "utensils", "subcategory": "cooking-strainer"},
    "dish-cover": {"category": "utensils", "subcategory": "dish-cover"},
    "drinking-glass": {"category": "utensils", "subcategory": "drinking-glass"},
    "eggbeater": {"category": "utensils", "subcategory": "eggbeater"},
    "electric-kettle": {"category": "utensils", "subcategory": "electric-kettle"},
    "food-bowl": {"category": "utensils", "subcategory": "food-bowl"},
    "food-jar": {"category": "utensils", "subcategory": "food-jar"},
    "food-picker": {"category": "utensils", "subcategory": "food-picker"},
    "food-tray": {"category": "utensils", "subcategory": "food-tray"},
    "frying-pan": {"category": "utensils", "subcategory": "frying-pan"},
    "grater": {"category": "utensils", "subcategory": "grater"},
    "kettle": {"category": "utensils", "subcategory": "kettle"},
    "kitchen-knife": {"category": "utensils", "subcategory": "kitchen-knife"},
    "kitchen-turner": {"category": "utensils", "subcategory": "kitchen-turner"},
    "ladle": {"category": "utensils", "subcategory": "ladle"},
    "metal-fork": {"category": "utensils", "subcategory": "metal-fork"},
    "metal-spoon": {"category": "utensils", "subcategory": "metal-spoon"},
    "mini plate": {"category": "utensils", "subcategory": "mini plate"},
    "mug": {"category": "utensils", "subcategory": "mug"},
    "pitcher": {"category": "utensils", "subcategory": "pitcher"},
    "plastic-fork": {"category": "utensils", "subcategory": "plastic-fork"},
    "plastic-spoon": {"category": "utensils", "subcategory": "plastic-spoon"},
    "plate": {"category": "utensils", "subcategory": "plate"},
    "potholder": {"category": "utensils", "subcategory": "potholder"},
    "rectangular-food-container": {"category": "utensils", "subcategory": "rectangular-food-container"},
    "scissor": {"category": "utensils", "subcategory": "scissor"},
    "serving-plate": {"category": "utensils", "subcategory": "serving-plate"},
    "shot-glass": {"category": "utensils", "subcategory": "shot-glass"},
    "tea-cup": {"category": "utensils", "subcategory": "tea-cup"},
    "two-tooth-fork": {"category": "utensils", "subcategory": "two-tooth-fork"},
    "wine-glass": {"category": "utensils", "subcategory": "wine-glass"},
}

def normalize_model_class(class_name: str) -> dict[str, str] | None:
    """Return category/subcategory for a model class, or ``None`` if unknown."""
    key = class_name.strip().lower()
    taxonomy = MODEL_CLASS_TO_TAXONOMY.get(key)
    return dict(taxonomy) if taxonomy else None


def normalize_item(category: str, subcategory: str | None = None) -> dict[str, str | None]:
    """Validate a donor/NGO item pair against the same taxonomy.

    Category-only values remain valid.  A supplied subcategory must belong to
    that category; otherwise callers receive a validation error.
    """
    category = category.strip().lower()
    if category not in CATEGORIES:
        raise ValueError("Unsupported item category")
    if subcategory is None:
        return {"category": category, "subcategory": None}

    subcategory = subcategory.strip().lower()
    taxonomy = normalize_model_class(subcategory)
    if taxonomy is None or taxonomy["category"] != category:
        raise ValueError("Subcategory does not belong to the selected category")
    return taxonomy


def taxonomy_for_class(class_name: str, fallback_category: str | None = None) -> dict[str, Any]:
    """Return safe output fields for detections, including unknown classes."""
    taxonomy = normalize_model_class(class_name)
    if taxonomy:
        return {**taxonomy, "known": True}
    return {
        "category": fallback_category,
        "subcategory": class_name.strip().lower(),
        "known": False,
    }


def subcategories_compatible(donation_subcategory: str | None, demand_subcategory: str | None) -> bool:
    """A category-only demand accepts any subcategory in that category."""
    return demand_subcategory is None or demand_subcategory == donation_subcategory
