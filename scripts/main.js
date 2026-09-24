import { MODULE_ID, SOCKET, log } from "./const.js";
import { estadoInicial, reduzir, vista } from "./logica.js";
import { contexto, configDe, desbloquear, eComputador, trancarTudo } from "./dados.js";
import { Computador } from "./janela.js";
import { configurar } from "./config.js";

/**
 * Computadores à mesa.
 *
 * Um diário vira um computador. O mestre carrega em «Mostrar à mesa» e escolhe
 * quem está ao teclado; o monitor abre para toda a gente e cada tecla de quem
 * joga vai ao mestre, que é o único a saber as senhas e o que está fechado.
 * Os outros recebem só o que se vê. (O Foundry envia os diários a todos os browsers,
 * por isso quem abrir a consola consegue ler o diário — como qualquer diário do Foundry.)
 */

let ativo = null;          // só no mestre: { id, estado, controlador }

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
    controlador: ativo.controlador, vista: vista(ativo.estado, contexto(diario))
  };
}

/** Pôr um computador à frente da mesa. Só o mestre. */
export async function abrir(diarioOuId, { controlador = null } = {}) {
  if (!game.user.isGM) return;
  const diario = typeof diarioOuId === "string" ? game.journal.get(diarioOuId) : diarioOuId;
  if (!diario) return;
  ativo = { id: diario.id, estado: estadoInicial(contexto(diario)), controlador };
  guardar();
  const msg = pacoteAbrir(diario, true);
  emitir(msg);                                   // o emit não ecoa: o mestre abre à parte
  await Computador.mostrar(msg, { arranque: true });
}

function difundir(efeitos = []) {
  const diario = game.journal.get(ativo?.id);
  if (!diario) return;
  const msg = { tipo: "vista", vista: vista(ativo.estado, contexto(diario)), controlador: ativo.controlador, efeitos };
  emitir(msg);
  Computador.atualizar(msg);
}

/** Uma tecla de quem está ao teclado — corre só no mestre ativo. */
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

function desligar() {
  if (!ativo) return;
  ativo = null;
  guardar();
  emitir({ tipo: "fechar" });
  Computador.fechar();
}

// ---------------------------------------------------------------- ligações

Computador.aoEscrever = (entrada) => {
  if (game.user.isGM) return processar(entrada, game.user.id);
  emitir({ tipo: "entrada", entrada, de: game.user.id });
};
Computador.aoMudarControlo = mudarControlo;
Computador.aoDesligar = desligar;

Hooks.once("ready", () => {
  game.socket.on(SOCKET, (msg, de) => {
    switch (msg?.tipo) {
      case "abrir": return Computador.mostrar(msg, { arranque: !!msg.arranque });
      case "vista": return Computador.atualizar(msg);
      case "fechar": return Computador.fechar();
      case "entrada": return processar(msg.entrada, msg.de);
      // quem chega a meio (ou recarrega) pede o que está no ar
      case "pedir": {
        if (!souMestreAtivo() || !ativo) return;
        const diario = game.journal.get(ativo.id);
        if (diario) emitir(pacoteAbrir(diario, false));
      }
    }
  });
  if (!game.user.isGM) emitir({ tipo: "pedir" });

  // o mestre recarregou com um computador no ar: volta a pô-lo à frente de toda a gente
  const antes = game.user.isGM && souMestreAtivo() ? recuperar() : null;
  const diarioAntes = antes && game.journal.get(antes.id);
  if (diarioAntes && eComputador(diarioAntes)) {
    ativo = antes;
    const msg = pacoteAbrir(diarioAntes, false);
    emitir(msg);
    Computador.mostrar(msg);
  } else if (antes) { ativo = null; guardar(); }

  game.computador = { abrir, desligar, configurar, trancarTudo: (d) => trancarTudo(typeof d === "string" ? game.journal.get(d) : d) };
  log("pronto");
});

// O mestre muda um ficheiro com o computador ligado: a mesa vê a mudança.
for (const h of ["createJournalEntryPage", "updateJournalEntryPage", "deleteJournalEntryPage"]) {
  Hooks.on(h, (pagina) => { if (ativo && pagina.parent?.id === ativo.id && souMestreAtivo()) difundir(); });
}
Hooks.on("updateJournalEntry", (diario) => { if (ativo && diario.id === ativo.id && souMestreAtivo()) difundir(); });

// Quem entra ou sai muda a lista «ao teclado» do rodapé do mestre.
Hooks.on("userConnected", () => Computador.redesenhar());

// ---------------------------------------------------------------- onde o mestre carrega

/** Escolher quem fica ao teclado — com os jogadores que estão ligados. */
async function escolherEAbrir(diario) {
  const ligados = game.users.filter(u => u.active && !u.isGM);
  const opcoes = [`<option value="">${game.i18n.localize("COMPUTADOR.Ninguem")}</option>`]
    .concat(ligados.map(u => `<option value="${u.id}">${foundry.utils.escapeHTML(u.name)}</option>`)).join("");
  const escolha = await foundry.applications.api.DialogV2.prompt({
    window: { title: game.i18n.localize("COMPUTADOR.Mostrar"), icon: "fa-solid fa-desktop" },
    content: `<div class="form-group"><label>${game.i18n.localize("COMPUTADOR.AoTeclado")}</label><select name="controlador">${opcoes}</select></div>`,
    ok: { label: "COMPUTADOR.Mostrar", callback: (_ev, botao) => botao.form.elements.controlador.value }
  }).catch(() => undefined);
  if (escolha !== undefined) await abrir(diario, { controlador: escolha || null });
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
