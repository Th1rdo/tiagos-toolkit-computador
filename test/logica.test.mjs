import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizarSenha, senhaCerta, listar, pastaProtegida, estadoInicial, reduzir, vista, letrasEmBloco
} from "../scripts/logica.js";

// um computador de exemplo, como o do vídeo: um memorando na raiz, pastas, uma privada
const paginas = [
  { id: "m", nome: "Memorando", pasta: "", ordem: 0, html: "<p>O pássaro do crachá.</p>" },
  { id: "c1", nome: "Caso 114", pasta: "CASOS", ordem: 1, html: "<p>caso</p>" },
  { id: "e1", nome: "Foto 1", pasta: "PROVAS", ordem: 2, html: "" },
  { id: "v1", nome: "Diário", pasta: "VOSS - PRIVADO", ordem: 4, html: "<p>segredo</p>" },
  { id: "v2", nome: "Cartas", pasta: "VOSS - PRIVADO/2011", ordem: 5, html: "<p>mais fundo</p>" }
];
const cfg = { titulo: "DELEGACIA 12", senha: "", pastas: { "VOSS - PRIVADO": { senha: "Rouxinol", dica: "O pássaro do crachá." } } };
const ctx = (extra = {}) => ({ paginas, cfg, desbloqueadas: [], ...extra });

// ── senhas ──────────────────────────────────────────────────────────
test("a senha ignora maiúsculas, espaços à volta e acentos", () => {
  assert.equal(normalizarSenha("  Rouxinól "), "rouxinol");
  assert.ok(senhaCerta("rouxinol", "Rouxinol"));
  assert.ok(senhaCerta(" ROUXINOL", "Rouxinol"));
  assert.ok(!senhaCerta("rouxino", "Rouxinol"));
  assert.ok(!senhaCerta("", "Rouxinol"));
});

// ── o que se vê numa pasta ──────────────────────────────────────────
test("na raiz: o ficheiro e as pastas, pela ordem das páginas", () => {
  const e = listar(paginas, [], cfg, []);
  assert.deepEqual(e.map(x => `${x.tipo}:${x.nome}`),
    ["ficheiro:Memorando", "pasta:CASOS", "pasta:PROVAS", "pasta:VOSS - PRIVADO"]);
});

test("a pasta protegida vem marcada; subpastas aparecem dentro da mãe", () => {
  const raiz = listar(paginas, [], cfg, []);
  assert.equal(raiz.find(x => x.nome === "VOSS - PRIVADO").protegida, true);
  const dentro = listar(paginas, ["VOSS - PRIVADO"], cfg, ["VOSS - PRIVADO"]);
  assert.deepEqual(dentro.map(x => x.nome), ["Diário", "2011"]);
});

test("uma pasta desbloqueada deixa de estar protegida, e as filhas também", () => {
  assert.equal(pastaProtegida("VOSS - PRIVADO", cfg, []), true);
  assert.equal(pastaProtegida("VOSS - PRIVADO/2011", cfg, []), true);    // por herança
  assert.equal(pastaProtegida("VOSS - PRIVADO/2011", cfg, ["VOSS - PRIVADO"]), false);
  assert.equal(pastaProtegida("CASOS", cfg, []), false);
});

// ── andar pelo computador ───────────────────────────────────────────
const tecla = (t) => ({ tipo: "tecla", tecla: t });
const correr = (entradas, c = ctx(), e = estadoInicial(c)) => {
  let efeitos = [];
  for (const en of entradas) { const r = reduzir(e, en, c); e = r.estado; efeitos = efeitos.concat(r.efeitos); }
  return { e, efeitos };
};

test("sem senha, o computador abre na lista da raiz", () => {
  assert.equal(estadoInicial(ctx()).ecra, "lista");
});

test("com senha no computador, abre no ecrã da senha", () => {
  const e = estadoInicial(ctx({ cfg: { ...cfg, senha: "abc" } }));
  assert.equal(e.ecra, "senha");
  assert.equal(e.alvo, "");
});

