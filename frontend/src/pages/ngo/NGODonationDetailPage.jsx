import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../../api/client";
import DonationStatusTimeline from "../../components/donations/DonationStatusTimeline";
import NGOOperationalActions from "../../components/donations/NGOOperationalActions";
import ErrorMessage from "../../components/common/ErrorMessage";
import LoadingState from "../../components/common/LoadingState";
import StatusBadge from "../../components/common/StatusBadge";
import NGOShell from "./NGOShell";
import DonorPageHeaderArtwork from "../donor/DonorPageHeaderArtwork";
import donationLeaves from "../../assets/ngo-donation-detail-leaves.png";
import "./NGODonationDetailPage.css";

export default function NGODonationDetailPage() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const [donation, setDonation] = useState(null);
  const [history, setHistory] = useState([]);
  const [pickup, setPickup] = useState(null);
  const [operations, setOperations] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [schedulingType, setSchedulingType] = useState("");
  const [reschedulingPickup, setReschedulingPickup] = useState(false);

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
      try {
        const loadedOperations = await api.getDonationOperations(id);
        setOperations(
          Array.isArray(loadedOperations)
            ? loadedOperations
            : loadedOperations?.operations || [],
        );
      } catch {
        setOperations([]);
      }
      try {
        const result = await api.getNgoStaff();
        setStaff(Array.isArray(result) ? result : result?.staff || []);
      } catch {
        setStaff([]);
      }
    } catch (err) {
      setError(t("ngo.donationDetail.loadError"));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadDonation();
  }, [loadDonation]);

  const scheduleOperation = async (event, type) => {
    if (schedulingType) return;
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const scheduledAt =
      type === "pickup"
        ? donation.pickup_scheduled_at
        : new Date(`${data.get("date")}T${data.get("time")}`).toISOString();
    if (type === "pickup" && !scheduledAt) {
      setError(t("ngo.donationDetail.schedulePickupFirst"));
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
      setNotice(
        t("ngo.donationDetail.operationScheduled", {
          operation: t(`ngo.operations.types.${type}`, type),
        }),
      );
    } catch (err) {
      setError(t("ngo.donationDetail.operationError"));
    } finally {
      setSchedulingType("");
    }
  };

  const reschedulePickup = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const date = form.get("pickup_date");
    const time = form.get("pickup_time");
    const scheduledAt = date && time ? new Date(`${date}T${time}`) : null;
    if (
      !scheduledAt ||
      Number.isNaN(scheduledAt.getTime()) ||
      scheduledAt <= new Date()
    ) {
      setError(t("ngo.donationDetail.futurePickupError"));
      return;
    }
    setReschedulingPickup(true);
    setError("");
    try {
      await api.reschedulePickup(id, {
        scheduled_at: scheduledAt.toISOString(),
      });
      await loadDonation();
      setNotice(t("ngo.donationDetail.pickupUpdated"));
    } catch (err) {
      setError(t("ngo.donationDetail.pickupUpdateError"));
    } finally {
      setReschedulingPickup(false);
    }
  };

  const activeStaff = (role) =>
    staff.filter(
      (member) => (member.active ?? member.is_active) && member.role === role,
    );
  const canScheduleOperation = (type) => {
    if (!donation) return false;
    if (type === "packaging")
      return ["matched", "packaging_notified"].includes(donation.status);
    if (type === "pickup")
      return (
        donation.status === "pickup_scheduled" &&
        Boolean(donation.pickup_scheduled_at)
      );
    if (type === "delivery")
      return ["collected", "delivered"].includes(donation.status);
    return false;
  };
  const activeOperation = (type) =>
    operations.find(
      (operation) =>
        (operation.task_type || operation.operation_type || operation.type) ===
          type && ["scheduled", "in_progress"].includes(operation.status),
    );
  const existingOperation = (type) =>
    activeOperation(type) ||
    operations.find(
      (operation) =>
        (operation.task_type || operation.operation_type || operation.type) ===
          type && operation.status === "completed",
    );
  const formatDateTime = (value) =>
    value
      ? new Date(value).toLocaleString(i18n.resolvedLanguage)
      : t("ngo.donationDetail.notScheduled");

  const donationItems = Array.isArray(donation?.items) ? donation.items : [];
  const thumbnailValue =
    donation?.image_url ||
    donation?.image ||
    donationItems.find((item) => item.image_url || item.image)?.image_url ||
    donationItems.find((item) => item.image)?.image;
  const donationThumbnail =
    typeof thumbnailValue === "string" ? thumbnailValue : thumbnailValue?.url;

  return (
    <NGOShell>
      <div className="ngo-donation-detail-header">
        <div className="ngo-donation-detail-heading">
          <nav
            className="ngo-donation-breadcrumbs"
            aria-label={t("ngo.donationDetail.breadcrumb")}
          >
            <Link to="/ngo/donations">{t("ngo.donationDetail.donations")}</Link>
            <i className="fi fi-rr-angle-right" aria-hidden="true" />
            <span>{t("ngo.donationDetail.title")}</span>
          </nav>
          <h1>
            {donation
              ? `${t("ngo.donationDetail.donation")} #${donation.id.slice(0, 8).toUpperCase()}`
              : t("ngo.donationDetail.title")}
          </h1>
          <p>{t("ngo.donationDetail.description")}</p>
        </div>
        <DonorPageHeaderArtwork />
      </div>
      {loading ? (
        <LoadingState message={t("ngo.donationDetail.loading")} />
      ) : null}
      {error ? (
        <ErrorMessage onRetry={loadDonation}>{error}</ErrorMessage>
      ) : null}
      {notice ? <div className="success-box">{notice}</div> : null}
      {donation && !loading ? (
        <>
          <div className="ngo-donation-detail-layout">
            <div className="ngo-donation-detail-main">
              <section className="info-card wide-card ngo-donation-info-card">
                <div className="ngo-detail-card-heading">
                  <span className="ngo-detail-heading-icon">
                    <i className="fi fi-rr-box-open" aria-hidden="true" />
                  </span>
                  <h2>{t("ngo.donationDetail.information")}</h2>
                  <StatusBadge status={donation.status} />
                </div>
                <div className="ngo-donation-items">
                  <div className="ngo-donation-detail-thumb" aria-hidden="true">
                    {donationThumbnail ? (
                      <img src={donationThumbnail} alt="" />
                    ) : (
                      <i className="fi fi-rr-box-open" />
                    )}
                  </div>
                  <div className="ngo-donation-detail-item-list">
                    {donationItems.length ? (
                      donationItems.map((item, index) => (
                        <div
                          className="ngo-donation-detail-item"
                          key={`${item.class_name}-${index}`}
                        >
                          <h3>
                            {item.category ||
                              item.class_name ||
                              t("ngo.donationDetail.item")}
                            {item.subcategory ? ` / ${item.subcategory}` : ""}
                          </h3>
                          <p>
                            <strong>{t("ngo.donationDetail.quantity")}:</strong>{" "}
                            {item.quantity}{" "}
                            {t(
                              item.quantity === 1
                                ? "ngo.donationDetail.oneItem"
                                : "ngo.donationDetail.manyItems",
                            )}
                            {item.was_edited_by_donor ? (
                              <>
                                {" "}
                                <span className="ngo-detail-separator">
                                  |
                                </span>{" "}
                                {t("ngo.donationDetail.reviewedByDonor")}
                              </>
                            ) : null}
                          </p>
                          <div className="ngo-donation-detail-tags">
                            <span>
                              <i className="fi fi-rr-box" aria-hidden="true" />
                              {item.category ||
                                item.class_name ||
                                t("ngo.donationDetail.other")}
                            </span>
                            {item.subcategory ? (
                              <span>{item.subcategory}</span>
                            ) : null}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="muted-text">
                        {t("ngo.donationDetail.itemsUnavailable")}
                      </p>
                    )}
                    {donation.donor_name || donation.donor?.name ? (
                      <p className="ngo-donor-name">
                        {t("ngo.donationDetail.donor")}:{" "}
                        {donation.donor_name || donation.donor.name}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="ngo-donation-primary-action">
                  <NGOOperationalActions
                    donation={donation}
                    onUpdated={async () => {
                      await loadDonation();
                      setNotice(t("ngo.donationDetail.donationUpdated"));
                    }}
                  />
                </div>
              </section>
              <div className="info-card wide-card">
                <div className="ngo-detail-card-heading ngo-operations-heading">
                  <span className="ngo-detail-heading-icon">
                    <i className="fi fi-rr-box" aria-hidden="true" />
                  </span>
                  <div>
                    <h2>{t("ngo.donationDetail.operations")}</h2>
                    <p>
                      {operations.length
                        ? t("ngo.donationDetail.operationsDescription")
                        : t("ngo.donationDetail.noOperations")}
                    </p>
                  </div>
                </div>
                {operations.length
                  ? operations.map((operation) => (
                      <div className="operation-row" key={operation.id}>
                        <div>
                          <strong>
                            {operation.task_type ||
                              operation.operation_type ||
                              operation.type}
                          </strong>
                          <p className="muted-text">
                            {operation.assigned_staff_name ||
                              operation.staff_name ||
                              operation.staff?.name ||
                              t("ngo.donationDetail.unassigned")}{" "}
                            <span aria-hidden="true">·</span> {operation.status}
                          </p>
                        </div>
                        <span>
                          {operation.scheduled_at
                            ? new Date(operation.scheduled_at).toLocaleString()
                            : t("ngo.donationDetail.notScheduled")}
                        </span>
                      </div>
                    ))
                  : null}
                {[
                  ["packaging", "packaging", "schedulePackaging"],
                  ["pickup", "pickup", "schedulePickup"],
                  ["delivery", "delivery", "scheduleDelivery"],
                ]
                  .filter(([type]) => canScheduleOperation(type))
                  .map(([type, role, labelKey]) => {
                    const existing = existingOperation(type);
                    const label = t(`ngo.donationDetail.${labelKey}`);
                    return existing ? (
                      <div className="operation-assignment" key={type}>
                        <h3>{label}</h3>
                        <p>
                          {existing.staff?.name ||
                            existing.assigned_staff_name ||
                            existing.staff_name ||
                            t("ngo.donationDetail.assignedStaff")}{" "}
                          <span aria-hidden="true">·</span> {existing.status}
                        </p>
                        <p className="muted-text">
                          {existing.scheduled_at
                            ? new Date(existing.scheduled_at).toLocaleString()
                            : t("ngo.donationDetail.noScheduleSet")}
                        </p>
                        <p className="muted-text">
                          {t("ngo.donationDetail.alreadyScheduled", {
                            operation: label,
                          })}
                        </p>
                      </div>
                    ) : (
                      <form
                        className="operation-assignment"
                        key={type}
                        onSubmit={(event) => scheduleOperation(event, type)}
                      >
                        <h3>{label}</h3>
                        <div className="form-grid-two">
                          <label>
                            {t("ngo.donationDetail.staff")}
                            <select name="staff_id" required>
                              <option value="">
                                {t("ngo.donationDetail.selectStaff")}
                              </option>
                              {activeStaff(role).map((member) => (
                                <option key={member.id} value={member.id}>
                                  {member.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            {t("ngo.donationDetail.date")}
                            <input
                              type="date"
                              name="date"
                              min={new Date().toISOString().slice(0, 10)}
                              defaultValue={
                                type === "pickup" &&
                                donation.pickup_scheduled_at
                                  ? new Date(donation.pickup_scheduled_at)
                                      .toISOString()
                                      .slice(0, 10)
                                  : undefined
                              }
                              required
                            />
                          </label>
                          <label>
                            {t("ngo.donationDetail.time")}
                            <input
                              type="time"
                              name="time"
                              defaultValue={
                                type === "pickup" &&
                                donation.pickup_scheduled_at
                                  ? new Date(donation.pickup_scheduled_at)
                                      .toTimeString()
                                      .slice(0, 5)
                                  : undefined
                              }
                              required
                            />
                          </label>
                          <label>
                            {t("ngo.donationDetail.notes")}
                            <input name="notes" />
                          </label>
                        </div>
                        <button
                          type="submit"
                          className="secondary-button"
                          disabled={Boolean(schedulingType)}
                        >
                          {schedulingType === type
                            ? t("ngo.donationDetail.saving")
                            : label}
                        </button>
                      </form>
                    );
                  })}
              </div>
              <div className="info-card wide-card ngo-pickup-card">
                <div className="ngo-detail-card-heading ngo-operations-heading">
                  <span className="ngo-detail-heading-icon">
                    <i className="fi fi-rr-truck-side" aria-hidden="true" />
                  </span>
                  <div>
                    <h2>{t("ngo.donationDetail.pickup")}</h2>
                    <p>
                      {pickup?.pickup_scheduled_at ||
                      donation.pickup_scheduled_at
                        ? t("ngo.donationDetail.pickupDescription")
                        : t("ngo.donationDetail.pickupUnavailable")}
                    </p>
                  </div>
                </div>
                {pickup?.pickup_scheduled_at || donation.pickup_scheduled_at ? (
                  <>
                    <p>
                      {t("ngo.donationDetail.scheduled")}:{" "}
                      {new Date(
                        pickup?.pickup_scheduled_at ||
                          donation.pickup_scheduled_at,
                      ).toLocaleString()}
                    </p>
                    {donation.status === "pickup_scheduled" &&
                    !activeOperation("pickup") ? (
                      <form
                        className="operation-assignment"
                        onSubmit={reschedulePickup}
                      >
                        <h3>{t("ngo.donationDetail.changePickupTime")}</h3>
                        <div className="form-grid-two">
                          <label>
                            {t("ngo.donationDetail.date")}
                            <input
                              type="date"
                              name="pickup_date"
                              min={new Date(
                                Date.now() -
                                  new Date().getTimezoneOffset() * 60000,
                              )
                                .toISOString()
                                .slice(0, 10)}
                              required
                            />
                          </label>
                          <label>
                            {t("ngo.donationDetail.time")}
                            <input type="time" name="pickup_time" required />
                          </label>
                        </div>
                        <button
                          type="submit"
                          className="secondary-button"
                          disabled={reschedulingPickup}
                        >
                          {reschedulingPickup
                            ? t("ngo.donationDetail.updating")
                            : t("ngo.donationDetail.updatePickupTime")}
                        </button>
                      </form>
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>
            <aside className="ngo-donation-detail-status info-card wide-card timeline-card">
              <div className="ngo-detail-card-heading ngo-status-heading">
                <h2>{t("ngo.donationDetail.status")}</h2>
              </div>
              <DonationStatusTimeline
                status={donation.status}
                history={history}
              />
            </aside>
            <img
              className="ngo-donation-detail-leaves"
              src={donationLeaves}
              alt=""
              aria-hidden="true"
            />
          </div>
        </>
      ) : null}
    </NGOShell>
  );
}
