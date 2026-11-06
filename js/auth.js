/** Client-side gate: PBKDF2-SHA256 hash only (no plaintext in repo). */
(function () {
  const SALT_HEX = "f5683dd503d323855db92b852f5f1ff4";
  const HASH_HEX = "7e5a33ce72990d7df64c18c5b9bf4dbfd945eb8111148b2deb4240f967688cf8";
  const KEY = "portal_coronel_ok_v1";
  const ITER = 120000;

  async function hashPassword(pw) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]
    );
    const salt = new Uint8Array(SALT_HEX.match(/.{2}/g).map((b) => parseInt(b, 16)));
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations: ITER, hash: "SHA-256" },
      keyMaterial,
      256
    );
    return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  function unlock() {
    sessionStorage.setItem(KEY, "1");
    const gate = document.getElementById("gate");
    const app = document.getElementById("app");
    if (gate) gate.hidden = true;
    if (app) app.hidden = false;
  }

  function lockUI() {
    const gate = document.getElementById("gate");
    const app = document.getElementById("app");
    if (gate) gate.hidden = false;
    if (app) app.hidden = true;
  }

  async function tryLogin(pw) {
    const h = await hashPassword(pw);
    return h === HASH_HEX;
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (sessionStorage.getItem(KEY) === "1") {
      unlock();
      return;
    }
    lockUI();
    const form = document.getElementById("gate-form");
    const err = document.getElementById("gate-err");
    if (!form) return;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      err.textContent = "Verificando…";
      const pw = document.getElementById("gate-pw").value;
      try {
        if (await tryLogin(pw)) {
          unlock();
        } else {
          err.textContent = "Contraseña incorrecta.";
        }
      } catch (ex) {
        err.textContent = "No se pudo verificar (navegador sin WebCrypto).";
      }
    });
  });

  window.PortalAuth = { unlock, tryLogin, lockUI };
})();
