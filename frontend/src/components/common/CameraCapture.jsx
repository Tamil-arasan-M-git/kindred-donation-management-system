import { useEffect, useRef, useState } from "react";

const cameraErrorMessage = (error) => {
  if (error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError") {
    return "Camera access was denied. Please allow camera permission in your browser settings or upload an image from your device.";
  }
  if (error?.name === "NotFoundError" || error?.name === "DevicesNotFoundError") {
    return "No camera is available on this device. You can upload an image instead.";
  }
  if (error?.name === "NotReadableError" || error?.name === "TrackStartError") {
    return "The camera could not be started. It may already be in use by another application.";
  }
  return "The camera could not be started. Please try again or upload an image from your device.";
};

export default function CameraCapture({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const closeButtonRef = useRef(null);
  const capturedUrlRef = useRef("");
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
        if (["NotAllowedError", "PermissionDeniedError"].includes(cameraError?.name)) throw cameraError;
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
    } catch (cameraError) {
      setError(cameraError?.message === "unsupported" ? "Live camera capture is not supported by this browser. Please upload an image from your device." : cameraErrorMessage(cameraError));
    } finally {
      setStarting(false);
    }
  };

  useEffect(() => {
    startCamera();
    closeButtonRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      stopStream();
      if (capturedUrlRef.current) URL.revokeObjectURL(capturedUrlRef.current);
    };
  }, []);

  const capture = () => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) {
      setError("The camera preview is not ready yet. Please try again.");
      return;
    }
    setCapturing(true);
    setError("");
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) {
        setError("The photo could not be captured. Please try again.");
        setCapturing(false);
        return;
      }
      clearCapturedPreview();
      const file = new File([blob], `kindred-camera-${Date.now()}.jpg`, { type: "image/jpeg" });
      const url = URL.createObjectURL(file);
      capturedUrlRef.current = url;
      setCapturedFile(file);
      setCapturedUrl(url);
      stopStream();
      setCapturing(false);
    }, "image/jpeg", 0.92);
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
      <section className="camera-dialog" role="dialog" aria-modal="true" aria-labelledby="camera-dialog-title">
        <div className="camera-dialog-header">
          <h2 id="camera-dialog-title">{capturedFile ? "Photo preview" : "Take a photo"}</h2>
          <button ref={closeButtonRef} type="button" className="camera-close" aria-label="Close camera" onClick={onClose}>×</button>
        </div>
        {error ? <div className="error-box" role="alert">{error}</div> : null}
        {capturedFile ? <img className="camera-captured-preview" src={capturedUrl} alt="Captured donation items" /> : <video ref={videoRef} className="camera-video" autoPlay playsInline muted aria-label="Live camera preview" />}
        <p className="camera-status">{capturedFile ? "PHOTO PREVIEW" : "LIVE CAMERA PREVIEW"}</p>
        <div className="camera-actions">
          {capturedFile ? <><button type="button" className="secondary-button" onClick={retake}>Retake</button><button type="button" className="primary-button" onClick={usePhoto}>Use Photo</button></> : <button type="button" className="primary-button camera-capture-button" onClick={capture} disabled={starting || capturing || Boolean(error)}>{starting ? "Starting camera..." : capturing ? "Capturing..." : "Capture"}</button>}
          <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
        </div>
      </section>
    </div>
  );
}
