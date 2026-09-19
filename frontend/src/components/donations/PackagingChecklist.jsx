import { useEffect, useMemo, useState } from "react";
import api from "../../api/client";
import LoadingState from "../common/LoadingState";

const fallbackTasks = [
  "Clean the donated items",
  "Remove personal documents",
  "Stack items securely",
  "Pack safely",
  "Label the package",
];

const normalizeTasks = (payload) => {
  const source = payload?.items || payload?.checklist || payload;
  if (!Array.isArray(source) || !source.length) return fallbackTasks;
  const tasks = source.flatMap((item) => {
    if (typeof item === "string") return [item];
    if (Array.isArray(item?.checklist)) return item.checklist;
    return [item?.label || item?.title || item?.task].filter(Boolean);
  });
  return tasks.length ? tasks : fallbackTasks;
};

export default function PackagingChecklist({ donation, onReady }) {
  const [tasks, setTasks] = useState([]);
  const [checked, setChecked] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getPackagingChecklist(donation.id)
      .then((payload) => setTasks(normalizeTasks(payload)))
      .catch(() => setError("Packaging guidance could not be loaded."))
      .finally(() => setLoading(false));
  }, [donation.id]);

  const completed = useMemo(() => Object.values(checked).filter(Boolean).length, [checked]);
  useEffect(() => {
    onReady?.(tasks.length > 0 && completed === tasks.length);
  }, [completed, onReady, tasks.length]);

  if (loading) return <LoadingState message="Loading packaging checklist..." />;
  if (error) return <p className="muted-text">{error}</p>;

  return (
    <div className="packaging-checklist">
      <p className="muted-text">Complete this checklist before scheduling pickup.</p>
      {tasks.map((task, index) => (
        <label className="checklist-item" key={`${task}-${index}`}>
          <input
            type="checkbox"
            checked={Boolean(checked[index])}
            onChange={(event) => setChecked((current) => ({ ...current, [index]: event.target.checked }))}
          />
          <span>{task}</span>
        </label>
      ))}
      <strong>{completed} / {tasks.length} completed</strong>
    </div>
  );
}
