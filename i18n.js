/* i18n.js -- the interface in more than one language.

   The dictionary is keyed by the English string itself rather than by a
   code, so nothing has to be threaded through the rest of the editor
   and a string with no translation simply stays as it is. That is the
   safety property worth keeping: a run of text is replaced only when it
   matches a key exactly, so a file name, a hex colour or a number is
   never touched by accident.

   Two sweeps keep it applied. One walks the document when the language
   changes. The other is a MutationObserver, because most of this
   interface is built at run time -- the tab list, the panels -- and
   those nodes have to be translated as they appear rather than only at
   load.

   This file is written in ASCII with \u escapes, because the scripts
   here are served without a charset and the accented characters would
   arrive broken otherwise. Write the Portuguese normally and run
   python/ascii_escape.py over the file; it is the same reason
   gifenc.js carries escapes. */

const I18N_LANGS = [
  ['en', 'English'],
  ['pt-BR', 'Portugu\u00eas do Brasil']
];

const I18N = {
  'pt-BR': {
    /* ---- the action bar */
    'Open\u2026': 'Abrir\u2026',
    'New sprite': 'Novo sprite',
    'Close all': 'Fechar tudo',
    'Save .bin': 'Salvar .bin',
    'Edit texture\u2026': 'Editar textura\u2026',
    'Replace texture\u2026': 'Trocar textura\u2026',
    'Save .GIF': 'Salvar .GIF',
    'Save UV .PNG': 'Salvar UV .PNG',
    'Export .OBJ': 'Exportar .OBJ',
    'Import .OBJ\u2026': 'Importar .OBJ\u2026',
    'Save sprite': 'Salvar sprite',
    'Edit frame\u2026': 'Editar quadro\u2026',
    'Import image\u2026': 'Importar imagem\u2026',
    'Save frame .PNG': 'Salvar quadro .PNG',
    'Save strip .PNG': 'Salvar tira .PNG',
    'Apply': 'Aplicar',
    'Cancel': 'Cancelar',
    'Model panel': 'Painel do modelo',
    'Tutorial': 'Tutorial',
    'Settings': 'Configura\u00e7\u00f5es',
    'Close': 'Fechar',
    'Save': 'Salvar',
    'Create': 'Criar',

    /* ---- the empty state */
    'no file open': 'nenhum arquivo aberto',
    'Drop a file here, or click to choose one':
      'Solte um arquivo aqui, ou clique para escolher',
    'meshes \u2014 3D view, textures, skeleton, dress-up':
      'malhas \u2014 vis\u00e3o 3D, texturas, esqueleto, vestir',
    'sprites \u2014 frame playback, recolouring, pixel editing':
      'sprites \u2014 anima\u00e7\u00e3o, recolorir, editar pixel',
    'geometry \u2014 in and out of any modeller':
      'geometria \u2014 entra e sai de qualquer modelador',

    /* ---- panels */
    'Layers': 'Camadas',
    'Add': 'Adicionar',
    'Merge down': 'Mesclar abaixo',
    'Delete': 'Excluir',
    'Brush': 'Pincel',
    'colour': 'cor',
    'size': 'tamanho',
    'zoom': 'zoom',
    'mirror': 'espelho',
    'off': 'desligado',
    'left and right': 'esquerda e direita',
    'top and bottom': 'cima e baixo',
    'both': 'ambos',
    'show the frames either side': 'mostrar os quadros ao lado',
    'Recently used': 'Usadas recentemente',
    'Reserved colours': 'Cores reservadas',
    'Frames': 'Quadros',
    'Prev': 'Anterior',
    'Play': 'Tocar',
    'Pause': 'Pausar',
    'Next': 'Pr\u00f3ximo',
    'speed': 'velocidade',
    'Add frame': 'Novo quadro',
    'Duplicate': 'Duplicar',
    'Colours': 'Cores',
    'apply to every frame': 'aplicar em todos os quadros',
    'replace the selected colour with': 'trocar a cor escolhida por',
    'Remap colour': 'Trocar a cor',
    'hue': 'matiz',
    'deg': 'graus',
    'sat': 'satura\u00e7\u00e3o',
    'lum': 'brilho',
    'Shift all colours': 'Deslocar todas as cores',
    'Sprite': 'Sprite',
    'Team preview': 'Pr\u00e9via de time',
    'white': 'branco',
    'black': 'preto',
    'red': 'vermelho',
    'blue': 'azul',
    'green': 'verde',
    'yellow': 'amarelo',
    'Textures': 'Texturas',
    'Create and transform': 'Criar e transformar',
    'Start a shape': 'Come\u00e7ar uma forma',
    'sides': 'lados',
    'height': 'altura',
    'Move this mesh': 'Mover esta malha',
    'Turn X': 'Girar X',
    'Turn Y': 'Girar Y',
    'Turn Z': 'Girar Z',
    'Mirror X': 'Espelhar X',
    'Mirror Y': 'Espelhar Y',
    'Mirror Z': 'Espelhar Z',
    'raise': 'levantar',
    'Centre on X and Z': 'Centralizar em X e Z',
    'Drop to the floor': 'Descer at\u00e9 o ch\u00e3o',
    'Motion': 'Movimento',
    'Stop': 'Parar',
    'Bind pose': 'Pose de descanso',
    'frame': 'quadro',
    'loop': 'repetir',
    'Pose a bone': 'Posar um osso',
    'bone': 'osso',
    'swing': 'balan\u00e7o',
    'lift': 'erguer',
    'twist': 'torcer',
    'Straighten this bone': 'Endireitar este osso',
    'Keep a pose': 'Guardar uma pose',
    'Save as .json': 'Salvar como .json',
    'Load a motion\u2026': 'Carregar um movimento\u2026',
    'View': 'Vis\u00e3o',
    'Face': 'Rosto',
    'Front': 'Frente',
    'Back': 'Costas',
    'Left': 'Esquerda',
    'Right': 'Direita',
    'Top': 'Cima',
    'Whole': 'Inteiro',
    'Display': 'Exibi\u00e7\u00e3o',
    'Texture': 'Textura',
    'Wireframe': 'Arame',
    'Normals': 'Normais',
    'Skeleton': 'Esqueleto',
    'Axes': 'Eixos',
    'Spin': 'Girar',
    'Dress-up': 'Vestir',
    'Properties': 'Propriedades',
    'Container': 'Cont\u00eainer',
    'Mesh': 'Malha',
    'Texture names': 'Nomes das texturas',
    'Materials': 'Materiais',
    'Health': 'Sa\u00fade',
    'Geometry notes': 'Notas de geometria',
    'Format': 'Formato',
    'Model': 'Modelo',
    'fit': 'ajustar',
    'New sprite sheet': 'Nova folha de sprite',
    'width': 'largura',
    'frames': 'quadros',
    'Save as .GIF': 'Salvar como .GIF',

    /* ---- the effect view */
    'The effect, as the game draws it': 'O efeito, como o jogo desenha',
    'alpha table': 'tabela de alfa',
    'behind': 'atr\u00e1s',
    'Player': 'Jogador',
    'Item': 'Item',
    'dark': 'escuro',
    'light': 'claro',
    'nothing': 'nada',

    'An effect frame is <b>eight layers</b>, each composited at its own transparency. The frame list below shows those layers one by one, which is what you paint; this is the eight of them together, which is what a player sees. The game also doubles the pixels across, so it is softer here than the runs are.':
      'Um quadro de efeito tem <b>oito camadas</b>, cada uma composta na sua pr\u00f3pria transpar\u00eancia. A lista de quadros abaixo mostra essas camadas uma a uma, que \u00e9 o que voc\u00ea pinta; aqui est\u00e3o as oito juntas, que \u00e9 o que o jogador v\u00ea. O jogo tamb\u00e9m dobra os pixels na horizontal, ent\u00e3o aqui fica mais suave do que as corridas s\u00e3o.',
    /* ---- the drop-downs in the action bar */
    'New': 'Novo',
    'Export': 'Exportar',

    /* ---- the words the sheet tables carry, which the panels and the
       set view both print */
    'Walk': 'Andando',
    'Stand': 'Parado',
    'Throw': 'Arremesso',
    'Stunned': 'Atordoado',
    'Death': 'Derrota',
    'Victory': 'Vit\u00f3ria',
    'Teleport': 'Teleporte',
    'Revenge cart': 'Carrinho da vingan\u00e7a',
    'Louie walk': 'Montado andando',
    'Louie stand': 'Montado parado',
    'Room preview': 'Pr\u00e9via da sala',
    'Portrait': 'Retrato',
    'front': 'frente',
    'left': 'esquerda',
    'back': 'costas',
    'right': 'direita',
    'the player moves': 'o jogador se move',
    'the player is still': 'o jogador est\u00e1 parado',
    'throwing a bomb with the glove': 'joga a bomba com a luva',
    'a flying bomb landed on this square':
      'uma bomba voando caiu nesta casa',
    'punching the bomb in front': 'soca a bomba da casa da frente',
    'the player died': 'o jogador morreu',
    'the player won the round': 'o jogador ganhou a rodada',
    'entering the round, and teleporting':
      'entra na rodada e passa por teleporte',
    'dead, riding the cart around the edge':
      'morto, andando no carrinho pela borda',
    'walking while mounted': 'anda montado',
    'standing while mounted': 'parado montado',
    'the room card, the profile and the shop':
      'o cart\u00e3o da sala, o perfil e a loja',
    'the bar at the top of a match': 'a barra do topo da partida',
    'facing the player; walks down the screen':
      'olha para quem joga; anda para baixo na tela',
    'profile, looking left': 'perfil, olhando para a esquerda',
    'back turned; walks up the screen': 'de costas; anda para cima na tela',
    'profile, looking right': 'perfil, olhando para a direita',
    'the Louie walks on your frame number':
      'o Louie anda pelo seu n\u00famero de quadro',
    'the hold on frame 0 counts by your own frame list':
      'a pausa no quadro 0 conta pela sua pr\u00f3pria lista de quadros',
    'the rider has to keep up with the Louie\u2019s 8':
      'o cavaleiro tem de acompanhar os 8 do Louie',
    'the rider has to keep up with the Louie\u2019s 3':
      'o cavaleiro tem de acompanhar os 3 do Louie',
    'the cart draws frame 0 and never any other':
      'o carrinho desenha o quadro 0 e nenhum outro',
    'the portrait is pasted as it is into a 40 x 40 slot':
      'o retrato \u00e9 colado como est\u00e1 num espa\u00e7o de 40 x 40',
    'it is a copy of st_s, which has 3': '\u00e9 uma c\u00f3pia do st_s, que tem 3',
    'the game counts on it': 'o jogo conta com isso',
    'a character': 'um personagem',
    'a bomb skin': 'uma skin de bomba',
    'the bomb resting and appearing': 'a bomba parada e aparecendo',
    'the marker where it is being placed': 'o marcador de onde ela \u00e9 posta',
    'its shadow': 'a sombra dela',
    'the fuse spark': 'a fa\u00edsca do pavio',
    'the fire at the bomb': 'o fogo na bomba',
    'the fire running across': 'o fogo correndo na horizontal',
    'the fire running up and down': 'o fogo correndo na vertical',
    'the right-hand tip': 'a ponta da direita',
    'the left-hand tip': 'a ponta da esquerda',
    'the top tip': 'a ponta de cima',
    'the bottom tip': 'a ponta de baixo',
    'a block breaking': 'um bloco quebrando',
    /* ---- the words a panel prints beside a number */
    'axis': 'eixo',
    'sole': 'sola',
    'foot': 'p\u00e9',
    'top': 'topo',
    'clock': 'rel\u00f3gio',
    'plays': 'toca',
    'facing': 'dire\u00e7\u00e3o',
    'files': 'arquivos',
    'colours': 'cores',
    'empty': 'vazio',
    'unreadable': 'ileg\u00edvel',
    'not here': 'n\u00e3o est\u00e1 aqui',
    'no pixels': 'nenhum pixel',
    'vs official': 'vs oficial',
    'slot {n}': 'slot {n}',
    'frame {i}/{n}': 'quadro {i}/{n}',
    '{n} runs': '{n} corridas',
    '{n} px': '{n} px',
    'bounds x {x0}..{x1} y {y0}..{y1}': 'limites x {x0}..{x1} y {y0}..{y1}',
    '{n} colours': '{n} cores',
    '{shown} of {all} colours': '{shown} de {all} cores',
    '{n} frame': '{n} quadro',
    '{n} frames': '{n} quadros',
    '{n}/{want} frames': '{n}/{want} quadros',
    '{have} of {want}': '{have} de {want}',
    '{here} here, {want} expected': '{here} aqui, {want} esperados',
    '{ms} ms a round, looping': '{ms} ms por volta, em la\u00e7o',
    '{ms} ms a round, once': '{ms} ms, uma vez',
    'static \u2014 the game draws frame 0 and no other':
      'est\u00e1tico \u2014 o jogo desenha o quadro 0 e nenhum outro',
    '{all} across the set, {alone} in one file only':
      '{all} no conjunto, {alone} em um arquivo s\u00f3',
    'unchanged -- writes back byte-identical ({n} bytes)':
      'sem altera\u00e7\u00e3o -- grava de volta byte a byte igual ({n} bytes)',
    'edited -- {now} bytes, was {before}':
      'editado -- {now} bytes, era {before}',
    /* ---- what the sheet checks say */
    'Nothing to flag: the counts, the size, the axis and the sole all read the way the game wants them.':
      'Nada a apontar: as contagens, o tamanho, o eixo e a sola est\u00e3o todos do jeito que o jogo quer.',
    'This is a {w} x {h} sheet, so the guides apply, but the name is not one of the 37 the loader asks for. Rename it and the frame counts, the timings and the measured medians come with it.':
      'Esta \u00e9 uma folha de {w} x {h}, ent\u00e3o as guias valem, mas o nome n\u00e3o \u00e9 um dos 37 que o carregador pede. Renomeie e as contagens de quadro, os tempos e as medianas medidas v\u00eam junto.',
    '{file} has to be {side} x {side}; this one is {w} x {h}. The game stamps the whole sheet at a fixed place, so a different size moves the character.':
      '{file} tem de ser {side} x {side}; esta \u00e9 {w} x {h}. O jogo carimba a folha inteira num lugar fixo, ent\u00e3o um tamanho diferente move o personagem.',
    '{file} needs exactly {want} frames, not {got} \u2014 {why}.':
      '{file} precisa de exatamente {want} quadros, n\u00e3o {got} \u2014 {why}.',
    '{file} usually has {want} frames; this one has {got}. Every frame costs time: the clock is fixed, so more frames is a longer animation, not a slower one.':
      '{file} costuma ter {want} quadros; esta tem {got}. Cada quadro custa tempo: o rel\u00f3gio \u00e9 fixo, ent\u00e3o mais quadros \u00e9 anima\u00e7\u00e3o mais longa, n\u00e3o mais lenta.',
    '{file} usually has {want} frames (the officials run {lo} to {hi}); this one has {got}. Every frame costs time: the clock is fixed, so more frames is a longer animation, not a slower one.':
      '{file} costuma ter {want} quadros (os oficiais v\u00e3o de {lo} a {hi}); esta tem {got}. Cada quadro custa tempo: o rel\u00f3gio \u00e9 fixo, ent\u00e3o mais quadros \u00e9 anima\u00e7\u00e3o mais longa, n\u00e3o mais lenta.',
    'while throwing the game ignores the player\u2019s direction, so {n} frames pins them for {ms} ms in the middle of a match.':
      'durante o arremesso o jogo ignora a dire\u00e7\u00e3o do jogador, ent\u00e3o {n} quadros o prendem por {ms} ms em plena partida.',
    'while punching the game ignores the player\u2019s direction, so {n} frames pins them for {ms} ms in the middle of a match.':
      'durante o soco o jogo ignora a dire\u00e7\u00e3o do jogador, ent\u00e3o {n} quadros o prendem por {ms} ms em plena partida.',
    '{n} frame is empty. The game shows it anyway, as a gap in the animation.':
      '{n} quadro est\u00e1 vazio. O jogo mostra assim mesmo, como um buraco na anima\u00e7\u00e3o.',
    '{n} frames are empty. The game shows them anyway, as a gap in the animation.':
      '{n} quadros est\u00e3o vazios. O jogo mostra assim mesmo, como um buraco na anima\u00e7\u00e3o.',
    '{n} frame sits more than 7 px off the axis. Collision is computed from the player\u2019s square, never from the pixels, so an off-axis body looks like it walks through walls and bombs.':
      '{n} quadro est\u00e1 a mais de 7 px do eixo. A colis\u00e3o \u00e9 calculada pela casa do jogador, nunca pelos pixels, ent\u00e3o um corpo fora do eixo parece atravessar parede e bomba.',
    '{n} frames sit more than 7 px off the axis. Collision is computed from the player\u2019s square, never from the pixels, so an off-axis body looks like it walks through walls and bombs.':
      '{n} quadros est\u00e3o a mais de 7 px do eixo. A colis\u00e3o \u00e9 calculada pela casa do jogador, nunca pelos pixels, ent\u00e3o um corpo fora do eixo parece atravessar parede e bomba.',
    'the sole sits at {at} on the median frame, and the floor is {want}. Higher and the character floats over the block in front; lower and it sinks into it.':
      'a sola est\u00e1 em {at} no quadro mediano, e o ch\u00e3o \u00e9 {want}. Mais alto e o personagem flutua sobre o bloco da frente; mais baixo e ele afunda nele.',
    '{n} frame touches the edge of the sheet. That is where grid cuts show up.':
      '{n} quadro encosta na borda da folha. \u00c9 ali que os cortes de grade aparecem.',
    '{n} frames touch the edge of the sheet. That is where grid cuts show up.':
      '{n} quadros encostam na borda da folha. \u00c9 ali que os cortes de grade aparecem.',
    '{n} frame leaves the safe area (80, 88) to (176, 216). Ground animations are expected to stay inside it; death and victory are not.':
      '{n} quadro sai da \u00e1rea segura (80, 88) a (176, 216). Espera-se que as anima\u00e7\u00f5es de ch\u00e3o fiquem dentro dela; derrota e vit\u00f3ria, n\u00e3o.',
    '{n} frames leave the safe area (80, 88) to (176, 216). Ground animations are expected to stay inside it; death and victory are not.':
      '{n} quadros saem da \u00e1rea segura (80, 88) a (176, 216). Espera-se que as anima\u00e7\u00f5es de ch\u00e3o fiquem dentro dela; derrota e vit\u00f3ria, n\u00e3o.',
    'the last frame of a death never reaches the screen \u2014 the player has already turned into the cart. Draw the end of the fall on the second to last and repeat it on the last.':
      'o \u00faltimo quadro da derrota nunca chega \u00e0 tela \u2014 o jogador j\u00e1 virou carrinho. Desenhe o fim da queda no pen\u00faltimo e repita no \u00faltimo.',
    'the legs barely change between frames ({d} distinct lower silhouettes, median {med}, largest {max}; a walk passes at 8, 0.12 and 0.20). This is what reads as sliding rather than walking.':
      'as pernas quase n\u00e3o mudam entre os quadros ({d} silhuetas de baixo distintas, mediana {med}, maior {max}; uma caminhada passa com 8, 0,12 e 0,20). \u00c9 isso que se l\u00ea como deslizar em vez de andar.',
    'nothing drawn to align': 'n\u00e3o h\u00e1 nada desenhado para alinhar',
    'already on the axis and the floor': 'j\u00e1 est\u00e1 no eixo e no ch\u00e3o',
    'moved the whole sheet {dx} across and {dy} down; the sole now sits at {at} on the median frame':
      'movi a folha inteira {dx} na horizontal e {dy} na vertical; a sola agora est\u00e1 em {at} no quadro mediano',
    'moved the whole sheet {dx} across and {dy} down; the sole now sits at {at} on the median frame, and {lost} pixels fell off the sheet':
      'movi a folha inteira {dx} na horizontal e {dy} na vertical; a sola agora est\u00e1 em {at} no quadro mediano, e {lost} pixels ca\u00edram para fora da folha',
    '<b>{pct}%</b> of this sheet is in the reserved ramp ({used} of 64 steps used), so the runtime recolours it. The preview above is an approximation -- the real substitution tables are not known.':
      '<b>{pct}%</b> desta folha est\u00e1 na rampa reservada ({used} dos 64 passos usados), ent\u00e3o o jogo a recolore. A pr\u00e9via acima \u00e9 uma aproxima\u00e7\u00e3o -- as tabelas reais de substitui\u00e7\u00e3o n\u00e3o s\u00e3o conhecidas.',
    'This frame is {w}x{h}. The original authoring tool\'s manual reports a failure on frames around 60x100, and recommends staying at or under {cw}x{ch}. Files this size that shipped with the set are fine; newly grown ones may not be.':
      'Este quadro \u00e9 {w}x{h}. O manual da ferramenta original relata falha em quadros perto de 60x100, e recomenda ficar em {cw}x{ch} ou abaixo. Arquivos desse tamanho que j\u00e1 vieram com o jogo est\u00e3o bem; os que crescerem agora podem n\u00e3o estar.',
    /* ---- what the set view says */
    'The set is complete and the files agree with each other.':
      'O conjunto est\u00e1 completo e os arquivos concordam entre si.',
    'no bomb.spr. That one is the skin: without it there is nothing to put on a bomb.':
      'sem bomb.spr. Esse \u00e9 a skin: sem ele n\u00e3o h\u00e1 o que p\u00f4r numa bomba.',
    '{n} of the twelve is not here, and that is normal \u2014 what a skin lacks stays the game\u2019s own. Of the forty skins the server ships, every one has bomb.spr, thirty-one have bomb_d.spr, three have the flames and none has bomb_s.spr.':
      '{n} dos doze n\u00e3o est\u00e1 aqui, e isso \u00e9 normal \u2014 o que falta numa skin continua sendo o do jogo. Das quarenta skins que o servidor serve, todas t\u00eam bomb.spr, trinta e uma t\u00eam bomb_d.spr, tr\u00eas t\u00eam as chamas e nenhuma tem bomb_s.spr.',
    '{n} of the twelve are not here, and that is normal \u2014 what a skin lacks stays the game\u2019s own. Of the forty skins the server ships, every one has bomb.spr, thirty-one have bomb_d.spr, three have the flames and none has bomb_s.spr.':
      '{n} dos doze n\u00e3o est\u00e3o aqui, e isso \u00e9 normal \u2014 o que falta numa skin continua sendo o do jogo. Das quarenta skins que o servidor serve, todas t\u00eam bomb.spr, trinta e uma t\u00eam bomb_d.spr, tr\u00eas t\u00eam as chamas e nenhuma tem bomb_s.spr.',
    'only {n} of the seven flame pieces are here. The fire is drawn from all seven, so a partial set shows this skin\u2019s fire in some directions and the game\u2019s in others.':
      's\u00f3 {n} das sete pe\u00e7as de chama est\u00e3o aqui. O fogo \u00e9 desenhado com as sete, ent\u00e3o um conjunto parcial mostra o fogo desta skin em algumas dire\u00e7\u00f5es e o do jogo nas outras.',
    '{n} of the 37 are missing: {names}. The loader asks for every one by name.':
      '{n} dos 37 est\u00e3o faltando: {names}. O carregador pede cada um pelo nome.',
    'preview is not a copy of st_s, though frame 0 matches. Of 41 officials, 41 are an exact copy.':
      'o preview n\u00e3o \u00e9 c\u00f3pia do st_s, embora o quadro 0 bata. De 41 oficiais, 41 s\u00e3o c\u00f3pia exata.',
    'preview is not a copy of st_s, and frame 0 differs too. This is the card in the room, the profile and the shop \u2014 it should be the stand, exactly.':
      'o preview n\u00e3o \u00e9 c\u00f3pia do st_s, e o quadro 0 tamb\u00e9m difere. Isto \u00e9 o cart\u00e3o da sala, o perfil e a loja \u2014 deveria ser o parado, exatamente.',
    'wa frame 0 is not st_s frame 0. Every round ends its entrance on wa frame 0 and the next step draws st_s frame 0, so the difference shows as a jump at the start of every round.':
      'o quadro 0 do wa n\u00e3o \u00e9 o quadro 0 do st_s. Toda rodada termina a entrada no quadro 0 do wa e o passo seguinte desenha o quadro 0 do st_s, ent\u00e3o a diferen\u00e7a aparece como um tranco no come\u00e7o de cada rodada.',
    '{n} file has a capital in the name ({names}). The server runs on a filesystem where MO_S.GRA and mo_s.gra are different files, and the client asks for the lowercase one.':
      '{n} arquivo tem mai\u00fascula no nome ({names}). O servidor roda num sistema de arquivos onde MO_S.GRA e mo_s.gra s\u00e3o arquivos diferentes, e o cliente pede o min\u00fasculo.',
    '{n} files have a capital in the name ({names}). The server runs on a filesystem where MO_S.GRA and mo_s.gra are different files, and the client asks for the lowercase one.':
      '{n} arquivos t\u00eam mai\u00fascula no nome ({names}). O servidor roda num sistema de arquivos onde MO_S.GRA e mo_s.gra s\u00e3o arquivos diferentes, e o cliente pede o min\u00fasculo.',
    '{n} file will not parse: {names}': '{n} arquivo n\u00e3o abre: {names}',
    '{n} files will not parse: {names}': '{n} arquivos n\u00e3o abrem: {names}',
    '{n} file here the loader never asks for: {names}.':
      '{n} arquivo aqui que o carregador nunca pede: {names}.',
    '{n} files here the loader never asks for: {names}.':
      '{n} arquivos aqui que o carregador nunca pede: {names}.',
    'add.gra is the sleep pose of the 2003 game; this client has no such state and the 37-file package has no room for it.':
      'o add.gra \u00e9 a pose de dormir do jogo de 2003; este cliente n\u00e3o tem esse estado e o pacote de 37 arquivos n\u00e3o tem espa\u00e7o para ele.',
    '{n} sheet has something the game will show wrong: {names}. Open it to see what.':
      '{n} folha tem algo que o jogo vai mostrar errado: {names}. Abra para ver o qu\u00ea.',
    '{n} sheets have something the game will show wrong: {names}. Open one to see what.':
      '{n} folhas t\u00eam algo que o jogo vai mostrar errado: {names}. Abra uma para ver o qu\u00ea.',
    'that folder has nothing a character or a bomb skin is made of':
      'essa pasta n\u00e3o tem nada do que um personagem ou uma skin de bomba s\u00e3o feitos',
    'nothing in there parsed as a sprite': 'nada ali abriu como sprite',
    '{name}: {have} of {want} files': '{name}: {have} de {want} arquivos',
    '{name} will not parse: {why}': '{name} n\u00e3o abre: {why}',
    'no sprites in that folder': 'nenhum sprite nessa pasta',
    'no sprites in that zip': 'nenhum sprite nesse zip',
    'could not read that zip: {why}': 'n\u00e3o consegui ler esse zip: {why}',
    /* ---- what the export desk says */
    'nothing is open to export': 'n\u00e3o h\u00e1 nada aberto para exportar',
    'that produced nothing': 'isso n\u00e3o produziu nada',
    'export failed: {why}': 'a exporta\u00e7\u00e3o falhou: {why}',
    '{n} files, {kb} KB': '{n} arquivos, {kb} KB',
    '{n} frames, {w} x {h}': '{n} quadros, {w} x {h}',
    '{n} frames, {w} x {h}, an effect': '{n} quadros, {w} x {h}, um efeito',
    'one format, two extensions \u2014 the loader asks for the name the folder uses':
      'um formato, duas extens\u00f5es \u2014 o carregador pede o nome que a pasta usa',
    '{n} files': '{n} arquivos',
    'drop it back in and it is sliced across the frames again':
      'solte de volta e ela \u00e9 fatiada entre os quadros de novo',
    'every frame on a grid, numbered \u2014 for looking at, not for importing back':
      'cada quadro numa grade, numerado \u2014 para olhar, n\u00e3o para importar de volta',
    'at the game\u2019s own timing: {ms} ms a round':
      'no tempo do pr\u00f3prio jogo: {ms} ms por volta',
    'at {fps} fps, the speed on the slider':
      'a {fps} fps, a velocidade da barra',
    '{n} frames, the eight layers together \u2014 what a player sees':
      '{n} quadros, as oito camadas juntas \u2014 o que o jogador v\u00ea',
    'the effect playing, the way the game draws it':
      'o efeito tocando, do jeito que o jogo desenha',
    'size, frames, the slot it is, the clock, and every frame measured \u2014 for a script to read':
      'tamanho, quadros, qual slot \u00e9, o rel\u00f3gio, e cada quadro medido \u2014 para um script ler',
    '{m} mesh(es), {t} texture(s)': '{m} malha(s), {t} textura(s)',
    '{v} vertices, {f} faces \u2014 opens in any modeller, and comes back in':
      '{v} v\u00e9rtices, {f} faces \u2014 abre em qualquer modelador, e volta',
    '{n} file(s), exactly the bytes the container holds':
      '{n} arquivo(s), exatamente os bytes que o arquivo guarda',
    'texture {i}, the layout drawn over it \u2014 the guide for painting a garment in the right place':
      'textura {i}, o mapa desenhado por cima \u2014 o guia para pintar uma roupa no lugar certo',
    'meshes, vertices, faces, bones, textures and the material bindings':
      'malhas, v\u00e9rtices, faces, ossos, texturas e as liga\u00e7\u00f5es de material',
    '{n} screens': '{n} telas',
    '46 sets x 100 variants, written back byte for byte':
      '46 conjuntos x 100 variantes, gravado de volta byte a byte',
    'set {n}: every distinct variant as a row of digits, 0 floor, 1 soft, 2 pillar, 9 wall':
      'conjunto {n}: cada variante distinta como uma fila de d\u00edgitos, 0 ch\u00e3o, 1 quebr\u00e1vel, 2 pilar, 9 parede',
    'the spawns, the gimmicks and the item counts, every set':
      'as largadas, os gimmicks e as contagens de item, de todos os conjuntos',
    '{n} file(s), exactly as they were opened':
      '{n} arquivo(s), exatamente como foram abertos',
    'which slots are filled, the frame counts, and what the cross-file checks found':
      'quais slots est\u00e3o preenchidos, as contagens de quadro, e o que as confer\u00eancias entre arquivos acharam',

    /* ---- opening files */
    'no files received': 'nenhum arquivo recebido',
    'could not read {name}': 'n\u00e3o consegui ler {name}',
    'an .obj has to come from a file, not from bytes already open':
      'um .obj tem de vir de um arquivo, n\u00e3o de bytes j\u00e1 abertos',

    /* ---- the frame tools */
    'Frame': 'Quadro',
    'Tools': 'Ferramentas',
    'Eraser': 'Borracha',
    'Fill': 'Balde',
    'Pick': 'Conta-gotas',
    'Line': 'Linha',
    'Box': 'Caixa',
    'Select': 'Selecionar',
    'this applies to': 'isto vale para',
    'this frame': 'este quadro',
    'every frame': 'todos os quadros',
    '90\u00b0 left': '90\u00b0 esquerda',
    '90\u00b0 right': '90\u00b0 direita',
    'Move it': 'Mover',
    'Turn it': 'Girar',
    'Edges and colour': 'Bordas e cor',
    'Centre across': 'Centrar na horizontal',
    'Centre down': 'Centrar na vertical',
    'Outline': 'Contorno',
    'Inline': 'Contorno por dentro',
    'Drop the picked colour': 'Tirar a cor escolhida',
    'Undo that': 'Desfazer isso',
    'How it works': 'Como funciona',
    'Open a sheet and its frames, its colours and the brushes arrive here.':
      'Abra uma folha e os quadros dela, as cores e os pinc\u00e9is aparecem aqui.',
    'These act on the drawing itself, not on a brush stroke: <b>Undo that</b> puts back the last one and nothing more. The sheet is a stamp pressed at a fixed place, so a pixel moved here is a pixel moved in the game.':
      'Estas agem no desenho em si, n\u00e3o numa pincelada: <b>Desfazer isso</b> devolve a \u00faltima e nada al\u00e9m. A folha \u00e9 um carimbo prensado num lugar fixo, ent\u00e3o um pixel movido aqui \u00e9 um pixel movido no jogo.',
    'open a sheet first': 'abra uma folha primeiro',
    'put back': 'devolvido',
    'outlined': 'contornado',
    'that colour is gone': 'essa cor saiu',
    'already centred': 'j\u00e1 est\u00e1 centrado',
    'nothing drawn to centre': 'n\u00e3o h\u00e1 nada desenhado para centrar',
    'pick a colour in the palette first':
      'escolha uma cor na paleta primeiro',
    'moved {dx}, {dy}': 'movido {dx}, {dy}',
    'turned {n} degrees': 'girado {n} graus',
    'a {w} x {h} sheet is not square, so a quarter turn would change its size':
      'uma folha de {w} x {h} n\u00e3o \u00e9 quadrada, ent\u00e3o um quarto de volta mudaria o tamanho dela',
    'frame {from} is now frame {to}':
      'o quadro {from} agora \u00e9 o quadro {to}',

    /* ---- the library */
    'Library': 'Estante',
    'Character': 'Personagem',
    'Bomb skin': 'Skin de bomba',
    'Import': 'Importados',
    'New folder': 'Nova pasta',
    'New folder inside': 'Nova pasta dentro',
    'File by animation': 'Organizar por anima\u00e7\u00e3o',
    'Save .zip': 'Salvar .zip',
    'Save as .zip': 'Salvar como .zip',
    'Clear': 'Limpar',
    'Open': 'Abrir',
    'Open as a set': 'Abrir como conjunto',
    'Rename': 'Renomear',
    'Remove from the shelf': 'Tirar da estante',
    'will not open': 'n\u00e3o abre',
    '{n} KB': '{n} KB',
    '{n} files filed by animation': '{n} arquivos organizados por anima\u00e7\u00e3o',
    'nothing here is one of the 37 sheets': 'nada aqui \u00e9 uma das 37 folhas',
    'nothing in there to save': 'n\u00e3o h\u00e1 nada ali para salvar',
    'nothing in there to open': 'n\u00e3o h\u00e1 nada ali para abrir',
    'Nothing here yet. Everything you open is shelved, and a folder or a zip keeps the folders it came in.':
      'Nada aqui ainda. Tudo o que voc\u00ea abrir vai para a estante, e uma pasta ou um zip mant\u00eam as pastas em que vieram.',
    'Remove "{name}" and the {n} files in it? They stay on your disk; this only clears the shelf.':
      'Tirar "{name}" e os {n} arquivos dentro? Eles continuam no seu disco; isto s\u00f3 limpa a estante.',
    'Clear the shelf? {n} files go, and they stay on your disk either way.':
      'Limpar a estante? {n} arquivos saem, e continuam no seu disco de qualquer jeito.',
    'Drag a row onto a folder to move it. <b>One click</b> opens a file and the <b>arrow keys</b> walk the list. Double-click a folder to rename it; right-click for the rest. The shelf lives in this page: closing the tab loses the arrangement, not the files.':
      'Arraste uma linha para dentro de uma pasta para mov\u00ea-la. <b>Um clique</b> abre um arquivo e as <b>setinhas</b> andam pela lista. Dois cliques numa pasta renomeia; o resto est\u00e1 no bot\u00e3o direito. A estante vive nesta p\u00e1gina: fechar a aba perde a arruma\u00e7\u00e3o, n\u00e3o os arquivos.',

    /* ---- what the map editor says */
    'The map has no name.': 'O mapa n\u00e3o tem nome.',
    'The name is longer than {n} characters.':
      'O nome \u00e9 mais longo que {n} caracteres.',
    'fewer than two start points.': 'menos de dois pontos de largada.',
    '{n} start points, and this size takes {max}.':
      '{n} pontos de largada, e este tamanho aceita {max}.',
    'start {n} is off the field.': 'a largada {n} est\u00e1 fora do campo.',
    'start {n} is not on floor.': 'a largada {n} n\u00e3o est\u00e1 no ch\u00e3o.',
    'two starts on the same tile.': 'duas largadas na mesma casa.',
    '{item} is over {max}.': '{item} passa de {max}.',
    '{items} items but only {soft} breakable blocks to hide them in.':
      '{items} itens mas s\u00f3 {soft} blocos quebr\u00e1veis para escond\u00ea-los.',
    'that is not map.spr': 'isso n\u00e3o \u00e9 o map.spr',
    'map.spr read: {n} sets. Open block.spr to see them':
      'map.spr lido: {n} conjuntos. Abra o block.spr para v\u00ea-los',
    'map.spr read: spawns, objects and items for {n} sets':
      'map.spr lido: largadas, objetos e itens de {n} conjuntos',
    'that JSON will not parse: {why}': 'esse JSON n\u00e3o abre: {why}',
    'that JSON is not a custom map': 'esse JSON n\u00e3o \u00e9 um mapa customizado',
    'set {n}: every variant is now this layout':
      'conjunto {n}: todas as variantes agora s\u00e3o este tra\u00e7ado',
    'only block.spr has a round trip':
      's\u00f3 o block.spr tem volta para conferir',

    /* ---- the labels painted over a sheet. These are drawn onto the
       canvas, so charLabel asks for them by hand and i18nSetLang
       redraws; the node sweep cannot reach a canvas. */
    'this square': 'esta casa',
    'head 40 x 40': 'cabe\u00e7a 40 x 40',
    'the name goes here': 'o nome vem aqui',
    'safe area': '\u00e1rea segura',
    'shadow': 'sombra',
    'team ring': 'anel de equipe',
    'stunned stars': 'estrelas de atordoado',
    'you marker': 'marcador voc\u00ea',
    'Hyper Bomb orbit': '\u00f3rbita da Hyper Bomb',
    'you arrow': 'seta voc\u00ea',

    /* ---- a folder as one document */
    'Folder\u2026': 'Pasta\u2026',
    'The whole set': 'O conjunto inteiro',
    'Close the set': 'Fechar o conjunto',
    'Every file in the set': 'Todos os arquivos do conjunto',
    'What the set is, as JSON': 'O que o conjunto \u00e9, em JSON',
    'A character is 37 files that have to agree with each other, and a bomb skin is 12 of which most are meant to be absent. The faults that matter live <b>between</b> files: the slot nobody drew, the preview that drifted from the stand it copies, the name saved in capitals onto a server that cares.':
      'Um personagem s\u00e3o 37 arquivos que precisam concordar entre si, e uma skin de bomba s\u00e3o 12 dos quais a maioria deve mesmo faltar. As falhas que importam ficam <b>entre</b> os arquivos: o slot que ningu\u00e9m desenhou, o preview que se afastou do parado que ele copia, o nome salvo em mai\u00fasculas num servidor que liga para isso.',

    /* ---- the export desk.
       The notes under each item count what is open, so they are built
       at run time and cannot be keyed; they stay in English, the same
       way the map editor's own findings do. */
    'Export\u2026': 'Exportar\u2026',
    'tick what you want; several come out as one .zip':
      'marque o que quiser; v\u00e1rios saem num .zip s\u00f3',
    'Nothing here changes the file. The zip is stored, not compressed, so every tool reads it.':
      'Nada aqui altera o arquivo. O .zip \u00e9 guardado sem compress\u00e3o, ent\u00e3o qualquer ferramenta l\u00ea.',
    'Nothing ticked': 'Nada marcado',
    'This sprite': 'Este sprite',
    'This model': 'Este modelo',
    'This map': 'Este mapa',
    'Also open': 'Tamb\u00e9m abertos',
    'How': 'Como',
    'Scale': 'Escala',
    'nearest neighbour, so a pixel stays a square':
      'vizinho mais pr\u00f3ximo, para o pixel continuar quadrado',
    'Crop to the drawing': 'Cortar no desenho',
    'Draw the guides on': 'Desenhar as guias por cima',
    'GIF at the game\u2019s timing': 'GIF no tempo do jogo',
    'rather than the speed on the slider': 'em vez da velocidade da barra',
    'Contact sheet columns': 'Colunas da folha de contato',
    '0 keeps it square': '0 deixa quadrada',
    'A folder per file, inside the zip': 'Uma pasta por arquivo, dentro do zip',
    'off puts everything at the top level':
      'desligado joga tudo na raiz',
    'The sprite itself': 'O pr\u00f3prio sprite',
    'Every frame, one PNG each': 'Cada quadro, um PNG',
    'One strip, every frame side by side':
      'Uma tira, os quadros lado a lado',
    'A contact sheet': 'Uma folha de contato',
    'The animation as a GIF': 'A anima\u00e7\u00e3o em GIF',
    'The numbers, as JSON': 'Os n\u00fameros, em JSON',
    'Composited, one PNG per frame': 'Composto, um PNG por quadro',
    'Composited, as a GIF': 'Composto, em GIF',
    'The container itself': 'O pr\u00f3prio arquivo',
    'The geometry as .obj': 'A geometria em .obj',
    'Every texture': 'Todas as texturas',
    'The UV layout, as a PNG': 'O mapa UV, em PNG',
    'This set, as JSON': 'Este conjunto, em JSON',
    'What map.spr says, as JSON': 'O que o map.spr diz, em JSON',
    'The board on screen, as a PNG': 'O tabuleiro da tela, em PNG',
    'The custom map, as the panel takes it':
      'O mapa customizado, como o painel aceita',

    /* ---- the character sheet */
    'Character sheet': 'Folha de personagem',
    'Align': 'Alinhar',
    'Save guides .PNG': 'Salvar guias .PNG',
    'Guides': 'Guias',
    'Axis and sole': 'Eixo e sola',
    'The board tile': 'A casa do tabuleiro',
    'Head box and name band': 'Caixa da cabe\u00e7a e faixa do nome',
    'Safe area for ground actions': '\u00c1rea segura das a\u00e7\u00f5es de ch\u00e3o',
    'What the game draws around you': 'O que o jogo desenha em volta',
    'The block in front covers your feet': 'O bloco da frente cobre o p\u00e9',
    'name the guides on the sheet': 'nomear as guias na folha',
    'play at the game\u2019s own timing': 'tocar no tempo do pr\u00f3prio jogo',
    'Frame by frame': 'Quadro a quadro',

    'The game stamps the whole 256 x 256 at a fixed place against the board square, so where the drawing sits inside the sheet is the only thing that decides where the character stands. The body belongs on <b>x 128</b> and the sole of the foot on <b>y 195</b>; the rest is what the game draws around you and never adapts.':
      'O jogo carimba os 256 x 256 inteiros num lugar fixo em rela\u00e7\u00e3o \u00e0 casa do tabuleiro, ent\u00e3o onde o desenho fica dentro da folha \u00e9 a \u00fanica coisa que decide onde o personagem aparece. O corpo fica em <b>x 128</b> e a sola do p\u00e9 em <b>y 195</b>; o resto \u00e9 o que o jogo desenha em volta, e ele nunca se adapta a voc\u00ea.',

    /* ---- the map editor */
    'New map': 'Novo mapa',
    'Save map': 'Salvar mapa',
    'Check': 'Conferir',
    'Close map': 'Fechar mapa',
    'Set and variant': 'Conjunto e variante',
    'What map.spr says': 'O que o map.spr diz',
    'Tiles': 'Pe\u00e7as',
    'The map': 'O mapa',
    'Start points': 'Pontos de largada',
    'What the blocks hide': 'O que os blocos escondem',
    'Before you hand it over': 'Antes de entregar',
    'set': 'conjunto',
    'variant': 'variante',
    'Name': 'Nome',
    'Floor': 'Ch\u00e3o',
    'Block': 'Bloco',
    'Pillar': 'Pilar',
    'Wall': 'Parede',
    'Walkable.': 'D\u00e1 para andar.',
    'Breaks. The items are hidden in these.':
      'Quebra. Os itens ficam escondidos nestes.',
    'Solid. Never breaks, never hides anything.':
      'Maci\u00e7o. Nunca quebra e nunca esconde nada.',
    'The outer wall. Normally the rim.':
      'A parede de fora. Normalmente a borda.',
    'Copy to every variant': 'Copiar para todas as variantes',
    'Revert this variant': 'Desfazer esta variante',
    'Start this screen over': 'Recome\u00e7ar esta tela',
    'Fill with blocks': 'Encher de blocos',
    'Clear the blocks': 'Tirar os blocos',
    'Add a start': 'Adicionar largada',
    'move': 'mover',
    'click the board': 'clique no tabuleiro',
    'Standard': 'Padr\u00e3o',
    'Pyramid': 'Pir\u00e2mide',
    'Laboratory': 'Laborat\u00f3rio',
    'Village': 'Vila',
    'Iceberg': 'Iceberg',
    'Road': 'Estrada',
    'ToyBox': 'Caixa de brinquedos',
    'Fire': 'Fogo',
    'Speed': 'Velocidade',
    'Bomb': 'Bomba',
    'Kick': 'Chute',
    'Glove': 'Luva',
    'Skull': 'Caveira',
    'Vest': 'Colete',
    'Full fire': 'Fogo m\u00e1ximo',
    'Punch': 'Soco',
    'Line bomb': 'Bomba em linha',
    'Pierce bomb': 'Bomba perfurante',
    'Water bomb': 'Bomba d\'\u00e1gua',
    'Hyper Bomb': 'Hyper Bomb',
    'Warp, to a destination': 'Portal, com destino',
    'Warp': 'Portal',
    'Drift sand': 'Areia movedi\u00e7a',
    'Conveyor belt': 'Esteira',
    'Direction switch': 'Chave de dire\u00e7\u00e3o',
    'Arrow': 'Seta',
    'Arrow, rotating': 'Seta girat\u00f3ria',
    'Tunnel or Soccer goal': 'T\u00fanel ou gol de futebol',
    'Cracking ice': 'Gelo que racha',
    'Speed panel': 'Painel de velocidade',
    'Tunnel': 'T\u00fanel',
    'Drift sand, whole floor': 'Areia movedi\u00e7a no ch\u00e3o inteiro',
    'Count tile': 'Casa de contagem',
    'Hyper Bomb goal': 'Gol da Hyper Bomb',
    'Nothing here would be refused.': 'Nada aqui seria recusado.',
    'Drag to paint. Right-drag lays floor.':
      'Arraste para pintar. Com o bot\u00e3o direito, deixa ch\u00e3o.',

    /* ---- settings */
    'Language': 'Idioma',
    'Theme': 'Tema',
    'Follow the system': 'Seguir o sistema',
    'Light': 'Claro',
    'Dark': 'Escuro',
    'While you work': 'Enquanto voc\u00ea trabalha',
    'Warn before leaving with a file open':
      'Avisar antes de sair com arquivo aberto',
    'How long a notice stays': 'Quanto tempo o aviso fica',
    'short': 'curto',
    'normal': 'normal',
    'long': 'longo',
    'Everything here is kept in this browser only.':
      'Tudo aqui fica guardado s\u00f3 neste navegador.',
    'Forget these settings': 'Esquecer estas configura\u00e7\u00f5es',
    'kept in this browser, nowhere else':
      'guardado neste navegador, em nenhum outro lugar',
    'The interface. File formats are not affected.':
      'A interface. Os formatos de arquivo n\u00e3o mudam.',
    'Following the system changes with it.':
      'Seguindo o sistema, muda junto com ele.',
    'The browser asks before closing the tab.':
      'O navegador pergunta antes de fechar a aba.',
    'The messages that appear at the bottom.':
      'As mensagens que aparecem embaixo.',
    'settings forgotten': 'configura\u00e7\u00f5es esquecidas',

  }
};

