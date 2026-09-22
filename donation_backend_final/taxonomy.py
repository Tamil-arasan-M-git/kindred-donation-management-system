"""Single source of truth for donation item category normalization."""

from __future__ import annotations

from typing import Any


CATEGORIES = {"clothing", "food", "books", "electronics", "furniture", "utensils"}

# These are the classes read from the currently installed custom model.  The
# model's ``names`` remain authoritative; this mapping only supplies the
# application's parent category for each returned model class.
MODEL_CLASS_TO_TAXONOMY = {
    "shirt": {"category": "clothing", "subcategory": "shirt"},
    "pants": {"category": "clothing", "subcategory": "pants"},
    "dress": {"category": "clothing", "subcategory": "dress"},
    "shoe": {"category": "clothing", "subcategory": "shoe"},
    "bag": {"category": "clothing", "subcategory": "bag"},
    "other_clothing": {"category": "clothing", "subcategory": "other_clothing"},
    "food": {"category": "food", "subcategory": "food"},
    "books": {"category": "books", "subcategory": "books"},
    "phone": {"category": "electronics", "subcategory": "phone"},
    "laptop": {"category": "electronics", "subcategory": "laptop"},
    "tv": {"category": "electronics", "subcategory": "tv"},
    "other_electronics": {"category": "electronics", "subcategory": "other_electronics"},
    "chair": {"category": "furniture", "subcategory": "chair"},
    "table": {"category": "furniture", "subcategory": "table"},
    "sofa": {"category": "furniture", "subcategory": "sofa"},
    "other_furniture": {"category": "furniture", "subcategory": "other_furniture"},
    "cup": {"category": "utensils", "subcategory": "cup"},
    "plate": {"category": "utensils", "subcategory": "plate"},
    "bowl": {"category": "utensils", "subcategory": "bowl"},
    "bottle": {"category": "utensils", "subcategory": "bottle"},
    "other_utensils": {"category": "utensils", "subcategory": "other_utensils"},
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
