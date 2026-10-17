import { cn } from "@/lib/utils"

export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("size-8 shrink-0", className)}
      aria-label="WatchedSeerr Logo"
    >
      <rect width="32" height="32" className="fill-primary" />
      {/* Outer reticle */}
      <circle
        cx="16"
        cy="16"
        r="11"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeDasharray="3 2"
        className="stroke-primary-foreground/30"
      />
      {/* Surveillance aperture eye */}
      <path
        d="M5 16C8.5 10.5 23.5 10.5 27 16C23.5 21.5 8.5 21.5 5 16Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
        className="stroke-primary-foreground"
      />
      {/* Central iris */}
      <circle
        cx="16"
        cy="16"
        r="4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        className="stroke-primary-foreground"
      />
      <circle
        cx="16"
        cy="16"
        r="2"
        className="fill-primary-foreground"
      />
      {/* Radar crosshairs */}
      <line
        x1="16"
        y1="2"
        x2="16"
        y2="5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        className="stroke-primary-foreground/70"
      />
      <line
        x1="16"
        y1="27"
        x2="16"
        y2="30"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        className="stroke-primary-foreground/70"
      />
      <line
        x1="2"
        y1="16"
        x2="5"
        y2="16"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        className="stroke-primary-foreground/70"
      />
      <line
        x1="27"
        y1="16"
        x2="30"
        y2="16"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        className="stroke-primary-foreground/70"
      />
    </svg>
  )
}
