/* i18n.js -- the interface in more than one language.

   The dictionary is keyed by the English string itself rather than by a
   code, so nothing has to be threaded through the rest of the editor
   and a string with no translation simply stays as it is. That is the
   safety property worth keeping: a run of text is replaced only when it
   matches a key exactly, so a file name, a hex colour or a number is
   never touched by accident.

   Two sweeps keep it applied. One walks the document when the language
   changes. The other is a MutationObserver, because most of this
   interface is built at run time -- the Workshop, the tab list, the
   panels -- and those nodes have to be translated as they appear rather
   than only at load.

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
    'Workshop': 'Oficina',
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
    'light': 'luz',
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

    /* ---- the Workshop */
    'pick what you are making; leave with the files to hand over':
      'escolha o que vai fazer; saia com os arquivos para entregar',
    'A costume': 'Uma roupa',
    'A bomb skin': 'Uma skin de bomba',
    'A map': 'Um mapa',
    'Scenery': 'Cen\u00e1rio',
    'A character': 'Um personagem',
    'recolour the White': 'recolorir o Branco',
    'the bomb and its flame': 'a bomba e a chama dela',
    'the grid and the items': 'a grade e os itens',
    'the border around it': 'a moldura em volta',
    'the whole set': 'o conjunto inteiro',
    '1 file': '1 arquivo',
    'up to 12': 'at\u00e9 12',
    'about 40': 'uns 40',
    'The ten parts': 'As dez partes',
    'Two extras': 'Dois extras',
    'What you hand over': 'O que voc\u00ea entrega',
    'Or paint it instead': 'Ou pinte, se preferir',
    'Part': 'Parte',
    'Colour': 'Cor',
    'Pattern, its colour, size, angle': 'Padr\u00e3o, cor dele, tamanho, \u00e2ngulo',
    'Helmet': 'Capacete',
    'Suit (arms, legs)': 'Macac\u00e3o (bra\u00e7os, pernas)',
    'Chest': 'Peito',
    'Buckle': 'Fivela',
    'Eyes': 'Olhos',
    'Pompom': 'Pompom',
    'Antenna': 'Antena',
    'Gloves': 'Luvas',
    'Boots': 'Botas',
    'no pattern': 'sem padr\u00e3o',
    'Plain': 'Liso',
    'Stripes': 'Listras',
    'Band': 'Faixa',
    'Spots': 'Bolinhas',
    'Checks': 'Xadrez',
    'Bandages': 'Ataduras',
    'Clouds': 'Nuvens',
    'Keep the White\'s': 'Manter a do Branco',
    'Save costume.json': 'Salvar costume.json',
    'Start again': 'Come\u00e7ar de novo',
    'The twelve files': 'Os doze arquivos',
    'How to make one': 'Como fazer uma',
    'The room': 'A sala',
    'Draw it': 'Desenhe',
    'What the blocks hide': 'O que os blocos escondem',
    'Edge': 'Borda',
    'Pillar': 'Pilar',
    'Block': 'Bloco',
    'Floor': 'Ch\u00e3o',
    'Start': 'In\u00edcio',
    'Size': 'Tamanho',
    'Theme': 'Tema',
    'Name': 'Nome',
    'Save map.json': 'Salvar map.json',
    'Which size': 'Qual tamanho',
    'Check it before you send it': 'Confira antes de enviar',
    'Your scenery': 'Seu cen\u00e1rio',
    'The painted picture': 'A imagem pintada',
    'The files of the set': 'Os arquivos do conjunto',
    'drop here, or click to choose': 'solte aqui, ou clique para escolher',
    'Export the set as a .zip': 'Exportar o conjunto em .zip',
    'Clear': 'Limpar',
    'needed': 'preciso',
    'optional': 'opcional',
    'What the set is': 'O que \u00e9 o conjunto',
    'Two rules that catch everyone': 'Duas regras que pegam todo mundo',
    'A way in that is not forty files':
      'Um come\u00e7o que n\u00e3o \u00e9 quarenta arquivos',
    'Standing': 'Parado',
    'Walking': 'Andando',
    'Punching': 'Socando',
    'Struck': 'Atingido',
    'Riding': 'Montado',
    'Mounted, still': 'Montado, parado',
    'Mounted, walking': 'Montado, andando',
    'Mounting': 'Subindo na montaria',
    'Idle flourish': 'Gracinha parado',
    'Death': 'Morte',
    'Portrait': 'Retrato',
    '4 files': '4 arquivos',
    'What you need': 'O que voc\u00ea precisa',
    'What to attach': 'O que anexar',
    '35 files': '35 arquivos',
    'The big one, and <b>all your own artwork</b>. A costume recolours the White and the server draws it; a character is its own drawing in every pose and every facing. Thirty-five files, named for the action and the direction.':
      'A grande, e <b>tudo arte sua</b>. Uma roupa recolore o Branco e o servidor desenha; um personagem \u00e9 o desenho dele mesmo em cada pose e cada dire\u00e7\u00e3o. Trinta e cinco arquivos, nomeados pela a\u00e7\u00e3o e pela dire\u00e7\u00e3o.',
    'Attach the painted template': 'Anexe o template pintado',
    'Attach the files of the set': 'Anexe os arquivos do conjunto',
    'Attach your scenery': 'Anexe o seu cen\u00e1rio',
    'Attach the character folder': 'Anexe a pasta do personagem',
    'none': 'nada',
    'or': 'ou',
    '(nothing)': '(nada)',
    'block tiles': 'pe\u00e7as de bloco',
    'scenery': 'cen\u00e1rio',
    'Or set the ten parts by hand': 'Ou escolha as dez partes na m\u00e3o',
    'Painting the template': 'Pintando o template',
    'What the check says': 'O que a checagem diz',
    'Export the folder as a .zip': 'Exportar a pasta em .zip',
    'nothing': 'nada',
    'the whole folder': 'a pasta inteira',
    'Attach the painted template and it appears here, checked before you send it anywhere.':
      'Anexe o template pintado e ele aparece aqui, conferido antes de voc\u00ea mandar para algu\u00e9m.',
    'Attach the files and they play here, so you can judge the set moving.':
      'Anexe os arquivos e eles tocam aqui, para voc\u00ea julgar o conjunto em movimento.',
    'Attach your scenery and it appears here with the arena drawn over it.':
      'Anexe o seu cen\u00e1rio e ele aparece aqui com a arena desenhada por cima.',
    'Attach the folder and the frames play here, so you can see whether the facings agree with one another.':
      'Anexe a pasta e os quadros tocam aqui, para voc\u00ea ver se as dire\u00e7\u00f5es combinam entre si.',
    'Attach a picture and this says whether the size is one the server takes, before you send it.':
      'Anexe uma imagem e isto diz se o tamanho \u00e9 um dos que o servidor aceita, antes de voc\u00ea mandar.',
    'Your files, playing:': 'Seus arquivos, tocando:',
    'Your character, playing:': 'Seu personagem, tocando:',
    'Standing': 'Parado',
    'Walking': 'Andando',
    'Punching': 'Socando',
    'Struck': 'Atingido',
    'Riding': 'Montado',
    'Mounted, still': 'Montado, parado',
    'Mounted, walking': 'Montado, andando',
    'Mounting': 'Subindo na montaria',
    'Idle flourish': 'Gracinha parado',
    'Death': 'Morte',
    'Portrait': 'Retrato',
    'Loose ends beside the head: a headband, a trailing bandage':
      'Pontas soltas ao lado da cabe\u00e7a: uma bandana, uma atadura solta',
    'Hair under the helmet': 'Cabelo embaixo do capacete',

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

    /* ---- the longer lines people actually read */
    'A schematic, drawn here from your choices. The real sheets are made at the other end, so this shows the parts and not the final artwork.':
      'Um esquema, desenhado aqui a partir das suas escolhas. As folhas de verdade s\u00e3o feitas do outro lado, ent\u00e3o isto mostra as partes e n\u00e3o a arte final.',
    'Green is a file you have dropped in. Grey is one that falls back to the ordinary bomb.':
      'Verde \u00e9 um arquivo que voc\u00ea soltou aqui. Cinza \u00e9 um que volta para a bomba comum.',
    'The dark rectangle is where the arena covers your picture. Paint outside it.':
      'O ret\u00e2ngulo escuro \u00e9 onde a arena cobre a sua imagem. Pinte em volta dele.',
    'Each square is one file. Four across means one per facing: east, north, south, west.':
      'Cada quadrado \u00e9 um arquivo. Quatro na linha quer dizer um por dire\u00e7\u00e3o: leste, norte, sul, oeste.',
    'What you dropped, playing:': 'O que voc\u00ea soltou, tocando:',
    'one bomb going off, and which file draws each part':
      'uma bomba explodindo, e qual arquivo desenha cada parte',
    'The outer wall. It stays around the rim.':
      'O muro externo. Fica em volta da borda.',
    'Solid. Never breaks, never hides anything.':
      'S\u00f3lido. Nunca quebra, nunca esconde nada.',
    'Breaks. The items are hidden in these.':
      'Quebra. Os itens ficam escondidos nestes.',
    'Walkable.': 'D\u00e1 para andar.',
    'Where a player appears. Needs floor.':
      'Onde um jogador aparece. Precisa de ch\u00e3o.',
    'The bomb sitting on the ground, and appearing':
      'A bomba parada no ch\u00e3o, e aparecendo',
    'The bomb in its last moment, about to go off':
      'A bomba no \u00faltimo instante, prestes a explodir',
    'The bomb while it slides after a kick':
      'A bomba deslizando depois de um chute',
    'The fuse burning on top of it': 'O pavio queimando em cima dela',
    'The blast where the bomb was': 'A explos\u00e3o onde a bomba estava',
    'The arm running left and right': 'O bra\u00e7o que corre para os lados',
    'The arm running up and down': 'O bra\u00e7o que corre para cima e para baixo',
    'The tip of the arm going left': 'A ponta do bra\u00e7o que vai para a esquerda',
    'The tip of the arm going right': 'A ponta do bra\u00e7o que vai para a direita',
    'The tip of the arm going up': 'A ponta do bra\u00e7o que vai para cima',
    'The tip of the arm going down': 'A ponta do bra\u00e7o que vai para baixo',
    'A breakable block coming apart': 'Um bloco quebr\u00e1vel se despeda\u00e7ando',
    'It breathes rather than holding still.':
      'Ele respira em vez de ficar im\u00f3vel.',
    'The longest set, and the one people see most.':
      'O conjunto mais longo, e o que as pessoas mais veem.',
    'Hitting a bomb away.': 'Afastando uma bomba com um soco.',
    'Caught by a thrown bomb.': 'Atingido por uma bomba arremessada.',
    'On the mount.': 'Em cima da montaria.',
    'Marked in the original manual as possibly unused.':
      'Marcado no manual original como possivelmente sem uso.',
    'Played after standing still for a while.':
      'Toca depois de ficar parado um tempo.',
    'Travels a long way across the frame.':
      'Percorre um longo caminho pelo quadro.',
    'The head at the top of the screen during a match.':
      'A cabe\u00e7a no topo da tela durante a partida.',

    /* ---- whole paragraphs, kept with their markup */
    'A costume is <b>not a drawing of your own</b>. The server keeps ten parts, each with a colour and some of them a pattern, and makes the 37 sheets itself from the White\'s own shape. You paint the template it gives you, or you set the ten parts by hand.':
      'Uma roupa <b>n\u00e3o \u00e9 um desenho seu</b>. O servidor guarda dez partes, cada uma com uma cor e algumas com um padr\u00e3o, e faz as 37 folhas sozinho a partir da forma do pr\u00f3prio Branco. Voc\u00ea pinta o template que ele d\u00e1, ou escolhe as dez partes na m\u00e3o.',
    'If you would rather not paint, choose the parts here and hand over <code>costume.json</code> instead. <b>Keep the White\'s</b> leaves a part alone; <b>Colour</b> gives it your own; <b>Same as</b> makes it follow another part.':
      'Se voc\u00ea preferir n\u00e3o pintar, escolha as partes aqui e entregue <code>costume.json</code> no lugar. <b>Manter a do Branco</b> deixa a parte como est\u00e1; <b>Cor</b> d\u00e1 uma sua; <b>Igual a</b> faz ela seguir outra parte.',
    'This one <b>is</b> your own artwork, and it is a set: the bomb itself and the flame it makes. The names are fixed. Only <code>bomb.spr</code> is required, so a skin that changes nothing but the bomb is <b>one file</b>.':
      'Esta <b>\u00e9</b> arte sua, e \u00e9 um conjunto: a bomba e a chama que ela faz. Os nomes s\u00e3o fixos. S\u00f3 <code>bomb.spr</code> \u00e9 obrigat\u00f3rio, ent\u00e3o uma skin que muda s\u00f3 a bomba \u00e9 <b>um arquivo</b>.',
    'Three are sprites (<code>.spr</code>), nine are effects (<code>.eft</code>), and <b>all twelve open in this editor</b>. Each is capped at 512 kB. Anything left out falls back to the ordinary bomb.':
      'Tr\u00eas s\u00e3o sprites (<code>.spr</code>), nove s\u00e3o efeitos (<code>.eft</code>), e <b>todos os doze abrem neste editor</b>. Cada um tem limite de 512 kB. O que faltar volta para a bomba comum.',
    'The one page with <b>nothing to attach</b>: you draw the map here and leave with the file. It is a grid, where people start, and what the breakable blocks hide. The theme decides which tiles draw it, so you are laying out a room rather than painting one.':
      'A \u00fanica p\u00e1gina <b>sem nada para anexar</b>: voc\u00ea desenha o mapa aqui e sai com o arquivo. \u00c9 uma grade, onde as pessoas come\u00e7am, e o que os blocos quebr\u00e1veis escondem. O tema decide quais pe\u00e7as desenham, ent\u00e3o voc\u00ea est\u00e1 montando uma sala, n\u00e3o pintando uma.',
    'The picture drawn <b>around</b> the arena. The grid sits on top of it, in the middle, so the part of your picture that shows is the border.':
      'A imagem desenhada <b>em volta</b> da arena. A grade fica por cima dela, no meio, ent\u00e3o a parte da sua imagem que aparece \u00e9 a moldura.',
    'One picture per size, and a map uses only the one that matches it. <b>Nothing is scaled</b>: paint at the size it will be shown.':
      'Uma imagem por tamanho, e um mapa usa s\u00f3 a que combina com ele. <b>Nada \u00e9 redimensionado</b>: pinte no tamanho em que vai aparecer.',
    'The dark rectangle over your picture is where the arena covers it. Paint outside it.':
      'O ret\u00e2ngulo escuro sobre a sua imagem \u00e9 onde a arena cobre. Pinte em volta dele.',
    'The big one, and <b>all your own artwork</b>. A costume recolours the White and the server draws it; a character is its own drawing in every pose and every facing. About forty files, named for the action and the direction.':
      'A grande, e <b>tudo arte sua</b>. Uma roupa recolore o Branco e o servidor desenha; um personagem \u00e9 o desenho dele mesmo em cada pose e cada dire\u00e7\u00e3o. Uns quarenta arquivos, nomeados pela a\u00e7\u00e3o e pela dire\u00e7\u00e3o.',
    'Select every file in the folder at once. The rows marked <b>needed</b> are the ones people actually look at: finish only those and the character still works. There is <b>no import for a whole character</b> at the other end yet, so a finished one is handed over as its folder.':
      'Selecione todos os arquivos da pasta de uma vez. As linhas marcadas <b>preciso</b> s\u00e3o as que as pessoas realmente olham: termine s\u00f3 essas e o personagem j\u00e1 funciona. Ainda <b>n\u00e3o existe importa\u00e7\u00e3o de personagem inteiro</b> do outro lado, ent\u00e3o um pronto \u00e9 entregue como pasta.',
    'A costume is <b>not a drawing</b>. The server keeps ten parts, each with a colour and some of them a pattern, and makes the 37 sheets itself from the White\'s own shape. You choose the parts; it does the rest.':
      'Uma roupa <b>n\u00e3o \u00e9 um desenho</b>. O servidor guarda dez partes, cada uma com uma cor e algumas com um padr\u00e3o, e faz as 37 folhas sozinho a partir da forma do pr\u00f3prio Branco. Voc\u00ea escolhe as partes; ele faz o resto.',
    'This one <b>is</b> real artwork, and it is a set: the bomb itself and the flame it makes. Only <code>bomb.spr</code> is required, so a skin that changes nothing but the bomb is <b>one file</b>.':
      'Esta <b>\u00e9</b> arte de verdade, e \u00e9 um conjunto: a bomba e a chama que ela faz. S\u00f3 <code>bomb.spr</code> \u00e9 obrigat\u00f3rio, ent\u00e3o uma skin que muda s\u00f3 a bomba \u00e9 <b>um arquivo</b>.',
    'A map is a grid, where people start, and what the breakable blocks hide. <b>There is no artwork in it</b>: the theme decides which set of tiles draws it, so you are laying out a room, not painting one.':
      'Um mapa \u00e9 uma grade, onde as pessoas come\u00e7am, e o que os blocos quebr\u00e1veis escondem. <b>N\u00e3o tem arte nenhuma nele</b>: o tema decide qual conjunto de pe\u00e7as desenha, ent\u00e3o voc\u00ea est\u00e1 montando uma sala, n\u00e3o pintando uma.',
    'The picture drawn <b>around</b> the arena. The grid sits on top of it, in the middle, so the part of your picture that shows is the border. <b>One file</b>, a PNG, at one of three exact sizes.':
      'A imagem desenhada <b>em volta</b> da arena. A grade fica por cima dela, no meio, ent\u00e3o a parte da sua imagem que aparece \u00e9 a moldura. <b>Um arquivo</b>, um PNG, em um de tr\u00eas tamanhos exatos.',
    'The big one. A costume recolours the White and the server draws it; a character is <b>its own drawing in every pose and every facing</b>. About forty files, and they all have to agree with one another.':
      'A grande. Uma roupa recolore o Branco e o servidor desenha; um personagem \u00e9 <b>o desenho dele mesmo em cada pose e cada dire\u00e7\u00e3o</b>. Uns quarenta arquivos, e todos t\u00eam que combinar entre si.',
    'Each row is one part. <b>Keep the White\'s</b> leaves it alone; <b>Colour</b> gives it your own; <b>Same as</b> makes it follow another part, which is how a belt and a buckle match.':
      'Cada linha \u00e9 uma parte. <b>Manter a do Branco</b> deixa como est\u00e1; <b>Cor</b> d\u00e1 uma sua; <b>Igual a</b> faz ela seguir outra parte, que \u00e9 como um cinto e uma fivela combinam.',
    'One file, <code>costume.json</code>. It holds the ten parts and nothing else, so it is small and easy to read before anyone imports it.':
      'Um arquivo, <code>costume.json</code>. Ele guarda as dez partes e nada mais, ent\u00e3o \u00e9 pequeno e f\u00e1cil de ler antes de algu\u00e9m importar.',
    'The names are fixed: the server looks for exactly these. Three are sprites (<code>.spr</code>) and nine are effects (<code>.eft</code>), and <b>all twelve open in this editor</b>. Each is capped at 512 kB.':
      'Os nomes s\u00e3o fixos: o servidor procura exatamente estes. Tr\u00eas s\u00e3o sprites (<code>.spr</code>) e nove s\u00e3o efeitos (<code>.eft</code>), e <b>todos os doze abrem neste editor</b>. Cada um tem limite de 512 kB.',
    'Drag to paint. The rim has to stay the outer wall, and a start needs floor under it, so the editor refuses both rather than letting you make a map that will be rejected.':
      'Arraste para pintar. A borda tem que continuar sendo o muro externo, e um ponto de in\u00edcio precisa de ch\u00e3o embaixo, ent\u00e3o o editor recusa os dois em vez de deixar voc\u00ea fazer um mapa que vai ser rejeitado.',
    'These go inside the breakable blocks, so there has to be room for them. At most 40 of any one.':
      'Eles ficam dentro dos blocos quebr\u00e1veis, ent\u00e3o tem que haver espa\u00e7o. No m\u00e1ximo 40 de cada um.',
    'A map uses only the size that matches it, so make the one you need. Nothing is scaled: paint at the size it will be shown. Up to 4 MB.':
      'Um mapa usa s\u00f3 o tamanho que combina com ele, ent\u00e3o fa\u00e7a o que voc\u00ea precisa. Nada \u00e9 redimensionado: pinte no tamanho em que vai aparecer. At\u00e9 4 MB.',
    'The rows marked green are the ones people actually look at. If you only ever finish those, the character still works.':
      'As linhas em verde s\u00e3o as que as pessoas realmente olham. Se voc\u00ea s\u00f3 terminar essas, o personagem j\u00e1 funciona.'
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
