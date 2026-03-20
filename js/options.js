import Utils from "./utils.js";
import { DefaultConfigs, DefaultAriaNgOptions } from "./config.js";
import BrowserCompat from "./browserCompat.js";
import StorageProxy from "./storageProxy.js";

const AriaNgOptionsKey = "AriaNg.Options"; // AriaNG options local storage key

/**
 * Extract only data properties from Configs object for storage
 * Firefox's storage API cannot clone functions, so we need to filter them out
 * @returns {Object} Plain data object without methods
 */
function getConfigData() {
    const data = {};
    const configKeys = Object.keys(DefaultConfigs);
    for (const key of configKeys) {
        if (Configs.hasOwnProperty(key) && typeof Configs[key] !== 'function') {
            data[key] = Configs[key];
        }
    }
    return data;
}

const SHORTCUTS_PAGE_URL = "chrome://extensions/shortcuts";

const ColorModeList = [
    { name: 'light', icon: 'fa-sun', title: 'LightMode' },
    { name: 'dark', icon: 'fa-moon', title: 'DarkMode' },
    { name: 'system', icon: 'fa-circle-half-stroke', title: 'FollowSystem' }
];

const OptionDeps = { // Key named option depends on the value named option
    askBeforeExport: 'contextMenus',
    checkClick: 'integration',
    keepAwake: 'monitorAria2',
    keepSilent: 'allowNotification'
}

const Mark = chrome.i18n.getMessage("Mark");
const NameStr = chrome.i18n.getMessage("Name");
const SecretKeyStr = chrome.i18n.getMessage("SecretKey");
const DownloadLocationStr = chrome.i18n.getMessage("DownloadLocation");
const MarkAsSecureTip = chrome.i18n.getMessage("MarkAsSecureTip");
const MarkAsInsecureTip = chrome.i18n.getMessage("MarkAsInsecureTip");

// Firefox compatibility messages
const FirefoxSidePanelTip = chrome.i18n.getMessage("FirefoxSidePanelTip") || "Side Panel is not supported in Firefox. Please use Tab, Popup, or Window mode.";
const FirefoxKeepAwakeTip = chrome.i18n.getMessage("FirefoxKeepAwakeTip") || "Keep Awake is not supported in Firefox.";

/**
 * Handle Firefox-specific option disabling
 * Disables options that are not supported in Firefox and adds visual feedback
 * Requirements: 10.3, 11.1
 */
function handleFirefoxOptions() {
    // Check Side Panel support and disable if not available
    if (!BrowserCompat.supportsSidePanel) {
        const sidePanelRadio = $("#sidePanel");
        const sidePanelLabel = $("label[for='sidePanel']");
        
        // Disable the radio button
        sidePanelRadio.prop("disabled", true);
        
        // Add visual styling for disabled state
        sidePanelLabel.addClass("text-muted");
        
        // Add tooltip to the parent container
        sidePanelRadio.closest(".form-check").addClass("tool-tip").attr("tooltip-content", FirefoxSidePanelTip);
        
        // If sidePanel was previously selected, switch to tab mode
        if (Configs.webUIOpenStyle === "sidePanel") {
            $("#tab").prop("checked", true);
            Configs.webUIOpenStyle = "tab";
            StorageProxy.set({ webUIOpenStyle: "tab" });
        }
    }
    
    // Check Power API support and disable keepAwake if not available
    if (!BrowserCompat.supportsPowerAPI) {
        const keepAwakeCheckbox = $("#keepAwake");
        const keepAwakeLabel = $("label[for='keepAwake']");
        
        // Disable the checkbox
        keepAwakeCheckbox.prop("disabled", true);
        
        // Add visual styling for disabled state
        keepAwakeLabel.addClass("text-muted");
        
        // Add tooltip to the parent container
        keepAwakeCheckbox.closest(".custom-control").addClass("tool-tip").attr("tooltip-content", FirefoxKeepAwakeTip);
        
        // Uncheck if it was previously checked (since it won't work anyway)
        if (Configs.keepAwake) {
            keepAwakeCheckbox.prop("checked", false);
        }
    }
}

