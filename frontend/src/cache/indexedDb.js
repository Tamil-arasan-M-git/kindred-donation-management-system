const DB_NAME = "kindred-application-cache";
const DB_VERSION = 1;
const RECORD_STORE = "records";
const SYNC_STORE = "sync_metadata";

const currentScope = () => {
  try {
    const raw = localStorage.getItem("kindred_user");
    const user = raw ? JSON.parse(raw) : null;
    if (!user?.id || !user?.role) return null;
    return `${user.role}:${user.id}`;
  } catch {
    return null;
  }
};

const openDatabase = () => new Promise((resolve, reject) => {
  if (!("indexedDB" in window)) {
    resolve(null);
    return;
  }
  const request = window.indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(RECORD_STORE)) {
      const records = db.createObjectStore(RECORD_STORE, { keyPath: "key" });
      records.createIndex("scope", "scope", { unique: false });
      records.createIndex("resource", "resource", { unique: false });
    }
    if (!db.objectStoreNames.contains(SYNC_STORE)) {
      db.createObjectStore(SYNC_STORE, { keyPath: "key" });
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const transaction = async (storeName, mode, callback) => {
  const db = await openDatabase();
  if (!db) return null;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    let result;
    try { result = callback(store); } catch (error) { reject(error); return; }
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
};

export async function cacheGet(resource, recordKey = "collection") {
  const scope = currentScope();
  if (!scope) return null;
  const key = `${scope}:${resource}:${recordKey}`;
  const db = await openDatabase();
  if (!db) return null;
  return new Promise((resolve, reject) => {
    const request = db.transaction(RECORD_STORE, "readonly").objectStore(RECORD_STORE).get(key);
    request.onsuccess = () => { db.close(); resolve(request.result?.value ?? null); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

export async function cacheSet(resource, value, recordKey = "collection") {
  const scope = currentScope();
  if (!scope) return;
  const key = `${scope}:${resource}:${recordKey}`;
  await transaction(RECORD_STORE, "readwrite", (store) => store.put({ key, scope, resource, recordKey, value, updatedAt: Date.now() }));
}

export async function cacheDelete(resource, recordKey = "collection") {
  const scope = currentScope();
  if (!scope) return;
  await transaction(RECORD_STORE, "readwrite", (store) => store.delete(`${scope}:${resource}:${recordKey}`));
}

export async function clearCurrentUserCache() {
  const scope = currentScope();
  if (!scope) return;
  const db = await openDatabase();
  if (!db) return;
  await new Promise((resolve, reject) => {
    const tx = db.transaction([RECORD_STORE, SYNC_STORE], "readwrite");
    const records = tx.objectStore(RECORD_STORE).index("scope").openCursor(IDBKeyRange.only(scope));
    records.onsuccess = () => {
      const cursor = records.result;
      if (cursor) { cursor.delete(); cursor.continue(); }
    };
    tx.objectStore(SYNC_STORE).delete(scope);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function getSyncMetadata() {
  const scope = currentScope();
  if (!scope) return {};
  const db = await openDatabase();
  if (!db) return {};
  return new Promise((resolve, reject) => {
    const request = db.transaction(SYNC_STORE, "readonly").objectStore(SYNC_STORE).get(scope);
    request.onsuccess = () => { db.close(); resolve(request.result?.versions || {}); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

export async function setSyncMetadata(versions) {
  const scope = currentScope();
  if (!scope) return;
  await transaction(SYNC_STORE, "readwrite", (store) => store.put({ key: scope, scope, versions, updatedAt: Date.now() }));
}
