// Minimal Date formatting polyfill to replace date-utils usage
// Provides: Date.prototype.toFormat, Date.today(), Date.yesterday()

if (!Date.prototype.toFormat) {
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
