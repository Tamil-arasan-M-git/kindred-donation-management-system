import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/client";
import EmptyState from "../../components/common/EmptyState";
import LoadingState from "../../components/common/LoadingState";
import PageHeader from "../../components/layout/PageHeader";
import { loadCurrentNgo } from "./ngoUtils";
import NGOShell from "./NGOShell";
import demandsBanner from "../../assets/ngo-demands-banner.jpg";
import demandLeaves from "../../assets/ngo-donation-detail-leaves.png";
import "./NGODemandsPage.css";

const defaultForm = () => ({
  class_name: "",
  subcategory: "",
  quantity_needed: "",
  priority: 3,
  expiry_date: "",
});

const asList = (payload) =>
  Array.isArray(payload) ? payload : payload?.demands || [];
const iconForCategory = (category = "") => {
  const name = String(category).toLowerCase();
  if (name.includes("food") || name.includes("utensil"))
    return "fi-rr-utensils";
  if (name.includes("book") || name.includes("education"))
    return "fi-rr-book-alt";
  if (name.includes("electronic") || name.includes("phone"))
    return "fi-rr-laptop";
  if (name.includes("cloth") || name.includes("wear")) return "fi-rr-shirt";
  if (name.includes("health") || name.includes("medical")) return "fi-rr-heart";
  if (name.includes("furniture")) return "fi-rr-couch";
  return "fi-rr-box-open";
};

const normalizedCategory = (category = "") => {
  const name = String(category).trim().toLowerCase();
  if (["clothes", "clothing", "wear"].some((value) => name.includes(value)))
    return "clothing";
  if (["books", "book", "education"].some((value) => name.includes(value)))
    return "books";
  if (name.includes("utensil")) return "utensils";
  if (name.includes("furniture")) return "furniture";
  if (name.includes("food")) return "food";
  if (name.includes("electronic")) return "electronics";
  return "other";
};

const categoryFilters = [
  "all",
  "food",
  "books",
  "utensils",
  "clothing",
  "furniture",
  "electronics",
];
const demandSubcategories = {
  clothing: ["shirt", "pants", "dress", "shoe", "bag", "other_clothing"],
  food: ["food"],
  books: ["books"],
  utensils: ["cup", "plate", "bowl", "bottle", "other_utensils"],
  furniture: ["chair", "table", "sofa", "other_furniture"],
  electronics: ["phone", "laptop", "tv", "other_electronics"],
};
const priorityLabels = {
  1: "low",
  2: "belowAverage",
  3: "normal",
  4: "high",
  5: "urgent",
};

const optionLabel = (value) => String(value).replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const fulfillmentStatusLabel = (status, tDemand) => {
  const labels = {
    active: tDemand("statusActive", "Active"),
    partially_fulfilled: tDemand("statusPartiallyFulfilled", "Partially Fulfilled"),
    fulfilled: tDemand("statusFulfilled", "Fulfilled"),
    expired: tDemand("statusExpired", "Expired"),
  };
  return labels[status] || labels.active;
};

const fulfillmentStatusClass = (status) =>
  ["active", "partially_fulfilled", "fulfilled", "expired"].includes(status)
    ? status
    : "active";

const fulfillmentValues = (demand) => {
  const needed = Number(demand.quantity_needed) || 0;
  const fulfilled = Number(demand.quantity_fulfilled) || 0;
  const remaining = Math.max(0, Number(demand.quantity_remaining ?? needed) || 0);
  const percentage = needed > 0
    ? Math.min(100, Math.max(0, (fulfilled / needed) * 100))
    : 0;
  return {
    needed,
    fulfilled,
    remaining,
    percentage,
    status: demand.fulfillment_status || "active",
  };
};

