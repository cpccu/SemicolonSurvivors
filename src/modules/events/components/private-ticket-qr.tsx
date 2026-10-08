"use client";

import { useEffect, useRef, useState } from "react";
import { createTicketQrPayload } from "../ticket-code";

export function PrivateTicketQr({ eventId, token }: { eventId: string; token: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  useEffect(() => {
    let disposed = false;
    const element = canvas.current;
    if (!element) return;
    async function draw() {
      try {
        const encoder = await import("qrcode");
        if (disposed || !element) return;
        await encoder.toCanvas(element, createTicketQrPayload(eventId, token), {
          width: 256, margin: 4, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" },
        });
        if (!disposed) setStatus("ready");
      } catch { if (!disposed) setStatus("unavailable"); }
    }
    void draw();
    return () => { disposed = true; element.getContext("2d")?.clearRect(0, 0, element.width, element.height); };
  }, [eventId, token]);
  return <div className="event-ticket-qr">
    <canvas ref={canvas} width={256} height={256} role="img" aria-label="Private event ticket QR code" hidden={status !== "ready"} />
    {status === "loading" && <p role="status">Preparing your private QR ticket on this device…</p>}
    {status === "unavailable" && <p role="status">The QR image could not be prepared. Your manual ticket code below still works.</p>}
    {status === "ready" && <p>Generated locally on this device. Show the QR to an authorized organizer for this event.</p>}
  </div>;
}
