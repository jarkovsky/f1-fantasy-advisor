import { TableCell } from "@/components/ui/table"
import { cn } from "@/lib/utils"

/** Right-aligned, monospaced, tabular numeric table cell. */
export function NumCell({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <TableCell className={cn("text-right font-mono tabular-nums", className)}>{children}</TableCell>
  )
}
