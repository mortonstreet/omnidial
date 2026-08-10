import type { PowerDialerTimezonePriority } from '../requests/powerDialer'

/**
 * IANA timezones that belong to each power-dialer priority bucket.
 *
 * This is the single source of truth. The backend uses it to build the
 * ORDER BY ranking SQL; the frontend uses it to label the current lead.
 * Keep additions here rather than in a local copy.
 */
export const TIMEZONE_GROUPS: Record<PowerDialerTimezonePriority, string[]> = {
  eastern: [
    'America/New_York',
    'America/Detroit',
    'America/Toronto',
    'America/Indiana/Indianapolis',
    'America/Indiana/Vincennes',
    'America/Indiana/Winamac',
    'America/Indiana/Marengo',
    'America/Indiana/Vevay',
    'America/Kentucky/Louisville',
    'America/Kentucky/Monticello',
    'America/Montreal',
    'America/Nassau',
    'America/Nipigon',
    'America/Thunder_Bay',
    'America/Iqaluit',
    'America/Panama',
    'America/Jamaica',
    'America/Port-au-Prince',
    'America/Cancun',
  ],
  central: [
    'America/Chicago',
    'America/Winnipeg',
    'America/Mexico_City',
    'America/Indiana/Knox',
    'America/Indiana/Tell_City',
    'America/Menominee',
    'America/North_Dakota/Center',
    'America/North_Dakota/New_Salem',
    'America/North_Dakota/Beulah',
    'America/Regina',
    'America/Swift_Current',
    'America/Rainy_River',
    'America/Resolute',
    'America/Matamoros',
    'America/Monterrey',
    'America/Merida',
    'America/Belize',
    'America/Costa_Rica',
    'America/Guatemala',
    'America/El_Salvador',
    'America/Tegucigalpa',
    'America/Managua',
  ],
  mountain: [
    'America/Denver',
    'America/Phoenix',
    'America/Boise',
    'America/Edmonton',
    'America/Cambridge_Bay',
    'America/Inuvik',
    'America/Yellowknife',
    'America/Chihuahua',
    'America/Ojinaga',
    'America/Hermosillo',
    'America/Mazatlan',
    'America/Creston',
    'America/Dawson_Creek',
    'America/Fort_Nelson',
  ],
  pacific: [
    'America/Los_Angeles',
    'America/Vancouver',
    'America/Tijuana',
    'America/Whitehorse',
    'America/Dawson',
    'America/Santa_Isabel',
  ],
}

/**
 * Dial order for each priority: start with the selected bucket, then walk
 * the remaining buckets in the order that keeps prospects inside business hours.
 */
export const TIMEZONE_PRIORITY_ORDER: Record<
  PowerDialerTimezonePriority,
  PowerDialerTimezonePriority[]
> = {
  eastern: ['eastern', 'central', 'mountain', 'pacific'],
  central: ['central', 'mountain', 'pacific', 'eastern'],
  mountain: ['mountain', 'pacific', 'eastern', 'central'],
  pacific: ['pacific', 'eastern', 'central', 'mountain'],
}

export const TIMEZONE_BUCKET_LABELS: Record<
  PowerDialerTimezonePriority,
  string
> = {
  eastern: 'EST',
  central: 'CST',
  mountain: 'MST',
  pacific: 'PST',
}

export const CANONICAL_TIMEZONE_BY_BUCKET: Record<
  PowerDialerTimezonePriority,
  string
> = {
  eastern: 'America/New_York',
  central: 'America/Chicago',
  mountain: 'America/Denver',
  pacific: 'America/Los_Angeles',
}

const BUCKET_BY_TIMEZONE = new Map<string, PowerDialerTimezonePriority>(
  (
    Object.entries(TIMEZONE_GROUPS) as Array<
      [PowerDialerTimezonePriority, string[]]
    >
  ).flatMap(([bucket, zones]) =>
    zones.map(
      (zone) => [zone, bucket] as [string, PowerDialerTimezonePriority],
    ),
  ),
)

/**
 * Map an IANA timezone to its power-dialer bucket, or null when the zone
 * falls outside the four North American continental buckets
 * (e.g. Pacific/Honolulu, Europe/London).
 */
export const getTimezoneBucket = (
  timezone?: string | null,
): PowerDialerTimezonePriority | null => {
  if (!timezone) return null
  return BUCKET_BY_TIMEZONE.get(timezone) ?? null
}
