const $ = id => document.getElementById(id);
let stream = null; let codeReader = null; let torchOn = false;

window.onload = () => {
  if (obterToken()) { $("login-screen").style.display = "none"; $("app-screen").style.display = "block"; }
  else { $("login-screen").style.display = "block"; }
};

$("btn-login").addEventListener("click", async () => {
  const data = await apiPost("login", { email: $("login-email").value, password: $("login-senha").value });
  if (data.success) { salvarSessao(data.token, { nome: data.nome, email: data.email }); window.location.reload(); }
  else { $("login-msg").textContent = data.message; }
});

$("btn-iniciar").addEventListener("click", async () => {
  $("camera-container").style.display = "block"; $("btn-iniciar").style.display = "none"; $("btn-flash").style.display = "block"; $("status-msg").textContent = "";
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    $("video").srcObject = stream;
    codeReader = new ZXing.BrowserMultiFormatReader();
    codeReader.decodeFromVideoDevice(null, 'video', (result) => {
      if (result) { pararCamera(); prepararConfirmacao(result.text); }
    });
  } catch (err) { $("status-msg").textContent = "Erro na câmera: " + err.message; }
});

function pararCamera() {
  if (codeReader) codeReader.reset();
  if (stream) stream.getTracks().forEach(t => t.stop());
  $("camera-container").style.display = "none"; $("btn-flash").style.display = "none"; $("btn-iniciar").style.display = "block";
}

$("btn-flash").addEventListener("click", async () => {
  if (!stream) return;
  const track = stream.getVideoTracks()[0];
  try {
    torchOn = !torchOn; await track.applyConstraints({ advanced: [{ torch: torchOn }] });
    $("btn-flash").style.background = torchOn ? "#fff" : ""; $("btn-flash").style.color = torchOn ? "#000" : "";
  } catch (e) { alert("Lanterna não suportada."); }
});

async function prepararConfirmacao(isbn) {
  $("confirm-form").style.display = "block"; $("c-isbn").value = isbn; $("save-msg").textContent = "Buscando dados...";
  try {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&key=${GOOGLE_BOOKS_KEY}`);
    const data = await res.json();
    if (data.items && data.items.length) {
      const v = data.items[0].volumeInfo;
      $("c-titulo").value = v.title || ""; $("c-autor").value = (v.authors || []).join(", ");
      $("c-editora").value = v.publisher || ""; $("c-genero").value = (v.categories || []).join(", ");
      $("save-msg").textContent = "";
    } else { $("save-msg").textContent = "Preencha manualmente."; $("save-msg").style.color = "orange"; }
  } catch (e) { $("save-msg").textContent = "Erro na API."; }
}

$("btn-salvar-livro").addEventListener("click", async () => {
  const book = { isbn: $("c-isbn").value, id: $("c-numero").value, title: $("c-titulo").value, author: $("c-autor").value, publisher: $("c-editora").value, genre: $("c-genero").value };
  if (!book.id || !book.title) { $("save-msg").textContent = "Preencha o ID e o Título."; $("save-msg").style.color = "red"; return; }

  $("save-msg").textContent = "Salvando...";
  const data = await apiPost("saveBook", { book });
  
  if (data.success) {
    $("save-msg").textContent = "Salvo com sucesso!"; $("save-msg").style.color = "green";
    notificarAtualizacao(); // Avisa os outros sites!
    setTimeout(() => {
      $("confirm-form").style.display = "none"; $("save-msg").textContent = "";
      ["c-isbn","c-numero","c-titulo","c-autor","c-editora","c-genero"].forEach(id => $(id).value = "");
    }, 2000);
  } else { $("save-msg").textContent = data.message; $("save-msg").style.color = "red"; }
});

$("btn-cancelar").addEventListener("click", () => { $("confirm-form").style.display = "none"; $("btn-iniciar").click(); });
