import { mapaBarril } from "./logica.js";

/**
 * O vidro curvo do monitor: um filtro SVG (`feDisplacementMap`) aplicado só à
 * camada do texto. As linhas de varrimento, o reflexo e o grão ficam em camadas
 * por cima e não passam pelo filtro — por isso o navegador só recalcula a curva
 * quando o conteúdo do ecrã muda (uma tecla, um ficheiro novo), não a cada frame.
 *
 * O mapa tem o tamanho real do ecrã: esticado (200×150 → 800×600) o navegador
 * não o suaviza e as linhas saíam em escada. Gera-se de novo quando o ecrã muda
 * de tamanho (é uma conta de ~20 ms).
 */
const ID = "cmp-barril";
const K = 0.055;                       // força da curva: as linhas dobram nas bordas sem o texto se desfazer
let svg = null, imagem = null, deslocar = null, filtro = null, vigia = null, tamanho = "", adiar = null;

function montar() {
  if (svg?.isConnected) return;
  const NS = "http://www.w3.org/2000/svg";
  svg = document.createElementNS(NS, "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
  filtro = document.createElementNS(NS, "filter");
  filtro.id = ID;
  filtro.setAttribute("filterUnits", "userSpaceOnUse");
  filtro.setAttribute("primitiveUnits", "userSpaceOnUse");
  filtro.setAttribute("color-interpolation-filters", "sRGB");
  imagem = document.createElementNS(NS, "feImage");
  imagem.setAttribute("preserveAspectRatio", "none");
  imagem.setAttribute("result", "mapa");
  deslocar = document.createElementNS(NS, "feDisplacementMap");
  deslocar.setAttribute("in", "SourceGraphic");
  deslocar.setAttribute("in2", "mapa");
  deslocar.setAttribute("xChannelSelector", "R");
  deslocar.setAttribute("yChannelSelector", "G");
  // O feDisplacementMap do Chromium vai buscar o píxel mais próximo, sem interpolar: as letras
  // saíam tremidas. Um desfoque de meio píxel esconde isso — e um CRT nunca foi nítido.
  const suavizar = document.createElementNS(NS, "feGaussianBlur");
  suavizar.setAttribute("stdDeviation", "0.55");
  filtro.append(imagem, deslocar, suavizar);
  svg.append(filtro);
  document.body.append(svg);
}

/** O mapa como blob (binário): em base64 era ~600 KB de texto dentro do atributo. */
let urlAntiga = null;
function desenharMapa(w, h) {
  const tela = document.createElement("canvas");
  tela.width = w; tela.height = h;
  const c = tela.getContext("2d");
  const img = c.createImageData(w, h);
  img.data.set(mapaBarril(w, h, K).dados);
  c.putImageData(img, 0, 0);
  return new Promise((ok) => tela.toBlob((b) => {
    if (urlAntiga) URL.revokeObjectURL(urlAntiga);
    ok(urlAntiga = URL.createObjectURL(b));
  }, "image/png"));
}

/**
 * O Chromium guarda o primeiro resultado do filtro: sem o mapa carregado, o texto sai desfeito
 * até ao próximo desenho da janela. Reaplicar o filtro não chega (tentado: esperar pela letra,
 * pelo mapa, pelo fim do fade) — resolve um desenho novo, como o de uma tecla. Por isso, com um
 * mapa novo, avisa-se quem desenha para redesenhar.
 */
let aoMapaNovo = () => {};
export function quandoMapaNovo(fn) { aoMapaNovo = fn; }

function medir(el) {
  const w = el.clientWidth, h = el.clientHeight;
  if (!w || !h) return;
  if (`${w}x${h}` !== tamanho) {
    tamanho = `${w}x${h}`;
    // O feImage não avisa quando o mapa está pronto (o evento «load» não chega). E se o computador
    // aparece enquanto o Foundry ainda arranca (o mestre recarregou, um jogador entrou a meio), o
    // texto sai desfeito até ~15 s depois — medido no Foundry v14 real. Redesenhar não custa nada
    // e só acontece com um mapa novo (uma vez por página, ou quando o ecrã muda de tamanho).
    desenharMapa(Math.min(w, 1920), Math.min(h, 1440)).then((url) => {
      imagem.setAttribute("href", url);
      for (const ms of [300, 1200, 3000, 7000, 12000, 20000]) setTimeout(() => aoMapaNovo(), ms);
    });
  }
  for (const n of [filtro, imagem]) {
    n.setAttribute("x", "0"); n.setAttribute("y", "0");
    n.setAttribute("width", String(w)); n.setAttribute("height", String(h));
  }
  // a mesma conta do mapaBarril, com a largura real do ecrã
  deslocar.setAttribute("scale", String((w / 2) * 2 * K * (255 / 127)));
}

/** Curvar esta camada (ou endireitá-la, se `ligada` for falso). */
export function curvar(el, ligada = true) {
  vigia?.disconnect(); vigia = null;
  if (!el) return;
  if (!ligada) { el.style.filter = ""; return; }
  montar();
  medir(el);
  el.style.filter = `url(#${ID})`;
  // durante um redimensionar contínuo, gerar o mapa só quando o tamanho assenta
  vigia = new ResizeObserver(() => { clearTimeout(adiar); adiar = setTimeout(() => medir(el), 120); });
  vigia.observe(el);
}

export function largar() {
  vigia?.disconnect(); vigia = null;
}
