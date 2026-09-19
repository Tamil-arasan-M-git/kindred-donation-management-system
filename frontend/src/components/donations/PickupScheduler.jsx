import { useState } from "react";
import api from "../../api/client";

export default function PickupScheduler({ donation, onScheduled }) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const schedule = async (event) => {
    event.preventDefault();
    setError("");
    if (!date || !time || new Date(`${date}T${time}`) <= new Date()) {
      setError("Choose a future pickup date and time.");
      return;
    }
    setSaving(true);
    try {
      const result = await api.schedulePickup(donation.id, {
        scheduled_at: new Date(`${date}T${time}`).toISOString(),
      });
      onScheduled?.(result);
    } catch (err) {
      setError(err.message || "Pickup could not be scheduled.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="pickup-scheduler" onSubmit={schedule}>
      <div className="form-grid-two">
        <label>Date<input type="date" min={new Date().toISOString().slice(0, 10)} value={date} onChange={(event) => setDate(event.target.value)} required /></label>
        <label>Time<input type="time" value={time} onChange={(event) => setTime(event.target.value)} required /></label>
      </div>
      {error ? <div className="error-box">{error}</div> : null}
      <button type="submit" className="primary-button" disabled={saving}>{saving ? "Scheduling..." : "Schedule pickup"}</button>
    </form>
  );
}
