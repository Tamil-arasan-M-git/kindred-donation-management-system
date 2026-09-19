import { useEffect, useState } from "react";
import api from "../../api/client";
import EmptyState from "../../components/common/EmptyState";
import ErrorMessage from "../../components/common/ErrorMessage";
import LoadingState from "../../components/common/LoadingState";
import PageHeader from "../../components/layout/PageHeader";
import NGOShell from "./NGOShell";

const roles = ["packaging", "pickup", "delivery"];
const blankForm = { name: "", phone: "", email: "", role: "packaging" };
const asList = (payload) => Array.isArray(payload) ? payload : payload?.staff || [];

export default function NGOStaffPage() {
  const [staff, setStaff] = useState([]);
  const [form, setForm] = useState(blankForm);
  const [editingId, setEditingId] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadStaff = async () => {
    setLoading(true);
    setError("");
    try { setStaff(asList(await api.getNgoStaff())); }
    catch (err) { setError(err.message || "Staff records could not be loaded."); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadStaff(); }, []);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true); setError(""); setNotice("");
    try {
      if (editingId) await api.updateNgoStaff(editingId, form);
      else await api.createNgoStaff(form);
      await loadStaff();
      setForm(blankForm); setEditingId(""); setShowForm(false);
      setNotice(editingId ? "Staff member updated." : "Staff member added.");
    } catch (err) { setError(err.message || "Staff member could not be saved."); }
    finally { setSaving(false); }
  };

  const deactivate = async (member) => {
    if (!window.confirm(`Deactivate ${member.name}?`)) return;
    try { await api.deleteNgoStaff(member.id); await loadStaff(); setNotice("Staff member deactivated."); }
    catch (err) { setError(err.message || "Staff member could not be deactivated."); }
  };

  const visible = staff.filter((member) =>
    (roleFilter === "all" || member.role === roleFilter) &&
    (activeFilter === "all" || Boolean(member.active ?? member.is_active) === (activeFilter === "active")),
  );

  return <NGOShell>
    <PageHeader eyebrow="NGO team" title="Staff management" description="Manage staff who handle packaging, pickup, and delivery operations." action={<button type="button" className="primary-button" onClick={() => { setShowForm((value) => !value); setEditingId(""); setForm(blankForm); }}>{showForm ? "Close form" : "Add staff"}</button>} />
    {error ? <ErrorMessage onRetry={loadStaff}>{error}</ErrorMessage> : null}
    {notice ? <div className="success-box">{notice}</div> : null}
    {showForm ? <form className="info-card staff-form" onSubmit={submit}>
      <label>Name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
      <label>Phone<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} required /></label>
      <label>Email<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></label>
      <label>Role<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>{roles.map((role) => <option key={role} value={role}>{role}</option>)}</select></label>
      <button type="submit" className="primary-button" disabled={saving}>{saving ? "Saving..." : editingId ? "Update staff" : "Add staff"}</button>
    </form> : null}
    <div className="filter-row">
      <select className="filter-select" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}><option value="all">All roles</option>{roles.map((role) => <option key={role} value={role}>{role}</option>)}</select>
      <select className="filter-select" value={activeFilter} onChange={(event) => setActiveFilter(event.target.value)}><option value="all">All staff</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
    </div>
    {loading ? <LoadingState message="Loading staff..." /> : null}
    {!loading && !visible.length ? <EmptyState title="No staff found">Add staff members to assign operational work.</EmptyState> : null}
    {!loading && visible.length ? <div className="card-grid staff-grid">{visible.map((member) => { const active = member.active ?? member.is_active; return <article className="info-card staff-card" key={member.id}><div className="section-heading"><h2>{member.name}</h2><span className={`status-pill ${active ? "status-matched" : "status-cancelled"}`}>{active ? "Active" : "Inactive"}</span></div><p>{member.role}</p><p>{member.phone}</p><p>{member.email}</p><div className="action-stack">{active ? <><button type="button" className="secondary-button" onClick={() => { setEditingId(member.id); setForm({ name: member.name || "", phone: member.phone || "", email: member.email || "", role: member.role || "packaging" }); setShowForm(true); }}>Edit</button><button type="button" className="secondary-button" onClick={() => deactivate(member)}>Deactivate</button></> : null}</div></article>; })}</div> : null}
  </NGOShell>;
}
