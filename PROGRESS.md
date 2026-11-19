# Progresso — Voidbound

## Base anterior: alpha 0.3 / casas com suporte de vida

A alpha é jogável; **não representa a conclusão da V1 solicitada**. O plano abaixo diferencia implementação de validação. A publicação é feita pelo workflow do GitHub Pages.

### Implementado

- [x] Vue 3 Composition API, TypeScript estrito, Vite, Phaser 3, Pinia, Dexie e Simplex Noise.
- [x] Menu, nova partida com seed, continuar, pausa e alternância de áudio.
- [x] Nave com aceleração, rotação, inércia, frenagem, combustível, energia, dano em asteroides e HUD/radar.
- [x] Estrelas e nebulosas em parallax, sprites originais por código, efeitos de motor, laser e partículas.
- [x] Sistemas por coordenadas inteiras, 1–8 planetas, cinco classes de estrela e seis biomas.
- [x] Distribuição estelar influencia a seleção de biomas; seeds hierárquicas reproduzíveis.
- [x] Mapa por proximidade, setores vazios, marcadores de visitados, deslocamento do mapa, alcance e custo de salto.
- [x] Órbita por proximidade real, dados planetários, três zonas de pouso, cabine funcional e decolagem.
- [x] Astronauta lateral, gravidade por planeta, pulo, colisão com terreno e dano por queda.
- [x] Chunks de 32×64 tiles, tiles de 16 px, cavernas, minérios e cache LRU de 12 chunks por planeta ativo.
- [x] Mineração modifica blocos reais. Só diferenças do terreno são persistidas.
- [x] Vida, oxigênio, energia, temperatura, recarga embarcada, resgate com penalidade e recuperação solar.
- [x] Dez recursos, pilhas, capacidade e inventário compartilhado.
- [x] Receitas funcionais com verificação transacional, bloqueios por progressão, refinaria e consumíveis.
- [x] Melhorias alteram aceleração/velocidade/alcance, tanque, proteção, carga, laser, broca e habilitação de salto.
- [x] Seis missões com desbloqueios e modo livre posterior.
- [x] IndexedDB com versão, autosave de 30 s, eventos importantes e retomada da partida.
- [x] Controles por teclado, mouse e botões de toque; CSS responsivo.
- [x] README e build estático apropriado à Vercel.

### Verificação executada nesta entrega

- [x] Build de produção, incluindo verificação TypeScript; 73 testes automatizados passaram.
- [x] ESLint.
- [x] Testes de determinismo após expulsão do cache, seis biomas, limites de memória e terreno negativo.
- [x] Testes de inventário e crafting com rollback por falta de materiais/capacidade.
- [x] Testes de progressão, proteção contra receitas fora da nave, melhorias duplicadas e recuperação solar.
- [x] Teste IndexedDB com fechamento e reabertura do banco, carga, coordenadas e blocos removidos.
- [x] Chromium: nova partida → pilotagem → órbita → pouso → mineração real por mouse → fabricação → reparo → decolagem → reload → continuar.
- [x] Chromium: sem erros de JavaScript; largura de 390 px sem overflow horizontal.
- [x] Emulação móvel com toque: botão de propulsão move a nave real; screenshots de 390×844 e 844×390.
- [x] Auditoria das dependências de produção: zero vulnerabilidades reportadas.

### Pendências para V1 completa