test("setas mexem o cursor sem sair da lista", () => {
  const { e } = correr([tecla("ArrowDown"), tecla("ArrowDown"), tecla("ArrowDown"), tecla("ArrowDown"), tecla("ArrowDown")]);
  assert.equal(e.cursor, 3);
  assert.equal(correr([tecla("ArrowUp")]).e.cursor, 0);
});

test("Enter num ficheiro abre-o; Escape volta à lista no mesmo sítio", () => {
  const { e, efeitos } = correr([tecla("Enter")]);
  assert.equal(e.ecra, "ficheiro");
  assert.equal(e.ficheiro, "m");
  assert.ok(efeitos.some(x => x.som === "abrir"));
  const volta = correr([tecla("Escape")], ctx(), e).e;
  assert.equal(volta.ecra, "lista");
  assert.equal(volta.cursor, 0);
});

test("Enter numa pasta livre entra; Escape sobe", () => {
  const { e } = correr([tecla("ArrowDown"), tecla("Enter")]);
  assert.deepEqual(e.caminho, ["CASOS"]);
  assert.equal(correr([tecla("Escape")], ctx(), e).e.caminho.length, 0);
});

test("Enter numa pasta protegida pede a senha dela", () => {
  const { e } = correr([tecla("ArrowDown"), tecla("ArrowDown"), tecla("ArrowDown"), tecla("Enter")]);
  assert.equal(e.ecra, "senha");
  assert.equal(e.alvo, "VOSS - PRIVADO");
});

test("senha errada: fica, avisa e limpa o que se escreveu", () => {
  let { e } = correr([tecla("ArrowDown"), tecla("ArrowDown"), tecla("ArrowDown"), tecla("Enter")]);
  const r = correr([..."pombo"].map(tecla).concat(tecla("Enter")), ctx(), e);
  assert.equal(r.e.ecra, "senha");
  assert.equal(r.e.erro, true);
  assert.equal(r.e.digitado, "");
  assert.ok(r.efeitos.some(x => x.som === "erro"));
});

test("senha certa: desbloqueia e entra na pasta", () => {
  let { e } = correr([tecla("ArrowDown"), tecla("ArrowDown"), tecla("ArrowDown"), tecla("Enter")]);
  const r = correr([..."ROUXINOL"].map(tecla).concat(tecla("Enter")), ctx(), e);
  assert.equal(r.e.ecra, "lista");
  assert.deepEqual(r.e.caminho, ["VOSS - PRIVADO"]);
  assert.ok(r.efeitos.some(x => x.desbloquear === "VOSS - PRIVADO"));
  assert.ok(r.efeitos.some(x => x.som === "acesso"));
});

test("Backspace apaga, Escape desiste da senha", () => {
  let { e } = correr([tecla("ArrowDown"), tecla("ArrowDown"), tecla("ArrowDown"), tecla("Enter"), tecla("a"), tecla("b"), tecla("Backspace")]);
  assert.equal(e.digitado, "a");
  assert.equal(correr([tecla("Escape")], ctx(), e).e.ecra, "lista");
});

test("clicar numa entrada é o mesmo que ir lá e carregar Enter", () => {
  const { e } = correr([{ tipo: "clicar", indice: 1 }]);
  assert.deepEqual(e.caminho, ["CASOS"]);
});

test("no ficheiro, as setas rolam e não passam do topo", () => {
  let { e } = correr([tecla("Enter"), tecla("ArrowDown"), tecla("ArrowDown"), tecla("PageDown")]);
  assert.ok(e.rolagem >= 2 + 10);
  e = correr([tecla("PageUp"), tecla("PageUp"), tecla("PageUp")], ctx(), e).e;
  assert.equal(e.rolagem, 0);
});

// ── o que os jogadores recebem ──────────────────────────────────────
test("a vista nunca leva a senha nem o que se escreveu — só a máscara", () => {
  let { e } = correr([tecla("ArrowDown"), tecla("ArrowDown"), tecla("ArrowDown"), tecla("Enter"), tecla("s"), tecla("e")]);
  const v = vista(e, ctx());
  const texto = JSON.stringify(v);
  assert.ok(!texto.toLowerCase().includes("rouxinol"));
  assert.equal(v.senha.mascara, "**");
  assert.equal(v.senha.dica, "O pássaro do crachá.");
});

