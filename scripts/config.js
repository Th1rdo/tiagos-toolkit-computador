import { MODULE_ID, FOSFORO, MOLDURAS } from "./const.js";
import { configDe } from "./dados.js";

/**
 * Configurar um diário como computador, num diálogo só:
 * o ecrã (título, cor do fósforo, moldura), a senha do computador, a pasta de cada
 * ficheiro e a senha + dica de cada pasta. As pastas saem do que se escreve nos
 * ficheiros: «CASOS» ou «VOSS - PRIVADO/2011».
 */
export async function configurar(diario) {
  if (!game.user.isGM || !diario) return;
  const esc = foundry.utils.escapeHTML;
  const t = (k) => game.i18n.localize(k);
  const cfg = configDe(diario);
  const paginas = diario.pages.contents.filter(p => p.type === "text").sort((a, b) => a.sort - b.sort);

  // todas as pastas que já existem, com as mães incluídas
  const pastas = new Set(Object.keys(cfg.pastas));
  for (const p of paginas) {
    const partes = String(p.getFlag(MODULE_ID, "pasta") ?? "").split("/").map(s => s.trim()).filter(Boolean);
    partes.forEach((_, i) => pastas.add(partes.slice(0, i + 1).join("/")));
  }

  const ROTULOS = {
    verde: "COMPUTADOR.Fosforo.verde", ambar: "COMPUTADOR.Fosforo.ambar", branco: "COMPUTADOR.Fosforo.branco",
    gasta: "COMPUTADOR.Moldura.gasta", clara: "COMPUTADOR.Moldura.clara", escura: "COMPUTADOR.Moldura.escura", sem: "COMPUTADOR.Moldura.sem"
  };
  const select = (nome, valores, atual) => `<select name="${nome}">${valores.map(v =>
    `<option value="${v}" ${v === atual ? "selected" : ""}>${t(ROTULOS[v])}</option>`).join("")}</select>`;

  const conteudo = `
    <div class="cmp-config">
      <fieldset><legend>${t("COMPUTADOR.Config.Ecra")}</legend>
        <div class="form-group"><label>${t("COMPUTADOR.Config.TituloEcra")}</label>
          <input type="text" name="titulo" value="${esc(cfg.titulo)}"></div>
        <div class="form-group"><label>${t("COMPUTADOR.Config.Fosforo")}</label>${select("fosforo", Object.keys(FOSFORO), cfg.fosforo)}</div>
        <div class="form-group"><label>${t("COMPUTADOR.Config.Moldura")}</label>${select("moldura", MOLDURAS, cfg.moldura)}</div>
      </fieldset>
      <fieldset><legend>${t("COMPUTADOR.Config.Acesso")}</legend>
        <div class="form-group"><label>${t("COMPUTADOR.Config.Senha")}</label>
          <input type="text" name="senha" value="${esc(cfg.senha)}" placeholder="${t("COMPUTADOR.Config.SemSenha")}"></div>
        <div class="form-group"><label>${t("COMPUTADOR.Config.Dica")}</label>
          <input type="text" name="dica" value="${esc(cfg.dica)}"></div>
      </fieldset>
      <fieldset><legend>${t("COMPUTADOR.Config.Ficheiros")}</legend>
        <p class="hint">${t("COMPUTADOR.Config.FicheirosDica")}</p>
        ${paginas.length ? paginas.map(p => `
          <div class="form-group"><label>${esc(p.name)}</label>
            <input type="text" name="pasta.${p.id}" value="${esc(p.getFlag(MODULE_ID, "pasta") ?? "")}" placeholder="${t("COMPUTADOR.Config.Raiz")}"></div>`).join("")
          : `<p class="hint">${t("COMPUTADOR.Config.SemPaginas")}</p>`}
      </fieldset>
      ${pastas.size ? `<fieldset><legend>${t("COMPUTADOR.Config.Pastas")}</legend>
        <p class="hint">${t("COMPUTADOR.Config.PastasDica")}</p>
        ${[...pastas].sort().map((p, i) => `
          <div class="form-group"><label>${esc(p)}</label>
            <input type="hidden" name="p${i}.nome" value="${esc(p)}">
            <input type="text" name="p${i}.senha" value="${esc(cfg.pastas[p]?.senha ?? "")}" placeholder="${t("COMPUTADOR.Config.SemSenha")}">
            <input type="text" name="p${i}.dica" value="${esc(cfg.pastas[p]?.dica ?? "")}" placeholder="${t("COMPUTADOR.Config.Dica")}"></div>`).join("")}
      </fieldset>` : ""}
    </div>`;

  const dados = await foundry.applications.api.DialogV2.prompt({
    window: { title: `${t("COMPUTADOR.Configurar")}: ${diario.name}`, icon: "fa-solid fa-desktop" },
    position: { width: 560 },
    content: conteudo,
    ok: { label: "COMPUTADOR.Config.Guardar", callback: (_ev, botao) => new foundry.applications.ux.FormDataExtended(botao.form).object }
  }).catch(() => null);
  if (!dados) return;

  const novasPastas = {};
  for (const [k, v] of Object.entries(dados)) {
    const m = /^p(\d+)\.nome$/.exec(k);
    if (!m) continue;
    const senha = String(dados[`p${m[1]}.senha`] ?? "").trim();
    const dica = String(dados[`p${m[1]}.dica`] ?? "").trim();
    if (senha || dica) novasPastas[v] = { senha, dica };
  }
  await diario.setFlag(MODULE_ID, "computador", {
    titulo: String(dados.titulo ?? "").trim(), fosforo: dados.fosforo, moldura: dados.moldura,
    senha: String(dados.senha ?? "").trim(), dica: String(dados.dica ?? "").trim(), pastas: novasPastas
  });
  const mudancas = paginas
    .map(p => ({ _id: p.id, [`flags.${MODULE_ID}.pasta`]: String(dados[`pasta.${p.id}`] ?? "").trim() }))
    .filter(m => m[`flags.${MODULE_ID}.pasta`] !== (diario.pages.get(m._id).getFlag(MODULE_ID, "pasta") ?? ""));
  if (mudancas.length) await diario.updateEmbeddedDocuments("JournalEntryPage", mudancas);
  ui.notifications.info(game.i18n.format("COMPUTADOR.Config.Guardado", { nome: diario.name }));
}
