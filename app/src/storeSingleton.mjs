
import Store from 'electron-store';

/**
 * Shared Store instance to prevent race conditions and data loss.
 * Using a singleton ensures all modules see the same in-memory state of the config.
 * clearInvalidConfig: false prevents the file from being wiped if corruption occurs.
 */
const store = new Store({
    clearInvalidConfig: false
});

export { store };
