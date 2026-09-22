import { useState } from "react";
import api from "../../api/client";

const ACTIONS = {
  matched: ["packaging_notified", "Notify Packaging"],
  pickup_scheduled: ["collected", "Mark Collected"],
  collected: ["delivered", "Mark Delivered"],
  delivered: ["acknowledged", "Acknowledge Donation"],
};

export default function NGOOperationalActions({ donation, onUpdated }) {
  const [actionId, setActionId] = useState("");
  const [error, setError] = useState("");
  const action = ACTIONS[donation?.status];
  if (!action) return null;

  const runAction = async () => {
    if (!window.confirm(`${action[1]}?`)) return;
    setActionId(action[0]);
    setError("");
    try {
      if (action[0] === "packaging_notified") await api.notifyPackaging(donation.id);
      else await api.updateDonationStatus(donation.id, action[0]);
      await onUpdated?.();
    } catch (err) {
      setError(err.message || "This donation action could not be completed.");
    } finally {
      setActionId("");
    }
  };

  return (
    <div className="action-stack">
      <button type="button" className="primary-button" onClick={runAction} disabled={Boolean(actionId)}>
        {actionId ? "Saving..." : action[1]}
      </button>
      {error ? <span className="error-box">{error}</span> : null}
    </div>
  );
}
