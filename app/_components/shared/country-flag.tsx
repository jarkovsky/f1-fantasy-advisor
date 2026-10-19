import {
  AE,
  AR,
  AT,
  AU,
  AZ,
  BE,
  BH,
  BR,
  CA,
  CN,
  DE,
  ES,
  FR,
  GB,
  HU,
  IT,
  JP,
  KR,
  MC,
  MX,
  MY,
  NL,
  PT,
  QA,
  RU,
  SA,
  SG,
  TH,
  TR,
  US,
  VN,
  ZA,
} from "country-flag-icons/react/3x2"

import { cn } from "@/lib/utils"

/**
 * Flags keyed by the raceday feed's CountryName: this season's hosts plus
 * recent and rumoured ones. Named imports keep the bundle to these flags; an
 * unknown country renders nothing rather than a wrong flag.
 */
const FLAGS: Record<string, typeof AU> = {
  "Abu Dhabi": AE,
  Argentina: AR,
  Australia: AU,
  Austria: AT,
  Azerbaijan: AZ,
  Bahrain: BH,
  Belgium: BE,
  Brazil: BR,
  Canada: CA,
  China: CN,
  France: FR,
  Germany: DE,
  "Great Britain": GB,
  Hungary: HU,
  Italy: IT,
  Japan: JP,
  Korea: KR,
  Malaysia: MY,
  Mexico: MX,
  Monaco: MC,
  Netherlands: NL,
  Portugal: PT,
  Qatar: QA,
  Russia: RU,
  "Saudi Arabia": SA,
  Singapore: SG,
  "South Africa": ZA,
  "South Korea": KR,
  Spain: ES,
  Thailand: TH,
  Turkey: TR,
  "United Arab Emirates": AE,
  "United Kingdom": GB,
  "United States": US,
  USA: US,
  Vietnam: VN,
}

/** The host country's flag at 3:2, decorative (the Grand Prix name beside it says the country). */
export function CountryFlag({
  country,
  className,
}: {
  country: string | null
  className?: string
}) {
  const Flag = country === null ? undefined : FLAGS[country]
  if (!Flag) return null
  return (
    <Flag
      aria-hidden="true"
      className={cn(
        "inline-block h-3 w-[1.125rem] shrink-0 rounded-[2px] shadow-[0_0_0_1px_oklch(0_0_0/0.12)]",
        className
      )}
    />
  )
}
