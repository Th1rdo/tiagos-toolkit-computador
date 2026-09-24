/**
 * Lógica pura do computador: sem Foundry, sem DOM — testada em Node.
 *
 * Um computador é um diário: cada página é um ficheiro, e a «pasta» de cada
 * página (ex.: "VOSS - PRIVADO/2011") desenha as pastas no ecrã. As senhas vivem
 * na configuração do computador e **só o mestre as verifica**: é ele que
 * corre `reduzir()` e manda aos outros apenas a `vista()` — o que se pode ver.
 */

// ------------------------------------------------------------------ senhas

/** «Rouxinól » e «rouxinol» são a mesma senha: sem maiúsculas, espaços à volta ou acentos. */
export const normalizarSenha = (s) =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

export const senhaCerta = (tentativa, senha) =>
  !!normalizarSenha(senha) && normalizarSenha(tentativa) === normalizarSenha(senha);

// ------------------------------------------------------------------ pastas

const juntar = (caminho) => caminho.filter(Boolean).join("/");
const antepassados = (caminho) => {
  const partes = caminho.split("/").filter(Boolean);
  return partes.map((_, i) => partes.slice(0, i + 1).join("/"));
};

/** Uma pasta está fechada se ela ou alguma acima dela tem senha e não foi aberta. */
export function pastaProtegida(caminho, cfg, desbloqueadas = []) {
  return antepassados(caminho).some(p => cfg?.pastas?.[p]?.senha && !desbloqueadas.includes(p));
}

/** A primeira pasta fechada no caminho — é essa que pede a senha. */
function primeiraFechada(caminho, cfg, desbloqueadas) {
  return antepassados(caminho).find(p => cfg?.pastas?.[p]?.senha && !desbloqueadas.includes(p)) ?? null;
}

/**
 * O que está dentro de uma pasta: os ficheiros dela e as pastas filhas, pela ordem
 * das páginas do diário (uma pasta conta pela sua página mais acima). É a ordem que
 * o mestre já vê no diário — não há outra coisa para arrumar.
 */
export function listar(paginas, caminho, cfg, desbloqueadas = []) {
  const aqui = juntar(caminho);
  const ficheiros = [];
  const pastas = new Map();
  for (const p of paginas) {
    const pasta = String(p.pasta ?? "").split("/").map(s => s.trim()).filter(Boolean).join("/");
    if (pasta === aqui) { ficheiros.push({ tipo: "ficheiro", nome: p.nome, id: p.id, ordem: p.ordem ?? 0 }); continue; }
    const dentro = aqui ? pasta.startsWith(aqui + "/") : !!pasta;
    if (!dentro) continue;
    const resto = aqui ? pasta.slice(aqui.length + 1) : pasta;
    const nome = resto.split("/")[0];
    const completo = juntar([aqui, nome]);
    const ordem = Math.min(pastas.get(completo)?.ordem ?? Infinity, p.ordem ?? 0);
    pastas.set(completo, { tipo: "pasta", nome, caminho: completo, ordem });
  }
  return [...ficheiros, ...pastas.values()]
    .map(x => (x.tipo === "pasta" ? { ...x, protegida: pastaProtegida(x.caminho, cfg, desbloqueadas) } : x))
    .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome));
}

// ------------------------------------------------------------------ estado

export function estadoInicial({ cfg, desbloqueadas = [] } = {}) {
  const base = { ecra: "lista", caminho: [], cursor: 0, ficheiro: null, rolagem: 0, alvo: null, digitado: "", erro: false, tentativas: 0 };
  if (cfg?.senha && !desbloqueadas.includes("")) return { ...base, ecra: "senha", alvo: "" };
  return base;
}

const PAGINA = 10;
const imprimivel = (t) => typeof t === "string" && t.length === 1 && t >= " ";

/**
 * Um passo do computador. Corre no mestre; devolve o novo estado e os efeitos
 * (sons para toda a gente, pastas a guardar como desbloqueadas).
 */