- [ ] Separar inventário pessoal (20 slots) da carga da nave, com transferência explícita.
- [x] Estruturas construíveis e colocação de blocos, paredes, escadas e armários persistentes.
- [ ] Adicionar luas e eventos de exploração.
- [x] Árvores originais por bioma, variantes por seed e coleta de madeira com persistência de cortes.
- [ ] Ampliar outras formas de vegetação, formações geológicas e água interativa.
- [ ] Refinar distribuição de minérios por profundidade e classe estelar; ampliar diferenças de atmosfera/perigos.
- [ ] Física de movimento e colisão atual é resolvida por código, com o movimento lateral extraído em `game/physics/surface.ts`. Arcade está configurado, mas ainda precisa ser integrado aos corpos e colisores.
- [ ] Extrair atualização física e renderização da cena em sistemas menores conforme o conteúdo crescer.
- [ ] Melhorar animações de caminhada, descida e decolagem; estrelas com mais variedade e luz local.
- [ ] Escalonamento inteiro no desktop; atualmente Phaser FIT e nearest-neighbor mantêm bordas sem suavização, mas a escala pode ser fracionária.
- [x] Joystick de toque com dead zone, botões independentes, multitouch e cancelamento de ponteiros. A direção do joystick ainda é convertida para os eixos digitais do jogo.
- [ ] Validar os novos controles e desempenho em aparelhos físicos, incluindo Safari no iOS.
- [ ] Ajustes de volume, bindings de controles, acessibilidade e penalidade de morte configurável.
- [x] Migrações reais e testadas do IndexedDB e payload de save das versões 1 e 2 para 3.
- [ ] Exportação/importação e múltiplos slots de save.
- [ ] Validar mais extensamente gamepad/input, retorno aos três pontos de pouso e restauração em caves profundas.
- [ ] Validar aquisição de todos os upgrades e missões 5–6 integralmente pelo navegador, sem preparação de inventário.
- [ ] Perfil de memória e benchmarks reais de 60/30 FPS; considerar pool de partículas e workers conforme medições.
- [ ] Dividir bundle Phaser e testar carregamento em redes/dispositivos lentos.
- [ ] Balanceamento longo de sobrevivência, combustível e crafting em diferentes seeds.

### Limitações conhecidas

- A largura horizontal do terreno é gerada sob demanda; a profundidade é limitada a 64 tiles. A camada inferior não é minerável.
- A nave permanece acessível na posição de pouso. A cabine é uma interface com representação visual, conforme permitido no pedido.
- Os três pontos de pouso usam coordenadas diferentes do mesmo terreno; não existem planetas esféricos percorríveis.
- O mapa usa uma estrela no máximo por setor ocupado; não há sistemas múltiplos no mesmo setor nesta alpha.
- Asteroides são determinísticos e removidos persistem, mas seu dano de mineração parcial é volátil.
- O tempo não avança durante menus, pausa ou órbita. A recuperação solar é uma ação explícita que avança o relógio, sem espera real de 60 segundos.
- Não há multiplayer, servidor, telemetria nem serviços externos em runtime.
- A capacidade de armazenamento depende do navegador; erros de IndexedDB aparecem no rodapé.
- A auditoria inicial apontou falhas críticas no executor de testes antigo, corrigidas atualizando Vitest. Permanecem avisos moderados transitivos nas ferramentas de lint (minimatch); não integram o bundle de produção.

### Próximo marco

Separar os dois inventários, integrar Arcade aos corpos, ampliar o teste de navegador para upgrades/salto e executar um percurso de longa duração em dispositivo móvel antes de declarar a V1 concluída.

## Publicação no GitHub Pages

- Adicionado `.github/workflows/pages.yml` com instalação via lockfile, lint, testes, build e deploy do artefato `dist/`.
- Caminho-base do Vite calculado pelo `configure-pages`, respeitando o domínio personalizado ou o subdiretório do repositório.
- A configuração anterior apontava para GitHub Actions, mas não havia workflows nem execuções; o domínio retornava HTTP 404.

## Correção de jogabilidade móvel

- HUD móvel próprio com barras compactas e ferramentas acessíveis; diário de missão fechado por padrão, acessível pelo botão de diário.
- Gameplay ocupa o viewport dinâmico, respeita safe areas e não depende de tela cheia do navegador. Cabeçalho, rodapé e HUD de desktop não ocupam a área móvel durante a partida.
- Canvas expande a área de mundo visível para a proporção disponível; câmera, fundo, partículas, seleção de blocos e culling do terreno usam as dimensões reais.
- Joystick com captura de ponteiros e botões de pelo menos 44 px para frear, minerar, pular e interagir. Soltar um botão não cancela o outro dedo.
- Painéis rolam internamente; orientação pode mudar sem recriar a partida. Tooltip de salvamento preservado e reposicionado para não cobrir os controles.
- Teste móvel dedicado usa contatos de toque reais na emulação Chromium, exercita o ciclo até mineração/pulo e verifica tamanhos de 844×280 a 320×568. Isso não substitui teste em Safari físico.

