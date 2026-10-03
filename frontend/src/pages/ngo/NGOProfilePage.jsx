import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/client";
import ErrorMessage from "../../components/common/ErrorMessage";
import LoadingState from "../../components/common/LoadingState";
import PageHeader from "../../components/layout/PageHeader";
import { loadCurrentNgo } from "./ngoUtils";
import NGOShell from "./NGOShell";
import ngoProfileBanner from "../../assets/ngo-profile-banner-cutout.jpg";
import "./NGOProfilePage.css";

const emptyNgoForm = {
  name: "",
  contact_email: "",
  contact_phone: "",
  address: "",
  city: "",
  latitude: "",
  longitude: "",
};

export default function NGOProfilePage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [ngo, setNgo] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadProfile = async () => {
    setLoading(true);
    setError("");
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
      setError(t("errors.generic"));
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
      setNotice(t("common.success"));
    } catch (err) {
      setError(t("errors.generic"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <NGOShell>
      <div className="ngo-profile-page-header">
        <PageHeader
          eyebrow={t("navigation.profile")}
          title={t("ngo.profile.title")}
          description={t("ngo.profile.description")}
          actionClassName="ngo-profile-art-action"
          action={
            <div className="ngo-profile-header-art">
              <img src={ngoProfileBanner} alt="" />
            </div>
          }
        />
      </div>
      {loading ? <LoadingState message={t("common.loading")} /> : null}
      {!loading && error ? (
        <ErrorMessage onRetry={loadProfile}>{error}</ErrorMessage>
      ) : null}
      {notice ? (
        <div className="success-box ngo-profile-notice">
          <i className="fi fi-rr-check-circle" aria-hidden="true" />
          {notice}
        </div>
      ) : null}
      {form && ngo ? (
        <div className="ngo-profile-layout">
          <form
            className="ngo-profile-card ngo-profile-form"
            onSubmit={saveProfile}
          >
            <div
              className={`ngo-verification-strip ${ngo.verified ? "is-verified" : "is-unverified"}`}
            >
              <span className="ngo-verification-icon">
                <i
                  className={`fi fi-rr-${ngo.verified ? "shield-check" : "shield-exclamation"}`}
                  aria-hidden="true"
                />
              </span>
              <strong>{t("ngo.profile.verificationStatus")}</strong>
              <span
                className={`ngo-verification-badge ${ngo.verified ? "is-verified" : "is-unverified"}`}
              >
                <i
                  className={`fi fi-rr-${ngo.verified ? "check" : "hourglass-end"}`}
                  aria-hidden="true"
                />
                {t(
                  ngo.verified
                    ? "ngo.profile.verified"
                    : "ngo.profile.unverified",
                )}
              </span>
              <small>{t("ngo.profile.verificationHelp")}</small>
            </div>
            <div className="ngo-profile-section-heading">
              <span className="ngo-profile-section-icon">
                <i className="fi fi-rr-building" aria-hidden="true" />
              </span>
              <div>
                <h2>{t("ngo.profile.organizationDetails")}</h2>
                <p>{t("ngo.profile.organizationDetailsDesc")}</p>
              </div>
            </div>
            <div className="ngo-profile-fields">
              <div className="ngo-profile-field">
                <i className="fi fi-rr-building" aria-hidden="true" />
                <label>
                  {t("auth.register.orgName")}
                  <input
                    value={form.name}
                    onChange={(event) =>
                      updateField("name", event.target.value)
                    }
                    required
                  />
                </label>
              </div>
              <div className="ngo-profile-field">
                <i className="fi fi-rr-envelope" aria-hidden="true" />
                <label>
                  {t("auth.register.contactEmail")}
                  <input
                    type="email"
                    value={form.contact_email}
                    readOnly
                    aria-describedby="ngo-contact-email-note"
                    required
                  />
                  <small id="ngo-contact-email-note">
                    {t("ngo.profile.emailNote")}
                  </small>
                </label>
              </div>
              <div className="ngo-profile-field">
                <i className="fi fi-rr-phone-call" aria-hidden="true" />
                <label>
                  {t("auth.register.contactPhone")}
                  <input
                    value={form.contact_phone}
                    onChange={(event) =>
                      updateField("contact_phone", event.target.value)
                    }
                  />
                </label>
              </div>
              <div className="ngo-profile-field">
                <i className="fi fi-rr-marker" aria-hidden="true" />
                <label>
                  {t("auth.register.address")}
                  <textarea
                    value={form.address}
                    onChange={(event) =>
                      updateField("address", event.target.value)
                    }
                    rows="3"
                  />
                </label>
              </div>
              <div className="ngo-profile-field">
                <i className="fi fi-rr-map" aria-hidden="true" />
                <label>
                  {t("auth.register.city")}
                  <input
                    value={form.city}
                    onChange={(event) =>
                      updateField("city", event.target.value)
                    }
                  />
                </label>
              </div>
            </div>
            <div className="ngo-profile-location-heading">
              <span className="ngo-profile-section-icon">
                <i className="fi fi-rr-marker" aria-hidden="true" />
              </span>
              <div>
                <h2>{t("ngo.profile.location")}</h2>
                <p>{t("ngo.profile.locationDesc")}</p>
              </div>
            </div>
            <div className="ngo-profile-coordinate-grid">
              <label>
                {t("auth.register.latitude")}
                <span className="ngo-coordinate-input">
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
                <span className="ngo-coordinate-input">
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
              className="primary-button ngo-profile-save"
              disabled={saving}
            >
              <i className="fi fi-rr-disk" aria-hidden="true" />
              {saving ? t("ngo.profile.saving") : t("ngo.profile.save")}
            </button>
          </form>

          <aside className="ngo-profile-sidebar">
            <section
              className="ngo-profile-card ngo-profile-overview"
              aria-label={t("ngo.profile.overview")}
            >
              <div className="ngo-profile-person">
                <div className="ngo-profile-avatar">
                  <i className="fi fi-rr-building" aria-hidden="true" />
                </div>
                <div className="ngo-profile-person-details">
                  <div className="ngo-profile-person-heading">
                    <strong>
                      {form.name || t("ngo.profile.organizationName")}
                    </strong>
                    <span
                      className={`ngo-profile-verified-pill ${ngo.verified ? "is-verified" : "is-unverified"}`}
                    >
                      <i
                        className={`fi fi-rr-${ngo.verified ? "shield-check" : "shield-exclamation"}`}
                        aria-hidden="true"
                      />
                      {t(
                        ngo.verified
                          ? "ngo.profile.verified"
                          : "ngo.profile.unverified",
                      )}
                    </span>
                  </div>
                  <span>
                    <i className="fi fi-rr-envelope" aria-hidden="true" />
                    {form.contact_email || "—"}
                  </span>
                  {form.contact_phone ? (
                    <span>
                      <i className="fi fi-rr-phone-call" aria-hidden="true" />
                      {form.contact_phone}
                    </span>
                  ) : null}
                  <span>
                    <i className="fi fi-rr-marker" aria-hidden="true" />
                    {[form.city, form.address].filter(Boolean).join(", ") ||
                      "—"}
                  </span>
                </div>
              </div>
            </section>
            <section className="ngo-profile-card ngo-profile-benefits">
              <div className="ngo-profile-section-heading">
                <span className="ngo-profile-section-icon icon-warm">
                  <i className="fi fi-rr-lightbulb-on" aria-hidden="true" />
                </span>
                <div>
                  <h2>{t("ngo.profile.whyTitle")}</h2>
                  <p>{t("ngo.profile.whyDesc")}</p>
                </div>
              </div>
              <div className="ngo-profile-benefit benefit-match">
                <span>
                  <i className="fi fi-rr-target" aria-hidden="true" />
                </span>
                <div>
                  <strong>{t("ngo.profile.betterMatches")}</strong>
                  <p>{t("ngo.profile.betterMatchesDesc")}</p>
                </div>
                <i className="fi fi-rr-angle-right" aria-hidden="true" />
              </div>
              <div className="ngo-profile-benefit benefit-trust">
                <span>
                  <i className="fi fi-rr-users-alt" aria-hidden="true" />
                </span>
                <div>
                  <strong>{t("ngo.profile.increasedTrust")}</strong>
                  <p>{t("ngo.profile.increasedTrustDesc")}</p>
                </div>
                <i className="fi fi-rr-angle-right" aria-hidden="true" />
              </div>
              <div className="ngo-profile-benefit benefit-impact">
                <span>
                  <i className="fi fi-rr-heart" aria-hidden="true" />
                </span>
                <div>
                  <strong>{t("ngo.profile.greaterImpact")}</strong>
                  <p>{t("ngo.profile.greaterImpactDesc")}</p>
                </div>
                <i className="fi fi-rr-angle-right" aria-hidden="true" />
              </div>
            </section>
          </aside>
        </div>
      ) : null}
    </NGOShell>
  );
}
