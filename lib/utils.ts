export { cn } from "cn"

export function formatMediaSize(bytes?: number | null): string {
  if (bytes === undefined || bytes === null || bytes <= 0) return ""
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(0)} MB`
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}
export function isDeleteDisabled(): boolean {
  const envVal =
    typeof process !== "undefined" && process?.env
      ? (process.env.DISABLE_DELETE ??
        process.env.NEXT_PUBLIC_DISABLE_DELETE ??
        process.env.DELETE_DISABLED)
      : undefined

  if (typeof envVal === "boolean") return envVal
  if (typeof envVal === "string") {
    return ["true", "1", "yes", "on"].includes(envVal.toLowerCase().trim())
  }
  return false
}
