export { cn } from "cn"

export function formatMediaSize(bytes?: number | null): string {
  if (bytes === undefined || bytes === null || bytes <= 0) return ""
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(0)} MB`
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}
