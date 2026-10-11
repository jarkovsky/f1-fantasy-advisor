import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

/**
 * "Start over" confirmation (edit mode only) — clears the saved team, budget,
 * and transfer count. Wrapped in a Dialog so the destructive action is
 * deliberate.
 */
export function StartOverDialog({ onConfirm }: { onConfirm: () => void }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" className="text-muted-foreground">
          Start over
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start over?</DialogTitle>
          <DialogDescription>
            This clears your saved team, budget, and transfer count.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost">
              Keep my team
            </Button>
          </DialogClose>
          <Button type="button" variant="destructive" onClick={onConfirm}>
            Start over
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