## Árvores e construção — alpha 0.2

- Seis famílias de árvores por bioma com posição, altura, paleta e variante determinísticas. Cortar com a multitool coleta madeira; somente árvores removidas são registradas no save.
- Oficina de campo e receitas à mão para blocos, paredes, escadas reversíveis e armários. Construção e desmontagem por célula, com custo/devolução de itens, prévia, alcance, suporte e proteção contra fechamento sobre o astronauta ou bloqueio da saída da nave.
- Camadas separadas para paredes de fundo e peças. Pisos colidem; escadas permitem subir nas duas direções; móveis e paredes de fundo não bloqueiam a caminhada. Só construções visíveis são renderizadas.
- Armários com 16 slots, interface de depósito/saque de 1, 10 ou todos, validação de capacidade e proteção contra desmontagem com conteúdo. Cada armário é vinculado ao seu planeta e coordenada.
- Saves versão 1 migram automaticamente para a versão 2 no mesmo banco. Seed, terreno alterado, inventários e progressão anteriores são preservados. Todos os eventos novos usam o salvamento atual e o tooltip de confirmação.
- Teste de navegador constrói com materiais coletados, guarda itens, sobe escadas e recupera o mundo após reload. Emulação móvel também fabrica e coloca bloco por toque. Testes de lógica cobrem retorno após saltos, isolamento entre planetas e migração real do banco.
- Portas e pressurização implementadas na alpha 0.3; continuam pendentes outros móveis, casas extensas e validação em Safari físico.

## Localização de bases e armazenamento

- Catálogo **Bases e depósitos** no mapa galáctico, com acesso também pela cabine e pelos armários.
- Consulta derivada exclusivamente das construções/armários do save: planeta, sistema, setor, recursos/quantidades, armários vazios e ocupados, coordenadas e pouso mais próximo. Nenhuma alteração no schema de save.
- Busca por nome/recurso e filtro de planetas com itens. Marcadores diferentes para sistemas com estoque e bases sem estoque; Localizar centraliza e seleciona o sistema sem mover a nave ou consumir combustível.
- Órbita mostra o resumo da base do planeta e indica zonas de pouso mais próximas dos armários.
- Consulta remota não expõe transferência de recursos; a regra de proximidade física permanece.
- Testes de índice, seeds com ':', coordenadas negativas, atualização reativa, leitura após reload, isolamento da carga da nave e cenários móveis de navegação. O percurso de construção com materiais coletados também verifica seus itens no catálogo.

## Portas e suporte de vida — alpha 0.3

- Porta de madeira de 1×2 células com colisão fechada, passagem aberta, interação por E/toque e impedimento de fechamento sobre o personagem. Demolição pela célula superior devolve uma única porta.
- Placas solares recebem luz do ciclo dia/noite, verificam obstruções e abastecem apenas o gerador mais próximo até 12 blocos. Energia não é duplicada entre geradores.
- Gerador elétrico de O₂ com capacidades reais de 100 para energia e oxigênio; consome energia para produzir e abastecer o traje. Componentes/peças têm receitas e consumo de materiais.
- Vedação por busca limitada ao cômodo: piso, teto, laterais, portas fechadas e paredes de fundo. Furos e portas abertas impedem a recarga; um gerador não atende outra sala isolada.
- Cache de topologia invalidado por obras, mineração e portas; produção ao retornar a um planeta integrada por tempo de jogo sem simular cada segundo. Pausar ou fechar o navegador não cria produção por tempo real.
- HUD e oficina mostram estado da casa, luz, energia e reserva de O₂. Estado da porta e reservas por gerador são persistidos no save v3, com migração das versões anteriores mantendo bases e armários.
- Testes de lógica, persistência, v2→v3 e percurso móvel pela interface cobrem abrir/entrar/fechar, recarga efetiva e recuperação após reload.
- A recarga de O₂ não fornece proteção térmica adicional; permanece a regra do escudo contra temperaturas extremas.

