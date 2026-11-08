const ARABIC_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'إبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getMonthKeyFromDate(dateStr: string): string {
  if (!dateStr || dateStr.length < 7) {
    return getCurrentMonthKey();
  }
  return dateStr.slice(0, 7);
}

export function getCurrentMonthKey(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function formatMonthName(monthKey: string): string {
  if (!monthKey || !monthKey.includes('-')) return monthKey;
  const [yearStr, monthStr] = monthKey.split('-');
  const monthIdx = parseInt(monthStr, 10) - 1;
  const monthName = ARABIC_MONTHS[monthIdx] || monthStr;
  return `${monthName} ${yearStr}`;
}

export function getPreviousMonthKey(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split('-');
  let y = parseInt(yearStr, 10);
  let m = parseInt(monthStr, 10) - 1;
  if (m < 1) {
    m = 12;
    y -= 1;
  }
  return `${y}-${String(m).padStart(2, '0')}`;
}

export function getNextMonthKey(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split('-');
  let y = parseInt(yearStr, 10);
  let m = parseInt(monthStr, 10) + 1;
  if (m > 12) {
    m = 1;
    y += 1;
  }
  return `${y}-${String(m).padStart(2, '0')}`;
}

/**
 * Format currency using English digits (1, 2, 3...) as requested by the user
 */
export function formatCurrency(amount: number, currency = 'ج.م'): string {
  const rounded = Number(amount || 0).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${rounded} ${currency}`;
}

export function formatCurrencyLatin(amount: number, currency = 'ج.م'): string {
  return formatCurrency(amount, currency);
}

/**
 * Format date in Arabic with English digits (e.g. 5 نوفمبر 2026)
 */
export function formatDateArabic(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const y = parts[0];
      const m = ARABIC_MONTHS[parseInt(parts[1], 10) - 1] || parts[1];
      const d = parseInt(parts[2], 10);
      return `${d} ${m} ${y}`;
    }
  } catch {
    // fallback
  }
  return dateStr;
}

export function generateInvoiceNumber(existingCount = 0): string {
  const now = new Date();
  const year = String(now.getFullYear()).slice(-2);
  const serial = String(existingCount + 1).padStart(3, '0');
  return `فاتورة-${year}-${serial}`;
}

export function generateReceiptNumber(existingCount = 0): string {
  const now = new Date();
  const year = String(now.getFullYear()).slice(-2);
  const serial = String(existingCount + 1).padStart(3, '0');
  return `سند-${year}-${serial}`;
}

export function generateOrderNumber(existingCount = 0): string {
  const now = new Date();
  const year = String(now.getFullYear()).slice(-2);
  const serial = String(existingCount + 1).padStart(3, '0');
  return `طلب-${year}-${serial}`;
}

/**
 * Period filter helpers for operations
 */
export function isDateToday(dateStr: string): boolean {
  if (!dateStr) return false;
  return dateStr.slice(0, 10) === getTodayDateString();
}

export function isDateWithinDays(dateStr: string, days = 7): boolean {
  if (!dateStr) return false;
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffTime = now.getTime() - d.getTime();
    const diffDays = diffTime / (1000 * 3600 * 24);
    return diffDays >= -1 && diffDays <= days;
  } catch {
    return false;
  }
}

export function isDateInCurrentMonth(dateStr: string, targetMonthKey?: string): boolean {
  if (!dateStr) return false;
  const monthKey = targetMonthKey || getCurrentMonthKey();
  return dateStr.slice(0, 7) === monthKey;
}

/**
 * Calculate relative time from ISO date string returning accurate Arabic string
 */
export function getTimeAgoArabic(dateString: string): string {
  if (!dateString) return '';
  const past = new Date(dateString);
  if (isNaN(past.getTime())) return '';

  const now = new Date();
  const diffMs = now.getTime() - past.getTime();
  if (diffMs < 0) return 'الآن';
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) {
    return 'الآن';
  }
  if (diffMin === 1) {
    return 'منذ دقيقة';
  }
  if (diffMin === 2) {
    return 'منذ دقيقتين';
  }
  if (diffMin >= 3 && diffMin <= 10) {
    return `منذ ${diffMin} دقائق`;
  }
  if (diffMin < 60) {
    return `منذ ${diffMin} دقيقة`;
  }
  if (diffHour === 1) {
    return 'منذ ساعة';
  }
  if (diffHour === 2) {
    return 'منذ ساعتين';
  }
  if (diffHour >= 3 && diffHour <= 10) {
    return `منذ ${diffHour} ساعات`;
  }
  if (diffHour < 24) {
    return `منذ ${diffHour} ساعة`;
  }
  if (diffDay === 1) {
    return 'أمس';
  }
  if (diffDay === 2) {
    return 'منذ يومين';
  }
  if (diffDay >= 3 && diffDay <= 10) {
    return `منذ ${diffDay} أيام`;
  }
  if (diffDay < 30) {
    return `منذ ${diffDay} يوماً`;
  }
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth === 1) return 'منذ شهر';
  if (diffMonth === 2) return 'منذ شهرين';
  if (diffMonth <= 10) return `منذ ${diffMonth} أشهر`;
  return `منذ ${diffMonth} شهراً`;
}

/**
 * Format relative time in Arabic (e.g. منذ 5 دقائق، منذ ساعتين، أمس، منذ يومين...)
 */
export function formatTimeAgoArabic(createdAt?: string, dateStr?: string): string {
  if (createdAt) return getTimeAgoArabic(createdAt);
  if (dateStr) return getTimeAgoArabic(dateStr);
  return '';
}

