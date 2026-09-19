export const getReviewItemsKey = (userId) =>
  `kindred_review_items_${userId || "anonymous"}`;

export const normalizeDetectionItems = (items = []) =>
  items.map((item) => ({
    class_name: item.class_name || item.class,
    quantity: Number(item.quantity) || 0,
    confidence: item.confidence == null ? null : Number(item.confidence),
    needs_review: Boolean(item.needs_review),
  }));
