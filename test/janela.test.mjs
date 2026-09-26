import test from "node:test";
import assert from "node:assert/strict";

/**
 * A janela com um ApplicationV2 falso que imita o ciclo de vida do verdadeiro:
 * durante um render o estado é RENDERING (não RENDERED) e os renders vão numa fila.
 * Foi assim que, no Foundry v14 real, o ecrã ficou preso na senha depois de uma
 * senha certa: o hook do desbloqueio pediu um render e a atualização seguinte,
 * que chegou a meio dele, foi deitada fora.
 */
const ESTADOS = { CLOSED: -1, NONE: 0, RENDERING: 1, RENDERED: 2 };
class ApplicationV2Falso {
  static RENDER_STATES = ESTADOS;
  state = ESTADOS.NONE;
  #fila = Promise.resolve();
  desenhos = [];
  get rendered() { return this.state === ESTADOS.RENDERED; }
  render() {
    this.#fila = this.#fila.then(async () => {
      this.state = ESTADOS.RENDERING;
      await new Promise(r => setTimeout(r, 5));       // o render do Handlebars é assíncrono
      const ctx = await this._prepareContext();
      this.desenhos.push(ctx.v?.ecra);
      this.state = ESTADOS.RENDERED;
    });
    return this.#fila.then(() => this);
  }
  async close() { this.state = ESTADOS.CLOSED; this.fechada = true; return this; }
}
globalThis.foundry = { applications: { api: { ApplicationV2: ApplicationV2Falso, HandlebarsApplicationMixin: (c) => c } } };
globalThis.game = {
  user: { id: "mestre", isGM: true }, users: { get: () => null, filter: () => [] },
  i18n: { localize: (k) => k }, settings: { get: () => 0 }
};
globalThis.getComputedStyle = () => ({ lineHeight: "22px" });
const { Computador } = await import("../scripts/janela.js");
Computador.prototype._onRender = function () {};      // sem DOM: só interessa o que se desenhou
const tocou = [];
const { tocar } = await import("../scripts/som.js");
for (const k of Object.keys(tocar)) tocar[k] = () => tocou.push(k);

const dormir = (ms) => new Promise(r => setTimeout(r, ms));

test("uma atualização que chega a meio de um render não se perde", async () => {
  const j = await Computador.mostrar({ id: "d", nome: "PC", visual: {}, vista: { ecra: "senha" } });
  Computador.atualizar({ vista: { ecra: "senha" } });  // o hook do desbloqueio: render começa
  await dormir(1);                                     // o await do setFlag
  Computador.atualizar({ vista: { ecra: "lista" } });  // a vista nova chega a meio dele
  await dormir(40);
  assert.equal(j.desenhos.at(-1), "lista");
});

test("desligar logo a seguir a mostrar fecha mesmo a janela", async () => {
  await Computador.fechar();
  await dormir(20);
  const j = await Computador.mostrar({ id: "d", nome: "PC", visual: {}, vista: { ecra: "lista" } });
  j.fechada = false;                                  // a janela é reutilizada entre aberturas
  Computador.atualizar({ vista: { ecra: "lista" } }); // um render ainda a correr
  await dormir(1);
  Computador.fechar();
  await dormir(40);
  assert.ok(j.fechada);
});

test("0.2: o X do mestre esconde a vista — não desliga o computador", async () => {
  let desligou = 0, escondeu = 0;
  Computador.aoDesligar = () => desligou++;
  Computador.aoFecharVista = () => escondeu++;
  const j = await Computador.mostrar({ id: "d", nome: "PC", visual: {}, vista: { ecra: "lista" } });
  await j.close();                                    // o X / «Esconder» do mestre
  assert.equal(desligou, 0);
  assert.equal(escondeu, 1);
  await Computador.mostrar({ id: "d", nome: "PC", visual: {}, vista: { ecra: "lista" } });
  Computador.fechar();                                // ordem do mestre (desligou para todos)
  await dormir(20);
  assert.equal(escondeu, 1, "fechar por ordem do mestre não conta como esconder");
});
