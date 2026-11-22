const extensionApi = typeof browser !== "undefined" ? browser : chrome;
let backgroundCleanupTimer = null;

extensionApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "scheduleClipboardCleanup") return;

  if (typeof navigator === "undefined" ||
      !navigator.clipboard ||
      typeof navigator.clipboard.readText !== "function") {
    sendResponse({ scheduled: false });
    return;
  }

  scheduleBackgroundCleanup(message.url, message.timeoutMs);
  sendResponse({ scheduled: true });
});

function scheduleBackgroundCleanup(copiedUrl, timeoutMs) {
  clearTimeout(backgroundCleanupTimer);
  backgroundCleanupTimer = setTimeout(async () => {
    try {
      if (await navigator.clipboard.readText() === copiedUrl) {
        await navigator.clipboard.writeText("");
      }
    } catch (error) {
      console.error("Could not clear the account URL from the clipboard:", error);
    }
    backgroundCleanupTimer = null;
  }, timeoutMs);
}