## Correção do Espaço no desktop

- Reproduzida a falha no navegador: o bloqueio de rolagem em captura marcava o evento como tratado antes de o KeyboardManager do Phaser recebê-lo.
- O preventDefault agora ocorre depois da leitura do Phaser, mantendo a proteção contra rolagem e ativação involuntária de botões durante o jogo.
- Pulos por teclado usam o mesmo mecanismo de pulsos do toque para reconhecer pressionamentos rápidos entre frames. Uma tolerância de 120 ms preserva o comando logo antes da aterrissagem, sem criar pulos automáticos depois de quedas longas.
- `npm run test:jump` verifica pulo normal/rápido, repetição após aterrissar, foco no HUD e retomada do save. Sem alteração no schema ou no progresso salvo.

## Economia galáctica e frota

- Novas partidas começam com 500 CR. Saves v1, v2 e v3 migram para v4 no mesmo banco IndexedDB, com 500 CR e a Sparrow original. O mundo, as bases, a carga e as melhorias existentes seguem com a partida.
- O sistema inicial sempre tem uma estação. Outros sistemas recebem estações por seed, sem alterar os planetas gerados anteriormente. O mapa usa ▣ para indicar estações. Em voo, o HUD mostra direção e distância. Use E ou **Interagir** a até 115 km, com velocidade de até 35 km/s. **Desacoplar** retorna ao voo.
- O mercado negocia dez recursos por quantidade. Cada estação tem estoque próprio, com 120 unidades iniciais por recurso e preços fixos de compra e venda. A oficina repara o casco a 3 CR por ponto e abre fabricação e melhorias. O abastecimento vende até 20 unidades por operação a 2 CR por unidade.
- A concessionária oferece sete modelos filtráveis: uso geral (Sparrow MK-I e Atlas C-2), combate (Viper X e Bastion G-7) e mineração (Prospector P-1, Titan M-4 e Mammoth M-9). As compras entram no hangar da estação. A troca guarda a nave anterior no mesmo local com carga, combustível, casco e melhorias próprios. O preço de revenda depende do casco. Para vender uma nave, selecione outra como ativa e esvazie a carga da nave a vender.
- O hangar lista naves locais e remotas. Só é possível ativar, vender e transferir carga de uma nave na estação onde ela está guardada. Melhorias de salto precisam estar instaladas na nave ativa. A Titan inclui laser avançado de fábrica.
- As operações comerciais gravam a partida completa antes de confirmar a mudança na tela. Se a gravação falhar, o saldo, a carga, a frota e o estoque ficam como estavam. Um bloqueio impede operações concorrentes na mesma sessão.
- Teste local em `http://localhost:4173/`. Os testes de economia cobrem validações, falha de gravação, concorrência, limites, migração e persistência. `npm run test:economy` cobre venda, compra, troca, transferência e retomada em Chromium desktop e mobile com toque.

| Arquivos                                                                                                                                                                              | Alterações                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `src/economy/market.ts`                                                                                                                                                               | Catálogo, preços, estoques e validação das compras e vendas.                             |
| `src/fleet/models.ts`, `src/fleet/hangar.ts`                                                                                                                                          | Modelos, sprites, identificação, localização, revenda, troca e transferência de carga.   |
| `src/game/types.ts`, `src/persistence/database.ts`, `src/persistence/migrations.ts`                                                                                                   | Tipos e migração do save para v4.                                                        |
| `src/stores/game.ts`, `src/universe/generator.ts`, `src/game/scenes/WorldScene.ts`                                                                                                    | Transações persistentes, acoplagem, geração procedural, atributos de voo e renderização. |
| `src/components/StationPanel.vue`, `MarketPanel.vue`, `DealershipPanel.vue`, `HangarPanel.vue`, `ShipSprite.vue`                                                                      | Serviços da estação, mercado, concessionária, frota, transferência e prévias.            |
| `src/app/App.vue`, `src/app/economy.css`, `src/main.ts`, `src/components/MobileHud.vue`, `GalaxyMap.vue`, `InventoryPanel.vue`, `CraftingPanel.vue`                                   | HUD, mapa, layout, identificação da nave ativa e acesso à fabricação na estação.         |
| `src/tests/economy.test.ts`, `catalog.test.ts`, `construction.test.ts`, `habitat.test.ts`, `scripts/economy-smoke.mjs`, `construction-smoke.mjs`, `habitat-smoke.mjs`, `package.json` | Testes de economia e compatibilidade com o save v4.                                      |

