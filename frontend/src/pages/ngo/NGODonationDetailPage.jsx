import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../../api/client";
import DonationStatusTimeline from "../../components/donations/DonationStatusTimeline";
import NGOOperationalActions from "../../components/donations/NGOOperationalActions";
import ErrorMessage from "../../components/common/ErrorMessage";
import LoadingState from "../../components/common/LoadingState";
import StatusBadge from "../../components/common/StatusBadge";
import PageHeader from "../../components/layout/PageHeader";
import NGOShell from "./NGOShell";

export default function NGODonationDetailPage() {
  const { id } = useParams();
  const [donation, setDonation] = useState(null);
  const [history, setHistory] = useState([]);
  const [pickup, setPickup] = useState(null);
  const [operations, setOperations] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [schedulingType, setSchedulingType] = useState("");

  const loadDonation = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [loadedDonation, loadedHistory] = await Promise.all([
        api.getDonation(id),
        api.getStatusHistory(id),
      ]);
      setDonation(loadedDonation);
      setHistory(loadedHistory.history || []);
      try {
        setPickup(await api.getPickup(id));
      } catch {
        setPickup(null);
      }
      try { const loadedOperations = await api.getDonationOperations(id); setOperations(Array.isArray(loadedOperations) ? loadedOperations : loadedOperations?.operations || []); } catch { setOperations([]); }
      try { const result = await api.getNgoStaff(); setStaff(Array.isArray(result) ? result : result?.staff || []); } catch { setStaff([]); }
    } catch (err) {
      setError(err.message || "Donation details could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadDonation(); }, [loadDonation]);

  const scheduleOperation = async (event, type) => {
    if (schedulingType) return;
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const scheduledAt = type === "pickup"
      ? donation.pickup_scheduled_at
      : new Date(`${data.get("date")}T${data.get("time")}`).toISOString();
    if (type === "pickup" && !scheduledAt) {
      setError("Schedule the donation pickup before assigning a pickup operation.");
      return;
    }
    setSchedulingType(type);
    try {
      await api.createDonationOperation(id, {
        task_type: type,
        staff_id: data.get("staff_id"),
        scheduled_at: scheduledAt,
        notes: data.get("notes"),
      });
      await loadDonation();
      setNotice(`${type} operation scheduled.`);
    } catch (err) { setError(err.message || "Operation could not be scheduled."); }
    finally { setSchedulingType(""); }
  };

  const activeStaff = (role) => staff.filter((member) => (member.active ?? member.is_active) && member.role === role);
  const canScheduleOperation = (type) => {
    if (!donation) return false;
    if (type === "packaging") return ["matched", "packaging_notified"].includes(donation.status);
    if (type === "pickup") return donation.status === "pickup_scheduled" && Boolean(donation.pickup_scheduled_at);
    if (type === "delivery") return ["collected", "delivered"].includes(donation.status);
    return false;
  };
  const activeOperation = (type) => operations.find((operation) =>
    (operation.task_type || operation.operation_type || operation.type) === type &&
    ["scheduled", "in_progress"].includes(operation.status),
  );

  return (
    <NGOShell>
      <PageHeader eyebrow="Donation detail" title={donation ? `Donation #${donation.id.slice(0, 8).toUpperCase()}` : "Donation detail"} description="Manage this donation through its backend-authorized lifecycle." />
      {loading ? <LoadingState message="Loading donation details..." /> : null}
      {error ? <ErrorMessage onRetry={loadDonation}>{error}</ErrorMessage> : null}
      {notice ? <div className="success-box">{notice}</div> : null}
      {donation && !loading ? (
        <>
          <div className="info-card wide-card">
            <div className="section-heading"><h2>Donation information</h2><StatusBadge status={donation.status} /></div>
            <p>{(donation.items || []).map((item) => `${item.class_name} × ${item.quantity}`).join(", ") || "Items unavailable"}</p>
            {donation.donor_name || donation.donor?.name ? <p>Donor: {donation.donor_name || donation.donor.name}</p> : null}
            <NGOOperationalActions donation={donation} onUpdated={async () => { await loadDonation(); setNotice("Donation status updated successfully."); }} />
          </div>
          <div className="info-card wide-card">
            <h2>Operations</h2>
            {operations.length ? operations.map((operation) => <div className="operation-row" key={operation.id}><div><strong>{operation.task_type || operation.operation_type || operation.type}</strong><p className="muted-text">{operation.assigned_staff_name || operation.staff_name || operation.staff?.name || "Unassigned"} · {operation.status}</p></div><span>{operation.scheduled_at ? new Date(operation.scheduled_at).toLocaleString() : "Not scheduled"}</span></div>) : <p className="muted-text">No operations assigned yet.</p>}
            {[['packaging', 'packaging', 'Schedule Packaging'], ['pickup', 'pickup', 'Schedule Pickup'], ['delivery', 'delivery', 'Schedule Delivery']].filter(([type]) => canScheduleOperation(type)).map(([type, role, label]) => { const existing = activeOperation(type); return existing ? <div className="operation-assignment" key={type}><h3>{label}</h3><p>{existing.staff?.name || existing.assigned_staff_name || existing.staff_name || "Assigned staff"} · {existing.status}</p><p className="muted-text">{existing.scheduled_at ? new Date(existing.scheduled_at).toLocaleString() : "No schedule set"}</p><p className="muted-text">An active {type} operation already exists. Update it from the Operations Center.</p></div> : <form className="operation-assignment" key={type} onSubmit={(event) => scheduleOperation(event, type)}><h3>{label}</h3><div className="form-grid-two"><label>Staff<select name="staff_id" required><option value="">Select staff</option>{activeStaff(role).map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label><label>Date<input type="date" name="date" min={new Date().toISOString().slice(0, 10)} defaultValue={type === "pickup" && donation.pickup_scheduled_at ? new Date(donation.pickup_scheduled_at).toISOString().slice(0, 10) : undefined} required /></label><label>Time<input type="time" name="time" defaultValue={type === "pickup" && donation.pickup_scheduled_at ? new Date(donation.pickup_scheduled_at).toTimeString().slice(0, 5) : undefined} required /></label><label>Notes<input name="notes" /></label></div><button type="submit" className="secondary-button" disabled={Boolean(schedulingType)}>{schedulingType === type ? "Saving..." : label}</button></form>; })}
          </div>
          <div className="info-card wide-card timeline-card"><h2>Status</h2><DonationStatusTimeline status={donation.status} history={history} /></div>
          <div className="info-card wide-card">
            <h2>Pickup</h2>
            {pickup?.pickup_scheduled_at || donation.pickup_scheduled_at ? <p>Scheduled: {new Date(pickup?.pickup_scheduled_at || donation.pickup_scheduled_at).toLocaleString()}</p> : <p className="muted-text">No pickup information is available yet.</p>}
          </div>
        </>
      ) : null}
    </NGOShell>
  );
}
