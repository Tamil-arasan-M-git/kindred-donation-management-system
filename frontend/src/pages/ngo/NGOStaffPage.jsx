import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import api from "../../api/client";
import EmptyState from "../../components/common/EmptyState";
import ErrorMessage from "../../components/common/ErrorMessage";
import LoadingState from "../../components/common/LoadingState";
import PageHeader from "../../components/layout/PageHeader";
import NGOShell from "./NGOShell";
import staffBanner from "../../assets/ngo-staff-banner.jpg";
import "./NGOStaffPage.css";

const roles = ["packaging", "pickup", "delivery"];
const blankForm = {
  name: "",
  phone: "",
  email: "",
  role: "packaging",
  is_active: true,
};
const asList = (payload) =>
  Array.isArray(payload) ? payload : payload?.staff || [];
const initials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "S";
const roleIcon = (role) =>
  role === "pickup" || role === "delivery"
    ? "fi-rr-truck-side"
    : "fi-rr-box-open";

export default function NGOStaffPage() {
  const { t } = useTranslation();
  const [staff, setStaff] = useState([]);
  const [form, setForm] = useState(blankForm);
  const [editingMember, setEditingMember] = useState(null);
  const [editForm, setEditForm] = useState(blankForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const closeEditor = useCallback(() => {
    setEditingMember(null);
    setEditForm(blankForm);
    setError("");
  }, []);

  const loadStaff = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setStaff(asList(await api.getNgoStaff()));
    } catch (err) {
      setError(t("errors.generic"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  useEffect(() => {
    if (!editingMember) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !saving) closeEditor();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editingMember, saving, closeEditor]);

  const editMember = (member) => {
    setEditForm({
      name: member.name || "",
      phone: member.phone || "",
      email: member.email || "",
      role: member.role || "packaging",
      is_active: member.is_active ?? member.active ?? true,
    });
    setEditingMember(member);
    setError("");
  };

  const createStaff = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await api.createNgoStaff(form);
      setForm(blankForm);
      await loadStaff();
      setNotice(t("common.success"));
    } catch (err) {
      setError(t("errors.generic"));
    } finally {
      setSaving(false);
    }
  };

  const updateStaff = async (event) => {
    event.preventDefault();
    if (!editingMember) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await api.updateNgoStaff(editingMember.id, editForm);
      await loadStaff();
      closeEditor();
      setNotice(t("common.success"));
    } catch (err) {
      setError(t("errors.generic"));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (member) => {
    setActionId(member.id);
    setError("");
    setNotice("");
    try {
      if (member.is_active ?? member.active) {
        await api.deleteNgoStaff(member.id);
      } else {
        await api.updateNgoStaff(member.id, {
          name: member.name,
          phone: member.phone,
          email: member.email,
          role: member.role,
          is_active: true,
        });
      }
      await loadStaff();
      setNotice(t("common.success"));
    } catch (err) {
      setError(t("errors.generic"));
    } finally {
      setActionId("");
    }
  };

  const permanentlyDelete = async (member) => {
    const confirmMessage = t("ngo.staff.deleteConfirm", {
      defaultValue:
        "Permanently delete this staff member? Staff with operation history cannot be deleted.",
    });
    if (!window.confirm(confirmMessage)) return;
    setActionId(member.id);
    setError("");
    setNotice("");
    try {
      await api.permanentlyDeleteNgoStaff(member.id);
      setStaff((current) => current.filter((item) => item.id !== member.id));
      setNotice(t("common.success"));
    } catch (err) {
      setError(t("errors.generic"));
    } finally {
      setActionId("");
    }
  };

  const label = (key, fallback) =>
    t(`ngo.staff.${key}`, { defaultValue: fallback });

  return (
    <NGOShell>
      <PageHeader
        eyebrow={t("navigation.staff")}
        title={t("ngo.staff.title")}
        description={t("ngo.staff.description", {
          defaultValue:
            "Manage staff who handle packaging, pickup, and delivery operations.",
        })}
        action={
          <img
            className="ngo-staff-header-art"
            src={staffBanner}
            alt=""
            aria-hidden="true"
          />
        }
        actionClassName="ngo-staff-header-action"
      />
      {error && !editingMember ? (
        <ErrorMessage onRetry={loadStaff}>{error}</ErrorMessage>
      ) : null}
      {notice ? <div className="success-box">{notice}</div> : null}

      <section className="ngo-staff-create-card">
        <div className="ngo-staff-section-heading">
          <span className="ngo-staff-heading-icon">
            <i className="fi fi-rr-user-add" aria-hidden="true" />
          </span>
          <div>
            <h2>{label("createTitle", "Add New Staff")}</h2>
            <p>
              {label(
                "createDescription",
                "Create a new staff member to handle operations.",
              )}
            </p>
          </div>
        </div>
        <form className="ngo-staff-create-form" onSubmit={createStaff}>
          <label>
            <span>
              {t("auth.register.fullName", { defaultValue: "Full Name" })}
            </span>
            <span className="ngo-staff-input-wrap">
              <i className="fi fi-rr-user" aria-hidden="true" />
              <input
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
                placeholder={label("namePlaceholder", "Enter full name")}
                required
              />
            </span>
          </label>
          <label>
            <span>{t("auth.register.email", { defaultValue: "Email" })}</span>
            <span className="ngo-staff-input-wrap">
              <i className="fi fi-rr-envelope" aria-hidden="true" />
              <input
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm({ ...form, email: event.target.value })
                }
                placeholder={label("emailPlaceholder", "Enter email address")}
                required
              />
            </span>
          </label>
          <label>
            <span>{t("auth.register.phone", { defaultValue: "Phone" })}</span>
            <span className="ngo-staff-input-wrap">
              <i className="fi fi-rr-phone-call" aria-hidden="true" />
              <input
                type="tel"
                value={form.phone}
                onChange={(event) =>
                  setForm({ ...form, phone: event.target.value })
                }
                placeholder={label("phonePlaceholder", "Enter phone number")}
                required
              />
            </span>
          </label>
          <label>
            <span>{label("role", "Role")}</span>
            <span className="ngo-staff-input-wrap">
              <i className={`fi ${roleIcon(form.role)}`} aria-hidden="true" />
              <select
                value={form.role}
                onChange={(event) =>
                  setForm({ ...form, role: event.target.value })
                }
              >
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {label(`roles.${role}`, role)}
                  </option>
                ))}
              </select>
            </span>
          </label>
          <div className="ngo-staff-create-actions">
            <button type="submit" className="primary-button" disabled={saving}>
              <i className="fi fi-rr-user-add" aria-hidden="true" />
              {saving ? t("common.loading") : t("ngo.staff.addStaff")}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setForm(blankForm)}
              disabled={saving}
            >
              {t("common.cancel")}
            </button>
          </div>
        </form>
      </section>

      <section className="ngo-staff-list-card">
        <div className="ngo-staff-section-heading">
          <span className="ngo-staff-heading-icon">
            <i className="fi fi-rr-users" aria-hidden="true" />
          </span>
          <div>
            <h2>{label("membersTitle", "Staff Members")}</h2>
            <p>
              {label(
                "membersDescription",
                "View and manage your staff members.",
              )}
            </p>
          </div>
        </div>
        {loading ? <LoadingState message={t("common.loading")} /> : null}
        {!loading && !staff.length ? (
          <EmptyState title={t("ngo.staff.empty")} />
        ) : null}
        {!loading && staff.length ? (
          <div className="ngo-staff-grid">
            {staff.map((member) => {
              const active = member.is_active ?? member.active;
              return (
                <article key={member.id} className="ngo-staff-card">
                  <div className="ngo-staff-card-top">
                    <span
                      className={`ngo-staff-avatar ngo-staff-avatar-${member.role}`}
                    >
                      {initials(member.name)}
                    </span>
                    <div className="ngo-staff-card-identity">
                      <h3>{member.name}</h3>
                      <span
                        className={`ngo-staff-role ngo-staff-role-${member.role}`}
                      >
                        <i
                          className={`fi ${roleIcon(member.role)}`}
                          aria-hidden="true"
                        />
                        {label(`roles.${member.role}`, member.role)}
                      </span>
                    </div>
                    <span
                      className={`ngo-staff-active ${active ? "is-active" : "is-inactive"}`}
                    >
                      <i aria-hidden="true" />
                      {active ? t("status.active") : t("status.inactive")}
                    </span>
                  </div>
                  <div className="ngo-staff-contact">
                    <p>
                      <i className="fi fi-rr-envelope" aria-hidden="true" />
                      <span>{member.email}</span>
                    </p>
                    <p>
                      <i className="fi fi-rr-phone-call" aria-hidden="true" />
                      <span>{member.phone}</span>
                    </p>
                  </div>
                  <div className="ngo-staff-card-actions">
                    <button
                      type="button"
                      className="ngo-staff-edit-button"
                      onClick={() => editMember(member)}
                      disabled={Boolean(actionId)}
                    >
                      <i className="fi fi-rr-edit" aria-hidden="true" />
                      {t("common.edit")}
                    </button>
                    <button
                      type="button"
                      className="ngo-staff-toggle-button"
                      onClick={() => toggleActive(member)}
                      disabled={Boolean(actionId)}
                    >
                      <i
                        className={`fi ${active ? "fi-rr-power" : "fi-rr-check"}`}
                        aria-hidden="true"
                      />
                      {actionId === member.id
                        ? t("common.loading")
                        : active
                          ? t("common.deactivate", {
                              defaultValue: "Deactivate",
                            })
                          : t("common.activate", { defaultValue: "Activate" })}
                    </button>
                    <button
                      type="button"
                      className="ngo-staff-delete-button"
                      onClick={() => permanentlyDelete(member)}
                      disabled={Boolean(actionId)}
                    >
                      <i className="fi fi-rr-trash" aria-hidden="true" />
                      {t("common.delete")}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </section>

      {editingMember ? (
        <div
          className="ngo-staff-drawer-backdrop"
          onMouseDown={(event) =>
            event.target === event.currentTarget && !saving && closeEditor()
          }
        >
          <aside
            className="ngo-staff-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ngo-staff-drawer-title"
          >
            <header className="ngo-staff-drawer-header">
              <div>
                <h2 id="ngo-staff-drawer-title">
                  {label("editTitle", "Edit Staff Member")}
                </h2>
                <p>
                  {label(
                    "editDescription",
                    "Update the staff member's information and role.",
                  )}
                </p>
              </div>
              <button
                type="button"
                className="ngo-staff-drawer-close"
                aria-label={t("common.close")}
                onClick={closeEditor}
                disabled={saving}
              >
                <i className="fi fi-rr-cross-small" aria-hidden="true" />
              </button>
            </header>
            <div className="ngo-staff-drawer-person">
              <span
                className={`ngo-staff-avatar ngo-staff-avatar-${editForm.role}`}
              >
                {initials(editForm.name)}
              </span>
              <span>{label(`roles.${editForm.role}`, editForm.role)}</span>
            </div>
            {error ? <div className="error-box">{error}</div> : null}
            <form className="ngo-staff-edit-form" onSubmit={updateStaff}>
              <label>
                <span>
                  {t("auth.register.fullName", { defaultValue: "Full Name" })}
                </span>
                <span className="ngo-staff-input-wrap">
                  <i className="fi fi-rr-user" aria-hidden="true" />
                  <input
                    autoFocus
                    value={editForm.name}
                    onChange={(event) =>
                      setEditForm({ ...editForm, name: event.target.value })
                    }
                    required
                  />
                </span>
              </label>
              <label>
                <span>
                  {t("auth.register.email", { defaultValue: "Email" })}
                </span>
                <span className="ngo-staff-input-wrap">
                  <i className="fi fi-rr-envelope" aria-hidden="true" />
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(event) =>
                      setEditForm({ ...editForm, email: event.target.value })
                    }
                    required
                  />
                </span>
              </label>
              <label>
                <span>
                  {t("auth.register.phone", { defaultValue: "Phone" })}
                </span>
                <span className="ngo-staff-input-wrap">
                  <i className="fi fi-rr-phone-call" aria-hidden="true" />
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(event) =>
                      setEditForm({ ...editForm, phone: event.target.value })
                    }
                    required
                  />
                </span>
              </label>
              <label>
                <span>{label("role", "Role")}</span>
                <span className="ngo-staff-input-wrap">
                  <i
                    className={`fi ${roleIcon(editForm.role)}`}
                    aria-hidden="true"
                  />
                  <select
                    value={editForm.role}
                    onChange={(event) =>
                      setEditForm({ ...editForm, role: event.target.value })
                    }
                  >
                    {roles.map((role) => (
                      <option key={role} value={role}>
                        {label(`roles.${role}`, role)}
                      </option>
                    ))}
                  </select>
                </span>
              </label>
              <label>
                <span>{label("status", "Status")}</span>
                <span className="ngo-staff-input-wrap">
                  <i
                    className={`ngo-staff-status-dot ${editForm.is_active ? "is-active" : "is-inactive"}`}
                    aria-hidden="true"
                  />
                  <select
                    value={editForm.is_active ? "active" : "inactive"}
                    onChange={(event) =>
                      setEditForm({
                        ...editForm,
                        is_active: event.target.value === "active",
                      })
                    }
                  >
                    <option value="active">{t("status.active")}</option>
                    <option value="inactive">{t("status.inactive")}</option>
                  </select>
                </span>
              </label>
              <div className="ngo-staff-drawer-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeEditor}
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
