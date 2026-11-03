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
