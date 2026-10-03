from inference_pipeline import DetectedBox, ItemDetector, to_json
from schemas import DemandCreate, DonationItemRequest
from taxonomy import (
    MODEL_CLASS_TO_TAXONOMY,
    normalize_model_class,
    subcategories_compatible,
    taxonomy_for_class,
)


def test_all_verified_model_classes_have_expected_taxonomy():
    assert len(MODEL_CLASS_TO_TAXONOMY) == 81
    assert normalize_model_class("shirt") == {"category": "clothing", "subcategory": "shirt"}
    assert normalize_model_class("computer") == {"category": "electronics", "subcategory": "computer"}
    assert normalize_model_class("book") == {"category": "books", "subcategory": "book"}
    assert normalize_model_class("apple") == {"category": "food", "subcategory": "apple"}
    assert normalize_model_class("chair") == {"category": "furniture", "subcategory": "chair"}
    assert normalize_model_class("cooking-pot") == {"category": "utensils", "subcategory": "cooking-pot"}
    assert normalize_model_class("sneakers") == {"category": "clothing", "subcategory": "sneakers"}


def test_unknown_class_is_safe_and_requires_review():
    result = taxonomy_for_class("unexpected_item")
    assert result == {
        "category": None,
        "subcategory": "unexpected_item",
        "known": False,
    }


def test_aggregation_keeps_subcategories_separate_and_counts_same_class():
    boxes = [
        DetectedBox("shirt", "clothing", "shirt", True, 0.9, [0, 0, 1, 1]),
        DetectedBox("shirt", "clothing", "shirt", True, 0.8, [1, 1, 2, 2]),
        DetectedBox("pants", "clothing", "pants", True, 0.95, [2, 2, 3, 3]),
    ]
    result = {item["class_name"]: item for item in to_json(ItemDetector._aggregate(boxes))}
    assert result["shirt"]["quantity"] == 2
    assert result["shirt"]["subcategory"] == "shirt"
    assert result["pants"]["quantity"] == 1
    assert result["pants"]["subcategory"] == "pants"


def test_request_validation_accepts_category_only_and_valid_pair():
    assert DemandCreate(class_name="clothing", subcategory=None, quantity_needed=5, priority=1)
    assert DonationItemRequest(class_name="clothing", subcategory="shirt", quantity=1)


def test_matching_subcategory_rules():
    assert subcategories_compatible("shirt", "shirt")
    assert not subcategories_compatible("shirt", "pants")
    assert subcategories_compatible("shirt", None)


def test_donation_update_category_resolution():
    req_item = DonationItemRequest(class_name="shirt", quantity=2)
    taxonomy = normalize_model_class(req_item.class_name)
    category = req_item.category if req_item.category else (taxonomy["category"] if taxonomy else req_item.class_name)
    assert category == "clothing"
    assert req_item.subcategory == "shirt"
