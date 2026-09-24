import { MODULE_ID, CONFIG_VAZIA } from "./const.js";

/**
 * O computador vive no próprio diário: a configuração numa flag do diário, a
 * pasta de cada ficheiro numa flag da página, as pastas já abertas noutra flag.
 * O mestre escreve os ficheiros no editor de diário que já conhece.
 */

export const eComputador = (diario) => !!diario?.getFlag(MODULE_ID, "computador");

export function configDe(diario) {
  const cfg = diario?.getFlag(MODULE_ID, "computador") ?? {};
  return { ...CONFIG_VAZIA, ...cfg, pastas: cfg.pastas ?? {}, titulo: cfg.titulo || diario?.name || "" };
}

/** As páginas de texto, com a pasta e a ordem de cada uma. Imagens e PDFs ficam de fora nesta versão. */
export function paginasDe(diario) {
  return (diario?.pages?.contents ?? [])
    .filter(p => p.type === "text")
    .sort((a, b) => a.sort - b.sort)
    .map((p, i) => ({
      id: p.id, nome: p.name, ordem: i,
      pasta: p.getFlag(MODULE_ID, "pasta") ?? "",
      html: p.text?.content ?? ""
    }));
}

export const desbloqueadasDe = (diario) => diario?.getFlag(MODULE_ID, "desbloqueadas") ?? [];

export async function desbloquear(diario, caminho) {
  const atuais = desbloqueadasDe(diario);
  if (atuais.includes(caminho)) return;
  await diario.setFlag(MODULE_ID, "desbloqueadas", [...atuais, caminho]);
}

/** Fechar tudo outra vez (para reutilizar o computador noutra sessão). */
export const trancarTudo = (diario) => diario.setFlag(MODULE_ID, "desbloqueadas", []);

export const contexto = (diario) => ({
  paginas: paginasDe(diario), cfg: configDe(diario), desbloqueadas: desbloqueadasDe(diario)
});
