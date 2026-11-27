const accountFields = new Set([
  "secret",
  "label",
  "account",
  "issuer",
  "digits",
  "algorithm",
  "type",
  "counter",
  "period",
  "image"
]);

function normalizeAccount(account) {
  const normalized = {};
  for (const [key, value] of Object.entries(account)) {
    if (accountFields.has(key) && value !== undefined) {
      normalized[key] = value;
    }
  }

  if (typeof normalized.label === "string") {
    const separator = normalized.label.indexOf(":");
    if (separator !== -1) {
      const labelIssuer = normalized.label.slice(0, separator);
      if (normalized.issuer == null && labelIssuer) {
        normalized.issuer = labelIssuer;
      }
      if (normalized.account == null) {
        normalized.account = normalized.label.slice(separator + 1);
      }
    }
  }

  if (normalized.digits == null) {
    normalized.digits = 6;
  }
  if (normalized.algorithm == null) {
    normalized.algorithm = "SHA-1";
  }
  if (String(normalized.type || "").toUpperCase() !== "HOTP" && normalized.period == null) {
    normalized.period = 30;
  }

  return normalized;
}

class Account {
  constructor(secret, label, account, issuer, digits, algorithm, type, counter, period, image) {
    Object.assign(this, normalizeAccount({
      secret,
      label,
      account,
      issuer,
      digits,
      algorithm,
      type,
      counter,
      period,
      image
    }));
  }

  static from(account) {
    return Object.assign(Object.create(Account.prototype), normalizeAccount(account));
  }
}

function createAccount(account) {
  return Account.from(account);
}

function normalizeAccounts(accounts) {
  return accounts.map(account => {
    if (!account || typeof account !== "object") {
      throw new TypeError("Each account must be an object");
    }

    return createAccount(account);
  });
}

function getAccountDuplicateKey(account) {
  if (!account || typeof account.secret !== "string" || !account.secret.trim()) {
    return null;
  }

  const type = String(account.type || "").trim().toUpperCase();
  const secret = account.secret
    .trim()
    .replace(/[\s-]/g, "")
    .replace(/=+$/, "")
    .toUpperCase();
  const algorithm = String(account.algorithm || "SHA-1")
    .trim()
    .toUpperCase()
    .replace(/[\s-]/g, "");
  const digits = Number(account.digits) || 6;
  const keyParts = [type, secret, algorithm, digits];

  if (type === "HOTP") {
    const counter = account.counter == null ? 0 : Number(account.counter);
    keyParts.push(Number.isFinite(counter) ? counter : 0);
  } else if (type === "TOTP") {
    const period = account.period == null ? 30 : Number(account.period);
    keyParts.push(Number.isFinite(period) ? period : 30);
  }

  return keyParts.join("|");
}

function mergeImportedAccounts(existingAccounts, importedAccounts) {
  const knownKeys = new Set();

  for (const account of existingAccounts || []) {
    const key = getAccountDuplicateKey(account);
    if (key !== null) {
      knownKeys.add(key);
    }
  }

  const uniqueImportedAccounts = [];
  for (const account of importedAccounts || []) {
    const key = getAccountDuplicateKey(account);
    if (key !== null && knownKeys.has(key)) {
      continue;
    }

    uniqueImportedAccounts.push(account);
    if (key !== null) {
      knownKeys.add(key);
    }
  }

  return {
    accounts: [...(existingAccounts || []), ...uniqueImportedAccounts],
    imported: uniqueImportedAccounts,
    skipped: (importedAccounts || []).length - uniqueImportedAccounts.length
  };
}

async function saveAccounts(accounts, password) {
  accounts = normalizeAccounts(accounts);
  if(!password){
    await browser.storage.local.set({ accounts });
    return;
  }
  
  const encryptedAccounts = await encrypt(JSON.stringify(accounts), password);
  
  await browser.storage.local.set({ accounts: encryptedAccounts });
}

async function loadAccounts(password) {
  const { accounts } = await browser.storage.local.get("accounts");
  if(!accounts){
    return [];
  }

  if(Array.isArray(accounts)){
    const normalizedAccounts = normalizeAccounts(accounts);
    if(password){
      await saveAccounts(normalizedAccounts, password);
    } else if (JSON.stringify(normalizedAccounts) !== JSON.stringify(accounts)) {
      await saveAccounts(normalizedAccounts, null);
    }
    return normalizedAccounts;
  }
  if(!password){
    throw new Error("A master password is required to unlock the account vault");
  }

  const decrypted = accounts.version === 2
    ? await decrypt(accounts, password)
    : await loadLegacyAccounts(accounts);
  const loadedAccounts = normalizeAccounts(JSON.parse(decrypted));

  if(accounts.version !== 2){
    const stagedCiphertext = await encrypt(JSON.stringify(loadedAccounts), password);
    await browser.storage.local.set({ accountsMigration: stagedCiphertext });
    const { accountsMigration } = await browser.storage.local.get("accountsMigration");
    const verifiedAccounts = JSON.parse(await decrypt(accountsMigration, password));
    if(JSON.stringify(verifiedAccounts) !== JSON.stringify(loadedAccounts)){
      throw new Error("The migrated account vault could not be verified");
    }
    await browser.storage.local.set({ accounts: accountsMigration });
    await browser.storage.local.remove("accountsMigration");
  } else if (JSON.stringify(loadedAccounts) !== decrypted) {
    await saveAccounts(loadedAccounts, password);
  }
  return loadedAccounts;
}

async function loadLegacyAccounts(encryptedAccounts) {
  const { masterPassword } = await browser.storage.local.get("masterPassword");
  if(!masterPassword || !masterPassword.hash){
    throw new Error("The legacy account vault cannot be migrated without its password verifier");
  }
  return decrypt(encryptedAccounts, masterPassword.hash);
}