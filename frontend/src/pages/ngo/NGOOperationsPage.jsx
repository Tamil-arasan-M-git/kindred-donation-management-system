import { useEffect, useMemo, useState } from "react";
import api from "../../api/client";
import EmptyState from "../../components/common/EmptyState";
import ErrorMessage from "../../components/common/ErrorMessage";
import LoadingState from "../../components/common/LoadingState";
import PageHeader from "../../components/layout/PageHeader";
import NGOShell from "./NGOShell";

const asList = (payload) => Array.isArray(payload) ? payload : payload?.operations || [];
const filters = ["all", "packaging", "pickup", "delivery", "scheduled", "in_progress", "completed", "cancelled", "unassigned"];

export default function NGOOperationsPage() {
  const [operations, setOperations] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [updatingId, setUpdatingId] = useState("");
  const load = async () => { setLoading(true); setError(""); try { setOperations(asList(await api.getTodayNgoOperations())); } catch (err) { setError(err.message || "Operations could not be loaded."); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  const visible = useMemo(() => operations.filter((operation) => filter === "all" || operation.type === filter || operation.task_type === filter || operation.operation_type === filter || operation.status === filter || (filter === "unassigned" && !operation.staff && !operation.assigned_staff_id && !operation.staff_id)), [operations, filter]);
  const update = async (operation, status) => { if (updatingId) return; setUpdatingId(operation.id); setError(""); try { await api.updateDonationOperation(operation.donation_id, operation.id, { status }); await load(); setNotice(`Operation marked ${status.replace("_", " ")}.`); } catch (err) { setError(err.message || "Operation could not be updated."); } finally { setUpdatingId(""); } };
  const counts = { pending: operations.filter((item) => ["scheduled", "pending"].includes(item.status)).length, completed: operations.filter((item) => item.status === "completed").length };
  return <NGOShell><PageHeader eyebrow="Operations" title="Operations center" description="Coordinate packaging, pickup, and delivery work for your donations." />{error ? <ErrorMessage onRetry={load}>{error}</ErrorMessage> : null}{notice ? <div className="success-box">{notice}</div> : null}<div className="stats-grid"><div className="stat-card"><span>Today's tasks</span><strong>{operations.length}</strong></div><div className="stat-card"><span>Pending</span><strong>{counts.pending}</strong></div><div className="stat-card"><span>Completed today</span><strong>{counts.completed}</strong></div></div><div className="filter-row">{filters.map((value) => <button type="button" key={value} className={`filter-button ${filter === value ? "selected" : ""}`} onClick={() => setFilter(value)}>{value.replace("_", " ")}</button>)}</div>{loading ? <LoadingState message="Loading today's operations..." /> : null}{!loading && !visible.length ? <EmptyState title="No operations found">There are no operational tasks for this filter.</EmptyState> : null}{!loading && visible.length ? <div className="card-grid">{visible.map((operation) => <article className="info-card operation-card" key={operation.id}><div className="section-heading"><h2>{operation.task_type || operation.type || operation.operation_type || "Operation"}</h2><span className="status-pill status-submitted">{operation.status || "scheduled"}</span></div><p>Donation: {operation.donation_id?.slice(0, 8) || "Unavailable"}</p><p>{operation.assigned_staff_name || operation.staff_name || operation.staff?.name || "Unassigned"}</p>{operation.notes ? <p className="muted-text">{operation.notes}</p> : null}<p className="muted-text">{operation.scheduled_at ? new Date(operation.scheduled_at).toLocaleString() : "No schedule set"}</p><div className="action-stack">{operation.status === "scheduled" ? <button type="button" className="primary-button" disabled={Boolean(updatingId)} onClick={() => update(operation, "in_progress")}>{updatingId === operation.id ? "Saving..." : "Start"}</button> : null}{operation.status === "in_progress" ? <button type="button" className="primary-button" disabled={Boolean(updatingId)} onClick={() => update(operation, "completed")}>{updatingId === operation.id ? "Saving..." : "Complete"}</button> : null}{["scheduled", "in_progress"].includes(operation.status) ? <button type="button" className="secondary-button" disabled={Boolean(updatingId)} onClick={() => update(operation, "cancelled")}>Cancel</button> : null}</div></article>)}</div> : null}</NGOShell>;
}