export function reduzir(estado, entrada, ctx) {
  const e = { ...estado, erro: estado.ecra === "senha" ? estado.erro : false };
  const efeitos = [];
  const { paginas, cfg } = ctx;
  const desbloqueadas = ctx.desbloqueadas ?? [];
  const t = entrada?.tecla;

  if (e.ecra === "lista") {
    const entradas = listar(paginas, e.caminho, cfg, desbloqueadas);
    const abrir = (i) => {
      const x = entradas[i];
      if (!x) return;
      e.cursor = i;
      if (x.tipo === "ficheiro") {
        Object.assign(e, { ecra: "ficheiro", ficheiro: x.id, rolagem: 0 });
        efeitos.push({ som: "abrir" });
        return;
      }
      const fechada = primeiraFechada(x.caminho, cfg, desbloqueadas);
      if (fechada) {
        Object.assign(e, { ecra: "senha", alvo: fechada, digitado: "", erro: false, tentativas: 0 });
        efeitos.push({ som: "tecla" });
        return;
      }
      Object.assign(e, { caminho: x.caminho.split("/"), cursor: 0 });
      efeitos.push({ som: "tecla" });
    };

    if (entrada?.tipo === "clicar") abrir(entrada.indice);
    else if (t === "ArrowDown") { e.cursor = Math.min(e.cursor + 1, Math.max(0, entradas.length - 1)); efeitos.push({ som: "tecla" }); }
    else if (t === "ArrowUp") { e.cursor = Math.max(0, e.cursor - 1); efeitos.push({ som: "tecla" }); }
    else if (t === "PageDown") e.cursor = Math.min(e.cursor + PAGINA, Math.max(0, entradas.length - 1));
    else if (t === "PageUp") e.cursor = Math.max(0, e.cursor - PAGINA);
    else if (t === "Enter") abrir(e.cursor);
    else if (t === "Escape" || t === "Backspace") {
      if (e.caminho.length) {
        const saida = juntar(e.caminho);
        e.caminho = e.caminho.slice(0, -1);
        const irmas = listar(paginas, e.caminho, cfg, desbloqueadas);
        e.cursor = Math.max(0, irmas.findIndex(x => x.caminho === saida));   // o cursor fica na pasta de onde se saiu
        efeitos.push({ som: "tecla" });
      }
    }
    return { estado: e, efeitos };
  }

  if (e.ecra === "ficheiro") {
    if (t === "ArrowDown") e.rolagem += 1;
    else if (t === "ArrowUp") e.rolagem = Math.max(0, e.rolagem - 1);
    else if (t === "PageDown") e.rolagem += PAGINA;
    else if (t === "PageUp") e.rolagem = Math.max(0, e.rolagem - PAGINA);
    else if (t === "Escape" || t === "Enter" || t === "Backspace" || entrada?.tipo === "voltar") {
      Object.assign(e, { ecra: "lista", ficheiro: null, rolagem: 0 });
      efeitos.push({ som: "tecla" });
    }
    return { estado: e, efeitos };
  }

  if (e.ecra === "senha") {
    if (imprimivel(t)) {
      if (e.digitado.length < 40) e.digitado += t;
      e.erro = false;
      efeitos.push({ som: "tecla" });
    } else if (t === "Backspace") {
      e.digitado = e.digitado.slice(0, -1);
      efeitos.push({ som: "tecla" });
    } else if (t === "Escape" && e.alvo !== "") {
      Object.assign(e, { ecra: "lista", alvo: null, digitado: "", erro: false });
      efeitos.push({ som: "tecla" });
    } else if (t === "Enter") {
      const senha = e.alvo === "" ? cfg?.senha : cfg?.pastas?.[e.alvo]?.senha;
      if (senhaCerta(e.digitado, senha)) {
        efeitos.push({ desbloquear: e.alvo }, { som: "acesso" });
        const dentro = e.alvo === "" ? [] : e.alvo.split("/");
        Object.assign(e, { ecra: "lista", caminho: dentro, cursor: 0, alvo: null, digitado: "", erro: false, tentativas: 0 });
      } else {
        Object.assign(e, { digitado: "", erro: true, tentativas: e.tentativas + 1 });
        efeitos.push({ som: "erro" });
      }
    }
    return { estado: e, efeitos };
  }

  return { estado: e, efeitos };
}

// ------------------------------------------------------------------ vista

/**
 * O que vai para toda a gente: nunca a senha, nunca o que se escreveu (só
 * asteriscos), nunca o conteúdo de um ficheiro que não está aberto.
 */
