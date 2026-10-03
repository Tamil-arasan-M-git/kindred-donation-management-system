import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import api from "../../api/client";
import LoadingState from "../common/LoadingState";

const fallbackTasks = ["clean", "removeDocuments", "stack", "pack", "label"];
const taskTranslationKeys = {
  "clean the donated items": "clean",
  "remove personal documents": "removeDocuments",
  "stack items securely": "stack",
  "pack safely": "pack",
  "label the package": "label",
};

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
  const { t } = useTranslation();
  const [tasks, setTasks] = useState([]);
  const [checked, setChecked] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getPackagingChecklist(donation.id)
      .then((payload) => setTasks(normalizeTasks(payload)))
      .catch(() => setError(t("donor.journey.checklistLoadError")))
      .finally(() => setLoading(false));
  }, [donation.id]);

  const completed = useMemo(
    () => Object.values(checked).filter(Boolean).length,
    [checked],
  );
  useEffect(() => {
    onReady?.(tasks.length > 0 && completed === tasks.length);
  }, [completed, onReady, tasks.length]);

  if (loading)
    return <LoadingState variant="checklist" message={t("donor.journey.checklistLoading")} />;
  if (error) return <p className="muted-text">{error}</p>;

  return (
    <div className="packaging-checklist">
      <p className="muted-text">{t("donor.journey.checklistIntro")}</p>
      {tasks.map((task, index) => (
        <label className="checklist-item" key={`${task}-${index}`}>
          <input
            type="checkbox"
            checked={Boolean(checked[index])}
            onChange={(event) =>
              setChecked((current) => ({
                ...current,
                [index]: event.target.checked,
              }))
            }
          />
          <span>
            {(() => {
              const translationKey = fallbackTasks.includes(task)
                ? task
                : taskTranslationKeys[String(task).trim().toLowerCase()];
              return translationKey
                ? t(`donor.journey.checklistTasks.${translationKey}`)
                : task;
            })()}
          </span>
        </label>
      ))}
      <strong>
        {t("donor.journey.checklistProgress", {
          completed,
          total: tasks.length,
        })}
      </strong>
    </div>
  );
}
