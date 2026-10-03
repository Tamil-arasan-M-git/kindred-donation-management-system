import "./MatchDetailsModal.css";
import { useTranslation } from "react-i18next";

const factors = [
  { key: "item_match_score", label: "itemCompatibility", weight: 0.4 },
  { key: "quantity_score", label: "quantityFit", weight: 0.25 },
  { key: "distance_score", label: "distance", weight: 0.2 },
  { key: "priority_score", label: "demandPriority", weight: 0.15 },
];

const percent = (value) => `${Math.round((Number(value) || 0) * 100)}%`;

export default function MatchDetailsModal({
  match,
  loading = false,
  error = "",
  onClose,
}) {
  const { t } = useTranslation();
  if (!match && !loading) return null;

  const score = Number(match?.score) || 0;
  return (
    <div
      className="match-modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="match-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="match-modal-title"
      >
        <button
          type="button"
          className="match-modal-close"
          aria-label={t("donor.matches.closeDetails")}
          onClick={onClose}
        >
          &times;
        </button>
        <p className="eyebrow">{t("donor.matches.breakdown")}</p>
        <h2 id="match-modal-title">
          {match?.ngo_name ||
            match?.ngo?.name ||
            t("donor.matches.matchDetails")}
        </h2>
        {loading ? (
          <p className="muted-text">{t("donor.matches.loadingDetails")}</p>
        ) : null}
        {error ? <div className="error-box">{error}</div> : null}
        {!loading && !error && match ? (
          <>
            <div className="match-modal-score">
              <strong>{percent(score)}</strong>
              <span>{t("donor.matches.overallMatch")}</span>
            </div>
            <p className="muted-text">{t("donor.matches.scoreExplanation")}</p>
            {match.donation?.items?.length || match.requirements?.length ? (
              <div className="match-modal-context">
                {match.donation?.items?.length ? (
                  <p>
                    <strong>{t("donor.matches.donationLabel")}:</strong>{" "}
                    {match.donation.items
                      .map(
                        (item) =>
                          `${t(`categories.${String(item.category || item.class_name || "").toLowerCase()}`, { defaultValue: item.category || item.class_name })}${item.subcategory ? ` / ${t(`categories.${String(item.subcategory).toLowerCase()}`, { defaultValue: item.subcategory })}` : ""} x ${item.quantity}`,
                      )
                      .join(", ")}
                  </p>
                ) : null}
                {match.requirements?.length ? (
                  <p>
                    <strong>{t("donor.matches.demandLabel")}:</strong>{" "}
                    {match.requirements
                      .map(
                        (item) =>
                          `${t(`categories.${String(item.category || "").toLowerCase()}`, { defaultValue: item.category })}${item.subcategory ? ` / ${t(`categories.${String(item.subcategory).toLowerCase()}`, { defaultValue: item.subcategory })}` : ` / ${t("donor.journey.anySubcategory")}`} - ${t("donor.matches.needsCount", { count: item.quantity_needed })}`,
                      )
                      .join("; ")}
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="match-score-breakdown">
              {factors.map(({ key, label, weight }) => {
                const component = Number(match[key]) || 0;
                const contribution = component * weight;
                return (
                  <div className="match-score-factor" key={key}>
                    <div className="match-score-factor-heading">
                      <strong>{t(`donor.matches.factors.${label}`)}</strong>
                      <span>
                        {t("donor.matches.of100", {
                          value: percent(contribution),
                        })}
                      </span>
                    </div>
                    <div className="match-score-track">
                      <span
                        style={{
                          width: `${Math.max(0, Math.min(100, contribution * 100))}%`,
                        }}
                      />
                    </div>
                    <p>
                      {t("donor.matches.fitWeighted", {
                        fit: percent(component),
                        weight: percent(weight),
                      })}
                    </p>
                  </div>
                );
              })}
            </div>
            <p className="match-modal-note">{t("donor.matches.scoringNote")}</p>
          </>
        ) : null}
      </section>
    </div>
  );
}
