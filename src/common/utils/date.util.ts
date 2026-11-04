/** Today's date (YYYY-MM-DD) in the school timezone (APP_TIMEZONE, default Asia/Kathmandu). */
export function today(): string {
  const tz = process.env.APP_TIMEZONE || 'Asia/Kathmandu';
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
