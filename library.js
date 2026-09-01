/**
 * Local-only score list. Never uploads. Folder stays on this machine.
 * Chromium: File System Access directory handle (remembered in IndexedDB).
 * Fallback: <input webkitdirectory> for this page session.
 */
(function (global) {
  const DB_NAME = "altoFingeringPlayer";
  const DB_VER = 1;
  const SCORE_RE = /\.(musicxml|xml|mxl|json)$/i;
  const SKIP_NAME = /^(container\.xml)$/i;
  const FOLDER_ORDER = ["中文歌_入門", "動畫主題", "English_Sax_Classics", "Jazz_Standards"];
  const MAX_FILES = 400;
  const MAX_DEPTH = 6;

  function idbReq(req) {
    return new Promise(function (resolve, reject) {
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function openDb() {
    return new Promise(function (resolve, reject) {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = function () {
        const db = req.result;
        if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  async function kvGet(key) {
    const db = await openDb();
    try {
      return await idbReq(db.transaction("kv", "readonly").objectStore("kv").get(key));
    } finally {
      db.close();
    }
  }

  async function kvSet(key, value) {
    const db = await openDb();
    try {
      const tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").put(value, key);
      await new Promise(function (resolve, reject) {
        tx.oncomplete = resolve;
        tx.onerror = function () { reject(tx.error); };
      });
    } finally {
      db.close();
    }
  }

  async function saveHandle(handle) {
    await kvSet("dirHandle", handle);
    if (handle && handle.name) await kvSet("dirName", handle.name);
  }

  async function loadHandle() {
    try {
      return await kvGet("dirHandle");
    } catch (e) {
      return null;
    }
  }

  async function permission(handle) {
    if (!handle || !handle.queryPermission) return "denied";
    try {
      const q = await handle.queryPermission({ mode: "read" });
      return q;
    } catch (e) {
      return "denied";
    }
  }

  function displayName(filename) {
    return String(filename || "").replace(/\.(musicxml|xml|mxl|json)$/i, "");
  }

  async function walkDir(dirHandle, prefix, depth, rootName, out) {
    out = out || [];
    if (depth > MAX_DEPTH || out.length >= MAX_FILES) return out;
    const folder = prefix ? prefix.replace(/\/$/, "") : (rootName || dirHandle.name || "樂譜");
    for await (const [name, handle] of dirHandle.entries()) {
      if (!name || name.charAt(0) === ".") continue;
      if (handle.kind === "directory") {
        await walkDir(handle, (prefix || "") + name + "/", depth + 1, rootName, out);
      } else if (SCORE_RE.test(name) && !SKIP_NAME.test(name) && !/META-INF\//i.test(prefix || "")) {
        out.push({
          id: (prefix || "") + name,
          name: name,
          path: (prefix || "") + name,
          folder: folder,
          title: displayName(name),
          handle: handle
        });
        if (out.length >= MAX_FILES) return out;
      }
    }
    return out;
  }

  async function fromDirectoryHandle(handle) {
    const items = await walkDir(handle, "", 0, handle.name, []);
    items.sort(function (a, b) {
      return a.path.localeCompare(b.path, "zh-Hant");
    });
    return items;
  }

  function fromFileList(fileList) {
    const files = Array.prototype.slice.call(fileList || []);
    const items = [];
    files.forEach(function (f) {
      const rel = f.webkitRelativePath || f.name;
      if (!SCORE_RE.test(f.name) || SKIP_NAME.test(f.name)) return;
      if (/META-INF\//i.test(rel) || rel.charAt(0) === ".") return;
      const parts = rel.split("/");
      const folder = parts.length > 1 ? parts.slice(0, -1).join("/") : "樂譜";
      items.push({
        id: rel,
        name: f.name,
        path: rel,
        folder: folder,
        title: displayName(f.name),
        file: f
      });
    });
    items.sort(function (a, b) {
      return a.path.localeCompare(b.path, "zh-Hant");
    });
    return items.slice(0, MAX_FILES);
  }

  async function readEntry(entry) {
    if (entry && entry.handle && entry.handle.getFile) {
      return entry.handle.getFile();
    }
    if (entry && entry.file) return entry.file;
    throw new Error("找不到檔案");
  }

  function groupItems(items) {
    const map = {};
    (items || []).forEach(function (it) {
      const key = it.folder || "樂譜";
      if (!map[key]) map[key] = [];
      map[key].push(it);
    });
    const keys = Object.keys(map);
    keys.sort(function (a, b) {
      const ia = FOLDER_ORDER.indexOf(a.split("/").pop());
      const ib = FOLDER_ORDER.indexOf(b.split("/").pop());
      if (ia >= 0 || ib >= 0) {
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      }
      return a.localeCompare(b, "zh-Hant");
    });
    return keys.map(function (k) {
      return { folder: k, items: map[k] };
    });
  }

  function canRememberFolder() {
    return typeof window.showDirectoryPicker === "function";
  }

  global.ScoreLibrary = {
    saveHandle: saveHandle,
    loadHandle: loadHandle,
    permission: permission,
    fromDirectoryHandle: fromDirectoryHandle,
    fromFileList: fromFileList,
    readEntry: readEntry,
    groupItems: groupItems,
    displayName: displayName,
    canRememberFolder: canRememberFolder
  };
})(window);
