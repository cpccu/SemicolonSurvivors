// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TicketCameraReader } from "./ticket-camera-reader";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function prepareCamera(getUserMedia: ReturnType<typeof vi.fn>) {
  vi.stubGlobal("isSecureContext", true);
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
  class Detector {
    static async getSupportedFormats() { return ["qr_code"]; }
    async detect() { return []; }
  }
  vi.stubGlobal("BarcodeDetector", Detector);
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
}
describe("optional native QR camera", () => {
  it("never requests permission before an explicit click and releases tracks on close", async () => {
    const stop = vi.fn();
    const getUserMedia = vi.fn(async () => ({ getTracks: () => [{ stop }] }));
    prepareCamera(getUserMedia);
    const view = render(<TicketCameraReader onDecoded={vi.fn()} disabled={false} />);
    expect(getUserMedia).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Start QR camera" }));
    await waitFor(() => expect(screen.getByText(/Hold one QR ticket in view/)).toBeDefined());
    expect(getUserMedia).toHaveBeenCalledWith({ video: { facingMode: { ideal: "environment" } }, audio: false });
    view.unmount();
    expect(stop).toHaveBeenCalledTimes(1);
  });
  it("releases a stream if permission resolves after the view is closed", async () => {
    const stop = vi.fn();
    let permit: ((stream: { getTracks: () => Array<{ stop: typeof stop }> }) => void) | undefined;
    const getUserMedia = vi.fn(() => new Promise((resolve) => { permit = resolve; }));
    prepareCamera(getUserMedia);
    const view = render(<TicketCameraReader onDecoded={vi.fn()} disabled={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Start QR camera" }));
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));
    view.unmount();
    await act(async () => permit?.({ getTracks: () => [{ stop }] }));
    expect(stop).toHaveBeenCalledTimes(1);
  });
  it("keeps manual entry as the supported path without requesting a camera on unsupported browsers", () => {
    const getUserMedia = vi.fn(); prepareCamera(getUserMedia); vi.stubGlobal("BarcodeDetector", undefined);
    render(<TicketCameraReader onDecoded={vi.fn()} disabled={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Start QR camera" }));
    expect(screen.getByRole("alert").textContent).toContain("no native QR camera reader");
    expect(getUserMedia).not.toHaveBeenCalled();
  });
  it("explains denied permissions without leaking native error text", async () => {
    const getUserMedia = vi.fn(async () => { throw new DOMException("private native details", "NotAllowedError"); });
    prepareCamera(getUserMedia);
    render(<TicketCameraReader onDecoded={vi.fn()} disabled={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Start QR camera" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("permission was not granted"));
    expect(screen.getByRole("alert").textContent).not.toContain("private native details");
  });
  it("stops after one decoded value and returns data without any request or navigation", async () => {
    const stop = vi.fn();
    const decoded = vi.fn();
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    prepareCamera(vi.fn(async () => ({ getTracks: () => [{ stop }] })));
    class Detector {
      static async getSupportedFormats() { return ["qr_code"]; }
      async detect() { return [{ rawValue: "https://evil.example/unsafe" }]; }
    }
    vi.stubGlobal("BarcodeDetector", Detector);
    vi.spyOn(HTMLMediaElement.prototype, "readyState", "get").mockReturnValue(2);
    render(<TicketCameraReader onDecoded={decoded} disabled={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Start QR camera" }));
    await waitFor(() => expect(decoded).toHaveBeenCalledWith("https://evil.example/unsafe"));
    expect(decoded).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
    expect(window.location.href).toBe("http://localhost:3000/");
  });
});
