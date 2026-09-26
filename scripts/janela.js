import { MODULE_ID, FOSFORO, ARRANQUE_MS, uidTransmissao } from "./const.js";
import { letrasEmBloco } from "./logica.js";
import { tocar, acordar } from "./som.js";
import { curvar, largar, quandoMapaNovo } from "./curva.js";
import { aliviarCanvas } from "./canvas.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

// um mapa de vidro curvo novo (primeira vez, ou o ecrã mudou de tamanho): desenhar outra vez depois de carregado
quandoMapaNovo(() => Computador.redesenhar());

/**
 * O monitor.
 *
 * 0.2: já não é uma janela do Foundry por cima do mapa. Ocupa o ecrã inteiro — uma
 * sala escura com o monitor ao meio — e a interface do Foundry fica por baixo.
 * Continua a não decidir nada: desenha a `vista` que o mestre manda e devolve-lhe
 * as teclas. O mestre é o único que sabe as senhas e o que está nas pastas fechadas.
 */
export class Computador extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "computador-janela",
    tag: "div",
    classes: ["computador"],
    // sem moldura e sem posição: o CSS põe-no em ecrã inteiro (position: fixed)
    window: { frame: false, positioned: false }
  };

  static PARTS = { corpo: { template: `modules/${MODULE_ID}/templates/computador.hbs` } };

  static #instancia = null;
  static get atual() { return Computador.#instancia; }

  #dados = null;          // { id, nome, visual, controlador, para, vista }
  #arranqueAte = 0;
  #relogio = null;
  /** Para onde vão as ações (ligadas em main.js). */
  static aoEscrever = () => {};
  static aoMudarControlo = () => {};
  static aoMudarAudiencia = () => {};
  static aoDesligar = () => {};
  /** Fechei a minha vista (mestre: esconder sem desligar; jogador: fechar a dele). */
  static aoFecharVista = () => {};

  /**
   * A letra VT323 carrega-se antes do primeiro desenho. Carregada tarde, trocava por baixo do
   * vidro curvo já desenhado e o Chromium guardava o texto desfeito até à próxima tecla.
   * (`document.fonts.ready` não serve: resolve logo se o carregamento ainda nem começou.)
   */
  static #letra = null;
  static carregarLetra() {
    return (Computador.#letra ??= globalThis.document?.fonts?.load('32px "Computador VT323"').catch(() => {}) ?? Promise.resolve());
  }

  static async mostrar(dados, { arranque = false } = {}) {
    await Computador.carregarLetra();
    const j = (Computador.#instancia ??= new Computador());
    j.#dados = dados;
    if (arranque) {
      j.#arranqueAte = Date.now() + ARRANQUE_MS;
      tocar.arranque();
    }
    await j.render({ force: true });
    j.#ligarRelogio();
    return j;
  }

  /**
   * Aberta = já desenhada ou a meio de se desenhar. `rendered` só é verdade entre
   * renders: uma vista que chegue a meio de um (o hook do desbloqueio pede um)
   * era deitada fora, e o ecrã ficava preso na senha.
   */
  static get aberta() {
    const j = Computador.#instancia;
    return !!j && j.state > ApplicationV2.RENDER_STATES.NONE;
  }

  static atualizar(parcial) {
    const j = Computador.#instancia;
    if (!Computador.aberta) return;
    Object.assign(j.#dados, parcial);
    for (const e of parcial.efeitos ?? []) if (e.som) tocar[e.som]?.();
    j.render();
  }

  /** Desenhar outra vez com os mesmos dados (ex.: entrou alguém e a lista do rodapé mudou). */
  static redesenhar() {
    if (Computador.aberta) Computador.#instancia.render();
  }

  /** Fechar por ordem do mestre (desligou, ou este jogador deixou de ver). */
  static fechar({ som = true } = {}) {
    const j = Computador.#instancia;
    if (!Computador.aberta) return;
    if (som) tocar.desligar();
    j.close({ doMestre: true });
  }

  get souControlador() { return this.#dados?.controlador === game.user.id; }
  /** Quem está ao teclado escreve — e o mestre também, sempre (para mostrar, ajudar ou desencravar). */
  get possoEscrever() { return this.souControlador || game.user.isGM; }
  get #aArrancar() { return Date.now() < this.#arranqueAte; }

  /** Durante o arranque, a barra de progresso anda sozinha em cada ecrã. */
  #ligarRelogio() {
    clearInterval(this.#relogio);
    if (!this.#aArrancar) return;
    this.#relogio = setInterval(() => {
      if (!Computador.aberta) return clearInterval(this.#relogio);
      if (!this.rendered) return;             // a meio de um render: fica para o próximo tique
      if (!this.#aArrancar) { clearInterval(this.#relogio); return this.render(); }
      const pct = Math.min(100, Math.round(100 * (1 - (this.#arranqueAte - Date.now()) / ARRANQUE_MS)));
      const barra = this.element.querySelector("[data-barra]");
      if (barra) barra.textContent = this.#barra(pct);
      const checks = this.element.querySelectorAll("[data-check]");
      checks.forEach((c, i) => { c.textContent = pct > 25 + i * 25 ? game.i18n.localize("COMPUTADOR.Arranque.Ok") : game.i18n.localize("COMPUTADOR.Arranque.Espera"); });
    }, 90);
  }

  #barra(pct) {
    const n = 36, cheio = Math.round(n * pct / 100);
    return `[${"█".repeat(cheio)}${"░".repeat(n - cheio)}] ${String(pct).padStart(3, " ")}%`;
  }

  async _prepareContext() {
    const d = this.#dados ?? {};
    const v = d.vista ?? {};
    const f = FOSFORO[d.visual?.fosforo] ?? FOSFORO.verde;
    const quem = game.users.get(d.controlador);
    const titulo = (v.titulo || d.nome || "").toUpperCase();
    const trans = uidTransmissao();
    const jogadores = game.users.filter(u => !u.isGM);
    return {
      visual: { moldura: d.visual?.moldura ?? "gasta", cor: f.cor, fundo: f.fundo },
      arranque: this.#aArrancar ? {
        logo: letrasEmBloco(titulo.split(/\s+/)[0] || "SISTEMA").join("\n"),
        barra: this.#barra(0),
        checks: ["COMPUTADOR.Arranque.Memoria", "COMPUTADOR.Arranque.Arquivo", "COMPUTADOR.Arranque.Sessao"]
          .map(k => game.i18n.localize(k))
      } : null,
      titulo,
      v,
      lista: v.ecra === "lista",
      ficheiro: v.ecra === "ficheiro",
      senha: v.ecra === "senha",
      pasta: (v.pasta ?? game.i18n.localize("COMPUTADOR.ArquivoLocal")).toUpperCase(),
      entradas: (v.entradas ?? []).map((e, i) => ({ ...e, i, ativa: i === v.cursor })),
      ficheiroHtml: v.ficheiro?.html ?? "",
      controlador: quem?.name ?? null,
      souControlador: this.souControlador,
      isGM: game.user.isGM,
      // ao teclado: quem está ligado, menos o utilizador da transmissão (ninguém escreve por ele)
      teclado: jogadores.filter(u => u.active && u.id !== trans)
        .map(u => ({ id: u.id, nome: u.name, escolhido: u.id === d.controlador })),
      // quem vê: todos os jogadores, ligados ou não; a transmissão com o nome dela
      audiencia: jogadores.map(u => ({
        id: u.id, nome: u.id === trans ? game.i18n.localize("COMPUTADOR.Transmissao") : u.name,
        ligado: u.active, ve: !Array.isArray(d.para) || d.para.includes(u.id)
      })),
      todosVeem: !Array.isArray(d.para)
    };
  }

  _onRender(ctx, opts) {
    super._onRender?.(ctx, opts);
    document.body.classList.add("computador-ligado");
    aliviarCanvas(true);                     // o mapa por baixo não se vê: não precisa de 60 fps
    const ecra = this.element.querySelector(".cmp-ecra");
    // quem está ao teclado escreve direto: o ecrã apanha o foco sozinho
    const meu = this.souControlador || (game.user.isGM && !this.#dados?.controlador);
    if (meu && !this.#aArrancar) ecra?.focus({ preventScroll: true });

    ecra?.addEventListener("keydown", (ev) => this.#tecla(ev));
    ecra?.addEventListener("pointerdown", () => acordar());
    this.element.querySelectorAll("[data-indice]").forEach(el =>
      el.addEventListener("click", () => this.#enviar({ tipo: "clicar", indice: Number(el.dataset.indice) })));
    this.element.querySelector("[data-voltar]")?.addEventListener("click", () => this.#enviar({ tipo: "voltar" }));
    this.element.querySelector("[data-controlo]")?.addEventListener("change", (ev) => Computador.aoMudarControlo(ev.target.value || null));
    this.element.querySelector("[data-desligar]")?.addEventListener("click", () => Computador.aoDesligar());
    this.element.querySelector("[data-esconder]")?.addEventListener("click", () => this.close());
    this.element.querySelectorAll("[data-ve]").forEach(el => el.addEventListener("change", () => {
      const caixas = [...this.element.querySelectorAll("[data-ve]")];
      const marcados = caixas.filter(c => c.checked).map(c => c.dataset.ve);
      Computador.aoMudarAudiencia(marcados.length === caixas.length ? null : marcados);
    }));

    // o vidro curvo (definição de cada um: desliga-se num computador que sofra)
    curvar(this.element.querySelector(".cmp-curva"), game.settings.get(MODULE_ID, "curvatura"));

    // o ficheiro rola pelas linhas que o mestre manda (todos veem o mesmo ponto)
    const texto = this.element.querySelector(".cmp-texto");
    if (texto) texto.scrollTop = (this.#dados?.vista?.rolagem ?? 0) * this.#linha(texto);
  }

  #linha(texto) { return parseFloat(getComputedStyle(texto).lineHeight) || 22; }

  #tecla(ev) {
    if (!this.possoEscrever || this.#aArrancar) return;
    const k = ev.key;
    const conhecida = ["ArrowUp", "ArrowDown", "Enter", "Escape", "Backspace", "PageUp", "PageDown"].includes(k);
    const letra = k.length === 1 && !ev.ctrlKey && !ev.metaKey && !ev.altKey;
    if (!conhecida && !letra) return;
    ev.preventDefault();
    ev.stopPropagation();
    const entrada = { tipo: "tecla", tecla: k };
    // num ficheiro, quem está a ver sabe até onde o texto vai: manda o fim com a tecla
    const texto = this.element.querySelector(".cmp-texto");
    if (texto) entrada.max = Math.ceil((texto.scrollHeight - texto.clientHeight) / this.#linha(texto));
    this.#enviar(entrada);
  }

  #enviar(entrada) {
    if (!this.possoEscrever || this.#aArrancar) return;
    acordar();
    Computador.aoEscrever(entrada);
  }

  /**
   * Fechar a minha vista. Para o mestre isto já não desliga: esconde o monitor e o
   * computador continua ligado para quem está ao teclado (volta-se pela aba do topo).
   * Desligar é o botão «Desligar».
   */
  async close(opts = {}) {
    clearInterval(this.#relogio);
    largar();
    globalThis.document?.body.classList.remove("computador-ligado");
    aliviarCanvas(false);
    if (!opts.doMestre) Computador.aoFecharVista();
    return super.close(opts);
  }
}
