# Voidbound — Fronteiras do Infinito

Survival espacial procedural, em português, com Vue 3, TypeScript estrito, Phaser 3, Pinia, Dexie e Simplex Noise. Todos os sprites e efeitos são desenhados por código. Sem imagens, fontes, serviços ou banco externos em tempo de execução.

**Estado: alpha 0.2, com árvores, construção e armazenamento planetário. A V1 completa ainda está em desenvolvimento.** Consulte [PROGRESS.md](PROGRESS.md).

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

Em telas com toque, o joystick controla movimento lateral na superfície e rotação/aceleração no espaço. Há botões separados para laser/mineração, freio, interação e pulo, com suporte a múltiplos dedos. O HUD móvel é compacto e o diário abre sob demanda. A área renderizada acompanha o formato da tela sem cortar o centro do jogo, inclusive ao girar o aparelho. Na superfície, a mineração por botão escolhe o bloco próximo à frente dos pés; tocar diretamente em um bloco também funciona.

## Salvamento e recuperação

Uma partida por origem de navegador é salva em IndexedDB a cada 30 segundos e em pousos, embarques, fabricação, uso de itens, saltos e mudança de visibilidade. O rodapé também permite salvar manualmente. O menu pede confirmação antes de substituir uma partida.

Continue usando o mesmo navegador, perfil e endereço/origem para encontrar o salvamento. O esquema Dexie e o payload estão na versão 2. Partidas da versão 1 migram automaticamente, preservando seed, nave, inventário, missões e alterações do terreno. O banco mantém o nome original `voidbound-v1` para preservar o slot existente.

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

### Verificação móvel

Com o Vite em execução, rode `npm run test:mobile`. O teste usa toque e múltiplos contatos para pilotar, entrar em órbita, pousar, caminhar, minerar, pular e acessar os painéis. Verifica também a preservação do estado ao girar a tela, controles de pelo menos 44 px, ausência de rolagem da página e o centro do jogo livre de sobreposições em 844×280, 667×280, 844×390, 390×664 e 320×568. Screenshots são gravadas em `/tmp/voidbound-mobile-qa`. A validação em aparelhos físicos continua recomendada.

## Árvores e bases planetárias

Cada bioma tem uma família de árvores alienígenas: cedros de basalto, acácias âmbar, coníferas glaciais, copas de jade, árvores brasa e mangues-lâmina. A seed do planeta determina variações de altura, copa, cor e posição. Árvores cortadas não reaparecem após viajar ou carregar o save.

Na superfície, mire no tronco e segure a mineração (ou use o botão **MINERAR** perto da árvore, olhando para ela). Três pulsos cortam a árvore e colocam 14–16 madeiras na carga. Não é necessário sair em uma nova partida: as árvores também aparecem nos planetas de saves antigos, preservando o terreno minerado.

Pressione **B** ou toque no botão **⌂** do HUD móvel para abrir a oficina de campo. Ela funciona fora da nave, sem bloquear receitas por missão:

| Peça               | Custo                 | Resultado | Função                                   |
| ------------------ | --------------------- | --------- | ---------------------------------------- |
| Bloco de madeira   | 2 madeiras            | 4 blocos  | Fundação, piso, pilar ou teto sólido     |
| Parede de madeira  | 2 madeiras            | 4 paredes | Fundo da casa; permite caminhar à frente |
| Escada de madeira  | 3 madeiras            | 4 escadas | Rampa com degraus que se sobe caminhando |
| Armário planetário | 6 madeiras + 2 ferros | 1 armário | 16 slots independentes naquele local     |

Fabrique e equipe uma peça. Clique/toque em uma célula vazia até 6 blocos do astronauta. A prévia indica se a posição é válida; cada colocação consome exatamente uma peça. É preciso conectar a construção ao chão ou a outra peça. Paredes ocupam uma camada própria e podem ficar atrás do piso, escada ou armário. Deixe pelo menos dois tiles livres de altura para caminhar dentro da casa.