let i18nLang = 'en';
let i18nBusy = false;
const I18N_TEXT = new WeakMap();
const I18N_ATTR = new WeakMap();
const I18N_SKIP = { SCRIPT: 1, STYLE: 1, CODE: 1, PRE: 1, TEXTAREA: 1,
                    CANVAS: 1, OPTION: 0 };
const I18N_ATTRS = ['title', 'placeholder', 'aria-label'];

function t(s) {
  const d = I18N[i18nLang];
  if (!d) return s;
  const hit = d[s];
  return hit === undefined ? s : hit;
}

/* Translate one text node, keeping whatever whitespace surrounded it so
   the layout does not shift. */
function i18nText(node) {
  let en = I18N_TEXT.get(node);
  if (en === undefined) {
    en = node.nodeValue;
    I18N_TEXT.set(node, en);
  }
  const key = en.trim();
  if (!key || key.length > 240) return;
  const tr = t(key);
  const want = tr === key ? en : en.replace(key, tr);
  if (node.nodeValue !== want) node.nodeValue = want;
}

function i18nAttrs(el) {
  let orig = I18N_ATTR.get(el);
  if (!orig) { orig = {}; I18N_ATTR.set(el, orig); }
  for (const a of I18N_ATTRS) {
    if (!el.hasAttribute(a)) continue;
    if (orig[a] === undefined) orig[a] = el.getAttribute(a);
    const want = t(orig[a]);
    if (el.getAttribute(a) !== want) el.setAttribute(a, want);
  }
}

