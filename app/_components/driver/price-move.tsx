import { formatPriceTenths } from "@/lib/format"
import { cn } from "@/lib/utils"

/**
 * A price change as `▲ $0.7M` / `▼ $0.6M`. The triangle carries the
 * direction (and an sr-only "up"/"down" says it in words), so the green/red
 * tint only reinforces it; no change renders a muted `$0.0M`.
 */
export function PriceMove({ tenths }: { tenths: number }) {
  if (tenths === 0) {
    return <span className="text-muted-foreground">{formatPriceTenths(0)}</span>
  }
  const up = tenths > 0
  return (
    <span className="inline-flex items-center gap-1">
      <span aria-hidden="true" className={cn("text-[0.6rem]", up ? "text-pos" : "text-neg")}>
        {up ? "▲" : "▼"}
      </span>
      <span className="sr-only">{up ? "up " : "down "}</span>
      {formatPriceTenths(Math.abs(tenths))}
    </span>
  )
}
