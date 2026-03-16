#!/usr/bin/env node
/**
 * Manifest Generator for Aria2-Explorer
 * 
 * Generates browser-specific manifest.json files for Chrome and Firefox.
 * 
 * Usage:
 *   node build/manifest-generator.js --chrome    # Generate Chrome manifest
 *   node build/manifest-generator.js --firefox   # Generate Firefox manifest
 *   node build/manifest-generator.js --all       # Generate both manifests
 * 
 * Requirements: 14.1, 14.3
 */

const fs = require('fs');
const path = require('path');

// Read version from package.json
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));

// Base manifest with shared properties between Chrome and Firefox
const baseManifest = {
    "name": "__MSG_appName__",
    "short_name": "A2E",
    "version": pkg.version,
    "manifest_version": 3,
    "default_locale": "en",
    "description": "__MSG_description__",
    "homepage_url": "https://aria2e.com",
    "options_page": "options.html",
    "host_permissions": ["<all_urls>"],
    "icons": {
        "16": "images/logo16.png",
        "32": "images/logo32.png",
        "48": "images/logo48.png",
        "128": "images/logo128.png"
    },
    "action": {
        "default_icon": {
            "16": "images/logo16.png",
            "32": "images/logo32.png",
            "48": "images/logo48.png"
        },
        "default_title": "__MSG_appName__"
    },
    "commands": {
        "toggle-capture": {
            "suggested_key": { "default": "Alt+A" },
            "description": "__MSG_toggleCapture__"
        },
        "launch-aria2": {
            "suggested_key": { "default": "Alt+X" },
            "description": "__MSG_startAria2Str__"
        }
    },
    "web_accessible_resources": [{
        "resources": ["js/magnet.js", "magnet.html", "ui/ariang/logo512m.png"],
        "matches": ["<all_urls>"]
    }]
};

/**
 * Generate Chrome-specific manifest
 * Includes: service_worker, sidePanel, power, system.display, externally_connectable, incognito: "split"
 * 
 * @returns {Object} Chrome manifest object
 */
function generateChromeManifest() {
    return {
        ...baseManifest,
        "minimum_chrome_version": "116.0.0",
        "permissions": [
            "cookies",
            "tabs",
            "notifications",
            "contextMenus",
            "downloads",
            "storage",
            "system.display",
            "scripting",
            "sidePanel",
            "power"
        ],
        "background": {
            "service_worker": "background.js",
            "type": "module"
        },
        "incognito": "split",
        "side_panel": {
            "default_path": "ui/ariang/index.html"
        },
        "content_security_policy": {
            "extension_pages": "script-src 'self';object-src 'self';frame-src 'self' aria2://* https://*.aria2e.com/;"
        },
        "externally_connectable": { "ids": ["*"] }
    };
}

/**
 * Generate Firefox-specific manifest
 * Includes: browser_specific_settings, background.scripts, incognito: "spanning"
 * Removes: Chrome-only permissions (sidePanel, system.display, power), externally_connectable
 * 
 * @returns {Object} Firefox manifest object
 */
function generateFirefoxManifest() {
    return {
        ...baseManifest,
        "browser_specific_settings": {
            "gecko": {
                "id": "nicong@aspect.dev",
                "strict_min_version": "128.0",
                "data_collection_permissions": {
                    "required": ["none"],
                    "optional": []
                }
            }
        },
        "permissions": [
            "cookies",
            "tabs",
            "notifications",
            "contextMenus",
            "downloads",
            "storage",
            "scripting"
        ],
        "background": {
            "scripts": ["js/browser-polyfill.min.js", "background.js"],
            "type": "module"
        },
        "content_security_policy": {
            "extension_pages": "script-src 'self';object-src 'self';"
        },
        "content_scripts": [{
            "matches": ["<all_urls>"],
            "js": ["js/content/clickChecker.js"],
            "run_at": "document_end",
            "all_frames": true
        }]
    };
}

/**
 * Write manifest to file
 * 
 * @param {Object} manifest - The manifest object to write
 * @param {string} outputPath - The output file path
 */
function writeManifest(manifest, outputPath) {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2));
    console.log(`Generated: ${outputPath}`);
}

/**
 * Print manifest to stdout
 * 
 * @param {Object} manifest - The manifest object to print
 */
function printManifest(manifest) {
    console.log(JSON.stringify(manifest, null, 2));
}

/**
 * Display usage information
 */
function showUsage() {
    console.log(`
Manifest Generator for Aria2-Explorer

Usage:
  node build/manifest-generator.js [options]

Options:
  --chrome              Generate Chrome manifest (output to stdout)
  --firefox             Generate Firefox manifest (output to stdout)
  --all                 Generate both manifests (output to stdout)
  --output <dir>        Write manifests to files in specified directory
                        Creates manifest.chrome.json and manifest.firefox.json
  --help, -h            Show this help message

Examples:
  node build/manifest-generator.js --chrome
  node build/manifest-generator.js --firefox
  node build/manifest-generator.js --all --output dist/
  node build/manifest-generator.js --chrome --output .
`);
}

/**
 * Parse command line arguments
 * 
 * @returns {Object} Parsed arguments
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const result = {
        chrome: false,
        firefox: false,
        all: false,
        output: null,
        help: false
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        switch (arg) {
            case '--chrome':
                result.chrome = true;
                break;
            case '--firefox':
                result.firefox = true;
                break;
            case '--all':
                result.all = true;
                break;
            case '--output':
                if (i + 1 < args.length) {
                    result.output = args[++i];
                } else {
                    console.error('Error: --output requires a directory path');
                    process.exit(1);
                }
                break;
            case '--help':
            case '-h':
                result.help = true;
                break;
            default:
                console.error(`Unknown option: ${arg}`);
                showUsage();
                process.exit(1);
        }
    }

    return result;
}

/**
 * Main entry point
 */
function main() {
    const args = parseArgs();

    if (args.help) {
        showUsage();
        process.exit(0);
    }

    // If no browser specified, show usage
    if (!args.chrome && !args.firefox && !args.all) {
        showUsage();
        process.exit(1);
    }

    const generateChrome = args.chrome || args.all;
    const generateFirefox = args.firefox || args.all;

    if (args.output) {
        // Write to files
        if (generateChrome) {
            const chromeManifest = generateChromeManifest();
            const chromePath = path.join(args.output, 'manifest.chrome.json');
            writeManifest(chromeManifest, chromePath);
        }
        if (generateFirefox) {
            const firefoxManifest = generateFirefoxManifest();
            const firefoxPath = path.join(args.output, 'manifest.firefox.json');
            writeManifest(firefoxManifest, firefoxPath);
        }
    } else {
        // Print to stdout
        if (generateChrome && generateFirefox) {
            console.log('=== Chrome Manifest ===');
            printManifest(generateChromeManifest());
            console.log('\n=== Firefox Manifest ===');
            printManifest(generateFirefoxManifest());
        } else if (generateChrome) {
            printManifest(generateChromeManifest());
        } else if (generateFirefox) {
            printManifest(generateFirefoxManifest());
        }
    }
}

// Export functions for testing
module.exports = {
    baseManifest,
    generateChromeManifest,
    generateFirefoxManifest,
    writeManifest,
    parseArgs
};

// Run main if executed directly
if (require.main === module) {
    main();
}
