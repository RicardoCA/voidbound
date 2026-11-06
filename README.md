# Voidbound — Fronteiras do Infinito

Survival espacial procedural, em português, com Vue 3, TypeScript estrito, Phaser 3, Pinia, Dexie e Simplex Noise. Todos os sprites e efeitos são desenhados por código. Sem imagens, fontes, serviços ou banco externos em tempo de execução.

**Estado: alpha 0.1, com ciclo vertical funcional. A V1 completa ainda está em desenvolvimento.** Consulte [PROGRESS.md](PROGRESS.md).

## Executar

Requer Node.js 22.12+ e npm.

```sh
npm ci
npm run dev
```

Abra o endereço exibido pelo Vite. O jogo executa no cliente. Depois de carregar os arquivos, o gameplay não utiliza rede. Não há service worker para reinstalação offline.

```sh
npm run lint
npm test
npm run build
```

Se quiser apenas jogar o build já gerado neste diretório, sem Node.js:

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
```

Abra `http://127.0.0.1:4173`. Este endereço usa um salvamento separado do servidor de desenvolvimento na porta 5173.

O build fica em `dist/`. Na Vercel: framework Vite, comando `npm run build`, diretório de saída `dist`. Nenhuma variável de ambiente ou backend é necessária.

## Primeira expedição

1. Inicie a partida. A seed determina os sistemas, planetas e terrenos.
2. Segure **W** para se aproximar do planeta à direita. A menos de 210 km, pressione **E** para entrar em órbita.
3. Escolha uma zona de pouso. Na cabine, selecione **Explorar superfície**.
4. Clique nos blocos até 76 pixels lógicos do astronauta para minerar. Minérios têm cores próprias; rocha comum também fornece ferro. Colete pelo menos 6 ferros, 4 cobres e 2 silícios. Os primeiros blocos na planície facilitam a introdução.
5. Perto da nave, pressione **E**. Na fabricação, produza 2 placas, 2 circuitos e 1 kit de reparo. Use o kit na carga e decole.
6. No espaço, segure **Espaço** perto de asteroides. O laser mira no mais próximo ao alcance. Colete materiais para uma melhoria; instale-a pela carga, a bordo.
7. Fabrique e instale o propulsor de salto. Decole, abra **M**, selecione um sistema no círculo de alcance e inicie o salto. O custo é de 8 unidades por ano-luz, arredondado para cima.

A carga é compartilhada entre traje e nave nesta alpha: 24 slots, ou 40 com compartimento adicional. Recursos empilham até 99 por slot; melhorias ocupam um slot por unidade.

## Controles

| Ação       | Nave                                     | Astronauta                       |
| ---------- | ---------------------------------------- | -------------------------------- |
| Movimento  | W acelerar, S frear, A/D girar           | A/D caminhar                     |
| Ferramenta | Espaço: laser de asteroides              | Clique: multitool; Espaço: pular |
| Interação  | E: órbita próxima                        | E: entrar na nave próxima        |
| Interfaces | I carga, C fabricação, M mapa, Esc pausa | Idem                             |

Em telas com toque, botões direcionais controlam os eixos, com ações de mineração, interação e pulo. Prefira orientação horizontal. Na superfície, a mineração por botão escolhe o bloco próximo à frente dos pés; tocar diretamente em um bloco também funciona.

## Salvamento e recuperação

Uma partida por origem de navegador é salva em IndexedDB a cada 30 segundos e em pousos, embarques, fabricação, uso de itens, saltos e mudança de visibilidade. O rodapé também permite salvar manualmente. O menu pede confirmação antes de substituir uma partida.

Continue usando o mesmo navegador, perfil e endereço/origem para encontrar o salvamento. O esquema Dexie e o payload começam na versão 1. Futuras versões precisam de migrações explícitas; nenhuma migração fictícia foi criada.

Sem combustível, solte a aceleração para receber uma reserva solar lenta até 3 unidades. Embarcado, **Recuperação solar** avança 60 segundos do relógio da expedição e restaura 5 unidades de combustível e oxigênio. Decolar custa 5 unidades e exige casco de pelo menos 70%. Morte resgata o astronauta na nave e reduz o casco em 10 pontos. Temperaturas extremas exigem o escudo instalado para proteção.

## Estrutura

- `src/game/`: cena Phaser, controles, áudio, tipos e terreno por chunks.
- `src/universe/`: sistemas e planetas determinísticos sob demanda.
- `src/inventory/` e `src/crafting/`: operações transacionais independentes da UI.
- `src/stores/`: estado da partida, progressão, transições e melhorias.
- `src/persistence/`: IndexedDB versionado.
- `src/components/` e `src/app/`: canvas, menus, carga, fabricação, mapa e HUD responsivo.
- `src/tests/`: determinismo, cache, terreno, inventário, fabricação, ciclo de jogo e persistência.

## Teste no navegador

Com o servidor em execução em outro terminal:

```sh
npx playwright install chromium
npm run test:browser
```

O teste usa uma nova sessão de navegador, pilota com teclado, pousa pelos menus, minera blocos reais com o mouse, fabrica, repara, decola e recarrega a partida. Não concede materiais por código. Screenshots são gravadas em `/tmp/voidbound-qa` (configure `VOIDBOUND_ARTIFACTS` para outro diretório). `VOIDBOUND_URL` substitui o endereço padrão `http://127.0.0.1:5173`.

## GitHub Pages

O workflow `.github/workflows/pages.yml` instala as dependências, executa lint/testes, compila o Vite e publica **apenas `dist/`** após cada push em `main`. Também pode ser iniciado manualmente na aba Actions.

Em **Settings → Pages → Build and deployment**, mantenha **Source: GitHub Actions**. O domínio personalizado é gerenciado nessa mesma tela (atualmente `voidbound.duckdns.org`). O workflow obtém o caminho-base da configuração do Pages: funciona tanto no domínio personalizado quanto no endereço com `/voidbound/`, caso o domínio seja removido.

Selecionar GitHub Actions na configuração não cria o deploy sozinho: é necessário que o workflow seja executado e termine com sucesso. Acompanhe os jobs `build` e `deploy` na aba Actions. Não publique diretamente o código-fonte Vue/TypeScript como se fosse um site HTML estático.
