import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/client";
import ErrorMessage from "../../components/common/ErrorMessage";
import LoadingState from "../../components/common/LoadingState";
import PageHeader from "../../components/layout/PageHeader";
import { loadCurrentNgo } from "./ngoUtils";
import NGOShell from "./NGOShell";

export default function NGOProfilePage() {
  const { user } = useAuth();
  const [ngo, setNgo] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadProfile = async () => {
    setLoading(true);
    try {
      const currentNgo = await loadCurrentNgo(user.email);
      const profile = await api.get(`/api/ngos/${currentNgo.id}`);
      setNgo(profile);
      setForm({
        name: profile.name || "",
        contact_email: profile.contact_email || "",
        contact_phone: profile.contact_phone || "",
        address: profile.address || "",
        city: profile.city || "",
        latitude: profile.latitude ?? "",
        longitude: profile.longitude ?? "",
      });
    } catch (err) {
      setError(err.message || "Organization profile could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [user.email]);

  const updateField = (field, value) =>
    setForm((current) => ({ ...current, [field]: value }));

  const saveProfile = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const updated = await api.put(`/api/ngos/${ngo.id}`, {
        ...form,
        latitude: form.latitude === "" ? null : Number(form.latitude),
        longitude: form.longitude === "" ? null : Number(form.longitude),
      });
      setNgo(updated);
      setNotice("Organization profile updated.");
    } catch (err) {
      setError(err.message || "Organization profile could not be updated.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <NGOShell>
      <PageHeader
        eyebrow="Organization profile"
        title="Profile details"
        description="Keep your organization information current for donors and matching."
      />
      {loading ? (
        <LoadingState message="Loading organization profile..." />
      ) : null}
      {error ? (
        <ErrorMessage onRetry={loadProfile}>{error}</ErrorMessage>
      ) : null}
      {notice ? <div className="success-box">{notice}</div> : null}
      {form && ngo ? (
        <form className="info-card profile-form" onSubmit={saveProfile}>
          <div className="profile-status">
            <span>Verification status</span>
            <span
              className={`status-pill ${ngo.verified ? "status-matched" : "status-submitted"}`}
            >
              {ngo.verified ? "Verified" : "Unverified"}
            </span>
            <small>Verification is managed by an administrator.</small>
          </div>
          <label>
            Organization name
            <input
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
              required
            />
          </label>
          <label>
            Contact email
            <input
              type="email"
              value={form.contact_email}
              readOnly
              aria-describedby="contact-email-note"
              required
            />
            <small id="contact-email-note">
              This stays aligned with the authenticated NGO account.
            </small>
          </label>
          <label>
            Phone
            <input
              value={form.contact_phone}
              onChange={(event) =>
                updateField("contact_phone", event.target.value)
              }
            />
          </label>
          <label>
            Address
            <textarea
              value={form.address}
              onChange={(event) => updateField("address", event.target.value)}
              rows="3"
            />
          </label>
          <label>
            City
            <input
              value={form.city}
              onChange={(event) => updateField("city", event.target.value)}
            />
          </label>
          <div className="form-grid-two">
            <label>
              Latitude
              <input
                type="number"
                step="any"
                min="-90"
                max="90"
                value={form.latitude}
                onChange={(event) =>
                  updateField("latitude", event.target.value)
                }
              />
            </label>
            <label>
              Longitude
              <input
                type="number"
                step="any"
                min="-180"
                max="180"
                value={form.longitude}
                onChange={(event) =>
                  updateField("longitude", event.target.value)
                }
              />
            </label>
          </div>
          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? "Saving..." : "Save profile"}
          </button>
        </form>
      ) : null}
    </NGOShell>
  );
}