/* A line with numbers in it cannot be keyed as a whole: the key would
   change every time the data does, so it would never match. The
   template is the key instead, with {name} where a value goes, and
   the values are put in after the translation.

   This is what the editor's own findings needed. They were being left
   in English on the grounds that they are built at run time, which
   was the wrong conclusion from a true fact: what is built at run
   time is the number, not the sentence. */
function tf(template, vars) {
  let s = t(template);
  for (const k in (vars || {})) s = s.split('{' + k + '}').join(vars[k]);
  return s;
}

/* English has one plural rule and Portuguese happens to agree with it
   for every count in this interface, so one helper serves both: the
   caller gives the two forms and the translation keys each on its
   own. */
function tn(n, one, many) {
  return t(n === 1 ? one : many);
}

function i18nApply(root) {
  if (!root) root = document.body;
  if (!root || i18nBusy) return;
  i18nBusy = true;
  try {
    if (root.nodeType === 3) { i18nText(root); return; }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: n => (n.parentNode && I18N_SKIP[n.parentNode.nodeName])
        ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    });
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    for (const node of nodes) i18nText(node);
    if (root.querySelectorAll) {
      i18nAttrs(root);
      for (const el of root.querySelectorAll('[title],[placeholder],[aria-label]'))
        i18nAttrs(el);
      /* whole paragraphs, markup and all */
      const rich = [];
      if (root.dataset && root.dataset.i18nHtml) rich.push(root);
      for (const el of root.querySelectorAll('[data-i18n-html]')) rich.push(el);
      for (const el of rich) {
        const en = el.dataset.i18nHtml;
        const tr = t(en);
        if (el.innerHTML !== tr) el.innerHTML = tr;
      }
    }
  } finally {
    i18nBusy = false;
  }
}

