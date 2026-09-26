/** Identidade do módulo e constantes partilhadas. */
export const MODULE_ID = "tiagos-toolkit-computador";
export const SOCKET = `module.${MODULE_ID}`;

/** Cor do fósforo: o texto e o brilho do ecrã. */
export const FOSFORO = {
  verde:  { cor: "#7DFFB0", fundo: "#07120c" },
  ambar:  { cor: "#FFB347", fundo: "#140d05" },
  branco: { cor: "#E6EEFF", fundo: "#0b0d12" }
};

/**
 * A moldura do monitor. «gasta» (0.2, a de omissão) é a da referência do Tiago: plástico escuro,
 * sujo, quase fundido com a sala. As outras ficam para quem já as escolheu.
 */
export const MOLDURAS = ["gasta", "escura", "clara", "sem"];

/** Quanto dura o arranque, em ms. Curto: é ambiente, não espera. */
export const ARRANQUE_MS = 2600;

export const CONFIG_VAZIA = {
  titulo: "", fosforo: "verde", moldura: "gasta", senha: "", dica: "", pastas: {}
};

export const log = (...args) => console.log(`${MODULE_ID} |`, ...args);

/** O utilizador da transmissão (módulo Transmissão), se existir: não vai para «ao teclado». */
export function uidTransmissao() {
  try { return game.settings.get("tiagos-toolkit-transmissao", "utilizador") || null; } catch { return null; }
}
