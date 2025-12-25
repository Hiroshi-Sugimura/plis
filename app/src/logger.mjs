/**
 * @module logger
 * @summary Centralized logger utility for consistent formatting and severity levels.
 */

export const logger = {
    /**
     * Returns current ISO timestamp.
     * @returns {string}
     */
    getTimestamp() {
        return new Date().toISOString();
    },

    /**
     * Log informational message.
     * @param {string} tag - Module name or context tag.
     * @param {...any} args - Values to log.
     */
    info(tag, ...args) {
        console.log(`${this.getTimestamp()} | [${tag}]`, ...args);
    },

    /**
     * Log debug message if enabled.
     * @param {string} tag - Module name or context tag.
     * @param {boolean} enabled - Whether debug logging is enabled for this module.
     * @param {...any} args - Values to log.
     */
    debug(tag, enabled, ...args) {
        if (enabled) {
            console.log(`${this.getTimestamp()} | [${tag}] DEBUG:`, ...args);
        }
    },

    /**
     * Log error message.
     * @param {string} tag - Module name or context tag.
     * @param {...any} args - Values to log.
     */
    error(tag, ...args) {
        console.error(`${this.getTimestamp()} | [${tag}] ERROR:`, ...args);
    },

    /**
     * Log warning message.
     * @param {string} tag - Module name or context tag.
     * @param {...any} args - Values to log.
     */
    warn(tag, ...args) {
        console.warn(`${this.getTimestamp()} | [${tag}] WARN:`, ...args);
    }
};
