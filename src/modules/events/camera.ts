type NativeQrDetector = { detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>> };
export type NativeQrDetectorConstructor = {
  new (options: { formats: string[] }): NativeQrDetector;
  getSupportedFormats?: () => Promise<string[]>;
};

export function nativeQrDetector(): NativeQrDetectorConstructor | undefined {
  return (window as Window & { BarcodeDetector?: NativeQrDetectorConstructor }).BarcodeDetector;
}

export function cameraFailureMessage(error: unknown): string {
  const name = error && typeof error === "object" && "name" in error && typeof error.name === "string" ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "Camera permission was not granted. Allow it in browser settings or paste a ticket / enter its manual code.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No usable camera was found. Paste a ticket QR payload or enter its manual code.";
  if (name === "NotReadableError") return "The camera is unavailable or in use by another app. Close that app or use manual entry.";
  return "Camera scanning is unavailable. Paste a ticket QR payload or enter its manual code.";
}
