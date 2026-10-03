import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useTranslation } from "react-i18next";
import DonorShell from "./DonorShell";
import { getReviewItemsKey, normalizeDetectionItems } from "./donorUtils";

export default function DonorReviewPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [items, setItems] = useState(() => {
    try {
      const stored = localStorage.getItem(getReviewItemsKey(user?.id));
      return stored ? normalizeDetectionItems(JSON.parse(stored)) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    localStorage.setItem(getReviewItemsKey(user?.id), JSON.stringify(items));
  }, [items, user?.id]);
  const updateItem = (index, field, value) =>
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [field]:
                field === "quantity" ? Math.max(1, Number(value) || 1) : value,
              needs_review: true,
              was_edited_by_donor: true,
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
      items.some(
        (item) =>
          !(item.category || item.class_name) ||
          !Number.isInteger(Number(item.quantity)) ||
          Number(item.quantity) < 1,
      )
    )
      return setError(t("donor.review.invalidItems"));
    setLoading(true);
    try {
      const donation = await api.createDonation(
        items.map((item) => ({
          class_name: item.class_name || item.category,
          category: item.category || item.class_name,
          subcategory: item.subcategory || null,
          quantity: Number(item.quantity),
          confidence: item.confidence,
          needs_review: Boolean(item.needs_review),
          was_edited_by_donor: Boolean(item.was_edited_by_donor),
        })),
      );
      localStorage.removeItem(getReviewItemsKey(user?.id));
      navigate(`/donor/donations/${donation.id}`, { replace: true });
    } catch (err) {
      setError(t("donor.review.submitError"));
    } finally {
      setLoading(false);
    }
  };
  return (
    <DonorShell>
      <div className="page-header">
        <div>
          <p className="eyebrow">{t("donor.review.eyebrow")}</p>
          <h1>{t("donor.review.title")}</h1>
        </div>
      </div>
      {!items.length ? (
        <div className="empty-state">{t("donor.review.empty")}</div>
      ) : null}
      <form className="table-list" onSubmit={submitDonation}>
        {items.map((item, index) => (
          <div
            key={`${item.class_name}-${index}`}
            className="table-row review-row"
          >
            <label>
              {t("donor.review.category", { defaultValue: "Category" })}
              <input
                type="text"
                value={item.category ?? item.class_name ?? ""}
                onChange={(event) =>
                  updateItem(index, "category", event.target.value)
                }
                required
              />
            </label>
            <label>
              {t("donor.review.subcategory", { defaultValue: "Subcategory" })}
              <input
                type="text"
                value={item.subcategory ?? ""}
                onChange={(event) =>
                  updateItem(index, "subcategory", event.target.value)
                }
              />
            </label>
            <label>
              {t("donor.review.count", { defaultValue: "Count" })}
              <input
                type="number"
                min="1"
                step="1"
                value={item.quantity}
                onChange={(event) =>
                  updateItem(index, "quantity", event.target.value)
                }
                required
              />
            </label>
            <div className="review-item-confidence">
              <span>
                {t("donor.review.confidence", {
                  value:
                    item.confidence == null
                      ? t("donor.review.notAvailable", {
                          defaultValue: "Not available",
                        })
                      : `${Math.round(item.confidence * 100)}%`,
                })}
              </span>
              {item.was_edited_by_donor ? (
                <span>
                  {t("donor.review.reviewedByDonor", {
                    defaultValue: "Reviewed by donor",
                  })}
                </span>
              ) : null}
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={() => removeItem(index)}
            >
              {t("donor.review.remove")}
            </button>
          </div>
        ))}
        {error ? <div className="error-box">{error}</div> : null}
        {items.length ? (
          <button type="submit" className="primary-button" disabled={loading}>
            {loading
              ? t("donor.review.submitting")
              : t("donor.review.submitDonation")}
          </button>
        ) : null}
      </form>
    </DonorShell>
  );
}
