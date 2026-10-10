# Conversor de Kit PES 21 → PES 13

Site estático que converte a textura de kit do PES 21 para o layout do PES 13, direto no navegador.
Baseado no arquivo `PES 21 KIT Converter to 13 V1.3.blend`.

## Como usar
1. Suba o kit do PES 21 (PNG/JPG/WebP, normalmente 2048×2048).
2. (Opcional) Clique em **Subir fitinha** para colocar a fitinha no espaço vazio do kit.
   Imagens deitadas (mais largas que altas) são giradas 90° automaticamente.
3. Clique em **Baixar PNG**.

O PNG sai com **cores indexadas** (paleta de até 256 cores, sem canal alfa).
As áreas transparentes são preenchidas automaticamente com a cor do pixel mais próximo (expandir bordas automático).

## Arquivos
- `index.html`, `app.js`: interface e conversão.
- `indexed.js`: preenchimento de transparência, quantização (median cut) e gerador de PNG indexado.
- `map.js`: para cada pixel do kit 13 (1024×512), a posição correspondente no kit 21, gerada a partir do .blend.

## Publicar no GitHub Pages
1. Suba todos os arquivos na raiz de um repositório.
2. Em **Settings → Pages**, escolha **Deploy from a branch**, branch `main`, pasta `/ (root)`.
3. O site fica em `https://SEU-USUARIO.github.io/NOME-DO-REPO/`.

Também dá para abrir o `index.html` direto no navegador.

## Limitações
- Entrada: PNG/JPG/WebP (converta DDS para PNG antes). Saída: PNG indexado (converta para DDS depois, se precisar).
- A fitinha ocupa o retângulo x=605, y=286, 32×226 px do kit 13 (editável em `RIBBON`, no `app.js`).
