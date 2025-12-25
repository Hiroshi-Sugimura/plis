//////////////////////////////////////////////////////////////////////
/**
 * @module dateformat
 * @description Minimal Date formatting polyfill to replace date-utils usage.
 * Provides: Date.prototype.toFormat, Date.today(), Date.yesterday()
 * This module extends the Date prototype with date formatting capabilities
 * compatible with the date-utils library.
 */
//////////////////////////////////////////////////////////////////////

if (!Date.prototype.toFormat) {
  /**
   * Format date using the specified format string.
   * Supported placeholders: YYYY (year), MM (month), DD (day),
   * HH24 (hour), MI (minute), SS (second).
   * @param {string} fmt - Format string (e.g., "YYYY-MM-DD HH24:MI:SS")
   * @returns {string} Formatted date string
   * @example
   * const now = new Date();
   * now.toFormat("YYYY-MM-DD"); // "2025-12-25"
   */
  Object.defineProperty(Date.prototype, 'toFormat', {
    value: function toFormat(fmt) {
      const pad = (n, w = 2) => String(n).padStart(w, '0');
      const YYYY = String(this.getFullYear());
      const MM = pad(this.getMonth() + 1);
      const DD = pad(this.getDate());
      const HH24 = pad(this.getHours());
      const MI = pad(this.getMinutes());
      const SS = pad(this.getSeconds());
      return String(fmt)
        .replace(/YYYY/g, YYYY)
        .replace(/MM/g, MM)
        .replace(/DD/g, DD)
        .replace(/HH24/g, HH24)
        .replace(/MI/g, MI)
        .replace(/SS/g, SS);
    },
    writable: false,
    enumerable: false,
  });
}

if (!Object.prototype.hasOwnProperty.call(Date, 'today')) {
  /**
   * Get today's date at 00:00:00.
   * @static
   * @returns {Date} Today's date with time set to midnight
   * @example
   * const today = Date.today();
   * console.log(today.toFormat("YYYY-MM-DD")); // e.g., "2025-12-25"
   */
  Object.defineProperty(Date, 'today', {
    value: function today() {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d;
    },
    writable: false,
    enumerable: false,
  });
}

if (!Object.prototype.hasOwnProperty.call(Date, 'yesterday')) {
  /**
   * Get yesterday's date at 00:00:00.
   * @static
   * @returns {Date} Yesterday's date with time set to midnight
   * @example
   * const yesterday = Date.yesterday();
   * console.log(yesterday.toFormat("YYYY-MM-DD")); // e.g., "2025-12-24"
   */
  Object.defineProperty(Date, 'yesterday', {
    value: function yesterday() {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      d.setHours(0, 0, 0, 0);
      return d;
    },
    writable: false,
    enumerable: false,
  });
}
