/**
 * Global footer: the unofficial-app disclaimer and data credits (spec §8.4).
 * The OpenF1 credit is a CC BY-NC-SA license obligation for the bundled
 * driver headshots — it must stay as long as public/headshots/ ships.
 */
export function Footer() {
  return (
    <footer className="mt-12 border-t border-grid-line">
      <div className="mx-auto flex max-w-5xl flex-col gap-1 px-6 py-6 text-xs text-muted-foreground">
        <p>
          Unofficial fan project — not affiliated with Formula One Group, the
          FIA, or F1 Fantasy. No accounts, no tracking; your team stays in your
          browser.
        </p>
        <p>
          Driver imagery via{" "}
          <a
            className="underline underline-offset-2 hover:text-foreground"
            href="https://openf1.org"
            rel="noreferrer"
          >
            OpenF1
          </a>{" "}
          (CC BY-NC-SA) · schedule cross-checks via{" "}
          <a
            className="underline underline-offset-2 hover:text-foreground"
            href="https://jolpi.ca"
            rel="noreferrer"
          >
            Jolpica F1
          </a>
          .
        </p>
      </div>
    </footer>
  )
}
