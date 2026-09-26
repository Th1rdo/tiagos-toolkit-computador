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
- **Ecrã inteiro (0.2).** O computador toma conta do ecrã: uma sala escura com o monitor ao meio, a interface
  do Foundry por baixo e o mapa a 5 fps enquanto está ligado (volta ao normal quando se fecha).
- **Vidro curvo.** O texto encurva nas bordas como num CRT (filtro SVG só na camada do texto; as linhas de
  varrimento, o grão e o reflexo ficam por cima). Quem tiver um computador lento desliga-o nas definições
  do módulo («Tela curva do computador», é de cada um).
- Ecrã: fósforo **verde, âmbar ou branco**; moldura **gasta** (escura e suja, a de omissão), escura, clara ou
  nenhuma. Arranque com o nome do computador em letras grandes, sons sintetizados (volume de Interface).

## Como se usa

1. No diário: **⋮ → Configurar como computador** — título do ecrã, cor, moldura, senha, pasta de cada ficheiro,
   senha e dica de cada pasta.
2. **⋮ → Mostrar o computador à mesa** (também no menu do diário na barra lateral) → escolher **quem fica ao
   teclado** e **quem vê** (a transmissão, se usares o módulo Transmissão, é uma caixa à parte).
3. No rodapé (aparece ao passar o rato em baixo), o mestre muda quem está ao teclado e quem vê, **Esconde** a
   sua tela ou **Desliga**.
   - **Esconder / o X do mestre** fecha só a tela do mestre: quem está ao teclado continua a usar o computador.
     Volta-se pela aba **«Computador ligado · Ver»** no topo do ecrã.
   - **Fechar** de um jogador fecha só a dele; volta pela mesma aba.
   - **Desligar** desliga para todos.

Se o mestre recarregar a página, o computador volta a aparecer onde estava.

> **Privacidade.** Só o mestre verifica as senhas, e os jogadores só recebem o que está no ecrã. Mas o
> Foundry envia todos os diários a todos os browsers: quem abrir a consola consegue ler o diário, como
> qualquer outro diário do Foundry.

```
https://github.com/Th1rdo/tiagos-toolkit-computador/releases/latest/download/module.json
```

Letra: VT323 (SIL Open Font License, em `fonts/`).
