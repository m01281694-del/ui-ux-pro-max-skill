// Europe/Paris clock helpers. Sim "day" = Paris calendar day.

export interface Clock {
  ts: number;
  day: number; // days since 1970-01-01 (Paris calendar)
  minute: number; // 0..1439.99 (fractional)
  dow: number; // 0=Sunday
  hour: number;
  label: string; // HH:MM
}

const fmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

let lastKey = -1;
let lastBase: { day: number; minuteBase: number; dow: number; baseTs: number } | null = null;

export function parisClock(ts: number): Clock {
  const key = Math.floor(ts / 60000);
  if (key !== lastKey || !lastBase) {
    const baseTs = key * 60000;
    const parts = Object.fromEntries(fmt.formatToParts(new Date(baseTs)).map((p) => [p.type, p.value]));
    const y = +parts.year, mo = +parts.month, d = +parts.day;
    const day = Math.floor(Date.UTC(y, mo - 1, d) / 86400000);
    lastBase = { day, minuteBase: +parts.hour * 60 + +parts.minute, dow: new Date(Date.UTC(y, mo - 1, d)).getUTCDay(), baseTs };
    lastKey = key;
  }
  const minute = lastBase.minuteBase + (ts - lastBase.baseTs) / 60000;
  const h = Math.floor(minute / 60), m = Math.floor(minute % 60);
  return { ts, day: lastBase.day, minute, dow: lastBase.dow, hour: minute / 60, label: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}` };
}

/** Timestamp (ms) of Paris day `day` at `minute`. Handles DST by probing the offset. */
export function tsOf(day: number, minute: number): number {
  const guess = day * 86400000 + minute * 60000 - 3600000; // assume UTC+1
  const c = parisClock(guess);
  const diffMin = (c.day - day) * 1440 + (c.minute - minute);
  return guess - diffMin * 60000;
}

export const dayOfYear = (day: number) => {
  const d = new Date(day * 86400000);
  return Math.floor((day * 86400000 - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000);
};

export const fmtTime = (ts: number) => parisClock(ts).label;
