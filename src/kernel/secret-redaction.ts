const SENSITIVE_ASSIGNMENT =
  /(["']?(?:access[_-]?token|refresh[_-]?token|authorization(?:Code)?|deviceId|device_id|exchange(?:Code)?|secret|password|token)["']?\s*[:=]\s*)(["']?)[^\s,"']+/gi

export function redactSecrets(value: string) {
  return value
    .replace(SENSITIVE_ASSIGNMENT, '$1$2[redacted]')
    .replace(/enc:v1:[A-Za-z0-9+/=]+/g, 'enc:v1:[redacted]')
}
