# Progresso — Voidbound

## Entrega atual: alpha 0.1 / ciclo vertical completo

A alpha é jogável; **não representa a conclusão da V1 solicitada**. O plano abaixo diferencia implementação de validação. Não foi feita publicação externa.

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

- [x] Build de produção, incluindo verificação TypeScript; 16 testes automatizados passaram.
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
- [ ] Adicionar luas, eventos de exploração, estruturas construíveis e colocação de blocos.
- [ ] Vegetação e formações geológicas específicas de cada bioma; árvores e água com interação própria.
- [ ] Refinar distribuição de minérios por profundidade e classe estelar; ampliar diferenças de atmosfera/perigos.
- [ ] Física de movimento e colisão atual é resolvida por código na cena. Arcade está configurado, mas ainda precisa ser integrado aos corpos e colisores.
- [ ] Extrair atualização física e renderização da cena em sistemas menores conforme o conteúdo crescer.
- [ ] Melhorar animações de caminhada, descida e decolagem; estrelas com mais variedade e luz local.
- [ ] Escalonamento inteiro no desktop; atualmente Phaser FIT e nearest-neighbor mantêm bordas sem suavização, mas a escala pode ser fracionária.
- [ ] Joystick analógico de toque; os controles atuais são direcionais digitais. Validar toque em aparelhos reais e orientação horizontal.
- [ ] Ajustes de volume, bindings de controles, acessibilidade e penalidade de morte configurável.
- [ ] Migrações reais quando houver uma segunda versão do schema; exportação/importação e múltiplos slots de save.
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
