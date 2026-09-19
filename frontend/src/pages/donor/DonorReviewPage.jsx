import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import DonorShell from "./DonorShell";
import { getReviewItemsKey } from "./donorUtils";

const DONATION_CATEGORIES = [
  "clothing",
  "food",
  "books",
  "electronics",
  "furniture",
  "utensils",
];

export default function DonorReviewPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState(() => {
    const stored = localStorage.getItem(getReviewItemsKey(user?.id));
    return stored ? JSON.parse(stored) : [];
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const updateItem = (index, field, value) =>
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [field]: field === "quantity" ? Number(value) : value,
              needs_review: true,
            }
          : item,
      ),
    );
  const removeItem = (index) =>
    setItems((current) =>
      current.filter((_, itemIndex) => itemIndex !== index),
    );
  const submitDonation = async (event) => {
    event.preventDefault();
    setError("");
    if (
      !items.length ||
      items.some((item) => !item.class_name || item.quantity < 1)
    )
      return setError(
        "Add at least one item with a quantity greater than zero.",
      );
    setLoading(true);
    try {
      const donation = await api.createDonation(
        items.map(({ class_name, quantity, confidence }) => ({
          class_name,
          quantity,
          confidence,
        })),
      );
      localStorage.removeItem(getReviewItemsKey(user?.id));
      navigate(`/donor/donations/${donation.id}`, { replace: true });
    } catch (err) {
      setError(err.message || "The donation could not be submitted.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <DonorShell>
      <div className="page-header">
        <div>
          <p className="eyebrow">Review donation</p>
          <h1>Check detected items</h1>
        </div>
      </div>
      {!items.length ? (
        <div className="empty-state">
          No detected items are waiting for review. Start with an image scan.
        </div>
      ) : null}
      <form className="table-list" onSubmit={submitDonation}>
        {items.map((item, index) => (
          <div
            key={`${item.class_name}-${index}`}
            className="table-row review-row"
          >
            <label>
              Category
              <select
                value={item.class_name}
                onChange={(event) =>
                  updateItem(index, "class_name", event.target.value)
                }
                required
              >
                {DONATION_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Quantity
              <input
                type="number"
                min="1"
                value={item.quantity}
                onChange={(event) =>
                  updateItem(index, "quantity", event.target.value)
                }
                required
              />
            </label>
            <span>
              {item.needs_review
                ? "Needs review"
                : `${Math.round((item.confidence || 0) * 100)}% confidence`}
            </span>
            <button
              type="button"
              className="secondary-button"
              onClick={() => removeItem(index)}
            >
              Remove
            </button>
          </div>
        ))}
        {error ? <div className="error-box">{error}</div> : null}
        {items.length ? (
          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? "Submitting..." : "Submit donation"}
          </button>
        ) : null}
      </form>
    </DonorShell>
  );
}
