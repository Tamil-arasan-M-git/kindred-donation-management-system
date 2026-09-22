import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/client";
import EmptyState from "../../components/common/EmptyState";
import LoadingState from "../../components/common/LoadingState";
import PageHeader from "../../components/layout/PageHeader";
import { loadCurrentNgo } from "./ngoUtils";
import NGOShell from "./NGOShell";

const categories = [
  "clothing",
  "food",
  "books",
  "electronics",
  "furniture",
  "utensils",
];

export default function NGODemandsPage() {
  const { user } = useAuth();
  const [ngo, setNgo] = useState(null);
  const [demands, setDemands] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState({
    class_name: "food",
    quantity_needed: 1,
    priority: 3,
    expiry_date: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const loadDemands = async () => {
    setLoading(true);
    try {
      const currentNgo = await loadCurrentNgo(user.email);
      setNgo(currentNgo);
      setDemands(await api.get(`/api/ngos/${currentNgo.id}/demands`));
    } catch (err) {
      setError(err.message || "Demand records could not be loaded.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    loadDemands();
  }, [user.email]);
  const createDemand = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (Number(form.quantity_needed) < 1) {
      setError("Quantity needed must be at least 1.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        quantity_needed: Number(form.quantity_needed),
        priority: Number(form.priority),
        expiry_date: form.expiry_date || null,
      };
      if (editingId) {
        await api.put(`/api/demands/${editingId}`, payload);
        setNotice("Demand updated successfully.");
      } else {
        await api.post(`/api/ngos/${ngo.id}/demands`, payload);
        setNotice("Demand created successfully.");
      }
      setForm({
        class_name: "food",
        quantity_needed: 1,
        priority: 3,
        expiry_date: "",
      });
      setShowForm(false);
      setEditingId("");
      await loadDemands();
    } catch (err) {
      setError(err.message || "The demand could not be created.");
    } finally {
      setSaving(false);
    }
  };
  const deleteDemand = async (demandId) => {
    if (
      !window.confirm(
        "Delete this demand? This may affect future matching and cannot be undone.",
      )
    )
      return;
    setError("");
    setNotice("");
    try {
      await api.del(`/api/demands/${demandId}`);
      await loadDemands();
      setNotice("Demand deleted successfully.");
    } catch (err) {
      setError(err.message || "The demand could not be deleted.");
    }
  };

  const startEditing = (demand) => {
    setEditingId(demand.id);
    setForm({
      class_name: demand.class_name,
      quantity_needed: demand.quantity_needed,
      priority: demand.priority,
      expiry_date: demand.expiry_date || "",
    });
    setShowForm(true);
    setNotice("");
  };
  return (
    <NGOShell>
      <PageHeader
        eyebrow="Needs & Demands"
        title="Demand registry"
        description="Manage the resources your organization currently needs."
        action={
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              setEditingId("");
              setShowForm((current) => !current);
            }}
          >
            {showForm ? "Close form" : "Create demand"}
          </button>
        }
      />
      {error ? <div className="error-box">{error}</div> : null}
      {notice ? <div className="success-box">{notice}</div> : null}
      {showForm && ngo ? (
        <form className="info-card demand-form" onSubmit={createDemand}>
          <label>
            Category
            <select
              value={form.class_name}
              onChange={(event) =>
                setForm({ ...form, class_name: event.target.value })
              }
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label>
            Quantity needed
            <input
              type="number"
              min="1"
              value={form.quantity_needed}
              onChange={(event) =>
                setForm({ ...form, quantity_needed: event.target.value })
              }
              required
            />
          </label>
          <label>
            Priority (1-5)
            <input
              type="number"
              min="1"
              max="5"
              value={form.priority}
              onChange={(event) =>
                setForm({ ...form, priority: event.target.value })
              }
              required
            />
          </label>
          <label>
            Expiry date
            <input
              type="date"
              value={form.expiry_date}
              onChange={(event) =>
                setForm({ ...form, expiry_date: event.target.value })
              }
            />
          </label>
          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? "Saving..." : editingId ? "Update demand" : "Save demand"}
          </button>
        </form>
      ) : null}
      {loading ? <LoadingState message="Loading demand records..." /> : null}
      {!loading && !demands.length ? (
        <EmptyState title="No active demands">
          Create a demand to let the system identify suitable incoming
          donations.
        </EmptyState>
      ) : null}
      {!loading && demands.length ? (
        <div className="table-list">
          {demands.map((demand) => (
            <div key={demand.id} className="table-row donation-row">
              <span>{demand.class_name}</span>
              <span>{demand.quantity_needed} needed</span>
              <span className="status-pill status-matched">
                Priority {demand.priority}
              </span>
              <button
                type="button"
                className="secondary-button"
                onClick={() => startEditing(demand)}
              >
                Edit
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => deleteDemand(demand.id)}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </NGOShell>
  );
}
