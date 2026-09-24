import { MODULE_ID, FOSFORO, ARRANQUE_MS } from "./const.js";
import { letrasEmBloco } from "./logica.js";
import { tocar, acordar } from "./som.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * O monitor.
 *
 * Toda a mesa abre a mesma janela e vê o mesmo ecrã; só quem está ao teclado
 * escreve. Esta janela não decide nada: desenha a `vista` que o mestre manda e
 * devolve-lhe as teclas. O mestre é o único que sabe as senhas e o que está nas
 * pastas fechadas.
 */
export class Computador extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "computador-janela",
    tag: "div",
    classes: ["computador"],
    window: { title: "COMPUTADOR.Titulo", icon: "fa-solid fa-desktop", resizable: true },
    position: { width: 960, height: 800 }
  };

  static PARTS = { corpo: { template: `modules/${MODULE_ID}/templates/computador.hbs` } };

  static #instancia = null;
  static get atual() { return Computador.#instancia; }

  #dados = null;          // { id, nome, visual, controlador, vista }
  #arranqueAte = 0;
  #relogio = null;
  /** Para onde vão as teclas de quem está ao teclado (ligado em main.js). */
  static aoEscrever = () => {};
  static aoMudarControlo = () => {};
  static aoDesligar = () => {};

  static async mostrar(dados, { arranque = false } = {}) {
    const j = (Computador.#instancia ??= new Computador());
    j.#dados = dados;
    if (arranque) {
      j.#arranqueAte = Date.now() + ARRANQUE_MS;
      tocar.arranque();
    }
    await j.render({ force: true, window: { title: dados.nome } });
    j.#ligarRelogio();
    return j;
  }

  /**
   * Aberta = já desenhada ou a meio de se desenhar. `rendered` só é verdade entre
   * renders: uma vista que chegue a meio de um (o hook do desbloqueio pede um)
   * era deitada fora, e o ecrã ficava preso na senha.
   */
  static get #aberta() {
    const j = Computador.#instancia;
    return !!j && j.state > ApplicationV2.RENDER_STATES.NONE;
  }

  static atualizar(parcial) {
    const j = Computador.#instancia;
    if (!Computador.#aberta) return;
    Object.assign(j.#dados, parcial);
    for (const e of parcial.efeitos ?? []) if (e.som) tocar[e.som]?.();
    j.render();
  }

  /** Desenhar outra vez com os mesmos dados (ex.: entrou alguém e a lista do rodapé mudou). */
  static redesenhar() {
    if (Computador.#aberta) Computador.#instancia.render();
  }

  static fechar() {
    const j = Computador.#instancia;
    if (Computador.#aberta) { tocar.desligar(); j.close({ doMestre: true }); }
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
      if (!Computador.#aberta) return clearInterval(this.#relogio);
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
    return {
      visual: { moldura: d.visual?.moldura ?? "clara", cor: f.cor, fundo: f.fundo },
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
      jogadores: game.users.filter(u => u.active).map(u => ({ id: u.id, nome: u.name, escolhido: u.id === d.controlador }))
    };
  }

  _onRender(ctx, opts) {
    super._onRender?.(ctx, opts);
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

    // o ficheiro rola pelas linhas que o mestre manda (todos veem o mesmo ponto)
    const texto = this.element.querySelector(".cmp-texto");
    if (texto) {
      const linha = parseFloat(getComputedStyle(texto).lineHeight) || 22;
      texto.scrollTop = (this.#dados?.vista?.rolagem ?? 0) * linha;
    }
  }

  #tecla(ev) {
    if (!this.possoEscrever || this.#aArrancar) return;
    const k = ev.key;
    const conhecida = ["ArrowUp", "ArrowDown", "Enter", "Escape", "Backspace", "PageUp", "PageDown"].includes(k);
    const letra = k.length === 1 && !ev.ctrlKey && !ev.metaKey && !ev.altKey;
    if (!conhecida && !letra) return;
    ev.preventDefault();
    ev.stopPropagation();
    this.#enviar({ tipo: "tecla", tecla: k });
  }

  #enviar(entrada) {
    if (!this.possoEscrever || this.#aArrancar) return;
    acordar();
    Computador.aoEscrever(entrada);
  }

  /** O X do mestre desliga o computador para todos; o de um jogador só fecha a janela dele. */
  async close(opts = {}) {
    clearInterval(this.#relogio);
    if (game.user.isGM && !opts.doMestre) Computador.aoDesligar();
    return super.close(opts);
  }
}