test("a vista de uma pasta fechada não leva o conteúdo dos ficheiros", () => {
  const v = vista(estadoInicial(ctx()), ctx());
  assert.ok(!JSON.stringify(v).includes("segredo"));
  assert.ok(v.entradas.every(x => !("html" in x)));
});

test("a vista de um ficheiro aberto leva o conteúdo dele (e só dele)", () => {
  const { e } = correr([tecla("Enter")]);
  const v = vista(e, ctx());
  assert.equal(v.ficheiro.titulo, "Memorando");
  assert.ok(v.ficheiro.html.includes("pássaro"));
  assert.ok(!JSON.stringify(v).includes("segredo"));
});

test("entradas numeradas com dois dígitos, pastas com barra", () => {
  const v = vista(estadoInicial(ctx()), ctx());
  assert.deepEqual(v.entradas.map(x => x.rotulo), ["00 - Memorando", "01 CASOS /", "02 PROVAS /", "03 VOSS - PRIVADO /"]);
});

// ── o logótipo do arranque ──────────────────────────────────────────
test("o logótipo em blocos tem 5 linhas e a mesma largura em todas", () => {
  const l = letrasEmBloco("ORDEM");
  assert.equal(l.length, 5);
  assert.equal(new Set(l.map(x => x.length)).size, 1);
  assert.ok(l.join("").includes("█"));
});

// ── 0.2.0 ───────────────────────────────────────────────────────────
import { podeVer, mapaBarril } from "../scripts/logica.js";

test("a rolagem de um ficheiro para no fim (quem está ao teclado diz até onde dá)", () => {
  let e = reduzir(estadoInicial(ctx()), { tipo: "clicar", indice: 0 }, ctx()).estado;
  for (let i = 0; i < 5; i++) e = reduzir(e, { tipo: "tecla", tecla: "PageDown", max: 12 }, ctx()).estado;
  assert.equal(e.rolagem, 12);
  e = reduzir(e, { tipo: "tecla", tecla: "PageUp", max: 12 }, ctx()).estado;
  assert.equal(e.rolagem, 2, "um PgUp depois do fim sobe logo — não há teclas perdidas");
  e = reduzir(e, { tipo: "tecla", tecla: "ArrowDown" }, ctx()).estado;
  assert.equal(e.rolagem, 3, "sem medida (ex.: o mestre sem a janela aberta) rola como antes");
});

test("quem vê: todos por omissão; com lista, só ela — e quem está ao teclado vê sempre", () => {
  assert.ok(podeVer({ para: null }, "a"));
  assert.ok(podeVer({}, "a"));
  assert.ok(podeVer({ para: ["a", "b"] }, "b"));
  assert.ok(!podeVer({ para: ["a"] }, "c"));
  assert.ok(podeVer({ para: ["a"], controlador: "c" }, "c"));
  assert.ok(!podeVer({ para: [] }, "a"));
});

test("mapa de barril: o centro não mexe, os cantos vão buscar mais longe (o vidro abaulado)", () => {
  const w = 64, h = 48, { dados, escala } = mapaBarril(w, h, 0.1);
  const px = (x, y) => [dados[(y * w + x) * 4], dados[(y * w + x) * 4 + 1]];
  const [cr, cg] = px(32, 24);
  assert.ok(Math.abs(cr - 128) <= 2 && Math.abs(cg - 128) <= 2);
  const [r, g] = px(0, 0);
  assert.ok(r < 110 && g < 110, "canto de cima à esquerda: amostra mais à esquerda e mais acima");
  const [r2, g2] = px(w - 1, h - 1);
  assert.ok(r2 > 146 && g2 > 146);
  assert.ok(escala > 0);
  // a meio de uma aresta a deslocação é só perpendicular a ela
  const [mr] = px(32, 0);
  assert.ok(Math.abs(mr - 128) <= 3);
});
