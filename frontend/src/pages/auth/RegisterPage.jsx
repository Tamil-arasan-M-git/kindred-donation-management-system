import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import AuthLayout from "./AuthLayout";

const roleHome = { donor: "/donor", ngo: "/ngo", admin: "/admin" };
const getDestination = (user) =>
  user ? roleHome[user.role] || "/login" : "/login";

const initialForm = {
  role: "donor",
  email: "",
  password: "",
  confirmPassword: "",
  name: "",
  phone: "",
  city: "",
  latitude: "",
  longitude: "",
  organization_name: "",
  contact_phone: "",
  address: "",
};

const coordinateInRange = (value, min, max) =>
  value === "" ||
  (Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max);

export default function RegisterPage() {
  const { register, user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to={getDestination(user)} replace />;

  const handleChange = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  const validate = () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      return t("validation.invalidEmail");
    }
    if (form.password.length < 8) return t("validation.passwordLength");
    if (form.password !== form.confirmPassword) return t("validation.passwordMatch");

    const requiredFields =
      form.role === "donor"
        ? [form.name, form.phone, form.city]
        : [form.organization_name, form.contact_phone, form.address, form.city];
    if (requiredFields.some((value) => !value.trim())) {
      return t("validation.checkFields");
    }
    if (!coordinateInRange(form.latitude, -90, 90) || !coordinateInRange(form.longitude, -180, 180)) {
      return t("validation.checkFields");
    }
    return "";
  };

  const buildPayload = () => {
    const coordinates = {
      latitude: form.latitude === "" ? null : Number(form.latitude),
      longitude: form.longitude === "" ? null : Number(form.longitude),
    };
    if (form.role === "donor") {
      return {
        role: "donor",
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        city: form.city.trim(),
        ...coordinates,
        password: form.password,
      };
    }
    return {
      role: "ngo",
      organization_name: form.organization_name.trim(),
      email: form.email.trim(),
      contact_phone: form.contact_phone.trim(),
      address: form.address.trim(),
      city: form.city.trim(),
      ...coordinates,
      password: form.password,
    };
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    const validationError = validate();
    if (validationError) return setError(validationError);

    setLoading(true);
    try {
      await register(buildPayload());
      setSuccess(t("auth.register.success"));
      setTimeout(() => navigate("/login", { replace: true }), 900);
    } catch (err) {
      if (err?.status === 409 || /already registered|already exists/i.test(err?.message || "")) {
        setError(t("auth.register.emailExists"));
      } else if (err?.status === 422) {
        setError(t("validation.checkFields"));
      } else {
        setError(t("errors.generic"));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title={t("auth.register.title")}
      description={t("auth.register.description")}
      footerLink="/login"
      footerText={t("auth.register.haveAccount")}
      variant="register"
    >
      <form onSubmit={handleSubmit} className="auth-form auth-register-form">
        <label>
          {t("auth.register.accountType")}
          <select value={form.role} onChange={handleChange("role")}>
            <option value="donor">{t("auth.register.donor")}</option>
            <option value="ngo">{t("auth.register.ngo")}</option>
          </select>
        </label>

        {form.role === "donor" ? (
          <>
            <label>{t("auth.register.fullName")} *<input placeholder={t("auth.register.fullNamePlaceholder", { defaultValue: "Enter your full name" })} value={form.name} onChange={handleChange("name")} required /></label>
            <label>{t("auth.register.email")} *<input type="email" placeholder={t("auth.register.emailPlaceholder", { defaultValue: "Enter your email" })} value={form.email} onChange={handleChange("email")} required /></label>
            <label>{t("auth.register.phone")} *<input placeholder={t("auth.register.phonePlaceholder", { defaultValue: "Enter your phone number" })} value={form.phone} onChange={handleChange("phone")} required /></label>
            <label>{t("auth.register.city")} *<input placeholder={t("auth.register.cityPlaceholder", { defaultValue: "Enter your city" })} value={form.city} onChange={handleChange("city")} required /></label>
          </>
        ) : (
          <>
            <label>{t("auth.register.orgName")} *<input placeholder={t("auth.register.orgNamePlaceholder", { defaultValue: "Enter organization name" })} value={form.organization_name} onChange={handleChange("organization_name")} required /></label>
            <label>{t("auth.register.contactEmail")} *<input type="email" placeholder={t("auth.register.emailPlaceholder", { defaultValue: "Enter your email" })} value={form.email} onChange={handleChange("email")} required /></label>
            <label>{t("auth.register.contactPhone")} *<input placeholder={t("auth.register.phonePlaceholder", { defaultValue: "Enter your phone number" })} value={form.contact_phone} onChange={handleChange("contact_phone")} required /></label>
            <label>{t("auth.register.address")} *<textarea placeholder={t("auth.register.addressPlaceholder", { defaultValue: "Enter your address" })} value={form.address} onChange={handleChange("address")} rows="3" required /></label>
            <label>{t("auth.register.city")} *<input placeholder={t("auth.register.cityPlaceholder", { defaultValue: "Enter your city" })} value={form.city} onChange={handleChange("city")} required /></label>
          </>
        )}

        <div className="form-grid-two">
          <label>{t("auth.register.latitude")}<input type="number" step="any" min="-90" max="90" placeholder={t("auth.register.latitudePlaceholder", { defaultValue: "Enter latitude" })} value={form.latitude} onChange={handleChange("latitude")} /></label>
          <label>{t("auth.register.longitude")}<input type="number" step="any" min="-180" max="180" placeholder={t("auth.register.longitudePlaceholder", { defaultValue: "Enter longitude" })} value={form.longitude} onChange={handleChange("longitude")} /></label>
        </div>
        <label>{t("auth.register.password")} *<input type="password" placeholder={t("auth.register.passwordPlaceholder", { defaultValue: "Enter your password" })} value={form.password} onChange={handleChange("password")} required /></label>
        <label>{t("auth.register.confirmPassword")} *<input type="password" placeholder={t("auth.register.confirmPasswordPlaceholder", { defaultValue: "Confirm your password" })} value={form.confirmPassword} onChange={handleChange("confirmPassword")} required /></label>
        {error ? <div className="error-box">{error}</div> : null}
        {success ? <div className="success-box">{success}</div> : null}
        <button type="submit" className="primary-button" disabled={loading}>
          {loading ? t("auth.register.creating") : t("auth.register.createAccount")}
        </button>
      </form>
    </AuthLayout>
  );
}
