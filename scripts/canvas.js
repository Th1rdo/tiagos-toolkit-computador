/**
 * Com o computador em ecrã inteiro o mapa não se vê — mas o PIXI continua a
 * desenhá-lo a 60 fps, e o Mac do Tiago já sofre com FPS. Baixa-se o ritmo
 * (nunca se PARA o ticker: uma falha na volta deixa o mapa lento, não congelado).
 * A mesma receita do Stage, incluindo a armadilha dele: guardar o ritmo original
 * UMA vez, e no `canvasReady` reaplicar sem o reler (senão o mapa ficava a 5 fps).
 */
let guardado = null;

export function aliviarCanvas(ligar) {
  const ticker = globalThis.canvas?.app?.ticker;
  if (!ticker) return;
  if (ligar) {
    if (guardado !== null) return;
    guardado = ticker.maxFPS ?? 0;
    ticker.maxFPS = 5;
  } else {
    if (guardado === null) return;
    ticker.maxFPS = guardado;
    guardado = null;
  }
}

/** Mudar de cena repõe o ticker: se estávamos a aliviar, volta a aliviar. */
export function reaplicar() {
  const ticker = globalThis.canvas?.app?.ticker;
  if (guardado !== null && ticker) ticker.maxFPS = 5;
}