**R** ou o botão de seta inverte a escada. O botão **⌫** alterna para desmontagem e devolve a peça à carga. Para retirar uma parede, selecione Parede antes de desmontar, escolhendo a camada de fundo. **B**, **Esc** ou **×** encerra a construção. No celular, também é possível usar **COLOCAR** para a célula da prévia (por padrão, à frente do personagem), ou tocar diretamente no mundo.

Abra um armário próximo com **E**, **INTERAGIR**, ou clicando/tocando nele fora do modo de construção. Selecione 1, 10 ou Todos e use Guardar/Retirar. Transferências são atômicas: falta de espaço não remove itens da origem. Um armário com conteúdo não pode ser desmontado; esvazie-o primeiro.

Construções, direção das escadas, paredes, árvores cortadas e cada inventário de armário são salvos por **ID do planeta e coordenada**, em pousos, transferências, colocações/desmontagens, cortes de árvore e no autosave existente. Decolar, saltar, retornar, fechar ou recarregar a página preserva esses dados. Casas não pressurizam o ambiente: a sobrevivência mantém as regras existentes de oxigênio e temperatura.

### Teste de construção e migração

`npm test` cobre geração de árvores, custo de fabricação, colisão, escadas nas duas direções, suporte, alcance, proteção de armários, transferências, retorno entre sistemas, reabertura do banco e upgrade real do IndexedDB de 1 para 2.

Com o Vite em execução, `npm run test:construction` corta uma árvore e minera ferro por controles reais, fabrica e coloca pisos/paredes/escada/armário, guarda peças, sobe a escada, recarrega a página e recupera itens. Não concede materiais por código. Screenshots ficam em `/tmp/voidbound-construction-qa`. O teste `npm run test:mobile` também fabrica e coloca um bloco por toque.

## Encontrar suas bases e itens armazenados

Abra o mapa com **M** ou **✧** no celular e selecione a aba **Bases e depósitos**. Ela lista automaticamente os planetas onde existem construções, distinguindo armários vazios e depósitos com itens. Também há acesso pela cabine e pelo painel de um armário.

Cada entrada mostra nome do planeta e sistema, coordenadas do setor, total guardado, recursos e quantidades. Expanda **Ver armários, coordenadas e conteúdo** para consultar cada armário, sua coordenada de bloco e a zona de pouso mais próxima. Use a busca por planeta/sistema/recurso ou o filtro **Só com itens**.

**Localizar** centraliza o mapa no sistema e destaca seu marcador; não move a nave nem consome combustível. Sistemas com itens recebem **▤**, e bases sem itens recebem **⌂**. Após selecionar um sistema, suas bases aparecem abaixo do mapa. Se estiver longe demais para um salto, avance por sistemas intermediários.

Na órbita, o planeta informa sua base e estoque, e as zonas de pouso indicam se são as mais próximas dos armários. As distâncias horizontais e coordenadas do catálogo ajudam a caminhar até o local exato: a zona mais próxima ainda pode ficar distante de uma base construída longe dos pontos iniciais.

O catálogo é uma consulta ao save versão 2 existente: não precisa de cadastro manual, nova partida ou migração adicional. Depósitos/retiradas, desmontagem e carregamento da partida atualizam os indicadores. A carga da nave não entra nesses totais. Consultar à distância não permite transferir itens; isso continua exigindo proximidade do armário na superfície.

### Testar o catálogo

Com o Vite em execução, `npm run test:catalog` usa um cenário de UI salvo com bases locais, remotas e vazias para verificar filtros, busca, coordenadas, marcadores, localização sem teleporte e informações de órbita em telas móveis. Screenshots ficam em `/tmp/voidbound-catalog-qa`. O teste `npm run test:construction` também confere o catálogo de itens guardados durante o percurso com materiais coletados no jogo.
