// Lab 4 (BR-30, api-spec §3): dashboard date windows use Asia/Bangkok calendar days.
// Bangkok is UTC+7 all year (no daylight saving time), so a fixed offset is exact.
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The instant (UTC) at which the Bangkok calendar day that is `daysBack` days
 * before today began. With the default of 6 this is the start of the "last 7
 * calendar days including today" window.
 */
export function bangkokWindowStart(now: Date, daysBack = 6): Date {
  const bangkokNow = now.getTime() + BANGKOK_OFFSET_MS;
  const startOfBangkokToday = Math.floor(bangkokNow / DAY_MS) * DAY_MS;
  return new Date(startOfBangkokToday - daysBack * DAY_MS - BANGKOK_OFFSET_MS);
}
