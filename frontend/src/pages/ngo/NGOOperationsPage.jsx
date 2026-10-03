import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import api from "../../api/client";
import EmptyState from "../../components/common/EmptyState";
import ErrorMessage from "../../components/common/ErrorMessage";
import LoadingState from "../../components/common/LoadingState";
import NGOShell from "./NGOShell";
import operationsBanner from "../../assets/ngo-operations-banner.jpg";
import "./NGOOperationsPage.css";

const asList = (payload) =>
  Array.isArray(payload) ? payload : payload?.operations || [];
const filters = [
  "all",
  "packaging",
  "pickup",
  "delivery",
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
  "unassigned",
];
const taskLabel = (operation) =>
  operation.task_type ||
  operation.type ||
  operation.operation_type ||
  "operation";
const taskIcon = (type) => {
  if (type === "pickup" || type === "delivery") return "fi fi-rr-truck-side";
  return "fi fi-rr-box-open";
};
const shortDonationId = (id, fallback) => id?.slice(0, 8) || fallback;

export default function NGOOperationsPage() {
  const { t } = useTranslation();
  const [operations, setOperations] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [updatingId, setUpdatingId] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setOperations(asList(await api.getNgoOperations({ limit: 100 })));
    } catch (err) {
      setError(t("errors.generic"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const visible = useMemo(
    () =>
      operations.filter(
        (operation) =>
          filter === "all" ||
          operation.type === filter ||
          operation.task_type === filter ||
          operation.operation_type === filter ||
          operation.status === filter ||
          (filter === "unassigned" &&
            !operation.staff &&
            !operation.assigned_staff_id &&
            !operation.staff_id),
      ),
    [operations, filter],
  );

  const update = async (operation, status) => {
    if (updatingId) return;
    setUpdatingId(operation.id);
    setError("");
    try {
      await api.updateDonationOperation(operation.donation_id, operation.id, {
        status,
      });
      await load();
      setNotice(t("common.success"));
    } catch (err) {
      setError(t("errors.generic"));
    } finally {
      setUpdatingId("");
    }
  };

  const counts = {
    pending: operations.filter((item) =>
      ["scheduled", "pending"].includes(item.status),
    ).length,
    completed: operations.filter((item) => item.status === "completed").length,
  };

  const filterLabel = (value) =>
    t(`ngo.operations.filters.${value}`, {
      defaultValue: value.replace("_", " "),
    });
  const statusLabel = (status) =>
    t(`status.${status}`, {
      defaultValue: (status || "scheduled").replaceAll("_", " "),
    });
  const typeLabel = (type) =>
    t(`ngo.operations.types.${type}`, {
      defaultValue: type.replaceAll("_", " "),
    });

  return (
    <NGOShell>
      <header className="ngo-operations-header">
        <div className="ngo-operations-heading">
          <p className="ngo-operations-eyebrow">{t("navigation.operations")}</p>
          <h1>{t("ngo.operations.title")}</h1>
          <p>
            {t("ngo.operations.description", {
              defaultValue:
                "Coordinate packaging, pickup, and delivery work for your donations.",
            })}
          </p>
        </div>
        <img src={operationsBanner} alt="" aria-hidden="true" />
      </header>

      {error ? <ErrorMessage onRetry={load}>{error}</ErrorMessage> : null}
      {notice ? <div className="success-box">{notice}</div> : null}

      <section
        className="ngo-operations-summary"
        aria-label={t("ngo.operations.summary", {
          defaultValue: "Operations summary",
        })}
      >
        <article className="ngo-operations-stat ngo-operations-stat-total">
          <span className="ngo-operations-stat-icon">
            <i className="fi fi-rr-box-open" aria-hidden="true" />
          </span>
          <div>
            <p>
              {t("ngo.operations.totalTasks", { defaultValue: "Total tasks" })}
            </p>
            <strong>{operations.length}</strong>
          </div>
          <i
            className="fi fi-rr-box ngo-operations-stat-decoration"
            aria-hidden="true"
          />
        </article>
        <article className="ngo-operations-stat ngo-operations-stat-pending">
          <span className="ngo-operations-stat-icon">
            <i className="fi fi-rr-hourglass-end" aria-hidden="true" />
          </span>
          <div>
            <p>{t("ngo.operations.pending", { defaultValue: "Pending" })}</p>
            <strong>{counts.pending}</strong>
          </div>
          <i
            className="fi fi-rr-hourglass-end ngo-operations-stat-decoration"
            aria-hidden="true"
          />
        </article>
        <article className="ngo-operations-stat ngo-operations-stat-completed">
          <span className="ngo-operations-stat-icon">
            <i className="fi fi-rr-check-circle" aria-hidden="true" />
          </span>
          <div>
            <p>
              {t("ngo.operations.completed", { defaultValue: "Completed" })}
            </p>
            <strong>{counts.completed}</strong>
          </div>
          <i
            className="fi fi-rr-check ngo-operations-stat-decoration"
            aria-hidden="true"
          />
        </article>
      </section>

      <nav
        className="ngo-operations-filters"
        aria-label={t("ngo.operations.filterLabel", {
          defaultValue: "Filter operations",
        })}
      >
        {filters.map((value) => (
          <button
            type="button"
            key={value}
            className={`filter-button ${filter === value ? "selected" : ""}`}
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {filterLabel(value)}
          </button>
        ))}
      </nav>

      {loading ? <LoadingState message={t("common.loading")} /> : null}
      {!loading && !visible.length ? (
        <EmptyState
          title={t("ngo.operations.emptyTitle", {
            defaultValue: "No operations found",
          })}
        >
          {t("ngo.operations.emptyDescription", {
            defaultValue: "There are no operational tasks for this filter.",
          })}
        </EmptyState>
      ) : null}
      {!loading && visible.length ? (
        <section
          className="ngo-operations-grid"
          aria-label={t("ngo.operations.taskList", {
            defaultValue: "Operation tasks",
          })}
        >
          {visible.map((operation) => {
            const type = taskLabel(operation);
            const taskStatus = operation.status || "scheduled";
            return (
              <article
                className={`ngo-operation-card ngo-operation-${type}`}
                key={operation.id}
              >
                <header className="ngo-operation-card-header">
                  <span
                    className={`ngo-operation-type-icon ngo-operation-type-${type}`}
                  >
                    <i className={taskIcon(type)} aria-hidden="true" />
                  </span>
                  <h2>{typeLabel(type)}</h2>
                  <span
                    className={`ngo-operation-status ngo-operation-status-${taskStatus}`}
                  >
                    {statusLabel(taskStatus)}
                  </span>
                </header>
                <div className="ngo-operation-card-details">
                  <p>
                    <span>
                      {t("ngo.operations.donation", {
                        defaultValue: "Donation",
                      })}
                      :
                    </span>{" "}
                    {shortDonationId(
                      operation.donation_id,
                      t("ngo.operations.unavailable"),
                    )}
                  </p>
                  <p className="ngo-operation-staff">
                    {operation.assigned_staff_name ||
                      operation.staff_name ||
                      operation.staff?.name ||
                      t("ngo.operations.unassigned", {
                        defaultValue: "Unassigned",
                      })}
                  </p>
                  {operation.notes ? (
                    <p className="ngo-operation-notes">{operation.notes}</p>
                  ) : null}
                </div>
                <p className="ngo-operation-schedule">
                  <i className="fi fi-rr-calendar" aria-hidden="true" />
                  <span>
                    {operation.scheduled_at
                      ? new Date(operation.scheduled_at).toLocaleString()
                      : t("ngo.operations.noSchedule", {
                          defaultValue: "No schedule set",
                        })}
                  </span>
                </p>
                <i
                  className={`ngo-operation-card-decoration ${taskIcon(type)}`}
                  aria-hidden="true"
                />
                <div className="ngo-operation-card-actions">
                  {taskStatus === "scheduled" ? (
                    <button
                      type="button"
                      className="primary-button"
                      disabled={Boolean(updatingId)}
                      onClick={() => update(operation, "in_progress")}
                    >
                      {updatingId === operation.id
                        ? t("common.loading")
                        : t("ngo.operations.start", { defaultValue: "Start" })}
                    </button>
                  ) : null}
                  {taskStatus === "in_progress" ? (
                    <button
                      type="button"
                      className="primary-button"
                      disabled={Boolean(updatingId)}
                      onClick={() => update(operation, "completed")}
                    >
                      {updatingId === operation.id
                        ? t("common.loading")
                        : t("common.confirm")}
                    </button>
                  ) : null}
                  {["scheduled", "in_progress"].includes(taskStatus) ? (
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={Boolean(updatingId)}
                      onClick={() => update(operation, "cancelled")}
                    >
                      {t("common.cancel")}
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </section>
      ) : null}
    </NGOShell>
  );
}