var Configs =
{
    init: async function () {
        Utils.localizeHtmlPage();
        if (location.search.endsWith("upgrade-storage"))
            await upgradeStorage();
        let configs = null;
        try {
            configs = await StorageProxy.get();
        } catch (error) {
            console.error("init: " + error.message);
        }
        Object.assign(Configs, DefaultConfigs, configs);

        setColorMode();

        $("input[type=checkbox]").prop("checked", false);
        $("input[type=text],input[type=number]").val("");
        $("textarea").val("");
        $(`#${Configs.webUIOpenStyle}`).prop('checked', true);
        $(`#${Configs.iconOffStyle}`).prop('checked', true);

        for (const checkbox of $("input[type=checkbox]")) {
            if (Configs[checkbox.id])
                checkbox.checked = Configs[checkbox.id];
        }

        Configs.rpcList.length > 1 ? $("#monitor-all").show() : $("#monitor-all").hide();

        for (const [dependent, dependency] of Object.entries(OptionDeps)) {
            $(`#${dependent}`).prop("disabled", !Configs[dependency]);
            $(`#${dependency}`).change(() => {
                $(`#${dependent}`).prop("disabled", !$(`#${dependency}`).prop("checked"));
            })
        }

        if (Utils.getPlatform() == "Windows") {
            let tooltip = chrome.i18n.getMessage("captureMagnetTip")
            $("#captureMagnet").parent().addClass("tool-tip tool-tip-icon");
        }

        for (const input of $("input[type=text],input[type=number]")) {
            if (Configs[input.id])
                input.value = Configs[input.id];
        }

        for (const textarea of $("textarea")) {
            if (Configs[textarea.id])
                textarea.value = Configs[textarea.id].join("\n");
        }

        if ($(".rpcGroup").length !== 0) {
            $(".rpcGroup").remove();
        }
        const rpcList = Configs.rpcList && Configs.rpcList.length ? Configs.rpcList : DefaultConfigs.rpcList;

        const addBtnOrPattern = (i) => {
            return i == 0 ? `<button class="btn btn-primary" id="add-rpc"><i class="fa-solid fa-circle-plus"></i> RPC Server</button>` :
                `<input id="pattern-${i}" type="text" class="form-control col-sm-3 pattern" placeholder="URL Pattern(s) splitted by ,">`;
        };
        const rpcInputGroup = (i) => {
            return `<div class="form-group row rpcGroup">` +
                `<label class="col-form-label col-sm-2 text-info">` + (i == 0 ? `<i class="fa-solid fa-server"></i> Aria2-RPC-Server` : '') + `</label>` +
                `<div id="rpcItem-${i}" class="input-group col-sm-10">` +
                `<input id="name-${i}" type="text" class="form-control col-sm-1 name" placeholder="${NameStr} ∗" required>` +
                `<input id="secretKey-${i}" type="password" class="form-control col-sm-2 secretKey" placeholder="${SecretKeyStr}">` +
                `<input id="rpcUrl-${i}" type="url" class="form-control col-sm-4 rpcUrl" placeholder="RPC URL ∗" required>` +
                `<div id="markRpc-${i}" class="input-group-append tool-tip" tooltip-content="">
                    <button id="markButton-${i}" class="btn btn-success" type="button">
                        <i class="fa-solid fa-pencil"></i> ${Mark}
                    </button>
                 </div>` +
                `<input id="location-${i}" type="text" class="form-control col-sm-2 location" placeholder="${DownloadLocationStr}">` + addBtnOrPattern(i) +
                `</div>` +
                `</div>`;
        };
        const validate = (event) => {
            const validator = { "url": Utils.validateRpcUrl, "text": Utils.validateFilePath };
            const input = event.target;
            input.classList.remove("is-invalid", "is-valid", "is-warning");
            input.parentElement.classList.remove('tool-tip');
            input.parentElement.removeAttribute("tooltip-content");
            let result = validator[input.type](input.value);
            if (result == "VALID" || result === true) {
                input.classList.add("is-valid");
            } else if (input.value && (result == "INVALID" || result === false)) {
                input.classList.add("is-invalid");
            } else if (result == "WARNING") {
                input.classList.add("is-valid", "is-warning");
                input.parentElement.classList.add("tool-tip");
                let tooltip = chrome.i18n.getMessage("RpcUrlTooltipWarnDes");
                input.parentElement.setAttribute("tooltip-content", tooltip);
            }
        };

        for (const i in rpcList) {
            // Append the rpc list elements and make sure the first item could not be empty.
            $("#rpcList").append(i == 0 ? rpcInputGroup(i) : rpcInputGroup(i).replaceAll("required", ''));
            $(`#markRpc-${i}`).off().on('click', markRpc);
        }
        for (const i in rpcList) {
            $("#name-" + i).val(rpcList[i].name);
            let rpc = Utils.parseUrl(rpcList[i].url);
            $("#secretKey-" + i).val(rpc.secretKey);
            $("#rpcUrl-" + i).val(rpc.rpcUrl);
            $("#location-" + i).val(rpcList[i].location || '');
            if (i > 0)
                $("#pattern-" + i).val(rpcList[i].pattern || '');
            if (Utils.validateRpcUrl(rpcList[i].url) == "WARNING") {
                $(`#markRpc-${i}`).css('display', 'inline-block');
                if (rpcList[i].ignoreInsecure) {
                    $(`#markRpc-${i}`).attr('tooltip-content', MarkAsInsecureTip);
                    $(`#markButton-${i}`).removeClass('btn-warning').addClass('btn-success');
                } else {
                    let tooltipRes = '';
                    if (Configs.askBeforeDownload || Configs.askBeforeExport) {
                        tooltipRes = "ManualDownloadCookiesTooltipDes";
                    } else {
                        tooltipRes = "AutoDownloadCookiesTooltipDes";
                    }
                    let tooltip = chrome.i18n.getMessage(tooltipRes);
                    $("#rpcItem-" + i).addClass('tool-tip');
                    $("#rpcItem-" + i).attr("tooltip-content", tooltip);
                    $("#rpcUrl-" + i).addClass('is-warning');
                    $(`#markRpc-${i}`).attr('tooltip-content', MarkAsSecureTip);
                    $(`#markButton-${i}`).removeClass('btn-success').addClass('btn-warning');
                }
            }
        }

        $("#shortcuts-setting").off().on("click", function () {
            chrome.tabs.query({ "url": SHORTCUTS_PAGE_URL }).then(function (tabs) {
                if (tabs?.length > 0) {
                    chrome.windows.update(tabs[0].windowId, {
                        focused: true
                    });
                    chrome.tabs.update(tabs[0].id, {
                        active: true
                    });
                } else {
                    chrome.tabs.getCurrent().then(tab => {
                        chrome.tabs.create({
                            url: SHORTCUTS_PAGE_URL,
                            openerTabId: tab.id,
                            index: tab.index + 1
                        });
                    });
                }
            });
        });

        $("#add-rpc").off().on("click", function () {
            let i = $(".rpcGroup").length;
            let newInput = rpcInputGroup(i).replace("password", "text");
            $("#rpcList").append(newInput);
            $("#rpcUrl-" + i).on("input", validate);
            $("#location-" + i).on("input", validate);
        });

        $(".rpcGroup .rpcUrl").off().on("input", validate);
        $(".rpcGroup .location").off().on("input", validate);

        for (const button of $("button")) {
            if (Configs[button.id] || !button.onclick)
                button.onclick = Configs[button.id];
        }
        /* prevent page from refresh when submit*/
        $("form").off().on("submit", function (event) {
            event.preventDefault();
        }).on("reset", function (event) {
            event.preventDefault();
        });
        $("#webStoreUrl").prop("href", Utils.getWebStoreUrl());
        const manifest = chrome.runtime.getManifest();
        $("#version").text('v' + manifest.version);

        $("#colorMode").off().on("click", function () {
            Configs.colorModeId = (Configs.colorModeId + 1) % ColorModeList.length;
            StorageProxy.set({ colorModeId: Configs.colorModeId });
        });

        $("#exportConfig").off().on("click", Configs.export);
        $("#importConfig").off().on("click", Configs.import);
        $("#configFileInput").off().on("change", Configs.handleConfigImport);
        
        // Handle Firefox-specific options (disable unsupported features)
        handleFirefoxOptions();
    },
    reset: async function () {
        if (confirm(chrome.i18n.getMessage("ClearSettingsDes"))) {
            localStorage.clear();
            await StorageProxy.clear().then(() => { StorageProxy.set(DefaultConfigs) });
        }
    },
    save: function () {
        let rpcGroup = $(".rpcGroup");
        Configs.rpcList = [];
        for (let i = 0; i < rpcGroup.length; i++) {
            if ($("#name-" + i).val() && $("#rpcUrl-" + i).val()) {
                let rpcUrl = Utils.combineUrl($("#secretKey-" + i).val(), $("#rpcUrl-" + i).val().trim());
                if (!rpcUrl) continue;
                let location = Utils.formatFilepath($("#location-" + i).val().trim());
                Configs.rpcList.push({
                    "name": $("#name-" + i).val().trim(),
                    "url": rpcUrl,
                    "location": location || '',
                    "pattern": $("#pattern-" + i).val()?.trim() || ''
                });
            }
        }

        if (!Configs.rpcList || !Configs.rpcList.length) {
            Configs.rpcList = DefaultConfigs.rpcList;
        }

        for (const checkbox of $("input[type=checkbox]")) {
            if (Configs.hasOwnProperty(checkbox.id))
                Configs[checkbox.id] = checkbox.checked;
        }
        for (const input of $("input[type=text],input[type=number]")) {
            if (Configs.hasOwnProperty(input.id))
                Configs[input.id] = input.value;
        }

        Configs.webUIOpenStyle = $("[name=webUIOpenStyle]:checked").val();
        Configs.iconOffStyle = $("[name=iconOffStyle]:checked").val();

        for (const textarea of $("textarea")) {
            Configs[textarea.id] = textarea.value.trim().split("\n");
            // clear the repeat record using Set object
            let tempSet = new Set(Configs[textarea.id]);
            tempSet.delete("");
            Configs[textarea.id] = Array.from(tempSet);
        }
        const configData = getConfigData();
        console.debug('[Aria2] Configs.save: saving config', JSON.stringify(configData));
        StorageProxy.set(configData);
        syncRpcToAriaNg(Configs.rpcList);
    },
    upload: function () {
        try {
            let ariaNgOptionsValue = localStorage.getItem(AriaNgOptionsKey);
            if (typeof ariaNgOptionsValue === "string") {
                Configs.ariaNgOptions = JSON.parse(ariaNgOptionsValue);
            }
        } catch {
            Configs.ariaNgOptions = DefaultAriaNgOptions;
            console.warn("Upload: Local AriaNG options is invalid, default is loaded.");
        }
        //check the validity of RPC list
        if (!Configs.rpcList || !Configs.rpcList.length) {
            let str = chrome.i18n.getMessage("uploadConfigWarn");
            if (!confirm(str))
                return;
        }
        // Use getConfigData() to extract only data properties (no methods)
        const uploadData = getConfigData();
        console.debug('[Aria2] upload: uploading to storage.sync', JSON.stringify(uploadData));
        chrome.storage.sync.set(uploadData).then(() => {
            console.debug('[Aria2] upload: success');
            let str = chrome.i18n.getMessage("uploadConfigSucceed");
            Configs.notifySyncResult(str, "alert-success");
        }).catch(error => {
            console.error('[Aria2] upload: failed', error);
            let str = chrome.i18n.getMessage("uploadConfigFailed");
            if (error.message.includes("QUOTA_BYTES_PER_ITEM")) {
                /* There must be too many BT trackers in the Aria2 settings */
                error.message = "Exceeded Quota (8KB). Please refine the Aria2 BT trackers."
            }
            Configs.notifySyncResult(`${str} (${error.message})`, "alert-danger", 5000);
        });
    },
    download: function () {
        console.debug('[Aria2] download: fetching from storage.sync');
        chrome.storage.sync.get().then(async configs => {
            console.debug('[Aria2] download: received configs keys=', Object.keys(configs), 'rpcList=', JSON.stringify(configs.rpcList));
            if (Object.keys(configs).length > 0) {
                try {
                    if (typeof configs.ariaNgOptions === "string") {
                        configs.ariaNgOptions = JSON.parse(configs.ariaNgOptions);
                    }
                    const optionsLength = Object.keys(configs.ariaNgOptions).length;
                    const defaultLength = Object.keys(DefaultAriaNgOptions).length;
                    console.debug('[Aria2] download: ariaNgOptions keys=', optionsLength, 'default keys=', defaultLength);
                    if (optionsLength >= defaultLength) {
                        localStorage.setItem(AriaNgOptionsKey, JSON.stringify(configs.ariaNgOptions));
                    } else {
                        throw new TypeError("Invalid AriaNG options");
                    }
                } catch {
                    delete configs.ariaNgOptions;
                    console.warn("Download: AriaNG options is invalid.");
                }
                Object.assign(Configs, configs);
                // Use getConfigData() to extract only data properties (no methods)
                const saveData = getConfigData();
                console.debug('[Aria2] download: saving to StorageProxy', JSON.stringify(saveData));
                await StorageProxy.set(saveData);
                let str = chrome.i18n.getMessage("downloadConfigSucceed");
                Configs.notifySyncResult(str, "alert-success");
            } else {
                throw new TypeError("Invalid extension configs");
            }
        }).catch((error) => {
            let str = chrome.i18n.getMessage("downloadConfigFailed");
            Configs.notifySyncResult(str, "alert-danger", 5000);
        });
    },
    notifySyncResult: function (msg, style, timeout = 2000) {
        $("#sync-result").addClass(style);
        $("#sync-result").text(msg);
        setTimeout(function () {
            $("#sync-result").text("");
            $("#sync-result").removeClass(style);
        }, timeout);
    },
    notifyImportExportResult: function (msg, style, timeout = 2000) {
        $("#import-export-result").addClass(style);
        $("#import-export-result").text(msg);
        setTimeout(function () {
            $("#import-export-result").text("");
            $("#import-export-result").removeClass(style);
        }, timeout);
    },
    export: function () {
        const configData = {};

        for (const key in Configs) {
            if (typeof Configs[key] !== 'function') {
                configData[key] = Configs[key];
            }
        }

        try {
            let ariaNgOptionsValue = localStorage.getItem(AriaNgOptionsKey);
            if (typeof ariaNgOptionsValue === "string") {
                configData.ariaNgOptions = JSON.parse(ariaNgOptionsValue);
            }
        } catch {
            configData.ariaNgOptions = DefaultAriaNgOptions;
        }

        const dataStr = JSON.stringify(configData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `aria2-explorer-config-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        const msg = chrome.i18n.getMessage("exportConfigSuccess");
        Configs.notifyImportExportResult(msg, "alert-success");
    },
    import: function () {
        const fileInput = document.getElementById('configFileInput');
        fileInput.click();
    },
    handleConfigImport: function (event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async function (e) {
            try {
                const configData = JSON.parse(e.target.result);

                if (!configData || typeof configData !== 'object') {
                    throw new Error('Invalid config format');
                }

                const confirmMsg = chrome.i18n.getMessage("importConfigConfirm");
                if (!confirm(confirmMsg)) {
                    return;
                }

                if (configData.ariaNgOptions) {
                    try {
                        localStorage.setItem(AriaNgOptionsKey, JSON.stringify(configData.ariaNgOptions));
                    } catch (error) {
                        console.warn("Failed to import AriaNG options:", error);
                    }
                    delete configData.ariaNgOptions;
                }

                Object.assign(Configs, DefaultConfigs, configData);

                await StorageProxy.set(getConfigData());

                await Configs.init();

                const msg = chrome.i18n.getMessage("importConfigSuccess");
                Configs.notifyImportExportResult(msg, "alert-success");

            } catch (error) {
                console.error("Import config error:", error);
                const msg = chrome.i18n.getMessage("importConfigFailed");
                Configs.notifyImportExportResult(`${msg} (${error.message})`, "alert-danger", 5000);
            }
        };
        reader.readAsText(file);

        event.target.value = '';
    }
};

window.onload = Configs.init;
window.matchMedia('(prefers-color-scheme: dark)').onchange = setColorMode;

chrome.storage.onChanged.addListener((changes, areaName) => {
    // Firefox uses sync storage, Chrome uses local storage
    const expectedArea = BrowserCompat.isFirefox ? "sync" : "local";
    if (areaName == expectedArea) {
        if (Object.keys(changes).length == 1 && changes.hasOwnProperty('colorModeId')) {
            /* Only call setColorMode to avoid breaking the rpc list's transition animation */
            setColorMode();
            return;
        }
        Configs.init();
        if (isRpcListChanged(changes) && !changes.hasOwnProperty("ariaNgOptions")) {
            syncRpcToAriaNg(changes.rpcList.newValue);
        }
        if (changes.captureMagnet)
            toggleMagnetHandler(changes.captureMagnet.newValue);
    }
});

window.onkeyup = function (e) {
    if (e.altKey) {
        let button;
        if (e.key == 's') {
            Configs.save();
            button = document.getElementById("save");
        } else if (e.key == 'r') {
            Configs.reset();
            button = document.getElementById("reset");
        } else if (e.key == 'u') {
            Configs.upload();
            button = document.getElementById("upload");
        } else if (e.key == 'j') {
            Configs.download();
            button = document.getElementById("download");
        } else if (e.key == 'e') {
            Configs.export();
            button = document.getElementById("exportConfig");
        } else if (e.key == 'i') {
            Configs.import();
            button = document.getElementById("importConfig");
        }
        button?.focus({ focusVisible: true });
    }
}

/**
 * Sync RPC list to AriaNg's localStorage options (no confirmation needed)
 * Only updates RPC-related fields, preserving other AriaNg settings.
 * @param {Array} rpcList
 */
function syncRpcToAriaNg(rpcList) {
    let ariaNgOptions = null;
    try {
        let stored = localStorage.getItem(AriaNgOptionsKey);
        if (stored) ariaNgOptions = JSON.parse(stored);
    } catch (error) {
        console.warn("syncRpcToAriaNg: stored AriaNG options is invalid.");
    }
    let newAriaNgOptions = JSON.stringify(Utils.exportRpcToAriaNg(rpcList, ariaNgOptions));
    const existing = localStorage.getItem(AriaNgOptionsKey);
    console.debug('[Aria2] syncRpcToAriaNg: rpcList=', JSON.stringify(rpcList));
    console.debug('[Aria2] syncRpcToAriaNg: newOptions=', newAriaNgOptions);
    console.debug('[Aria2] syncRpcToAriaNg: changed=', newAriaNgOptions !== existing);
    if (newAriaNgOptions !== existing) {
        localStorage.setItem(AriaNgOptionsKey, newAriaNgOptions);
    }
}

function isRpcListChanged(changes) {
    if (changes && changes.rpcList && changes.rpcList.newValue) {
        let oldList = changes.rpcList.oldValue;
        let newList = changes.rpcList.newValue;
        if (oldList?.length != newList?.length) {
            return true;
        } else {
            for (let i in newList) {
                if (newList[i].name != oldList[i].name || newList[i].url != oldList[i].url ||
                    (newList[i].pattern == '*' && oldList[i].pattern != '*')) {
                    return true;
                }
            }
        }
        return false;
    }
}

/**
 * toggle magnet protocol handler before changing the captureMagnet storage value
 *
 * @param {boolean} flag Set true to register, false to unregister
 */
function toggleMagnetHandler(flag) {
    let magnetPage = chrome.runtime.getURL("magnet.html") + "?action=magnet&url=%s";
    if (flag) {
        navigator.registerProtocolHandler("magnet", magnetPage, "Capture Magnet");
    } else if (typeof navigator.unregisterProtocolHandler === "function") {
        navigator.unregisterProtocolHandler("magnet", magnetPage);
    }
}

/**
 * Migrate extension settings from web local storage to Chrome local storage
 */
async function upgradeStorage() {
    let configs = await StorageProxy.get("rpcList");
    if (configs.rpcList) return;
    let convertMap = {
        white_site: "allowedSites",
        black_site: "blockedSites",
        white_ext: "allowedExts",
        black_ext: "blockedExts",
        rpc_list: "rpcList",
        newwindow: "window",
        newtab: "tab"
    }
    for (let [k, v] of Object.entries(localStorage)) {
        if (convertMap[k])
            k = convertMap[k]

        if (convertMap[v])
            v = convertMap[v]

        if (k.startsWith("AriaNg"))
            continue;

        if (v == "true")
            configs[k] = true;
        else if (v == "false")
            configs[k] = false;
        else if (/\[.*\]|\{.*\}/.test(v))
            configs[k] = JSON.parse(v);
        else
            configs[k] = v;
    }
    StorageProxy.set(configs).then(
        () => console.log("Storage upgrade completed.")
    );
}

function setColorMode() {
    switch (Configs.colorModeId) {
        case 0:
            $('html').removeClass("dark-mode");
            break;
        case 1:
            $('html').addClass("dark-mode");
            break;
        case 2:
            if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                $('html').addClass("dark-mode");
            } else {
                $('html').removeClass("dark-mode");
            }
            break;
    }
    let title = chrome.i18n.getMessage(ColorModeList[Configs.colorModeId].title);
    $("#colorMode .fa").removeClass('fa-moon fa-sun fa-circle-half-stroke')
        .addClass(ColorModeList[Configs.colorModeId].icon).attr("title", title);
}

function markRpc(event) {
    let rpcIndex = event.delegateTarget.id.split('-')[1];
    if (rpcIndex in Configs.rpcList) {
        Configs.rpcList[rpcIndex].ignoreInsecure = !Configs.rpcList[rpcIndex].ignoreInsecure;
        StorageProxy.set(getConfigData());
    }
}