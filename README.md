# Conversor de Kit PES 21 → PES 13

Site estático que converte a textura de kit (camisa) do PES 21 para o layout do PES 13, direto no navegador.
Baseado no arquivo `PES 21 KIT Converter to 13 V1.3.blend`.

## Como funciona
Os dois modelos do .blend têm os mesmos vértices no espaço 3D, mas UVs diferentes.
`map.js` guarda, para cada pixel do kit 13 (1024×512), a posição correspondente no kit 21 (2048×2048).
O site só lê esse mapa e reamostra a imagem (interpolação bilinear).

## Publicar no GitHub Pages
1. Suba `index.html`, `app.js`, `map.js` e `README.md` na raiz de um repositório.
2. Em **Settings → Pages**, escolha **Deploy from a branch**, branch `main`, pasta `/ (root)`.
3. O site fica em `https://SEU-USUARIO.github.io/NOME-DO-REPO/`.

Também dá para abrir o `index.html` direto no navegador.

## Limitações
- Entrada: PNG/JPG/WebP (converta DDS para PNG antes). Saída: PNG (converta para DDS depois, se o jogo pedir).
- Só converte o que o .blend cobre; áreas do kit 13 sem correspondência no 21 ficam transparentes.
