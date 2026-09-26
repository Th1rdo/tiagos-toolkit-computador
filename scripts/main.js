import { MODULE_ID, SOCKET, log, uidTransmissao } from "./const.js";
import { estadoInicial, reduzir, vista, podeVer } from "./logica.js";
import { contexto, configDe, desbloquear, eComputador, trancarTudo } from "./dados.js";
import { Computador } from "./janela.js";
import { configurar } from "./config.js";
import { reaplicar } from "./canvas.js";

/**
 * Computadores à mesa.
 *
 * Um diário vira um computador. O mestre carrega em «Mostrar à mesa», escolhe
 * quem está ao teclado e quem vê; o monitor ocupa o ecrã de quem vê e cada tecla
 * de quem joga vai ao mestre, que é o único a saber as senhas e o que está fechado.
 * Os outros recebem só o que se vê. (O Foundry envia os diários a todos os browsers,
 * por isso quem abrir a consola consegue ler o diário — como qualquer diário do Foundry.)
 *
 * 0.2: fechar a vista já não desliga. O mestre esconde o monitor e o jogador continua
 * a usar o computador; volta-se pela aba «Computador ligado» no topo do ecrã.
 */

let ativo = null;          // só no mestre: { id, estado, controlador, vistos, escondido }
let noAr = null;           // nos jogadores: o último pacote que me diz respeito (para a aba)
let fecheiAMinha = false;  // nos jogadores: fechei a minha vista de propósito

const souMestreAtivo = () => game.users.activeGM?.isSelf;

// O que está no ar sobrevive a um recarregar do mestre (no browser dele, não na base de dados:
// escreve-se a cada tecla). Sem isto, os jogadores ficavam com um ecrã que já não respondia.
const CHAVE = () => `${MODULE_ID}.ativo.${game.world.id}`;
function guardar() {
  try { ativo ? localStorage.setItem(CHAVE(), JSON.stringify(ativo)) : localStorage.removeItem(CHAVE()); } catch { /* sem armazenamento */ }
}
function recuperar() {
  try { return JSON.parse(localStorage.getItem(CHAVE()) ?? "null"); } catch { return null; }
}
const emitir = (msg) => game.socket.emit(SOCKET, msg);

function visual(diario) {
  const c = configDe(diario);
  return { fosforo: c.fosforo, moldura: c.moldura, titulo: c.titulo };
}

function pacoteAbrir(diario, arranque) {
  return {
    tipo: "abrir", arranque, id: diario.id, nome: diario.name, visual: visual(diario),
    controlador: ativo.controlador, para: ativo.vistos ?? null, vista: vista(ativo.estado, contexto(diario))
  };
}

// ---------------------------------------------------------------- a aba «computador ligado»

let aba = null, abaAdiada = null;
/** Mostra a aba quando há um computador no ar para mim e a minha vista está fechada. */
function atualizarAba() {
  clearTimeout(abaAdiada);
  // adiado: o close() da janela só muda o estado depois de o chamarmos
  abaAdiada = setTimeout(() => {
    const quer = game.user.isGM ? !!ativo : !!noAr;
    if (!quer || Computador.aberta) { aba?.remove(); aba = null; return; }
    if (!aba) {
      aba = document.createElement("div");
      aba.id = "computador-no-ar";
      aba.addEventListener("click", (ev) => {
        const acao = ev.target.closest("[data-acao]")?.dataset.acao;
        if (acao === "ver") ver();
        else if (acao === "desligar") desligar();
      });
      document.body.append(aba);
    }
    const t = (k) => game.i18n.localize(k);
    aba.innerHTML = `<span class="cmp-ponto"></span><span>${t("COMPUTADOR.NoAr")}</span>
      <button type="button" data-acao="ver">${t("COMPUTADOR.Ver")}</button>
      ${game.user.isGM ? `<button type="button" data-acao="desligar">${t("COMPUTADOR.Desligar")}</button>` : ""}`;
  }, 60);
}

// ---------------------------------------------------------------- mestre

/** Pôr um computador à frente da mesa. Só o mestre. `vistos`: nulo = toda a mesa. */
export async function abrir(diarioOuId, { controlador = null, vistos = null } = {}) {
  if (!game.user.isGM) return;
  const diario = typeof diarioOuId === "string" ? game.journal.get(diarioOuId) : diarioOuId;
  if (!diario) return;
  ativo = { id: diario.id, estado: estadoInicial(contexto(diario)), controlador, vistos, escondido: false };
  guardar();
  const msg = pacoteAbrir(diario, true);
  emitir(msg);                                   // o emit não ecoa: o mestre abre à parte
  await Computador.mostrar(msg, { arranque: true });
  atualizarAba();
}