function i18nSetLang(code) {
  i18nLang = I18N[code] || code === 'en' ? code : 'en';
  document.documentElement.lang = i18nLang === 'pt-BR' ? 'pt-BR' : 'en';
  i18nApply(document.body);
  /* Text painted onto a canvas is not a node, so the sweep above
     cannot reach it. The guide labels over a sheet are drawn, not
     written, and only a redraw puts them in the new language. */
  for (const fn of ['spriteDraw', 'paintDraw', 'mapDraw'])
    if (typeof window[fn] === 'function') { try { window[fn](); } catch (e) { /* not open */ } }
}

/* Most of this interface is built at run time, so new nodes have to be
   translated as they arrive rather than only when the language
   changes. */
function i18nWatch() {
  if (!window.MutationObserver) return;
  const obs = new MutationObserver(muts => {
    if (i18nBusy || i18nLang === 'en') return;
    for (const m of muts) {
      for (const node of m.addedNodes) {
        if (node.nodeType === 1) i18nApply(node);
        else if (node.nodeType === 3) {
          i18nBusy = true;
          try { i18nText(node); } finally { i18nBusy = false; }
        }
      }
      if (m.type === 'characterData' && m.target) {
        i18nBusy = true;
        try { i18nText(m.target); } finally { i18nBusy = false; }
      }
    }
  });
  obs.observe(document.body, { childList: true, subtree: true,
                               characterData: true });
}
