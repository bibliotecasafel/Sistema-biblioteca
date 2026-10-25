const $ = id => document.getElementById(id);

$("menu-btn").addEventListener("click", () => { $("sidebar").classList.add("open"); $("overlay").classList.add("active"); });
$("overlay").addEventListener("click", () => { $("sidebar").classList.remove("open"); $("overlay").classList.remove("active"); });
$("btn-sair").addEventListener("click", () => { limparSessao(); location.reload(); });

window.onload = () => {
  if (obterToken()) {
    $("login-screen").style.display = "none"; $("app-screen").style.display = "block";
    $("user-name").textContent = obterUsuario().nome;
    carregarAcervo();
  } else { $("login-screen").style.display = "block"; }
};

$("btn-login").addEventListener("click", async () => {
  const data = await apiPost("login", { email: $("l-email").value, password: $("l-senha").value });
  if (data.success) { salvarSessao(data.token, { nome: data.nome, email: data.email }); window.location.reload(); } 
  else { $("login-msg").textContent = data.message; }
});

$("isbn").addEventListener("blur", async () => {
  const isbn = $("isbn").value.trim(); if (isbn.length < 10) return;
  try {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&key=${GOOGLE_BOOKS_KEY}`);
    const data = await res.json();
    if (data.items && data.items.length) {
      const v = data.items[0].volumeInfo;
      $("titulo").value = v.title || ""; $("autor").value = (v.authors || []).join(", ");
      $("editora").value = v.publisher || ""; $("genero").value = (v.categories || []).join(", ");
    }
  } catch(e) {}
});

$("btn-salvar").addEventListener("click", async () => {
  const book = { isbn: $("isbn").value, id: $("numero").value, title: $("titulo").value, author: $("autor").value, publisher: $("editora").value, genre: $("genero").value };
  const data = await apiPost("saveBook", { book });
  if (data.success) {
    $("msg").textContent = "Salvo!"; $("msg").style.color = "green";
    ["isbn","numero","titulo","autor","editora","genero"].forEach(i => $(i).value = "");
    carregarAcervo(); notificarAtualizacao();
  } else { $("msg").textContent = data.message; $("msg").style.color = "red"; }
});

async function carregarAcervo() {
  const data = await apiGet("books");
  const tbody = $("tabela").querySelector("tbody"); tbody.innerHTML = "";
  if(data.books) data.books.forEach(b => tbody.innerHTML += `<tr><td>${b.id}</td><td>${b.title}</td><td>${b.author}</td><td>${b.isbn}</td></tr>`);
}

$("busca").addEventListener("input", (e) => {
  const termo = e.target.value.toLowerCase();
  $("tabela").querySelectorAll("tbody tr").forEach(tr => tr.style.display = tr.textContent.toLowerCase().includes(termo) ? "" : "none");
});