function difundir(efeitos = []) {
  const diario = game.journal.get(ativo?.id);
  if (!diario) return;
  const msg = { tipo: "vista", vista: vista(ativo.estado, contexto(diario)), controlador: ativo.controlador, para: ativo.vistos ?? null, efeitos };
  emitir(msg);
  Computador.atualizar(msg);                     // no mestre com a vista escondida não faz nada
}

/** Uma tecla de quem está ao teclado — corre só no mestre ativo, com ou sem a vista dele aberta. */
async function processar(entrada, de) {
  if (!ativo || !souMestreAtivo()) return;
  const quemPode = de === ativo.controlador || game.users.get(de)?.isGM;
  if (!quemPode) return;
  const diario = game.journal.get(ativo.id);
  if (!diario) return;
  const { estado, efeitos } = reduzir(ativo.estado, entrada, contexto(diario));
  for (const e of efeitos) if (typeof e.desbloquear === "string") await desbloquear(diario, e.desbloquear);
  ativo.estado = estado;
  guardar();
  difundir(efeitos.filter(e => e.som));
}

function mudarControlo(id) {
  if (!ativo) return;
  ativo.controlador = id || null;
  guardar();
  difundir();
}

/** Quem vê mudou: toda a gente recebe o pacote inteiro e decide se abre ou fecha. */
function mudarAudiencia(lista) {
  if (!ativo) return;
  ativo.vistos = Array.isArray(lista) ? lista : null;
  guardar();
  const diario = game.journal.get(ativo.id);
  if (!diario) return;
  emitir(pacoteAbrir(diario, false));
  Computador.atualizar({ para: ativo.vistos });
}

function desligar() {
  if (!ativo) return;
  ativo = null;
  guardar();
  emitir({ tipo: "fechar" });
  Computador.fechar();
  atualizarAba();
}

/** Voltar a ver (pela aba). O mestre volta ao que está no ar; o jogador ao último pacote. */
async function ver() {
  if (game.user.isGM) {
    const diario = ativo && game.journal.get(ativo.id);
    if (!diario) return;
    ativo.escondido = false;
    guardar();
    await Computador.mostrar(pacoteAbrir(diario, false));
  } else {
    fecheiAMinha = false;
    if (noAr) await Computador.mostrar(noAr);
  }
  atualizarAba();
}

// ---------------------------------------------------------------- jogadores

function deixarDeVer() {
  noAr = null;
  fecheiAMinha = false;
  Computador.fechar({ som: Computador.aberta });
  atualizarAba();
}

function receberAbrir(msg) {
  if (!podeVer(msg, game.user.id)) return deixarDeVer();
  noAr = msg;
  if (msg.arranque) fecheiAMinha = false;        // um arranque novo é sempre para ver
  if (!fecheiAMinha) Computador.mostrar(msg, { arranque: !!msg.arranque }).then(atualizarAba);
  else atualizarAba();
}

function receberVista(msg) {
  if (!podeVer(msg, game.user.id)) return deixarDeVer();
  if (!noAr) return emitir({ tipo: "pedir" });   // passei a ver (ex.: fiquei ao teclado): quero tudo
  const { efeitos, ...resto } = msg;
  Object.assign(noAr, resto);
  Computador.atualizar(msg);
  atualizarAba();
}

// ---------------------------------------------------------------- ligações

Computador.aoEscrever = (entrada) => {
  if (game.user.isGM) return processar(entrada, game.user.id);
  emitir({ tipo: "entrada", entrada, de: game.user.id });
};
Computador.aoMudarControlo = mudarControlo;
Computador.aoMudarAudiencia = mudarAudiencia;
Computador.aoDesligar = desligar;
Computador.aoFecharVista = () => {
  if (game.user.isGM) { if (ativo) { ativo.escondido = true; guardar(); } }
  else fecheiAMinha = true;
  atualizarAba();
};

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "curvatura", {
    name: "COMPUTADOR.Definicoes.Curvatura", hint: "COMPUTADOR.Definicoes.CurvaturaDica",
    scope: "client", config: true, type: Boolean, default: true,
    onChange: () => Computador.redesenhar()
  });
});

