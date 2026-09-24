# Tiago's Toolkit: Computador

Um **diário vira um computador** que a mesa usa em cena: um monitor CRT com pastas, ficheiros e senhas.
O mestre mostra-o à mesa e escolhe quem está ao teclado; toda a gente vê o mesmo ecrã em direto.

- **Cada página de texto é um ficheiro.** Escreve-se no editor de diário normal.
- **Pastas** saem do nome que se dá a cada ficheiro: `CASOS`, ou `VOSS - PRIVADO/2011` para uma pasta dentro
  de outra. Uma pasta pode ter **senha e dica**; as de dentro herdam o fecho. O computador inteiro também pode ter.
- **Senhas** ignoram maiúsculas, espaços à volta e acentos. Tentativas ilimitadas. Uma pasta aberta fica aberta
  (`game.computador.trancarTudo(diario)` volta a fechar tudo).
- **Quem está ao teclado** escreve direto no ecrã: setas, Enter, Esc, PgUp/PgDn — ou clica.
  Os outros veem. **O mestre pode escrever sempre**, esteja quem estiver ao teclado (clica na tela primeiro).
  No rodapé, o mestre muda quem está ao teclado («só o mestre» também serve), ou desliga.
- Ecrã: fósforo **verde, âmbar ou branco**; moldura **clara, escura ou nenhuma**. Arranque com o nome do
  computador em letras grandes, sons sintetizados (volume de Interface).

## Como se usa

1. No diário: **⋮ → Configurar como computador** — título do ecrã, cor, senha, pasta de cada ficheiro,
   senha e dica de cada pasta.
2. **⋮ → Mostrar o computador à mesa** (também no menu do diário na barra lateral) → escolher quem fica ao
   teclado.
3. **Desligar** no rodapé, ou o X do mestre. O X de um jogador só fecha a janela dele.

Se o mestre recarregar a página, o computador volta a aparecer onde estava.

> **Privacidade.** Só o mestre verifica as senhas, e os jogadores só recebem o que está no ecrã. Mas o
> Foundry envia todos os diários a todos os browsers: quem abrir a consola consegue ler o diário, como
> qualquer outro diário do Foundry.

```
https://github.com/Th1rdo/tiagos-toolkit-computador/releases/latest/download/module.json
```

Letra: VT323 (SIL Open Font License, em `fonts/`).
