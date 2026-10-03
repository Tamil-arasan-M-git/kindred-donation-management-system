export const getReviewItemsKey = (userId) =>
  `kindred_review_items_${userId || "anonymous"}`;

export const normalizeDetectionItems = (items = []) =>
  items.map((item) => ({
    class_name: item.class_name || item.class || "",
    category: item.category || item.class || item.class_name || "",
    subcategory: item.subcategory || "",
    quantity: Math.max(1, Number(item.quantity) || 1),
    confidence: item.confidence == null ? null : Number(item.confidence),
    needs_review: Boolean(item.needs_review),
    was_edited_by_donor: Boolean(item.was_edited_by_donor),
  }));

const itemTranslationKey = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  const aliases = {
    electronic: "electronics",
    clothing: "clothing",
    clothes: "clothing",
    book: "books",
    toy: "toys",
    furniture: "furniture",
    utensil: "utensils",
    phone: "phone",
    smartphone: "phone",
    keyboard: "keyboard",
  };
  return aliases[normalized] || normalized.replace(/\s+/g, "_");
};

export const formatDonationItem = (item, t) => {
  const rawCategory = item.category || item.class_name || "Item";
  const category = t
    ? t(`categories.${itemTranslationKey(rawCategory)}`, {
        defaultValue: rawCategory,
      })
    : rawCategory;
  const rawSubcategory = item.subcategory;
  const subcategory =
    rawSubcategory && t
      ? t(`categories.${itemTranslationKey(rawSubcategory)}`, {
          defaultValue: rawSubcategory,
        })
      : rawSubcategory;
  const label =
    subcategory && rawSubcategory !== rawCategory
      ? `${category} / ${subcategory}`
      : category;
  return `${label} × ${item.quantity}`;
};
