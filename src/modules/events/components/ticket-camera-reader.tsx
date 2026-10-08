"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cameraFailureMessage, nativeQrDetector } from "../camera";

export function TicketCameraReader({ onDecoded, disabled }: { onDecoded: (value: string) => void; disabled: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const generation = useRef(0);
  const busy = useRef(false);
  const poll = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [status, setStatus] = useState<"idle" | "starting" | "scanning">("idle");
  const [error, setError] = useState("");

  const stopHardware = useCallback(() => {
    generation.current += 1;
    busy.current = false;
    clearTimeout(poll.current); clearTimeout(timeout.current);
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
  }, []);
  function stop() { stopHardware(); setStatus("idle"); }
  useEffect(() => {
    const onHidden = () => { if (document.hidden) { stopHardware(); setStatus("idle"); } };
    document.addEventListener("visibilitychange", onHidden);
    return () => { document.removeEventListener("visibilitychange", onHidden); stopHardware(); };
  }, [stopHardware]);

  async function start() {
    if (disabled || busy.current || status !== "idle") return;
    setError("");
    const Detector = nativeQrDetector();
    if (!window.isSecureContext) { setError("Camera scanning requires HTTPS or localhost. Use the paste / manual code entry below."); return; }
    if (!Detector || !navigator.mediaDevices?.getUserMedia) { setError("This browser has no native QR camera reader. Paste the decoded QR payload or enter the manual ticket code."); return; }
    busy.current = true;
    setStatus("starting");
    const attempt = ++generation.current;
    try {
      if (Detector.getSupportedFormats && !(await Detector.getSupportedFormats()).includes("qr_code")) {
        if (attempt !== generation.current) return;
        stop(); setError("This browser cannot decode QR tickets. Use paste / manual entry."); return;
      }
      if (attempt !== generation.current) return;
      const detector = new Detector({ formats: ["qr_code"] });
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      // Permission may resolve after the dialog closes; release that late stream immediately.
      if (attempt !== generation.current) { media.getTracks().forEach((track) => track.stop()); return; }
      stream.current = media;
      const element = video.current;
      if (!element) { stop(); return; }
      element.srcObject = media;
      await element.play();
      if (attempt !== generation.current) return;
      setStatus("scanning");
      timeout.current = setTimeout(() => { stop(); setError("Camera stopped after two minutes. Start it again or use manual entry."); }, 120_000);
      async function scan() {
        if (attempt !== generation.current) return;
        try {
          const codes = element && element.readyState >= 2 ? await detector.detect(element) : [];
          if (attempt !== generation.current) return;
          const code = codes.find((item) => typeof item.rawValue === "string");
          if (code) { stop(); onDecoded(code.rawValue); return; }
          poll.current = setTimeout(() => void scan(), 250);
        } catch (failure) {
          if (attempt === generation.current) { stop(); setError(cameraFailureMessage(failure)); }
        }
      }
      void scan();
    } catch (failure) {
      if (attempt === generation.current) { stop(); setError(cameraFailureMessage(failure)); }
    }
  }

  return <div className="event-camera-reader">
    <p>Optional on-device camera reader. Camera access starts only when you choose it. Decoding does not check anyone in.</p>
    <video ref={video} playsInline muted hidden={status !== "scanning"} aria-label="Local ticket QR camera preview" />
    {status === "idle" ? <button type="button" className="button button--secondary" disabled={disabled} onClick={() => void start()}>Start QR camera</button> : <button type="button" className="button button--secondary" onClick={stop}>Stop camera</button>}
    {status === "starting" && <p role="status">Waiting for browser camera permission…</p>}
    {status === "scanning" && <p role="status">Hold one QR ticket in view. The camera stops after decoding so you can review the event before check-in.</p>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
