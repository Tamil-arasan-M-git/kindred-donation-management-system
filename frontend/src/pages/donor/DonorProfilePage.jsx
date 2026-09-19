import { useEffect, useState } from "react";
import api from "../../api/client";
import ErrorMessage from "../../components/common/ErrorMessage";
import LoadingState from "../../components/common/LoadingState";
import PageHeader from "../../components/layout/PageHeader";
import DonorShell from "./DonorShell";

const emptyForm = { name: "", email: "", phone: "", city: "", latitude: "", longitude: "" };

export default function DonorProfilePage() {
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadProfile = async () => {
    setLoading(true);
    setError("");
    try {
      const profile = await api.get("/api/donors/me");
      setForm({
        name: profile.name || "",
        email: profile.email || "",
        phone: profile.phone || "",
        city: profile.city || "",
        latitude: profile.latitude ?? "",
        longitude: profile.longitude ?? "",
      });
    } catch {
      setError("Unable to load profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const updateField = (field, value) =>
    setForm((current) => ({ ...current, [field]: value }));

  const saveProfile = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const updated = await api.put("/api/donors/me", {
        name: form.name.trim(),
        email: form.email,
        phone: form.phone.trim(),
        city: form.city.trim(),
        latitude: form.latitude === "" ? null : Number(form.latitude),
        longitude: form.longitude === "" ? null : Number(form.longitude),
      });
      setForm((current) => ({
        ...current,
        ...updated,
        latitude: updated.latitude ?? "",
        longitude: updated.longitude ?? "",
      }));
      setNotice("Profile updated successfully.");
    } catch {
      setError("Unable to update profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DonorShell>
      <PageHeader
        eyebrow="Profile"
        title="Personal information"
        description="Keep your donor details current for better donation matching."
      />
      {loading ? <LoadingState message="Loading profile..." /> : null}
      {!loading && error ? <ErrorMessage onRetry={loadProfile}>{error}</ErrorMessage> : null}
      {notice ? <div className="success-box">{notice}</div> : null}
      {!loading && !error ? (
        <form className="info-card profile-form" onSubmit={saveProfile}>
          <label>Full name<input value={form.name} onChange={(event) => updateField("name", event.target.value)} required /></label>
          <label>Email<input type="email" value={form.email} readOnly aria-describedby="donor-email-note" required /><small id="donor-email-note">Email is linked to your account and cannot be edited here.</small></label>
          <label>Phone<input value={form.phone} onChange={(event) => updateField("phone", event.target.value)} required /></label>
          <label>City<input value={form.city} onChange={(event) => updateField("city", event.target.value)} required /></label>
          <h2>Location</h2>
          <div className="form-grid-two">
            <label>Latitude<input type="number" step="any" min="-90" max="90" value={form.latitude} onChange={(event) => updateField("latitude", event.target.value)} /></label>
            <label>Longitude<input type="number" step="any" min="-180" max="180" value={form.longitude} onChange={(event) => updateField("longitude", event.target.value)} /></label>
          </div>
          <button type="submit" className="primary-button" disabled={saving}>{saving ? "Saving..." : "Save changes"}</button>
        </form>
      ) : null}
    </DonorShell>
  );
}