export function vista(estado, { paginas, cfg, desbloqueadas = [] }) {
  const entradas = listar(paginas, estado.caminho, cfg, desbloqueadas);
  const v = {
    ecra: estado.ecra,
    titulo: cfg?.titulo ?? "",
    caminho: "/" + juntar(estado.caminho),
    pasta: estado.caminho.at(-1) ?? null,
    cursor: estado.cursor,
    rolagem: estado.rolagem,
    entradas: entradas.map((x, i) => ({
      tipo: x.tipo,
      protegida: !!x.protegida,
      rotulo: x.tipo === "pasta"
        ? `${String(i).padStart(2, "0")} ${x.nome} /`
        : `${String(i).padStart(2, "0")} - ${x.nome}`
    }))
  };
  if (estado.ecra === "ficheiro") {
    const p = paginas.find(x => x.id === estado.ficheiro);
    v.ficheiro = p ? { titulo: p.nome, html: p.html ?? "" } : null;
  }
  if (estado.ecra === "senha") {
    const pasta = estado.alvo === "" ? null : cfg?.pastas?.[estado.alvo];
    v.senha = {
      alvo: estado.alvo === "" ? null : "/" + estado.alvo,
      dica: (estado.alvo === "" ? cfg?.dica : pasta?.dica) ?? "",
      mascara: "*".repeat(estado.digitado.length),
      erro: !!estado.erro,
      tentativas: estado.tentativas
    };
  }
  return v;
}

// ------------------------------------------------------------------ arranque

/**
 * Letras em blocos para o logótipo do arranque (5×5, desenhadas à mão).
 * Um computador chamado «ORDEM» arranca com ORDEM em letras grandes — como o
 * VANTAGE do módulo que o Tiago mostrou, mas com o nome de cada computador.
 */
const FONTE = {
  A: ["01110","10001","11111","10001","10001"], B: ["11110","10001","11110","10001","11110"],
  C: ["01111","10000","10000","10000","01111"], D: ["11110","10001","10001","10001","11110"],
  E: ["11111","10000","11110","10000","11111"], F: ["11111","10000","11110","10000","10000"],
  G: ["01111","10000","10011","10001","01111"], H: ["10001","10001","11111","10001","10001"],
  I: ["11111","00100","00100","00100","11111"], J: ["00111","00010","00010","10010","01100"],
  K: ["10010","10100","11000","10100","10010"], L: ["10000","10000","10000","10000","11111"],
  M: ["10001","11011","10101","10001","10001"], N: ["10001","11001","10101","10011","10001"],
  O: ["01110","10001","10001","10001","01110"], P: ["11110","10001","11110","10000","10000"],
  Q: ["01110","10001","10101","10010","01101"], R: ["11110","10001","11110","10100","10010"],
  S: ["01111","10000","01110","00001","11110"], T: ["11111","00100","00100","00100","00100"],
  U: ["10001","10001","10001","10001","01110"], V: ["10001","10001","10001","01010","00100"],
  W: ["10001","10001","10101","11011","10001"], X: ["10001","01010","00100","01010","10001"],
  Y: ["10001","01010","00100","00100","00100"], Z: ["11111","00010","00100","01000","11111"],
  0: ["01110","10011","10101","11001","01110"], 1: ["00100","01100","00100","00100","01110"],
  2: ["11110","00001","01110","10000","11111"], 3: ["11110","00001","00110","00001","11110"],
  4: ["10010","10010","11111","00010","00010"], 5: ["11111","10000","11110","00001","11110"],
  6: ["01110","10000","11110","10001","01110"], 7: ["11111","00001","00010","00100","00100"],
  8: ["01110","10001","01110","10001","01110"], 9: ["01110","10001","01111","00001","01110"],
  "-": ["00000","00000","11111","00000","00000"], " ": ["000","000","000","000","000"]
};

export function letrasEmBloco(texto, max = 10) {
  const letras = normalizarSenha(texto).toUpperCase().slice(0, max).split("").map(c => FONTE[c] ?? FONTE[" "]);
  return [0, 1, 2, 3, 4].map(l => letras.map(g => g[l].replace(/1/g, "█").replace(/0/g, " ")).join(" "));
}
