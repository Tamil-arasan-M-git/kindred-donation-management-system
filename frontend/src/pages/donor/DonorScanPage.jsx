import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import DonorShell from "./DonorShell";
import { getReviewItemsKey, normalizeDetectionItems } from "./donorUtils";
import CameraCapture from "../../components/common/CameraCapture";

export default function DonorScanPage() {
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const previewUrlRef = useRef("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const handleDetect = async () => {
    if (!selectedFile)
      return setError("Choose an image before running detection.");
    setLoading(true);
    setError("");
    try {
      const response = await api.detectImage(selectedFile);
      const items = normalizeDetectionItems(response.items);
      setResult({ ...response, items });
      localStorage.setItem(getReviewItemsKey(user?.id), JSON.stringify(items));
    } catch (err) {
      setError(err.message || "Detection could not run for this image.");
    } finally {
      setLoading(false);
    }
  };

  const selectFile = (file) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const nextPreviewUrl = file ? URL.createObjectURL(file) : "";
    previewUrlRef.current = nextPreviewUrl;
    setSelectedFile(file);
    setPreviewUrl(nextPreviewUrl);
    setResult(null);
    setError("");
  };

  return (
    <DonorShell>
      <div className="page-header">
        <div>
          <p className="eyebrow">Scan items</p>
          <h1>Capture or upload a donation image</h1>
        </div>
      </div>
      <div className="scan-panel">
        <div className="upload-box">
          <div className="image-source-actions">
            <label className="secondary-button upload-trigger">
              Upload From Device
              <input
            type="file"
            accept="image/*"
                onChange={(event) => selectFile(event.target.files?.[0] || null)}
              />
            </label>
            <button type="button" className="primary-button" onClick={() => setCameraOpen(true)}>Take Live Photo</button>
          </div>
          {previewUrl ? (
            <img
              className="scan-preview"
              src={previewUrl}
              alt="Selected donation items"
            />
          ) : null}
          <button
            type="button"
            className="primary-button"
            onClick={handleDetect}
            disabled={loading || !selectedFile}
          >
            {loading ? "Detecting..." : "Run detection"}
          </button>
        </div>
        {error ? <div className="error-box">{error}</div> : null}
        {result ? (
          <div className="result-card">
            <h2>Detected items</h2>
            <div className="table-list">
              {result.items?.length ? (
                result.items.map((item, index) => (
                  <div
                    key={`${item.class_name}-${index}`}
                    className="table-row"
                  >
                    <span>{item.class_name}</span>
                    <span>{item.quantity}</span>
                    <span>
                      {item.confidence
                        ? `${item.confidence.toFixed(2)} confidence`
                        : "Reviewed"}
                    </span>
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  No items were detected in the uploaded image.
                </div>
              )}
            </div>
            <Link to="/donor/review" className="primary-button">
              Review and submit
            </Link>
          </div>
        ) : null}
      </div>
      {cameraOpen ? <CameraCapture onCapture={selectFile} onClose={() => setCameraOpen(false)} /> : null}
    </DonorShell>
  );
}
