import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
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
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to={getDestination(user)} replace />;

  const handleChange = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  const validate = () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      return "Please enter a valid email address.";
    }
    if (form.password.length < 8) return "Password must be at least 8 characters long.";
    if (form.password !== form.confirmPassword) return "Passwords do not match.";

    const requiredFields =
      form.role === "donor"
        ? [form.name, form.phone, form.city]
        : [form.organization_name, form.contact_phone, form.address, form.city];
    if (requiredFields.some((value) => !value.trim())) {
      return "Please check the highlighted fields.";
    }
    if (!coordinateInRange(form.latitude, -90, 90) || !coordinateInRange(form.longitude, -180, 180)) {
      return "Please check the highlighted fields.";
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
      setSuccess("Account created successfully. You can now sign in.");
      setTimeout(() => navigate("/login", { replace: true }), 900);
    } catch (err) {
      if (err?.status === 409 || /already registered|already exists/i.test(err?.message || "")) {
        setError("This email is already registered.");
      } else if (err?.status === 422) {
        setError("Please check the highlighted fields.");
      } else {
        setError("We couldn't create your account right now. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      description="Join Kindred as a donor or NGO."
      footerLink="/login"
      footerText="Already have an account?"
    >
      <form onSubmit={handleSubmit} className="auth-form">
        <label>
          Account type
          <select value={form.role} onChange={handleChange("role")}>
            <option value="donor">Donor</option>
            <option value="ngo">NGO</option>
          </select>
        </label>

        {form.role === "donor" ? (
          <>
            <label>Full name *<input value={form.name} onChange={handleChange("name")} required /></label>
            <label>Email *<input type="email" value={form.email} onChange={handleChange("email")} required /></label>
            <label>Phone number *<input value={form.phone} onChange={handleChange("phone")} required /></label>
            <label>City *<input value={form.city} onChange={handleChange("city")} required /></label>
          </>
        ) : (
          <>
            <label>Organization name *<input value={form.organization_name} onChange={handleChange("organization_name")} required /></label>
            <label>Contact email *<input type="email" value={form.email} onChange={handleChange("email")} required /></label>
            <label>Contact phone *<input value={form.contact_phone} onChange={handleChange("contact_phone")} required /></label>
            <label>Address *<textarea value={form.address} onChange={handleChange("address")} rows="3" required /></label>
            <label>City *<input value={form.city} onChange={handleChange("city")} required /></label>
          </>
        )}

        <div className="form-grid-two">
          <label>Latitude<input type="number" step="any" min="-90" max="90" value={form.latitude} onChange={handleChange("latitude")} /></label>
          <label>Longitude<input type="number" step="any" min="-180" max="180" value={form.longitude} onChange={handleChange("longitude")} /></label>
        </div>
        <label>Password *<input type="password" value={form.password} onChange={handleChange("password")} required /></label>
        <label>Confirm password *<input type="password" value={form.confirmPassword} onChange={handleChange("confirmPassword")} required /></label>
        {error ? <div className="error-box">{error}</div> : null}
        {success ? <div className="success-box">{success}</div> : null}
        <button type="submit" className="primary-button" disabled={loading}>
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>
    </AuthLayout>
  );
}
