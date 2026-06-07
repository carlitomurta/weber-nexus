export function sanitizeLog(message: unknown): string {
  if (typeof message === "string") {
    // Remove or escape potentially harmful characters
    return message.replace(/[\r\n]/g, "");
  }
  return String(message);
}
