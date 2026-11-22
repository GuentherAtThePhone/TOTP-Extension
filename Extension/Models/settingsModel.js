class Settings{
    theme;
    fontSize;
    nextCode;
    masterPasswordEnabled;
    showServiceImages;
    allowRemoteImages;
    showAccountUrlButton;
    accountUrlClipboardTimeout;
    constructor(theme, fontSize, nextCode, masterPasswordEnabled, showServiceImages = true, allowRemoteImages = false, showAccountUrlButton = true, accountUrlClipboardTimeout = 10){
        this.theme = theme;
        this.fontSize = fontSize;
        this.nextCode = nextCode;
        this.masterPasswordEnabled = masterPasswordEnabled;
        this.showServiceImages = showServiceImages;
        this.allowRemoteImages = allowRemoteImages;
        this.showAccountUrlButton = showAccountUrlButton;
        this.accountUrlClipboardTimeout = accountUrlClipboardTimeout;
    }
}

/**
 * Creates and saves default settings
 * @returns DefaultSettings
 */
async function createDefaultSettings(){
    var result = await browser.storage.local.get("masterPasswordEnabled");

    var settings = new Settings(
        "default",
        "medium",
        true,
        result.masterPasswordEnabled,
        true,
        false,
        true,
        10,
    );

    await browser.storage.local.set({settings: settings});

    return settings;
}

async function isDarkMode(){
    var result = await browser.storage.local.get("settings");
    if(!result.settings || result.settings.theme === "default"){
        return window.matchMedia("(prefers-color-scheme: dark)").matches;
    };
    
    return (result.settings.theme === "dark") ? true : false;
}

async function isShowNextCode(){
    var result = await browser.storage.local.get("settings");
    if(!result.settings)
        return true;

    return result.settings.nextCode;
}

async function isShowServiceImages(){
    var result = await browser.storage.local.get("settings");
    return !result.settings || result.settings.showServiceImages !== false;
}

async function isAllowRemoteImages(){
    var result = await browser.storage.local.get("settings");
    return !!(result.settings && result.settings.allowRemoteImages === true);
}

async function isShowAccountUrlButton(){
    var result = await browser.storage.local.get("settings");
    return !result.settings || result.settings.showAccountUrlButton !== false;
}

async function getAccountUrlClipboardTimeout(){
    var result = await browser.storage.local.get("settings");
    const timeout = Number(result.settings && result.settings.accountUrlClipboardTimeout);
    return Number.isInteger(timeout) && timeout > 0 && timeout <= 3600 ? timeout : 10;
}

async function getFontSize(){
    var result = await browser.storage.local.get("settings");
    if(!result.settings)
        return "medium";

    return result.settings.fontSize;
}