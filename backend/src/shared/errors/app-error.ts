export class AppError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details: ReadonlyArray<{ path: string; message: string }>;

  public constructor(status: number, code: string, message: string, details: ReadonlyArray<{ path: string; message: string }> = []) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
