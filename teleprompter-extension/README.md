# Mini Teleprompter (extensão Chrome)

Janela 400x240, topo da tela, centralizada na horizontal (perto da câmera do notebook).
Mostra um slide por vez. Troca de slide por atalho global, clique ou teclado.

## Instalar

1. `chrome://extensions` → ativar **Modo do desenvolvedor**.
2. **Carregar sem compactação** → escolher a pasta `teleprompter-extension`.
3. Fixar o ícone na barra do Chrome.

## Usar

1. Clicar no ícone. Colar texto **ou** URL + **Carregar**.
2. Formato:

   ```
   Slide 1: Abertura
   **Bem-vindos** ao encontro
   - ponto um
   - ponto dois

   Slide 2: Contexto
   1. primeiro
   2. segundo
   ```

   Suporta `**negrito**`, `*itálico*`, `# títulos`, bullets (`-`, `*`, indentar 2 espaços = sub-bullet), listas numeradas.
   Sem marcador `Slide N`: separar com `---`.
3. **Enviar e abrir teleprompter**.

URLs aceitas: Google Docs / Google Slides (precisa estar logado no Chrome com acesso; vem como texto, sem negrito), arquivo texto/markdown cru, página HTML (negrito/bullets/títulos preservados).

## Trocar de slide

| Ação | Efeito |
|---|---|
| `Alt+Shift+→` / `Alt+Shift+←` | próximo / anterior, **mesmo com foco no Meet/Zoom** |
| Clique na janela | próximo |
| Clique direito na janela | anterior |
| `→ Espaço PageDown` / `← PageUp` (janela focada) | próximo / anterior |
| `+` / `-` ou botões A+ A- | tamanho da fonte |

Mudar atalho: `chrome://extensions/shortcuts`.

## Esconder da tela compartilhada

Chrome não deixa extensão excluir janela da captura ao nível do SO. O que funciona:

- **Compartilhar uma aba ou uma janela específica** (Meet: "Uma guia" / "Uma janela"): o teleprompter é janela separada, **não aparece** pros outros. Recomendado.
- **Compartilhar tela inteira**: teleprompter **aparece**. Evitar.
- Botão 📌 (Picture-in-Picture): janela sempre no topo, também fora da captura de aba/janela, mas aparece em tela inteira. Posição do PiP é escolhida pelo Chrome (arrastar manual).

Teste antes da reunião: abrir Meet, compartilhar, conferir a prévia.

## Limites

- Janela popup tem barra de título (~30px), área útil de texto ≈ 400x210.
- Janela popup não fica sempre no topo; use 📌 se outra janela cobrir.
