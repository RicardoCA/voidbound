# Progresso — Voidbound

## Entrega atual: alpha 0.3 / casas com suporte de vida

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
