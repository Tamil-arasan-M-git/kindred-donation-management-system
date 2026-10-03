import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import api from "../../api/client";
import ErrorMessage from "../../components/common/ErrorMessage";
import LoadingState from "../../components/common/LoadingState";
import PageHeader from "../../components/layout/PageHeader";
import DonorShell from "./DonorShell";
import donorHeroArt from "../../assets/donor-profile-banner-cutout.jpg";
import profileImpactArt from "../../assets/donor-profile-impact-cutout.jpg";
import profileCardBanner from "../../assets/donor-profile-card-banner-cutout.jpg";
import "./DonorProfilePage.css";

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  city: "",
  latitude: "",
  longitude: "",
};

export default function DonorProfilePage() {
  const { t } = useTranslation();
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
      setError(t("errors.generic"));
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
      setNotice(t("common.success"));
    } catch {
      setError(t("errors.generic"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DonorShell>
      <div className="donor-profile-header">
        <PageHeader
          eyebrow={t("navigation.profile")}
          title={t("donor.profile.title")}
          description={t("donor.profile.description")}
          action={
            <div className="donor-profile-banner">
              <p>{t("donor.profile.bannerMessage")}</p>
              <img src={donorHeroArt} alt="" />
            </div>
          }
        />
      </div>
      {loading ? <LoadingState message={t("common.loading")} /> : null}
      {!loading && error ? (
        <ErrorMessage onRetry={loadProfile}>{error}</ErrorMessage>
      ) : null}
      {notice ? (
        <div className="success-box donor-profile-notice">
          <i className="fi fi-rr-check-circle" aria-hidden="true" />
          {notice}
        </div>
      ) : null}
      {!loading && !error ? (
        <>
          <div className="donor-profile-layout">
            <form className="donor-profile-card" onSubmit={saveProfile}>
              <div className="donor-profile-card-heading">
                <span className="donor-profile-heading-icon">
                  <i className="fi fi-rr-user" aria-hidden="true" />
                </span>
                <div>
                  <h2>{t("donor.profile.personalDetails")}</h2>
                  <p>{t("donor.profile.personalDetailsDesc")}</p>
                </div>
              </div>
              <div className="donor-profile-fields">
                <div className="donor-profile-field-row">
                  <i className="fi fi-rr-user" aria-hidden="true" />
                  <label>
                    {t("auth.register.fullName")}
                    <input
                      value={form.name}
                      onChange={(event) =>
                        updateField("name", event.target.value)
                      }
                      required
                    />
                  </label>
                </div>
                <div className="donor-profile-field-row">
                  <i className="fi fi-rr-envelope" aria-hidden="true" />
                  <label>
                    {t("auth.register.email")}
                    <input
                      type="email"
                      value={form.email}
                      readOnly
                      aria-describedby="donor-email-note"
                      required
                    />
                    <small id="donor-email-note">
                      {t("donor.profile.emailNote")}
                    </small>
                  </label>
                </div>
                <div className="donor-profile-field-row">
                  <i className="fi fi-rr-phone-call" aria-hidden="true" />
                  <label>
                    {t("auth.register.phone")}
                    <input
                      value={form.phone}
                      onChange={(event) =>
                        updateField("phone", event.target.value)
                      }
                      required
                    />
                  </label>
                </div>
                <div className="donor-profile-field-row">
                  <i className="fi fi-rr-marker" aria-hidden="true" />
                  <label>
                    {t("auth.register.city")}
                    <input
                      value={form.city}
                      onChange={(event) =>
                        updateField("city", event.target.value)
                      }
                      required
                    />
                  </label>
                </div>
              </div>
              <div className="donor-profile-location-heading">
                <span className="donor-profile-heading-icon">
                  <i className="fi fi-rr-marker" aria-hidden="true" />
                </span>
                <div>
                  <h2>{t("donor.profile.location")}</h2>
                  <p>{t("donor.profile.locationDesc")}</p>
                </div>
              </div>
              <div className="donor-profile-coordinate-grid">
                <label>
                  {t("auth.register.latitude")}
                  <span className="donor-profile-coordinate-input">
                    <i className="fi fi-rr-crosshairs" aria-hidden="true" />
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
                  </span>
                </label>
                <label>
                  {t("auth.register.longitude")}
                  <span className="donor-profile-coordinate-input">
                    <i className="fi fi-rr-crosshairs" aria-hidden="true" />
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
                  </span>
                </label>
              </div>
              <button
                type="submit"
                className="primary-button donor-profile-save"
                disabled={saving}
              >
                <i className="fi fi-rr-disk" aria-hidden="true" />
                {saving ? t("donor.profile.saving") : t("donor.profile.save")}
              </button>
            </form>
            <aside className="donor-profile-sidebar">
              <section
                className="donor-profile-card donor-profile-overview"
                aria-label={t("donor.profile.overview")}
              >
                <img
                  className="donor-profile-cover"
                  src={profileCardBanner}
                  alt=""
                />
                <div className="donor-profile-person">
                  <div className="donor-profile-avatar">
                    {(form.name || "?")
                      .trim()
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((part) => part[0]?.toUpperCase())
                      .join("")}
                  </div>
                  <div className="donor-profile-person-info">
                    <strong>{form.name || t("donor.profile.yourName")}</strong>
                    <span>
                      <i className="fi fi-rr-envelope" aria-hidden="true" />
                      {form.email || "—"}
                    </span>
                    <span>
                      <i className="fi fi-rr-phone-call" aria-hidden="true" />
                      {form.phone || "—"}
                    </span>
                    <span>
                      <i className="fi fi-rr-marker" aria-hidden="true" />
                      {form.city || "—"}
                    </span>
                  </div>
                  <span className="donor-profile-role">
                    <i className="fi fi-rr-heart" aria-hidden="true" />
                    {t("donor.profile.donorRole")}
                  </span>
                </div>
              </section>
              <section className="donor-profile-card donor-profile-benefits">
                <div className="donor-profile-card-heading">
                  <span className="donor-profile-heading-icon">
                    <i className="fi fi-rr-lightbulb-on" aria-hidden="true" />
                  </span>
                  <div>
                    <h2>{t("donor.profile.whyTitle")}</h2>
                    <p>{t("donor.profile.whyDesc")}</p>
                  </div>
                </div>
                <div className="donor-profile-benefit benefit-matches">
                  <span>
                    <i className="fi fi-rr-target" aria-hidden="true" />
                  </span>
                  <div>
                    <strong>{t("donor.profile.betterMatches")}</strong>
                    <p>{t("donor.profile.betterMatchesDesc")}</p>
                  </div>
                  <i className="fi fi-rr-angle-right" aria-hidden="true" />
                </div>
                <div className="donor-profile-benefit benefit-pickup">
                  <span>
                    <i className="fi fi-rr-truck-side" aria-hidden="true" />
                  </span>
                  <div>
                    <strong>{t("donor.profile.fasterPickup")}</strong>
                    <p>{t("donor.profile.fasterPickupDesc")}</p>
                  </div>
                  <i className="fi fi-rr-angle-right" aria-hidden="true" />
                </div>
                <div className="donor-profile-benefit benefit-impact">
                  <span>
                    <i className="fi fi-rr-heart" aria-hidden="true" />
                  </span>
                  <div>
                    <strong>{t("donor.profile.greaterImpact")}</strong>
                    <p>{t("donor.profile.greaterImpactDesc")}</p>
                  </div>
                  <i className="fi fi-rr-angle-right" aria-hidden="true" />
                </div>
              </section>
              <section className="donor-profile-impact">
                <img src={profileImpactArt} alt="" />
                <div>
                  <h2>{t("donor.profile.impactHeadline")}</h2>
                  <p>{t("donor.profile.impactDesc")}</p>
                </div>
                <i className="fi fi-rr-heart" aria-hidden="true" />
              </section>
            </aside>
          </div>
        </>
      ) : null}
    </DonorShell>
  );
}
