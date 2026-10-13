import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { Delta } from "@/app/_components/shared/delta"

describe("Delta", () => {
  it("colors a points gain positive and a loss negative", () => {
    render(
      <>
        <Delta value={0.3} points />
        <Delta value={-1.2} points />
      </>
    )
    expect(screen.getByText("+0.3")).toHaveClass("text-pos")
    expect(screen.getByText("−1.2")).toHaveClass("text-neg")
  })

  it("keeps a points delta that rounds to zero neutral", () => {
    render(<Delta value={0.04} points />)
    expect(screen.getByText("·")).toHaveClass("text-muted-foreground")
  })

  it("renders a zero price delta as a muted dot", () => {
    render(<Delta value={0} tenths />)
    expect(screen.getByText("·")).toHaveClass("text-muted-foreground")
  })
})