O jogador pode comprar um cargueiro, mantê-lo no hangar e continuar explorando com sua nave ativa. Naves guardadas também podem receber pilotos NPC para rotas comerciais.

### Validação desta atualização

- ESLint, TypeScript e build de produção passaram. Os 91 testes automatizados passaram.
- Chromium desktop e mobile com toque completaram acoplagem, venda de carga preparada, compra da Atlas, transferência, troca, reload e desacoplagem. O hangar foi verificado em 320×568, 390×780 e 844×390.
- Saves v4 locais gravados antes da inclusão da frota são completados na leitura, preservando saldo, carga e progresso. A retomada na superfície foi reproduzida e validada no navegador.
- O teste de regressão completou pilotagem, órbita, pouso, mineração real, fabricação, reparo, decolagem e retomada da partida. A verificação móvel foi feita por emulação Chromium.

## Pilotos NPC e rotas comerciais

- No hangar, contrate um piloto por 100 CR para uma nave guardada. Selecione uma estação dentro do alcance, recurso e quantidade. O contrato mostra custo da mercadoria, frete com combustível, recebimento, lucro e duração.
- O piloto compra o lote na origem, entrega ao destino e retorna ao hangar. A entrega repõe o estoque no destino e paga uma vez. A nave fica indisponível para troca, venda e transferência durante a rota. A nave ativa continua livre para explorar.
- A repetição é opcional. Ela para após a viagem corrente quando solicitada, ou ao faltar saldo, estoque ou capacidade. O tempo avança durante o jogo. A contratação, a viagem em curso e os pagamentos usam o save existente.
- Implementação em `src/fleet/pilots.ts`, `src/components/PilotPanel.vue`, integração com o hangar e o relógio do jogo. Validação de contratação, frete, pagamento, bloqueio de nave, repetição e persistência em `src/tests/pilots.test.ts`. Fluxo com retomada de viagem verificado em Chromium desktop e mobile emulado.

## Alimentação e fauna planetária

- Os seis biomas têm frutas próprias e fauna pacífica e agressiva. Frutas são coletadas por clique/toque. A multitool atinge animais próximos e a caça rende carne crua. Predadores perseguem e ferem o astronauta quando o caminho está livre.
- A fogueira é fabricada na oficina de campo com 4 madeiras e 2 ferros. Depois de instalada, interaja por E ou toque para transformar carne crua em carne assada.
- A fome parte de 100%, cai durante a simulação e causa dano quando chega a zero. Fruta, carne crua e carne assada restauram 18, 8 e 35 pontos respectivamente, pela tela de carga. Saves anteriores começam com a barra cheia.
- Fome, fogueiras, comida e tempos de retorno da fauna e das frutas são salvos. Frutas voltam após 3 minutos de jogo e animais após 5. O teste de navegador cobre coleta, caça, fabricação, instalação, preparo e alimentação no desktop e celular emulado.

## Expansão Galáctica V2.0 · etapas 1 a 3

