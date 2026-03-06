// js/browserCompat.js
// Browser Compatibility Module - Handles browser-specific API differences
// Requirements: 2.1, 2.4, 10.1, 11.1, 11.2, 12.1, 12.2

class BrowserCompat {
    // Browser detection
    // Firefox has browser.runtime.getBrowserInfo, Chrome does not
    static isFirefox = typeof browser !== 'undefined' &&
        browser.runtime?.getBrowserInfo !== undefined;

    static isChrome = !BrowserCompat.isFirefox;

    /**
     * Check if a specific API path is available
     * @param {string} apiPath - Dot-separated API path (e.g., 'sidePanel', 'power', 'system.display')
     * @returns {boolean} - True if the API exists
     */
    static hasAPI(apiPath) {
        const parts = apiPath.split('.');
        let obj = typeof browser !== 'undefined' ? browser : chrome;
        for (const part of parts) {
            if (obj && part in obj) {
                obj = obj[part];
            } else {
                return false;
            }
        }
        return true;
    }

    /**
     * Side Panel support detection
     * Side Panel is Chrome-specific (Chrome 114+)
     * @returns {boolean}
     */
    static get supportsSidePanel() {
        return BrowserCompat.isChrome && BrowserCompat.hasAPI('sidePanel');
    }

    /**
     * Power API support detection
     * chrome.power is not available in Firefox
     * @returns {boolean}
     */
    static get supportsPowerAPI() {
        return BrowserCompat.hasAPI('power');
    }

    /**
     * System Display API support detection
     * chrome.system.display is not available in Firefox
     * @returns {boolean}
     */
    static get supportsSystemDisplay() {
        return BrowserCompat.hasAPI('system.display');
    }

    /**
     * downloads.onDeterminingFilename support detection
     * This event is not available in Firefox
     * @returns {boolean}
     */
    static get supportsOnDeterminingFilename() {
        return BrowserCompat.hasAPI('downloads.onDeterminingFilename');
    }

    /**
     * Get screen size (cross-browser)
     * Uses system.display API on Chrome, falls back to window.screen on Firefox
     * @returns {Promise<{width: number, height: number, left: number, top: number}>}
     */
    static async getScreenSize() {
        if (BrowserCompat.supportsSystemDisplay) {
            const displays = await chrome.system.display.getInfo();
            return displays[0].workArea;
        }
        // Firefox fallback using window.screen
        return {
            width: window.screen.availWidth,
            height: window.screen.availHeight,
            left: 0,
            top: 0
        };
    }

    /**
     * Request keep awake (cross-browser)
     * Silently ignored on Firefox where power API is not available
     * @param {string} level - Keep awake level ('system' or 'display')
     */
    static requestKeepAwake(level) {
        if (BrowserCompat.supportsPowerAPI) {
            chrome.power.requestKeepAwake(level);
        }
        // Firefox: silently ignore - no power API available
    }

    /**
     * Release keep awake (cross-browser)
     * Silently ignored on Firefox where power API is not available
     */
    static releaseKeepAwake() {
        if (BrowserCompat.supportsPowerAPI) {
            chrome.power.releaseKeepAwake();
        }
        // Firefox: silently ignore - no power API available
    }

    /**
     * Get platform information (cross-browser)
     * Uses navigator.userAgentData on modern browsers, falls back to browser.runtime.getPlatformInfo
     * @returns {Promise<string>} - Platform name (e.g., 'Windows', 'macOS', 'Linux')
     */
    static async getPlatform() {
        // Try modern API first (Chrome 90+, some Firefox versions)
        if (navigator.userAgentData?.platform) {
            return navigator.userAgentData.platform;
        }
        // Firefox fallback using runtime.getPlatformInfo
        const api = typeof browser !== 'undefined' ? browser : chrome;
        const platformInfo = await api.runtime.getPlatformInfo();
        const osMap = { 'win': 'Windows', 'mac': 'macOS', 'linux': 'Linux' };
        return osMap[platformInfo.os] || platformInfo.os;
    }
}

export default BrowserCompat;
