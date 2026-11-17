// All "human" dates in the app are expressed in India Standard Time.
const IST_MS = 330 * 60000;
export const IST_SUFFIX = '+05:30';
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function parts(date) {
  const x = new Date(date.getTime() + IST_MS);
  return {
    y: x.getUTCFullYear(),
    m: x.getUTCMonth(),
    d: x.getUTCDate(),
    wd: x.getUTCDay(),
    h: x.getUTCHours(),
    min: x.getUTCMinutes(),
  };
}
export const fromIST = (y, m, d, h = 0, min = 0) => new Date(Date.UTC(y, m, d, h, min) - IST_MS);
export const addDays = (date, n) => new Date(date.getTime() + n * 86400000);
export const hoursAgo = (now, h) => new Date(now.getTime() - h * 3600000);
export const fmtMD = (date) => {
  const p = parts(date);
  return `${MONTHS[p.m]} ${p.d}`;
};
export const fmtWeekday = (date) => DAYS[parts(date).wd];
export const fmtDayMD = (date) => `${fmtWeekday(date).slice(0, 3)}, ${fmtMD(date)}`;
