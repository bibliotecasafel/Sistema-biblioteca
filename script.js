const $ = id => document.getElementById(id);
const qsa = sel => document.querySelectorAll(sel);

const PERMISSIONS = {
  admin:         { tabs: ["cadastrar","acervo","emprestimos","retiradas","relatorios","config","admin"], canCatalog: true,  canEditBook: true,  canLoan: true,  canWithdraw: true,  canFinish: true,  canManageUsers: true,  canViewLogs: true },
  bibliotecario: { tabs: ["cadastrar","acervo","emprestimos","retiradas","relatorios","config"],           canCatalog: true,  canEditBook: true,  canLoan: true,  canWithdraw: true,  canFinish: true,  canManageUsers: false, canViewLogs: false },
  operador:      { tabs: ["cadastrar","acervo","emprestimos","retiradas","relatorios"],                    canCatalog: true,  canEditBook: true,  canLoan: true,  canWithdraw: true,  canFinish: true,  canManageUsers: false, canViewLogs: false },
  supervisor:    { tabs: ["acervo","emprestimos","retiradas","relatorios"],                                canCatalog: false, canEditBook: false, canLoan: false, canWithdraw: false, canFinish: false, canManageUsers: false, canViewLogs: false },
  monitor:       { tabs: ["acervo","emprestimos","relatorios"],                                            canCatalog: false, canEditBook: false, canLoan: true,  canWithdraw: false, canFinish: true,  canManageUsers: false, canViewLogs: false }
};

let chartGeneros = null, chartStatus = null;

function showModal(msg) { $("modal-message").textContent = msg; $("modal").classList.remove("hidden"); }
$("modal-close").addEventListener("click", () => $("modal").classList.add("hidden"));

// --- INICIALIZAÇÃO E LOGIN ---
window.onload = () => {
  const user = obterUsuario();
  if (user) {
    $("login-screen").classList.remove("active");
    $("app-screen").classList.add("active");
    
    const nomes = user.nome.split(" ").filter(Boolean);
    $("avatar").textContent = nomes.slice(0, 2).map(n => n[0].toUpperCase()).join("");
    $("welcome-message").textContent = `Seja bem‑vindo(a), ${user.nome}`;
    $("user-role-menu").textContent = user.nome;
    
    aplicarPermissoes(user.cargo);
    
    // Abre a primeira aba permitida
    const perms = PERMISSIONS[user.cargo] || PERMISSIONS.monitor;
    navegarAba(perms.tabs[0]);
    
    carregarAcervo();
    carregarEmprestimos();
    carregarRetiradas();
    carregarEstatisticas();
    if(user.cargo === "admin") carregarUsuarios();
  } else {
    $("login-screen").classList.add("active");
    $("app-screen").classList.remove("active");
  }
};

$("btn-login").addEventListener("click", async () => {
  const email = $("login-email").value;
  const senha = $("login-senha").value;
  $("login-feedback").textContent = "Entrando...";
  
  const data = await apiPost("login", { email, password: senha });
  if (data.success) {
    salvarSessao(data.token, { nome: data.nome, email: data.email, cargo: data.cargo });
    window.location.reload();
  } else {
    $("login-feedback").textContent = data.message;
  }
});

$("btn-sair-menu").addEventListener("click", (e) => { e.preventDefault(); limparSessao(); window.location.reload(); });

// --- NAVEGAÇÃO E MENU ---
$("menu-btn").addEventListener("click", () => { $("sidebar").classList.add("open"); $("overlay").classList.add("active"); });
$("overlay").addEventListener("click", () => { $("sidebar").classList.remove("open"); $("overlay").classList.remove("active"); });

qsa(".tab-link").forEach(link => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    const tab = link.dataset.tab;
    if (tab) navegarAba(tab);
    $("sidebar").classList.remove("open");
    $("overlay").classList.remove("active");
  });
});

function navegarAba(tabId) {
  qsa(".tab-link").forEach(l => l.classList.remove("active"));
  document.querySelector(`.tab-link[data-tab="${tabId}"]`)?.classList.add("active");
  qsa(".tab-content").forEach(c => c.classList.remove("active"));
  $(`tab-${tabId}`)?.classList.add("active");
}

function aplicarPermissoes(cargo) {
  const perms = PERMISSIONS[cargo] || PERMISSIONS.monitor;
  qsa(".tab-link").forEach(l => {
    if (l.dataset.tab) l.parentElement.style.display = perms.tabs.includes(l.dataset.tab) ? "" : "none";
  });
}

// --- GOOGLE BOOKS ---
let isbnTimer = null;
$("isbn").addEventListener("input", (e) => {
  clearTimeout(isbnTimer);
  const digits = e.target.value.replace(/[^0-9Xx]/g, "");
  if (digits.length < 10) return;
  isbnTimer = setTimeout(() => buscarISBN(e.target.value.trim()), 800);
});