- **Carreiras:** Explorador, Minerador e Pirata têm XP, níveis e patentes independentes. Limite atual de 30, com curva calculada até 100. O mapa mostra as barras de XP, patentes, estatísticas, histórico e contratos ativos. A carreira Pirata está preparada para receber eventos da etapa de combate.
- **Exploração:** o primeiro pouso ou scan válido cataloga cada planeta uma vez. Saltos inéditos, anomalias e ruínas procedurais também rendem XP. O scanner mostra atmosfera e recursos dos planetas registrados, sinais dentro do alcance e veios reais de titânio e cristal. As estações compram cada conjunto de dados uma vez e o registro permanece consultável.
- **Mineração:** XP é concedido após extração bem-sucedida de terreno natural ou asteroide, primeira extração de um depósito raro por região e lote de combustível refinado. As vantagens reduzem o custo de energia e o intervalo de mineração planetária em até 20%.
- **Contratos:** estações oferecem levantamentos científicos e fornecimento de recursos. O quadro permite aceitar, acompanhar, entregar na estação emissora ou abandonar. Níveis profissionais liberam dificuldades superiores. Entrega, XP, créditos e estado de recompensa são gravados juntos.
- **Compatibilidade:** o save recebe o campo de progressão ao carregar, sem trocar o banco IndexedDB ou alterar naves, saldo ou carga. Testes de regressão cobrem duplicação, migração e retomada. O índice do planeta também é redefinido antes das coordenadas no salto, para evitar um índice inválido ao chegar a um sistema com menos planetas.

| Arquivos                                                                                                                                 | Alterações                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `src/progression/careers.ts`, `exploration.ts`, `contracts.ts`                                                                           | Curva e patentes, registro científico, ofertas e transações de contratos.                             |
| `src/stores/game.ts`, `src/game/scenes/WorldScene.ts`, `src/game/types.ts`, `src/persistence/migrations.ts`                              | Pontos de entrada de mineração, salto, scanner e pouso, sinais renderizados e progressão persistente. |
| `src/components/GalaxyMap.vue`, `CareerProgress.vue`, `ScannerPanel.vue`, `ScienceJournal.vue`, `ContractsBoard.vue`, `StationPanel.vue` | Painéis acessíveis no mapa e serviços funcionais nas estações.                                        |
| `src/tests/careers.test.ts`, `src/tests/contracts.test.ts`                                                                               | Curva, atividades reais, venda única, geração, entrega e persistência.                                |

**Validação:** lint, TypeScript, build e 110 testes passaram. Chromium validou catalogação, venda de dados e painel profissional em desktop e celular de 320 px. O contrato de fornecimento passou no desktop e celular horizontal, da aceitação ao recebimento. A regressão existente passou com mineração real, fabricação, decolagem e retomada.

**Próxima etapa:** NPCs espaciais, armas, combate, destroços, saque e contrabando. Jurisdições, registros criminais, as 20 naves e o balanceamento de longo prazo seguem pendentes. A expansão está em teste local.

## Expansão Galáctica V2.0 · etapa 4: pirataria

- Cargueiros, mineradoras, escoltas e corsários têm IDs estáveis por sistema. Cargueiros e mineradoras fogem sob ataque. Escoltas e corsários podem perseguir e disparar.
- **F** no PC ou **Atirar** no celular dispara projéteis com mira assistida até 340 km. A mineração mantém seu controle. O dano passa pelos escudos antes de reduzir o casco de um NPC.
- Destruir uma nave deixa um destroço persistente. **E** ou **Saquear** recolhe a carga até 95 km e a 50 km/s ou menos, se houver espaço. Cada destroço só pode ser saqueado uma vez, inclusive após reload.
- A estação inicial e parte das demais têm mercado clandestino. Vendas e contratos de contrabando pagam CR e XP de Pirata. O nível melhora a cotação e desbloqueia contratos avançados.
- Implementação em `src/combat/flight.ts`, `src/combat/traffic.ts`, cena de voo, HUD e controles de toque, `BlackMarket.vue` e quadro de contratos. Lint, TypeScript, build e 113 testes passaram. Chromium validou disparo, destruição, saque e venda em desktop e celular emulado.
- **Próxima etapa:** jurisdições, registro criminal, procurado, patrulhas policiais, caçadores de recompensa e regularização. A expansão de 20 naves e o balanceamento também seguem pendentes.

## Expansão Galáctica V2.0 · autoridades e procurado

