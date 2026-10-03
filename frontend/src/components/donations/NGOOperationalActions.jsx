import { useState } from "react";
import { useTranslation } from "react-i18next";
import api from "../../api/client";

const ACTIONS = {
  matched: ["packaging_notified", "notifyPackaging"],
  pickup_scheduled: ["collected", "markCollected"],
  collected: ["delivered", "markDelivered"],
  delivered: ["acknowledged", "acknowledgeDonation"],
};

export default function NGOOperationalActions({ donation, onUpdated }) {
  const { t } = useTranslation();
  const [actionId, setActionId] = useState("");
  const [error, setError] = useState("");
  const action = ACTIONS[donation?.status];
  if (!action) return null;
  const actionLabel = t(`ngo.operationalActions.${action[1]}`);

  const runAction = async () => {
    if (
      !window.confirm(
        t("ngo.donationDetail.confirmAction", { action: actionLabel }),
      )
    )
      return;
    setActionId(action[0]);
    setError("");
    try {
      if (action[0] === "packaging_notified")
        await api.notifyPackaging(donation.id);
      else await api.updateDonationStatus(donation.id, action[0]);
      await onUpdated?.();
    } catch (err) {
      setError(t("ngo.donationDetail.actionError"));
    } finally {
      setActionId("");
    }
  };

  return (
    <div className="action-stack">
      <button
        type="button"
        className="primary-button"
        onClick={runAction}
        disabled={Boolean(actionId)}
      >
        {actionId ? t("ngo.donationDetail.saving") : actionLabel}
      </button>
      {error ? <span className="error-box">{error}</span> : null}
    </div>
  );
}
