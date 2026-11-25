const ISO_DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})(?:$|[\sT]00:00:00(?:\.0+)?$)/;
const ISO_MONTH_RE = /^(\d{4})-(\d{2})$/;
const ISO_WEEK_RE = /^(\d{4})-W(\d{2})$/;

export const MONTH_NAMES_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

function pad2(num) {
  return String(num).padStart(2, '0');
}

function formatLongIndonesianDate(year, monthIndex, day) {
  const monthName = MONTH_NAMES_ID[monthIndex];
  if (!monthName || Number.isNaN(day) || Number.isNaN(year)) {
    return '';
  }
  return `${day} ${monthName} ${year}`;
}

/**
 * Returns local calendar date formatted as YYYY-MM-DD (API format).
 * Avoids UTC off-by-one bug between 00:00 and 07:00 WIB.
 */
export function toISODateLocal(date = new Date()) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return '';
  }
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/**
 * Parses YYYY-MM-DD or ISO datetime into a local Date at 00:00:00.
 */
export function parseISODateLocal(value) {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  const raw = String(value).trim();
  const dateOnly = raw.match(ISO_DATE_ONLY_RE);
  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const month = Number(dateOnly[2]) - 1;
    const day = Number(dateOnly[3]);
    const parsed = new Date(year, month, day);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

/**
 * Formats date values to Indonesian long text (e.g. "20 November 2026")
 * without UTC timezone drift on date-only strings.
 */
export function formatDate(value, fallback = '-') {
  if (!value) return fallback;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return fallback;
    return (
      formatLongIndonesianDate(value.getFullYear(), value.getMonth(), value.getDate()) ||
      fallback
    );
  }

  const raw = String(value).trim();
  const dateOnly = raw.match(ISO_DATE_ONLY_RE);
  if (dateOnly) {
    return (
      formatLongIndonesianDate(
        Number(dateOnly[1]),
        Number(dateOnly[2]) - 1,
        Number(dateOnly[3])
      ) || fallback
    );
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return (
    formatLongIndonesianDate(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()) ||
    fallback
  );
}

/**
 * Formats timestamp values to Indonesian long text with local time
 * (e.g. "20 November 2026, 14:30").
 */
export function formatDateTime(value, fallback = '-') {
  if (!value) return fallback;
  const parsed = value instanceof Date ? value : new Date(String(value).trim());
  if (Number.isNaN(parsed.getTime())) return fallback;
  const dateText = formatLongIndonesianDate(
    parsed.getFullYear(),
    parsed.getMonth(),
    parsed.getDate()
  );
  if (!dateText) return fallback;
  return `${dateText}, ${pad2(parsed.getHours())}:${pad2(parsed.getMinutes())}`;
}

/**
 * Formats YYYY-MM to Indonesian month and year (e.g. "November 2026").
 */
export function formatMonth(value, fallback = '-') {
  if (!value) return fallback;
  const raw = String(value).trim();
  const match = raw.match(ISO_MONTH_RE);
  if (match) {
    const monthName = MONTH_NAMES_ID[Number(match[2]) - 1];
    if (monthName) {
      return `${monthName} ${match[1]}`;
    }
  }
  return raw || fallback;
}

/**
 * Computes local Monday..Sunday date range for an ISO 8601 week string (YYYY-Www).
 */
export function getIsoWeekRange(weekValue) {
  if (!weekValue) return null;
  const match = String(weekValue).trim().match(ISO_WEEK_RE);
  if (!match) return null;

  const isoYear = Number(match[1]);
  const isoWeek = Number(match[2]);
  if (isoWeek < 1 || isoWeek > 53) return null;

  // Jan 4 is always in ISO week 1
  const jan4 = new Date(isoYear, 0, 4);
  const jan4IsoDay = jan4.getDay() === 0 ? 7 : jan4.getDay();
  const week1Monday = new Date(isoYear, 0, 4 - (jan4IsoDay - 1));

  const start = new Date(
    week1Monday.getFullYear(),
    week1Monday.getMonth(),
    week1Monday.getDate() + (isoWeek - 1) * 7
  );
  const end = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate() + 6
  );

  return {
    start,
    end,
    startIso: toISODateLocal(start),
    endIso: toISODateLocal(end),
  };
}

/**
 * Converts a local Date (or YYYY-MM-DD string) to ISO 8601 week format YYYY-Www.
 */
export function toApiWeek(value) {
  const date = parseISODateLocal(value);
  if (!date) return '';

  // Shift to Thursday of current ISO week (ISO year is the year of that Thursday)
  const isoDay = date.getDay() === 0 ? 7 : date.getDay();
  const thursday = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + (4 - isoDay)
  );
  const isoYear = thursday.getFullYear();

  const jan4 = new Date(isoYear, 0, 4);
  const jan4IsoDay = jan4.getDay() === 0 ? 7 : jan4.getDay();
  const week1Monday = new Date(isoYear, 0, 4 - (jan4IsoDay - 1));

  const diffDays = Math.round(
    (Date.UTC(thursday.getFullYear(), thursday.getMonth(), thursday.getDate()) -
      Date.UTC(week1Monday.getFullYear(), week1Monday.getMonth(), week1Monday.getDate())) /
      86400000
  );
  const weekNo = Math.floor(diffDays / 7) + 1;

  return `${isoYear}-W${pad2(weekNo)}`;
}

/**
 * Formats ISO week string (YYYY-Www) as compact Indonesian range:
 * - Same month: "16–22 November 2026"
 * - Cross month: "30 November – 6 Desember 2026"
 * - Cross year: "28 Desember 2026 – 3 Januari 2027"
 */
export function formatWeek(weekValue, fallback = '-') {
  const range = getIsoWeekRange(weekValue);
  if (!range) return weekValue ? String(weekValue) : fallback;
  const { start, end } = range;

  if (
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth()
  ) {
    return `${start.getDate()}–${end.getDate()} ${MONTH_NAMES_ID[start.getMonth()]} ${start.getFullYear()}`;
  }

  if (start.getFullYear() === end.getFullYear()) {
    return `${start.getDate()} ${MONTH_NAMES_ID[start.getMonth()]} – ${end.getDate()} ${MONTH_NAMES_ID[end.getMonth()]} ${end.getFullYear()}`;
  }

  return `${formatDate(start)} – ${formatDate(end)}`;
}

/**
 * Formats ISO week string (YYYY-Www) as Monday start date (e.g. "16 November 2026").
 */
export function formatWeekStart(weekValue, fallback = '-') {
  const range = getIsoWeekRange(weekValue);
  if (!range) return weekValue ? String(weekValue) : fallback;
  return formatDate(range.start);
}

/**
 * Ensures API payload date string stays strictly YYYY-MM-DD.
 */
export function toApiDate(value) {
  if (!value) return '';
  if (value instanceof Date) return toISODateLocal(value);
  const raw = String(value).trim();
  const dateOnly = raw.match(ISO_DATE_ONLY_RE);
  if (dateOnly) return `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}`;
  const parsed = parseISODateLocal(raw);
  return parsed ? toISODateLocal(parsed) : '';
}

/**
 * Ensures API payload month string stays strictly YYYY-MM.
 */
export function toApiMonth(value) {
  if (!value) return '';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}`;
  }
  const raw = String(value).trim();
  if (ISO_MONTH_RE.test(raw)) return raw;
  return '';
}

/**
 * Computes integer calendar day difference (targetDate - today) in local timezone.
 */
export function daysUntilDate(value) {
  const target = parseISODateLocal(value);
  if (!target) return null;
  const now = new Date();
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const targetUtc = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((targetUtc - todayUtc) / 86400000);
}
