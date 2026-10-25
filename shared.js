const API_URL = "https://script.google.com/macros/s/SEU_ID_AQUI/exec"; // COLOQUE SUA URL AQUI
const GOOGLE_BOOKS_KEY = "SUA_CHAVE_AQUI"; // COLOQUE SUA CHAVE AQUI

const bc = new BroadcastChannel('biblioteca_sync');

function salvarSessao(token, user) {
  sessionStorage.setItem("bv_token", token);
  sessionStorage.setItem("bv_user", JSON.stringify(user));
}
function obterToken() { return sessionStorage.getItem("bv_token"); }
function obterUsuario() {
  const u = sessionStorage.getItem("bv_user");
  return u ? JSON.parse(u) : null;
}
function limparSessao() { sessionStorage.clear(); }

async function apiPost(action, payload = {}) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, ...payload, token: obterToken() })
  });
  const data = await res.json();
  if (!data.success && data.code === "SESSION_EXPIRED") {
    limparSessao();
    window.location.reload();
  }
  return data;
}

async function apiGet(action, extra = {}) {
  const url = new URL(API_URL);
  url.searchParams.set("action", action);
  url.searchParams.set("token", obterToken() || "");
  Object.entries(extra).forEach(([k, v]) => url.searchParams.set(k, v));
  
  const res = await fetch(url.toString());
  const data = await res.json();
  if (!data.success && data.code === "SESSION_EXPIRED") {
    limparSessao();
    window.location.reload();
  }
  return data;
}

function notificarAtualizacao() {
  bc.postMessage({ type: 'ACERVO_ALTERADO' });
}

bc.onmessage = (event) => {
  if (event.data.type === 'ACERVO_ALTERADO') {
    if (typeof carregarAcervo === 'function') carregarAcervo();
  }
};