- Cargueiros, mineradoras e escoltas circulam pelos sistemas. Corsários NPC aparecem apenas nos sistemas com mercado clandestino, marcados com ◆ no mapa.
- Patrulhas aparecem em sistemas vigiados e perseguem a partir de procurado 2. Caçadores entram a partir do nível 4. No nível 5, chegam interceptores de elite e a estação local bloqueia a acoplagem.
- Ataques e destruição de naves registram sistema, facção, horário, detecção, multa, recompensa e ID da nave usada. O alerta e a perseguição são exclusivos do sistema do crime, inclusive entre sistemas da mesma facção. O mapa marca os sistemas procurados e o nível ativo. As multas continuam vinculadas à facção. O alerta pode baixar com o tempo, mas as dívidas permanecem até a regularização. A carreira Pirata mantém seu XP.
- O registro está no mapa e nas estações. É possível pagar multas da jurisdição em uma estação acessível. Os dados persistem no save, inclusive ao trocar de nave.
- Implementação em `src/combat/law.ts`, `flight.ts`, `traffic.ts`, `CriminalRecord.vue`, mapa, HUD e store. Os 116 testes, lint, TypeScript e build passaram. Chromium validou mobilização, consulta e pagamento em desktop e celular.
- Pendentes nesta frente: inspeções de carga, entrega voluntária, negociação clandestina e o aprofundamento de reputação e registros das naves. As 20 naves novas e o balanceamento de longo prazo continuam nas próximas etapas.

## 2026-11-17 · Alimentador automático do traje

- Receita na bancada da nave: 3 placas metálicas, 2 circuitos básicos e 1 célula energética. O equipamento é instalado no traje pelo inventário.
- Reserva de um tipo de alimento, limitada a 100 unidades, com abastecimento/retirada em 1, 10 ou todos. Transferências preservam a validade da carne; desequipar exige reserva vazia e espaço para guardar o equipamento.
- Com fome ativa e abaixo de 30%, consome até 100% ou esgotar a reserva. Mantém risco de intoxicação da carne crua, persistência e perda/recuperação dos alimentos conforme as regras de sobrevivência existentes.
- Arquivos: tipos e arte dos itens, receitas, inventário, store do jogo, perecíveis e novos módulos/testes de alimentador.
- Verificação: 228 testes passaram; TypeScript, ESLint e build de produção passaram. Interface ainda sem teste manual em navegador.

## 2026-11-17 · Cartuchos reutilizáveis e oxigênio automático

- Cartucho vazio fabricado com 4 placas metálicas. Sem venda de cartuchos nas estações.
- Interagir com gerador normal ou planetário abre o abastecimento. O normal consome 100 O₂ da reserva; o planetário exige funcionamento ativo e consome 10 de energia da bateria conectada. A operação valida recipiente, recursos e capacidade antes de alterar qualquer estado.
- Novo reabastecedor do traje (3 placas, 2 circuitos, 1 célula): comporta 10 cartuchos, usa um cheio abaixo de 30% de O₂ e completa até 100%, preservando o recipiente vazio para reutilização. Gerenciamento pelo inventário, incluindo retirada dos vazios. Respeita a opção de consumo de oxigênio.
- Reserva persistida no save e sujeita às regras de morte/recuperação existentes, como o alimentador.
- Arquivos: tipos/arte, receitas, inventário, store de jogo/construção, App, novo painel de abastecimento, lógica e testes de cartuchos.
- Verificação: 234 testes, ESLint, TypeScript e build passaram. Sem teste manual em navegador nesta etapa.

### Abastecimento animado dos cartuchos

- Encher um cartucho agora leva 10 segundos, com ilustração animada do gerador enviando oxigênio ao recipiente, nível crescente, bolhas, porcentagem e barra de progresso no painel responsivo.
- Impede iniciar processos duplicados. Fechar, pausar, afastar-se ou remover o gerador cancela sem consumir recursos; valida novamente recipiente, capacidade, energia e reserva antes da entrega final.
- Testes verificam duração, consumo único e cancelamentos. Verificação completa: 239 testes, ESLint, TypeScript e build de produção.

### Correção de NaN no abastecimento durante atualização local

- Progresso ausente/inválido agora é tratado como inativo, sem NaN nem botão travado. O store de construção passa a aceitar atualização a quente via Pinia, evitando manter métodos antigos com o painel atualizado.
- Testes cobrem valores inválidos de progresso e dois abastecimentos completos consecutivos, além das validações anteriores (12 testes de cartuchos).
- ESLint, TypeScript e build de produção verificados.

