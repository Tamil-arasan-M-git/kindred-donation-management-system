import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

const cameraErrorMessage = (error, t) => {
  if (
    error?.name === "NotAllowedError" ||
    error?.name === "PermissionDeniedError"
  ) {
    return t("donor.scan.camera.permissionDenied");
  }
  if (
    error?.name === "NotFoundError" ||
    error?.name === "DevicesNotFoundError"
  ) {
    return t("donor.scan.camera.notFound");
  }
  if (error?.name === "NotReadableError" || error?.name === "TrackStartError") {
    return t("donor.scan.camera.notReadable");
  }
  return t("donor.scan.camera.generic");
};

export default function CameraCapture({ onCapture, onClose }) {
  const { t } = useTranslation();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const closeButtonRef = useRef(null);
  const capturedUrlRef = useRef("");
  const mountedRef = useRef(false);
  const [capturedFile, setCapturedFile] = useState(null);
  const [capturedUrl, setCapturedUrl] = useState("");
  const [starting, setStarting] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState("");

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const clearCapturedPreview = () => {
    if (capturedUrlRef.current) URL.revokeObjectURL(capturedUrlRef.current);
    capturedUrlRef.current = "";
    setCapturedUrl("");
    setCapturedFile(null);
  };

  const startCamera = async () => {
    stopStream();
    setStarting(true);
    setError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("unsupported");
      }
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      } catch (cameraError) {
        if (
          ["NotAllowedError", "PermissionDeniedError"].includes(
            cameraError?.name,
          )
        )
          throw cameraError;
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
    } catch (cameraError) {
      setError(
        cameraError?.message === "unsupported"
          ? t("donor.scan.camera.unsupported")
          : cameraErrorMessage(cameraError, t),
      );
    } finally {
      setStarting(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    startCamera();
    closeButtonRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      mountedRef.current = false;
      document.removeEventListener("keydown", handleKeyDown);
      stopStream();
      if (capturedUrlRef.current) URL.revokeObjectURL(capturedUrlRef.current);
    };
  }, []);

  const capture = () => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) {
      setError(t("donor.scan.camera.notReady"));
      return;
    }
    setCapturing(true);
    setError("");
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas
      .getContext("2d")
      ?.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError(t("donor.scan.camera.captureFailed"));
          setCapturing(false);
          return;
        }
        clearCapturedPreview();
        const file = new File([blob], `kindred-camera-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        const url = URL.createObjectURL(file);
        capturedUrlRef.current = url;
        setCapturedFile(file);
        setCapturedUrl(url);
        stopStream();
        setCapturing(false);
      },
      "image/jpeg",
      0.92,
    );
  };

  const retake = async () => {
    clearCapturedPreview();
    await startCamera();
  };

  const usePhoto = () => {
    if (!capturedFile) return;
    onCapture(capturedFile);
    onClose();
  };

  return (
    <div className="camera-backdrop" role="presentation">
      <section
        className="camera-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="camera-dialog-title"
      >
        <div className="camera-dialog-header">
          <h2 id="camera-dialog-title">
            {capturedFile
              ? t("donor.scan.camera.photoPreview")
              : t("donor.scan.camera.takePhoto")}
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            className="camera-close"
            aria-label={t("common.close")}
            onClick={onClose}
          >
            ×
          </button>
        </div>
        {error ? (
          <div className="error-box" role="alert">
            {error}
          </div>
        ) : null}
        {capturedFile ? (
          <img
            className="camera-captured-preview"
            src={capturedUrl}
            alt={t("donor.scan.selectedImageAlt")}
          />
        ) : (
          <video
            ref={videoRef}
            className="camera-video"
            autoPlay
            playsInline
            muted
            aria-label={t("donor.scan.camera.livePreviewAlt")}
          />
        )}
        <p className="camera-status">
          {capturedFile
            ? t("donor.scan.camera.photoPreviewStatus")
            : t("donor.scan.camera.livePreviewStatus")}
        </p>
        <div className="camera-actions">
          {capturedFile ? (
            <>
              <button
                type="button"
                className="secondary-button"
                onClick={retake}
              >
                {t("donor.scan.camera.retake")}
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={usePhoto}
              >
                {t("donor.scan.camera.usePhoto")}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="primary-button camera-capture-button"
              onClick={capture}
              disabled={starting || capturing || Boolean(error)}
            >
              {starting
                ? t("donor.scan.camera.starting")
                : capturing
                  ? t("donor.scan.camera.capturing")
                  : t("donor.scan.camera.capture")}
            </button>
          )}
          <button type="button" className="secondary-button" onClick={onClose}>
            {t("common.cancel")}
          </button>
        </div>
      </section>
    </div>
  );
}