async function buscarISBN(isbn) {
  $("isbn-info").textContent = "🔎 Buscando...";
  try {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&key=${GOOGLE_BOOKS_KEY}`);
    const data = await res.json();
    if (data.items && data.items.length) {
      const v = data.items[0].volumeInfo;
      $("titulo").value = v.title || ""; $("autor").value = (v.authors || []).join(", ");
      $("editora").value = v.publisher || ""; $("genero").value = (v.categories || []).join(", ");
      $("isbn-info").textContent = "✅ Dados preenchidos!";
    } else { $("isbn-info").textContent = "⚠️ Não encontrado."; }
  } catch(e) { $("isbn-info").textContent = "⚠️ Erro na busca."; }
}

// --- LIVROS ---
$("btn-salvar-livro").addEventListener("click", async () => {
  const isbn = $("isbn").value.trim();
  if (isbn.replace(/[^0-9Xx]/g, "").length < 10) {
    $("isbn-erro").textContent = "Este provavelmente não é um ISBN. Tente novamente com o ISBN correto.";
    return;
  }
  $("isbn-erro").textContent = "";
  
  const book = { isbn, id: $("numero-livro").value, title: $("titulo").value, author: $("autor").value, publisher: $("editora").value, genre: $("genero").value };
  const data = await apiPost("saveBook", { book });
  if (data.success) {
    $("cadastro-feedback").textContent = "Salvo com sucesso!"; $("cadastro-feedback").style.color = "var(--success)";
    ["isbn","numero-livro","titulo","autor","editora","genero"].forEach(i => $(i).value = "");
    $("isbn-info").textContent = "";
    carregarAcervo(); carregarEstatisticas(); notificarAtualizacao();
  } else { $("cadastro-feedback").textContent = data.message; $("cadastro-feedback").style.color = "var(--error)"; }
});

async function carregarAcervo() {
  const data = await apiGet("books");
  const tbody = $("tabela-acervo").querySelector("tbody");
  tbody.innerHTML = "";
  if (data.books) data.books.forEach(b => {
    tbody.innerHTML += `<tr><td>${b.id}</td><td>${b.title}</td><td>${b.author}</td><td>${b.publisher}</td><td>${b.genre}</td><td>${b.isbn}</td><td>${b.status}</td>
    <td><button class="btn-mini" onclick="editarLivro('${b.id}')">✏️ Editar</button></td></tr>`;
  });
  atualizarSelects(data.books);
}

function editarLivro(id) { showModal("Função de edição mantida no código original."); } // Simplificado para o teste
function atualizarSelects(books) {
  ["emp-livros", "ret-livros"].forEach(sel => {
    const el = $(sel); if (!el) return; el.innerHTML = "";
    books.filter(b => b.status === "Disponível").forEach(b => el.innerHTML += `<option value="${b.id}">${b.id} – ${b.title}</option>`);
  });
}

$("busca-acervo").addEventListener("input", (e) => {
  const termo = e.target.value.toLowerCase(); let achou = 0;
  qsa("#tabela-acervo tbody tr").forEach(tr => {
    const match = tr.textContent.toLowerCase().includes(termo);
    tr.style.display = match ? "" : "none"; if (match) achou++;
  });
  $("acervo-vazio").classList.toggle("hidden", achou > 0 || termo === "");
});

// --- EMPRÉSTIMOS E RETIRADAS (Lógica Básica para não quebrar) ---
$("btn-registrar-emprestimo").addEventListener("click", async () => {
  const livros = Array.from($("emp-livros").selectedOptions).map(o => o.value);
  const loan = { nome: $("emp-nome").value, turma: $("emp-turma").value, chamada: $("emp-chamada").value, turno: $("emp-turno").value, livros, quantidade: $("emp-qtd").value, devolucaoPrevista: $("emp-devolucao").value };
  const data = await apiPost("saveLoan", { loan });
  if(data.success) { showModal("Empréstimo registrado!"); carregarAcervo(); carregarEmprestimos(); }
});

async function carregarEmprestimos() {
  const data = await apiGet("loans");
  const tbody = $("tabela-emprestimos").querySelector("tbody"); tbody.innerHTML = "";
  if(data.loans) data.loans.forEach(l => tbody.innerHTML += `<tr><td>${l.nome}</td><td>${l.turma}</td><td>${l.livros.join(", ")}</td><td>${l.devolucaoPrevista}</td><td>${l.status}</td><td><button class="btn-mini" onclick="concluirEmprestimo('${l.id}')">✅ Concluir</button></td></tr>`);
}

async function concluirEmprestimo(id) {
  if(confirm("Concluir empréstimo?")) {
    await apiPost("concluirEmprestimo", { id });
    carregarAcervo(); carregarEmprestimos(); carregarEstatisticas();
  }
}

$("btn-registrar-retirada").addEventListener("click", async () => {
  const livros = Array.from($("ret-livros").selectedOptions).map(o => o.value);
  const withdrawal = { nome: $("ret-nome").value, finalidade: $("ret-finalidade").value, dataRetirada: $("ret-data-ret").value, dataPrevista: $("ret-data-prev").value, livros };
  const data = await apiPost("saveWithdrawal", { withdrawal });
  if(data.success) { showModal("Retirada registrada!"); carregarAcervo(); carregarRetiradas(); }
});

async function carregarRetiradas() {
  const data = await apiGet("withdrawals");
  const tbody = $("tabela-retiradas").querySelector("tbody"); tbody.innerHTML = "";
  if(data.withdrawals) data.withdrawals.forEach(w => tbody.innerHTML += `<tr><td>${w.nome}</td><td>${w.finalidade}</td><td>${w.livros.join(", ")}</td><td>${w.dataPrevista}</td><td>${w.status}</td><td><button class="btn-mini" onclick="concluirRetirada('${w.id}')">✅ Concluir</button></td></tr>`);
}

async function concluirRetirada(id) {
  if(confirm("Concluir retirada?")) {
    await apiPost("concluirRetirada", { id });
    carregarAcervo(); carregarRetiradas(); carregarEstatisticas();
  }
}

// --- ESTATÍSTICAS ---
async function carregarEstatisticas() {
  const data = await apiGet("stats");
  $("stat-total").textContent = data.total; $("stat-disponiveis").textContent = data.disponiveis; $("stat-fora").textContent = data.fora;
  if (chartGeneros) chartGeneros.destroy();
  chartGeneros = new Chart($("grafico-generos"), { type: "bar", data: { labels: Object.keys(data.porGenero), datasets: [{ label: "Gêneros", data: Object.values(data.porGenero), backgroundColor: "#0b3d91" }] }, options: { responsive: true, maintainAspectRatio: false } });
  if (chartStatus) chartStatus.destroy();
  chartStatus = new Chart($("grafico-status"), { type: "doughnut", data: { labels: ["Estante", "Fora"], datasets: [{ data: [data.disponiveis, data.fora], backgroundColor: ["#00b050", "#f2a71b"] }] }, options: { responsive: true, maintainAspectRatio: false } });
}

// --- ADMIN E CONFIGURAÇÕES BÁSICAS ---
$("btn-salvar-config").addEventListener("click", async () => {
  const data = await apiPost("updateConfig", { novoEmail: $("conf-email").value, novaSenha: $("conf-senha").value });
  if(data.success) { showModal("Configurações salvas. Faça login novamente."); setTimeout(()=>limparSessao(), 2000); }
});

qsa(".admin-tab-btn").forEach(btn => btn.addEventListener("click", () => {
  qsa(".admin-tab-btn").forEach(b => b.classList.remove("active"));
  qsa(".admin-tab-content").forEach(c => c.style.display = "none");
  btn.classList.add("active"); $(`admin-${btn.dataset.adminTab}`).style.display = "block";
  if(btn.dataset.adminTab === "logs") carregarLogs();
}));

$("btn-criar-usuario").addEventListener("click", async () => {
  const data = await apiPost("createUser", { user: { nome: $("u-nome").value, email: $("u-email").value, senha: $("u-senha").value, cargo: $("u-cargo").value, cargoLabel: $("u-cargo-label").value, ativo: $("u-ativo").value === "true" } });
  if(data.success) { showModal("Usuário salvo."); carregarUsuarios(); }
});

async function carregarUsuarios() {
  const data = await apiGet("users");
  const tbody = $("tabela-usuarios").querySelector("tbody"); tbody.innerHTML = "";
  if(data.users) data.users.forEach(u => tbody.innerHTML += `<tr><td>${u.nome}</td><td>${u.email}</td><td>${u.cargo}</td><td>${u.ativo === 'Sim' ? 'Ativo' : 'Inativo'}</td><td><button class="btn-mini danger" onclick="excluirUsuario('${u.email}')">Excluir</button></td></tr>`);
}
async function excluirUsuario(email) { if(confirm("Excluir?")) { await apiPost("deleteUser", { email }); carregarUsuarios(); } }

async function carregarLogs() {
  const data = await apiGet("logs", { days: $("logs-period").value });
  const tbody = $("tabela-logs").querySelector("tbody"); tbody.innerHTML = "";
  if(data.logs) data.logs.forEach(l => tbody.innerHTML += `<tr><td>${l.dataHora}</td><td>${l.usuarioNome}</td><td>${l.acao}</td><td>${l.detalhes}</td></tr>`);
}
$("btn-carregar-logs").addEventListener("click", carregarLogs);