Hooks.once("ready", () => {
  game.socket.on(SOCKET, (msg) => {
    switch (msg?.tipo) {
      case "abrir": return game.user.isGM ? null : receberAbrir(msg);
      case "vista": return game.user.isGM ? null : receberVista(msg);
      case "fechar": return game.user.isGM ? null : deixarDeVer();
      case "entrada": return processar(msg.entrada, msg.de);
      // quem chega a meio (ou recarrega, ou passou a ver) pede o que está no ar
      case "pedir": {
        if (!souMestreAtivo() || !ativo) return;
        const diario = game.journal.get(ativo.id);
        if (diario) emitir(pacoteAbrir(diario, false));
      }
    }
  });
  if (!game.user.isGM) emitir({ tipo: "pedir" });

  // o mestre recarregou com um computador no ar: volta a pô-lo à frente de quem vê
  const antes = game.user.isGM && souMestreAtivo() ? recuperar() : null;
  const diarioAntes = antes && game.journal.get(antes.id);
  if (diarioAntes && eComputador(diarioAntes)) {
    ativo = antes;
    const msg = pacoteAbrir(diarioAntes, false);
    emitir(msg);
    if (!ativo.escondido) Computador.mostrar(msg).then(atualizarAba);
    else atualizarAba();
  } else if (antes) { ativo = null; guardar(); }

  game.computador = {
    abrir, desligar, configurar, ver,
    trancarTudo: (d) => trancarTudo(typeof d === "string" ? game.journal.get(d) : d)
  };
  log("pronto");
});

// O mestre muda um ficheiro com o computador ligado: a mesa vê a mudança.
for (const h of ["createJournalEntryPage", "updateJournalEntryPage", "deleteJournalEntryPage"]) {
  Hooks.on(h, (pagina) => { if (ativo && pagina.parent?.id === ativo.id && souMestreAtivo()) difundir(); });
}
Hooks.on("updateJournalEntry", (diario) => { if (ativo && diario.id === ativo.id && souMestreAtivo()) difundir(); });

// Quem entra ou sai muda as listas do rodapé do mestre.
Hooks.on("userConnected", () => Computador.redesenhar());
Hooks.on("canvasReady", reaplicar);

// ---------------------------------------------------------------- onde o mestre carrega

/** Escolher quem fica ao teclado e quem vê. Se este computador já está no ar, só volta a mostrá-lo. */
async function escolherEAbrir(diario) {
  if (ativo?.id === diario.id) return ver();
  const esc = foundry.utils.escapeHTML;
  const t = (k) => game.i18n.localize(k);
  const trans = uidTransmissao();
  const jogadores = game.users.filter(u => !u.isGM);
  const teclado = [`<option value="">${t("COMPUTADOR.Ninguem")}</option>`]
    .concat(jogadores.filter(u => u.active && u.id !== trans).map(u => `<option value="${u.id}">${esc(u.name)}</option>`)).join("");
  const quem = jogadores.map(u => `<label><input type="checkbox" name="ve.${u.id}" checked> ${
    u.id === trans ? t("COMPUTADOR.Transmissao") : esc(u.name)}${u.active ? "" : ` <span class="hint">(${t("COMPUTADOR.ForaDeLinha")})</span>`}</label>`).join("");
  const escolha = await foundry.applications.api.DialogV2.prompt({
    window: { title: t("COMPUTADOR.Mostrar"), icon: "fa-solid fa-desktop" },
    content: `<div class="cmp-mostrar">
      <div class="form-group"><label>${t("COMPUTADOR.AoTeclado")}</label><select name="controlador">${teclado}</select></div>
      <p><strong>${t("COMPUTADOR.QuemVe")}</strong></p>
      <div class="cmp-mostrar-lista">${quem || `<span class="hint">${t("COMPUTADOR.SemJogadores")}</span>`}</div>
    </div>`,
    ok: {
      label: "COMPUTADOR.Mostrar",
      callback: (_ev, botao) => {
        const f = botao.form.elements;
        const marcados = jogadores.filter(u => f[`ve.${u.id}`]?.checked).map(u => u.id);
        return { controlador: f.controlador.value || null, vistos: marcados.length === jogadores.length ? null : marcados };
      }
    }
  }).catch(() => undefined);
  if (escolha) await abrir(diario, escolha);
}

Hooks.on("getHeaderControlsJournalEntrySheet", (app, controlos) => {
  if (!game.user.isGM || !app.document) return;
  controlos.push(
    { icon: "fa-solid fa-sliders", label: "COMPUTADOR.Configurar", action: "tttComputadorConfigurar", onClick: () => configurar(app.document) },
    { icon: "fa-solid fa-desktop", label: "COMPUTADOR.Mostrar", action: "tttComputadorMostrar",
      visible: () => eComputador(app.document), onClick: () => escolherEAbrir(app.document) }
  );
});

Hooks.on("getJournalEntryContextOptions", (_app, opcoes) => {
  const doc = (li) => game.journal.get(li.closest("[data-entry-id]")?.dataset.entryId);
  opcoes.push(
    { label: "COMPUTADOR.Mostrar", icon: "fa-solid fa-desktop", visible: (li) => game.user.isGM && eComputador(doc(li)), onClick: (_ev, li) => escolherEAbrir(doc(li)) },
    { label: "COMPUTADOR.Configurar", icon: "fa-solid fa-sliders", visible: () => game.user.isGM, onClick: (_ev, li) => configurar(doc(li)) }
  );
});
