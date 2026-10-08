export type ApplicationErrorCode =
  | "configuration" | "validation" | "authentication" | "authorization"
  | "conflict" | "quota" | "unexpected";

const publicErrors: Record<ApplicationErrorCode, { status: number; message: string }> = {
  configuration: { status: 503, message: "This service is not available yet." },
  validation: { status: 400, message: "Check the information you entered." },
  authentication: { status: 401, message: "Sign in to continue." },
  authorization: { status: 403, message: "This action is not available to your account." },
  conflict: { status: 409, message: "This item changed. Refresh and try again." },
  quota: { status: 429, message: "Please wait before trying again." },
  unexpected: { status: 500, message: "Something went wrong. Please try again." },
};

export class ApplicationError extends Error {
  readonly code: ApplicationErrorCode;

  constructor(code: ApplicationErrorCode, options?: ErrorOptions) {
    super(publicErrors[code].message, options);
    this.name = "ApplicationError";
    this.code = code;
  }
}

export function publicError(error: unknown): {
  code: ApplicationErrorCode;
  status: number;
  message: string;
} {
  const code = error instanceof ApplicationError ? error.code : "unexpected";
  return { code, ...publicErrors[code] };
}
