import { useState } from "react";
import { useTranslation } from "react-i18next";
import api from "../../api/client";

export default function PickupScheduler({ donation, onScheduled }) {
  const { t } = useTranslation();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const schedule = async (event) => {
    event.preventDefault();
    setError("");
    if (!date || !time || new Date(`${date}T${time}`) <= new Date()) {
      setError(t("donor.journey.pickupFutureError"));
      return;
    }
    setSaving(true);
    try {
      const result = await api.schedulePickup(donation.id, {
        scheduled_at: new Date(`${date}T${time}`).toISOString(),
      });
      onScheduled?.(result);
    } catch {
      setError(t("donor.journey.pickupError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="pickup-scheduler" onSubmit={schedule}>
      <div className="form-grid-two">
        <label>
          {t("donor.journey.dateLabel")}
          <input
            type="date"
            min={new Date().toISOString().slice(0, 10)}
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
          />
        </label>
        <label>
          {t("donor.journey.timeLabel")}
          <input
            type="time"
            value={time}
            onChange={(event) => setTime(event.target.value)}
            required
          />
        </label>
      </div>
      {error ? <div className="error-box">{error}</div> : null}
      <button type="submit" className="primary-button" disabled={saving}>
        {saving
          ? t("donor.journey.scheduling")
          : t("donor.journey.schedulePickup")}
      </button>
    </form>
  );
}
