"""Deterministic, category-aware packaging guidance."""

CHECKLISTS = {
    "clothing": ["Wash and dry the clothing", "Fold items neatly", "Pack safely", "Label the package"],
    "food": ["Check the expiry date", "Keep sealed and hygienic", "Separate fragile items", "Label the package"],
    "books": ["Clean the books", "Remove personal documents", "Stack securely", "Pack safely", "Label the package"],
    "electronics": ["Remove personal data", "Include available accessories", "Protect screens and cables", "Pack safely", "Label the package"],
    "furniture": ["Clean the item", "Remove loose parts", "Protect sharp edges", "Secure for transport", "Label the package"],
    "utensils": ["Wash and dry the utensils", "Wrap fragile pieces", "Group items securely", "Pack safely", "Label the package"],
}

DEFAULT_CHECKLIST = ["Inspect the item", "Pack safely", "Label the package"]


def get_packaging_checklist(items):
    """Return one checklist per distinct category without changing database data."""
    categories = []
    for item in items:
        category = item.class_name if hasattr(item, "class_name") else item.get("class_name")
        if category not in categories:
            categories.append(category)
    return {
        "items": [
            {"category": category, "checklist": list(CHECKLISTS.get(category, DEFAULT_CHECKLIST))}
            for category in categories
        ]
    }