## 2026-11-18 · Botão Andar na exploração móvel

- Joystick da superfície substituído por botão Andar: mantém avanço enquanto pressionado e para ao soltar, cancelar o toque ou perder captura. Permite olhar arrastando a tela com outro dedo.
- Pular e Interagir continuam à direita; controles dos outros ambientes preservados. Pausa, mudança de ambiente, aba sem foco e desmontagem limpam o movimento para evitar personagem andando sozinho.
- Verificação: ESLint, TypeScript e build passaram. Chromium móvel validou retrato/paisagem, pressionar/soltar, câmera com dois dedos, parada na pausa e joystick espacial. Teste reproduzível em scripts/touch-walk-smoke.mjs.

## 2026-11-18 · Pilotagem móvel por botão e arrasto

- Nave comum e colossal usam botão Acelerar no lugar do joystick. Segurar mantém propulsão; soltar interrompe o impulso, preservando o embalo e o botão Frear.
- Arrastar no cenário controla a direção, com giro suavizado e limitado por quadro e resposta mais pesada na colossal. Na nave comum, o arrasto vertical controla a inclinação 3D. Interiores continuam com o joystick de caminhada.
- Corrigida a exibição dos botões de pilotagem durante o comando da colossal. Cancelamento de toque e perda de foco limpam a entrada.
- Verificação: 242 testes, ESLint, TypeScript e build passaram; teste Chromium móvel cobre superfície, nave comum e colossal, incluindo dois dedos simultâneos, retrato/paisagem e soltar os controles.

## 2026-11-18 · Janelas e antecâmaras das bases

- Janela vedada construível (2 silícios + 1 placa metálica), com vidro transparente de ambos os lados, moldura e fixações metálicas, rotação, colisão e vedação. Só ocupa vão livre, sem terreno, parede ou bloco; também impede sobrepor uma parede ao vidro.
- Porta de antecâmara (4 placas + 1 circuito), com modelo metálico de duas folhas, indicadores e abertura. Duas portas alinhadas no mesmo piso, até 5 blocos, formam um par: abrir uma fecha a outra antes, sem fechar sobre o jogador. Pares não compartilham portas.
- Integrados ao construtor, receitas de superfície, ícones, alcance, montagem/remoção, colisão, análise dos cômodos, interação no celular/PC e persistência existente. Guia do construtor explica montagem da câmara fechada entre as portas.
- Testes cobrem janela nos quatro ângulos, rejeição de sobreposições, remoção, transparência, colisão, pressão da sala/câmara, intertravamento e save. 254 testes passaram, além de ESLint, TypeScript e build. Sem teste manual em navegador nesta etapa.

## 2026-11-18 · Holofotes e sinalização de emergência

- Holofote construível (2 placas metálicas, 2 cobres, 1 circuito e 1 cristal), girável, com pedestal, lente emissiva e feixe real de luz no terreno. Consome 2 de energia por segundo de placas expostas ou baterias a até 12 blocos.
- Iluminação de emergência (1 placa, 1 circuito e 1 célula) montável nas bases junto às saídas. Reserva própria começa vazia, carrega em 2 minutos de rede e dura 20 minutos ativos no apagão; sinal verde e luz local acendem automaticamente. A carga persiste e não é recriada ao desmontar/reinstalar.
- Rede compartilha energia sem duplicar produção e prioriza suporte de vida/refrigeração. Holofote desliga quando não há alimentação. Interagir mostra alimentação e reserva; os itens estão no construtor e usam inventário e save existentes.
- Renderização usa grupos de luzes reutilizados e limitados às proximidades para reduzir custo no celular, sem mapas de sombra adicionais. Alinhamento das novas peças de painel corrigido em relação à colisão.
- Testes: consumo e esgotamento, divisão de energia, alcance, sol/noite, recarga e ativação de reserva, persistência, montagem/remoção e iluminação 3D. 262 testes, ESLint, TypeScript e build passaram. Sem teste manual em navegador nesta etapa.