export default function NGODemandsPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [ngo, setNgo] = useState(null);
  const [demands, setDemands] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [editForm, setEditForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const closeEdit = useCallback(() => {
    setEditingId("");
    setEditForm(defaultForm());
    setError("");
  }, []);

  const loadDemands = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const currentNgo = await loadCurrentNgo(user.email);
      setNgo(currentNgo);
      setDemands(asList(await api.get(`/api/ngos/${currentNgo.id}/demands`)));
    } catch (err) {
      setError(t("errors.generic"));
    } finally {
      setLoading(false);
    }
  }, [user.email, t]);

  useEffect(() => {
    loadDemands();
  }, [loadDemands]);

  useEffect(() => {
    if (!editingId) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape" && !saving) closeEdit();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [editingId, saving, closeEdit]);

  const payloadFor = (values) => ({
    class_name: values.class_name.trim(),
    subcategory: values.subcategory.trim() || null,
    quantity_needed: Number(values.quantity_needed),
    priority: Number(values.priority),
    expiry_date: values.expiry_date || null,
  });

  const createDemand = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!form.class_name.trim() || Number(form.quantity_needed) < 1) {
      setError(t("validation.checkFields"));
      return;
    }
    setSaving(true);
    try {
      await api.post(`/api/ngos/${ngo.id}/demands`, payloadFor(form));
      setForm(defaultForm());
      await loadDemands();
      setNotice(t("common.success"));
    } catch (err) {
      setError(t("errors.generic"));
    } finally {
      setSaving(false);
    }
  };

  const editDemand = (demand) => {
    setEditingId(demand.id);
    setEditForm({
      class_name: demand.class_name || "",
      subcategory: demand.subcategory || "",
      quantity_needed: demand.quantity_needed ?? 1,
      priority: demand.priority ?? 3,
      expiry_date: demand.expiry_date || "",
    });
    setError("");
  };

  const updateDemand = async (event) => {
    event.preventDefault();
    if (!editingId) return;
    if (!editForm.class_name.trim() || Number(editForm.quantity_needed) < 1) {
      setError(t("validation.checkFields"));
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await api.put(`/api/demands/${editingId}`, payloadFor(editForm));
      await loadDemands();
      closeEdit();
      setNotice(t("common.success"));
    } catch (err) {
      setError(t("errors.generic"));
    } finally {
      setSaving(false);
    }
  };

  const deleteDemand = async (demandId) => {
    if (
      !window.confirm(
        t("ngo.demands.deleteConfirm", {
          defaultValue: "Delete this demand? This cannot be undone.",
        }),
      )
    )
      return;
    setDeletingId(demandId);
    setError("");
    setNotice("");
    try {
      await api.del(`/api/demands/${demandId}`);
      setDemands((current) =>
        current.filter((demand) => demand.id !== demandId),
      );
      setNotice(t("common.success"));
    } catch (err) {
      setError(t("errors.generic"));
    } finally {
      setDeletingId("");
    }
  };

  const tDemand = (key, fallback) =>
    t(`ngo.demands.${key}`, { defaultValue: fallback });
  const tCategory = (value) =>
    t(`categories.${String(value || "").toLowerCase()}`, {
      defaultValue: value || tDemand("notSpecified", "Not specified"),
    });
  const filterLabel = (value) =>
    value === "all"
      ? t("common.all")
      : tCategory(value);

  const visibleDemands = demands.filter((demand) => {
    const text =
      `${demand.class_name || ""} ${demand.subcategory || ""}`.toLowerCase();
    const matchesSearch = text.includes(search.trim().toLowerCase());
    if (!matchesSearch) return false;
    if (categoryFilter === "all") return true;
    const category = normalizedCategory(demand.class_name);
    return category === categoryFilter;
  });

  return (
    <NGOShell>
      <PageHeader
        eyebrow={t("navigation.demands")}
        title={t("ngo.demands.title")}
        description={t("ngo.demands.description", {
          defaultValue: "Publish and manage your resource requirements.",
        })}
        action={
          <img
            className="ngo-demands-header-art"
            src={demandsBanner}
            alt=""
            aria-hidden="true"
          />
        }
        actionClassName="ngo-demands-header-action"
      />

      {error && !editingId ? <div className="error-box">{error}</div> : null}
      {notice ? <div className="success-box">{notice}</div> : null}

      <section className="ngo-demands-create-card">
        <img
          className="ngo-demands-leaf"
          src={demandLeaves}
          alt=""
          aria-hidden="true"
        />
        <div className="ngo-demands-section-heading">
          <div>
            <h2>
              <i className="fi fi-rr-folder-plus" aria-hidden="true" />
              {tDemand("createTitle", "Add New Demand")}
            </h2>
            <p>
              {tDemand(
                "createDescription",
                "Let donors know what resources you need.",
              )}
            </p>
          </div>
        </div>
        <form className="ngo-demands-form" onSubmit={createDemand}>
          <label>
            <span>{tDemand("category", "Category")}</span>
            <span className="ngo-demand-input-wrap">
              <i
                className={`fi ${iconForCategory(form.class_name)}`}
                aria-hidden="true"
              />
              <select
                value={form.class_name}
                onChange={(event) => setForm({ ...form, class_name: event.target.value, subcategory: "" })}
                required
              >
                <option value="" disabled>{tDemand("categoryPlaceholder", "Select category")}</option>
                {categoryFilters.filter((value) => value !== "all").map((value) => <option key={value} value={value}>{optionLabel(value)}</option>)}
              </select>
            </span>
          </label>
          <label>
            <span>{tDemand("subcategory", "Subcategory (optional)")}</span>
            <span className="ngo-demand-input-wrap">
              <i className="fi fi-rr-tag" aria-hidden="true" />
              <select
                value={form.subcategory}
                onChange={(event) => setForm({ ...form, subcategory: event.target.value })}
                disabled={!form.class_name}
              >
                <option value="">{tDemand("notSpecified", "Not specified")}</option>
                {(demandSubcategories[form.class_name] || []).map((value) => <option key={value} value={value}>{optionLabel(value)}</option>)}
              </select>
            </span>
          </label>
          <label>
            <span>{tDemand("quantityNeeded", "Quantity Needed")}</span>
            <span className="ngo-demand-input-wrap">
              <i className="fi fi-rr-box" aria-hidden="true" />
              <input
                type="number"
                min="1"
                value={form.quantity_needed}
                onChange={(event) =>
                  setForm({ ...form, quantity_needed: event.target.value })
                }
                placeholder={tDemand("quantityPlaceholder", "Enter quantity")}
                required
              />
            </span>
          </label>
          <label>
            <span>{tDemand("priority", "Priority (1 = Low, 5 = Urgent)")}</span>
            <span className="ngo-demand-input-wrap">
              <i className="fi fi-rr-flag" aria-hidden="true" />
              <select
                value={form.priority}
                onChange={(event) =>
                  setForm({ ...form, priority: event.target.value })
                }
              >
                {[1, 2, 3, 4, 5].map((priority) => (
                  <option key={priority} value={priority}>
                    {priority} · {priorityLabels[priority]}
                  </option>
                ))}
              </select>
            </span>
          </label>
          <label className="ngo-demand-needed-until">
            <span>{tDemand("neededUntil", "Needed Until")}</span>
            <span className="ngo-demand-input-wrap">
              <i className="fi fi-rr-calendar" aria-hidden="true" />
              <input
                type="date"
                min={new Date().toISOString().slice(0, 10)}
                value={form.expiry_date}
                onChange={(event) =>
                  setForm({ ...form, expiry_date: event.target.value })
                }
              />
            </span>
          </label>
          <div className="ngo-demands-form-actions">
            <button
              type="submit"
              className="primary-button"
              disabled={saving || !ngo}
            >
              <i className="fi fi-rr-plus" aria-hidden="true" />
              {saving ? t("common.loading") : t("ngo.demands.addDemand")}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setForm(defaultForm())}
              disabled={saving}
            >
              {tDemand("clear", "Clear")}
            </button>
          </div>
        </form>
      </section>

      <section className="ngo-demands-list-section">
        <div className="ngo-demands-list-heading">
          <div className="ngo-demands-section-heading">
            <span className="ngo-demands-heading-icon">
              <i className="fi fi-rr-list" aria-hidden="true" />
            </span>
            <div>
              <h2>{tDemand("yourDemands", "Your Demands")}</h2>
              <p>
                {tDemand(
                  "manageDescription",
                  "Manage, edit or remove your published demands.",
                )}
              </p>
            </div>
          </div>
          <label className="ngo-demands-search">
            <i className="fi fi-rr-search" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={tDemand("search", "Search demands...")}
              aria-label={tDemand("search", "Search demands...")}
            />
          </label>
        </div>
        <nav
          className="ngo-demands-filters"
          aria-label={tDemand("filtersLabel", "Filter demands by category")}
        >
          {categoryFilters.map((value) => (
            <button
              type="button"
              key={value}
              className={`filter-button ${categoryFilter === value ? "selected" : ""}`}
              aria-pressed={categoryFilter === value}
              onClick={() => setCategoryFilter(value)}
            >
              {filterLabel(value)}
            </button>
          ))}
        </nav>
        {loading ? <LoadingState message={t("common.loading")} /> : null}
        {!loading && !visibleDemands.length ? (
          <EmptyState
            title={
              demands.length
                ? tDemand("noResults", "No demands match your filters")
                : t("ngo.demands.empty")
            }
          >
            {demands.length
              ? tDemand(
                  "noResultsDescription",
                  "Try a different search or category.",
                )
              : tDemand(
                  "emptyDescription",
                  "Create demands to let donors know what items your organization needs.",
                )}
          </EmptyState>
        ) : null}
        {!loading && visibleDemands.length ? (
          <div className="ngo-demands-grid">
            {visibleDemands.map((demand) => (
              <article key={demand.id} className="ngo-demand-card">
                {(() => {
                  const fulfillment = fulfillmentValues(demand);
                  return (
                    <>
                <header className="ngo-demand-card-header">
                  <h3>{tCategory(demand.class_name)}</h3>
                  <span
                    className={`ngo-demand-category-icon ngo-demand-category-${normalizedCategory(demand.class_name)}`}
                  >
                    <i
                      className={`fi ${iconForCategory(demand.class_name)}`}
                      aria-hidden="true"
                    />
                  </span>
                </header>
                <dl className="ngo-demand-details">
                  <div>
                    <dt>
                      <i className="fi fi-rr-tag" aria-hidden="true" />
                      {tDemand("subcategoryShort", "Subcategory (optional)")}
                    </dt>
                    <dd>
                      {demand.subcategory ||
                        tDemand("notSpecified", "Not specified")}
                    </dd>
                  </div>
                  <div>
                    <dt>
                      <i className="fi fi-rr-box" aria-hidden="true" />
                      {tDemand("quantityNeeded", "Quantity needed")}
                    </dt>
                    <dd>{demand.quantity_needed}</dd>
                  </div>
                  <div>
                    <dt>
                      <i className="fi fi-rr-flag" aria-hidden="true" />
                      {tDemand("priorityShort", "Priority")}
                    </dt>
                    <dd>
                      <span
                        className={`ngo-demand-priority ngo-demand-priority-${demand.priority}`}
                      >
                        {demand.priority} ·{" "}
                        {priorityLabels[demand.priority] || "Normal"}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt>
                      <i className="fi fi-rr-calendar" aria-hidden="true" />
                      {tDemand("neededUntil", "Needed Until")}
                    </dt>
                    <dd>
                      {demand.expiry_date || tDemand("noExpiry", "No expiry")}
                    </dd>
                  </div>
                </dl>
                <section className="ngo-demand-fulfillment" aria-label={tDemand("fulfillment", "Fulfillment")}>
                  <div className="ngo-demand-fulfillment-heading">
                    <span>{tDemand("fulfillment", "Fulfillment")}</span>
                    <strong className={`ngo-demand-status ngo-demand-status-${fulfillmentStatusClass(fulfillment.status)}`}>
                      {fulfillmentStatusLabel(fulfillment.status, tDemand)}
                    </strong>
                  </div>
                  <div className="ngo-demand-fulfillment-values">
                    <span><small>{tDemand("required", "Required")}</small><strong>{fulfillment.needed}</strong></span>
                    <span><small>{tDemand("fulfilled", "Fulfilled")}</small><strong>{fulfillment.fulfilled}</strong></span>
                    <span><small>{tDemand("remaining", "Remaining")}</small><strong>{fulfillment.remaining}</strong></span>
                  </div>
                  <div className="ngo-demand-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(fulfillment.percentage)} aria-label={`${Math.round(fulfillment.percentage)}% ${tDemand("fulfilled", "fulfilled")}`}>
                    <span style={{ width: `${fulfillment.percentage}%` }} />
                  </div>
                  <span className="ngo-demand-progress-label">{Math.round(fulfillment.percentage)}% {tDemand("fulfilled", "fulfilled").toLowerCase()}</span>
                </section>
                <div className="ngo-demand-card-actions">
                  <button
                    type="button"
                    className="ngo-demand-edit-button"
                    onClick={() => editDemand(demand)}
                    disabled={Boolean(deletingId)}
                  >
                    <i className="fi fi-rr-edit" aria-hidden="true" />
                    {t("common.edit")}
                  </button>
                  <button
                    type="button"
                    className="ngo-demand-delete-button"
                    onClick={() => deleteDemand(demand.id)}
                    disabled={Boolean(deletingId)}
                  >
                    <i className="fi fi-rr-trash" aria-hidden="true" />
                    {deletingId === demand.id
                      ? t("common.loading")
                      : t("common.delete")}
                  </button>
                </div>
                    </>
                  );
                })()}
              </article>
            ))}
          </div>
        ) : null}
      </section>

      {editingId ? (
        <div
          className="ngo-demand-drawer-backdrop"
          onMouseDown={(event) =>
            event.target === event.currentTarget && !saving && closeEdit()
          }
        >
          <aside
            className="ngo-demand-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ngo-demand-drawer-title"
          >
            <header className="ngo-demand-drawer-header">
              <div>
                <h2 id="ngo-demand-drawer-title">
                  {tDemand("editTitle", "Edit Demand")}
                </h2>
                <p>
                  {tDemand(
                    "editDescription",
                    "Update the details of your resource requirement.",
                  )}
                </p>
              </div>
              <button
                type="button"
                aria-label={t("common.close")}
                onClick={closeEdit}
                disabled={saving}
              >
                <i className="fi fi-rr-cross-small" aria-hidden="true" />
              </button>
            </header>
            {error ? <div className="error-box">{error}</div> : null}
            <form className="ngo-demand-edit-form" onSubmit={updateDemand}>
              <label>
                <span>{tDemand("category", "Category")}</span>
                <span className="ngo-demand-input-wrap">
                  <i
                    className={`fi ${iconForCategory(editForm.class_name)}`}
                    aria-hidden="true"
                  />
                  <select
                    autoFocus
                    value={editForm.class_name}
                    onChange={(event) => setEditForm({ ...editForm, class_name: event.target.value, subcategory: "" })}
                    required
                  >
                    {categoryFilters.filter((value) => value !== "all").map((value) => <option key={value} value={value}>{optionLabel(value)}</option>)}
                  </select>
                </span>
              </label>
              <label>
                <span>{tDemand("subcategory", "Subcategory (optional)")}</span>
                <span className="ngo-demand-input-wrap">
                  <i className="fi fi-rr-tag" aria-hidden="true" />
                  <select
                    value={editForm.subcategory}
                    onChange={(event) => setEditForm({ ...editForm, subcategory: event.target.value })}
                  >
                    <option value="">{tDemand("notSpecified", "Not specified")}</option>
                    {(demandSubcategories[editForm.class_name] || []).map((value) => <option key={value} value={value}>{optionLabel(value)}</option>)}
                  </select>
                </span>
              </label>
              <label>
                <span>{tDemand("quantityNeeded", "Quantity Needed")}</span>
                <span className="ngo-demand-input-wrap">
                  <i className="fi fi-rr-box" aria-hidden="true" />
                  <input
                    type="number"
                    min="1"
                    value={editForm.quantity_needed}
                    onChange={(event) =>
                      setEditForm({
                        ...editForm,
                        quantity_needed: event.target.value,
                      })
                    }
                    required
                  />
                </span>
              </label>
              <label>
                <span>
                  {tDemand("priority", "Priority (1 = Low, 5 = Urgent)")}
                </span>
                <span className="ngo-demand-input-wrap">
                  <i className="fi fi-rr-flag" aria-hidden="true" />
                  <select
                    value={editForm.priority}
                    onChange={(event) =>
                      setEditForm({ ...editForm, priority: event.target.value })
                    }
                  >
                    {[1, 2, 3, 4, 5].map((priority) => (
                      <option key={priority} value={priority}>
                        {priority} · {priorityLabels[priority]}
                      </option>
                    ))}
                  </select>
                </span>
              </label>
              <label>
                <span>{tDemand("neededUntil", "Needed Until")}</span>
                <span className="ngo-demand-input-wrap">
                  <i className="fi fi-rr-calendar" aria-hidden="true" />
                  <input
                    type="date"
                    min={new Date().toISOString().slice(0, 10)}
                    value={editForm.expiry_date}
                    onChange={(event) =>
                      setEditForm({
                        ...editForm,
                        expiry_date: event.target.value,
                      })
                    }
                  />
                </span>
              </label>
              <div className="ngo-demand-drawer-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeEdit}
                  disabled={saving}
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={saving}
                >
                  <i className="fi fi-rr-disk" aria-hidden="true" />
                  {saving ? t("common.loading") : t("common.save")}
                </button>
              </div>
            </form>
          </aside>
        </div>
      ) : null}
    </NGOShell>
  );
}
