import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import DonorShell from "./DonorShell";
import { getReviewItemsKey, normalizeDetectionItems } from "./donorUtils";
import CameraCapture from "../../components/common/CameraCapture";
import scanReferenceArt from "../../assets/donor-scan-reference-art.jpg";
import "./DonorScanPage.css";

export default function DonorScanPage() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const previewUrlRef = useRef("");
  const detectionInProgressRef = useRef(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (result) {
      localStorage.setItem(
        getReviewItemsKey(user?.id),
        JSON.stringify(result.items),
      );
    }
  }, [result, user?.id]);

  const handleDetect = async () => {
    if (detectionInProgressRef.current) return;
    if (!selectedFile) return setError(t("donor.scan.noFile"));
    detectionInProgressRef.current = true;
    setLoading(true);
    setError("");
    try {
      const response = await api.detectImage(selectedFile);
      const items = normalizeDetectionItems(response.items);
      setResult({ ...response, items });
      localStorage.setItem(getReviewItemsKey(user?.id), JSON.stringify(items));
    } catch (err) {
      setError(t("errors.generic"));
    } finally {
      detectionInProgressRef.current = false;
      setLoading(false);
    }
  };

  const updateItem = (index, field, value) => {
    setResult((current) => {
      if (!current) return current;
      const items = current.items.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [field]:
                field === "quantity" ? Math.max(1, Number(value) || 1) : value,
              needs_review: true,
              was_edited_by_donor: true,
            }
          : item,
      );
      return { ...current, items };
    });
  };

  const selectFile = (file) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const nextPreviewUrl = file ? URL.createObjectURL(file) : "";
    previewUrlRef.current = nextPreviewUrl;
    setSelectedFile(file);
    setPreviewUrl(nextPreviewUrl);
    setResult(null);
    localStorage.removeItem(getReviewItemsKey(user?.id));
    setError("");
  };

  return (
    <DonorShell>
      <div className="donor-scan-page">
        <header className="donor-scan-hero">
          <div className="donor-scan-heading">
            <p className="eyebrow">{t("navigation.scanItems")}</p>
            <h1>{t("donor.scan.title")}</h1>
            <p>{t("donor.scan.subtitle")}</p>
          </div>
          <div
            className={`donor-scan-art-wrap ${i18n.language !== "en" ? "localized-art" : ""}`}
          >
            <img
              className="donor-scan-art"
              src={scanReferenceArt}
              alt={t("donor.scan.illustrationAlt")}
            />
            {i18n.language !== "en" ? (
              <span className="donor-scan-art-message">
                {t("donor.scan.artMessage")}
              </span>
            ) : null}
          </div>
        </header>
        <div className="donor-scan-grid">
          <section className="scan-workspace">
            <div className="scan-source-tabs">
              <button
                type="button"
                className="scan-tab scan-tab-active"
                onClick={() => setCameraOpen(true)}
              >
                <i className="fi fi-rr-camera" aria-hidden="true" />
                {t("donor.scan.takePhoto")}
              </button>
              <label className="scan-tab">
                <i className="fi fi-rr-cloud-upload-alt" aria-hidden="true" />
                {t("donor.scan.upload")}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) =>
                    selectFile(event.target.files?.[0] || null)
                  }
                />
              </label>
            </div>
            <div
              className={`scan-viewfinder ${previewUrl ? "has-preview" : ""}`}
            >
              {previewUrl ? (
                <img
                  className="scan-preview"
                  src={previewUrl}
                  alt={t("donor.scan.selectedImageAlt")}
                />
              ) : (
                <div className="scan-empty-preview">
                  <span className="scan-frame-corner corner-tl" />
                  <span className="scan-frame-corner corner-tr" />
                  <span className="scan-frame-corner corner-bl" />
                  <span className="scan-frame-corner corner-br" />
                  <span className="scan-camera-hint">
                    <i className="fi fi-rr-camera" aria-hidden="true" /> &nbsp;{" "}
                    {t("donor.scan.frameHint")}
                  </span>
                  <i
                    className="fi fi-rr-camera scan-empty-icon"
                    aria-hidden="true"
                  />
                  <span>{t("donor.scan.emptyPreview")}</span>
                </div>
              )}
              <div className="scan-camera-controls">
                <label
                  className="scan-control-button"
                  aria-label={t("donor.scan.upload")}
                >
                  <i className="fi fi-rr-picture" aria-hidden="true" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) =>
                      selectFile(event.target.files?.[0] || null)
                    }
                  />
                </label>
                <button
                  type="button"
                  className="scan-shutter"
                  onClick={() => setCameraOpen(true)}
                  aria-label={t("donor.scan.takePhoto")}
                />
                <button
                  type="button"
                  className="scan-control-button"
                  onClick={() => {
                    if (previewUrl) {
                      selectFile(null);
                    } else setCameraOpen(true);
                  }}
                  aria-label={t("donor.scan.retakePhoto")}
                >
                  <i className="fi fi-rr-refresh" aria-hidden="true" />
                </button>
              </div>
            </div>
            {error ? (
              <p className="scan-inline-error" role="alert">
                {error}
              </p>
            ) : null}
            <button
              type="button"
              className="primary-button scan-detect-button"
              onClick={handleDetect}
              disabled={loading || !selectedFile}
            >
              {loading ? t("donor.scan.detecting") : t("donor.scan.detect")}
            </button>
          </section>
          <aside className="scan-guide">
            <section className="scan-guide-card scan-ai-card">
              <div className="scan-guide-icon">
                <i className="fi fi-rr-sparkles" aria-hidden="true" />
              </div>
              <div>
                <h2>{t("donor.scan.aiTitle")}</h2>
                <p>{t("donor.scan.aiDescription")}</p>
              </div>
            </section>
            <section className="scan-guide-card scan-tips-card">
              <div className="scan-guide-icon">
                <i className="fi fi-rr-bulb" aria-hidden="true" />
              </div>
              <div>
                <h2>{t("donor.scan.tipsTitle")}</h2>
                <ul>
                  {[
                    "visible",
                    "lighting",
                    "multipleItems",
                    "cleanBackground",
                    "reviewResults",
                  ].map((tip) => (
                    <li key={tip}>
                      <span>
                        <i className="fi fi-rr-check" aria-hidden="true" />
                      </span>
                      {t(`donor.scan.tips.${tip}`)}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
            <section className="scan-guide-card scan-supported-card">
              <div className="scan-supported-heading">
                <div className="scan-guide-icon">
                  <i className="fi fi-rr-box-open" aria-hidden="true" />
                </div>
                <div>
                  <h2>{t("donor.scan.supportedTitle")}</h2>
                  <p>{t("donor.scan.supportedDescription")}</p>
                </div>
              </div>
              <div className="scan-category-grid">
                {[
                  ["fi-rr-shirt", "clothing"],
                  ["fi-rr-book-alt", "books"],
                  ["fi-rr-laptop", "electronics"],
                  ["fi-rr-couch", "furniture"],
                  ["fi-rr-utensils", "utensils"],
                  ["fi-rr-bowl-rice", "food"],
                  ["fi-rr-menu-dots", "andMore"],
                ].map(([icon, label], i) => (
                  <div
                    className={`scan-category scan-category-${i}`}
                    key={label}
                  >
                    <i className={`fi ${icon}`} aria-hidden="true" />
                    {t(`donor.scan.categories.${label}`)}
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
        {result ? (
          <section className="detection-results scan-detection-results">
            <div className="scan-results-heading">
              <h2>{t("donor.scan.results")}</h2>
              <p>{t("donor.scan.resultsDescription")}</p>
            </div>
            <div className="detected-item-list">
              {result.items.map((item, index) => (
                <div key={index} className="detected-item-card">
                  <label className="scan-result-field">
                    <span>{t("donor.scan.categoryLabel")}</span>
                    <input
                      type="text"
                      value={item.category}
                      onChange={(event) =>
                        updateItem(index, "category", event.target.value)
                      }
                    />
                  </label>
                  <label className="scan-result-field">
                    <span>{t("donor.scan.subcategoryLabel")}</span>
                    <input
                      type="text"
                      value={item.subcategory}
                      onChange={(event) =>
                        updateItem(index, "subcategory", event.target.value)
                      }
                    />
                  </label>
                  <div className="scan-result-field">
                    <span>{t("donor.scan.countLabel")}</span>
                    <div className="scan-count-control">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(event) =>
                          updateItem(index, "quantity", event.target.value)
                        }
                        aria-label={t("donor.scan.countLabel")}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updateItem(
                            index,
                            "quantity",
                            Number(item.quantity) - 1,
                          )
                        }
                        aria-label={t("donor.scan.decreaseCount")}
                      >
                        −
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateItem(
                            index,
                            "quantity",
                            Number(item.quantity) + 1,
                          )
                        }
                        aria-label={t("donor.scan.increaseCount")}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <p className="muted-text">
                    {t("donor.review.confidence", {
                      value:
                        item.confidence == null
                          ? t("donor.review.notAvailable", {
                              defaultValue: "Not available",
                            })
                          : `${Math.round(item.confidence * 100)}%`,
                    })}
                  </p>
                </div>
              ))}
            </div>
            <Link to="/donor/review" className="primary-button">
              {t("donor.scan.review")}
            </Link>
          </section>
        ) : null}
      </div>
      {cameraOpen && (
        <CameraCapture
          onCapture={(file) => {
            selectFile(file);
            setCameraOpen(false);
          }}
          onClose={() => setCameraOpen(false)}
        />
      )}
    </DonorShell>
  );
}
