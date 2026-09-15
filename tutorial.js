/* The guide, as a panel inside the editor.

   Written as diagrams rather than screenshots on purpose. A screenshot
   of this interface would be a bitmap that goes stale the moment a
   button moves, would need to exist twice for the light and dark
   themes, and would weigh more than the whole editor. These draw the
   same layout in SVG: sharp at any size, themed by the same tokens the
   real interface uses, and small enough to ship inline.

   The arrows are dashed and violet, a colour nothing else in the
   interface uses, so a callout never reads as part of the thing it is
   pointing at. */

/* ------------------------------ drawing -------------------------- */
/* A dashed arrow from one point to another, with the head drawn as two
   strokes so it inherits currentColor along with the shaft. */
function tutArrow(x1, y1, x2, y2, bend) {
  const mx = (x1 + x2) / 2 + (bend || 0);
  const my = (y1 + y2) / 2;
  const a = Math.atan2(y2 - my, x2 - mx);
  const h = 9;
  const p1 = [x2 - h * Math.cos(a - 0.42), y2 - h * Math.sin(a - 0.42)];
  const p2 = [x2 - h * Math.cos(a + 0.42), y2 - h * Math.sin(a + 0.42)];
  return '<path class="tArrow" d="M' + x1 + ' ' + y1 + 'Q' + mx + ' ' + my +
         ' ' + x2 + ' ' + y2 + '"/>' +
         '<path class="tHead" d="M' + p1[0].toFixed(1) + ' ' + p1[1].toFixed(1) +
         'L' + x2 + ' ' + y2 + 'L' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1) + '"/>';
}

function tutLabel(x, y, text, anchor) {
  return '<text class="tLbl" x="' + x + '" y="' + y + '"' +
         (anchor ? ' text-anchor="' + anchor + '"' : '') + '>' +
         text.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</text>';
}

function tutRing(x, y, w, h) {
  return '<rect class="tRing" x="' + x + '" y="' + y + '" width="' + w +
         '" height="' + h + '" rx="4"/>';
}

/* The whole window, to scale, inside a margin wide enough for the
   callouts to sit outside it. Arrows that cross the picture are worse
   than no arrows: the first version of this had five of them meeting in
   the middle of the figure. */
function tutShell() {
  const g = [];
  const X = 92, Y = 54, W = 470, H = 262;   /* the window */
  g.push('<rect class="tWin" x="' + X + '" y="' + Y + '" width="' + W +
         '" height="' + H + '" rx="7"/>');
  /* action bar */
  g.push('<rect class="tBar" x="' + X + '" y="' + Y + '" width="' + W + '" height="26"/>');
  for (let i = 0; i < 6; i++) {
    g.push('<rect class="tBtn" x="' + (X + 54 + i * 62) + '" y="' + (Y + 7) +
           '" width="54" height="12" rx="3"/>');
  }
  g.push(tutLabel(X + 10, Y + 17, 'MXW'));
  /* tabs */
  g.push('<rect class="tTabs" x="' + X + '" y="' + (Y + 26) + '" width="' + W + '" height="20"/>');
  g.push('<rect class="tTabOn" x="' + (X + 4) + '" y="' + (Y + 28) + '" width="104" height="17" rx="2"/>');
  g.push('<rect class="tSub" x="' + (X + 112) + '" y="' + (Y + 31) + '" width="38" height="11" rx="3"/>');
  g.push('<rect class="tSubOn" x="' + (X + 154) + '" y="' + (Y + 31) + '" width="38" height="11" rx="3"/>');
  /* rail */
  g.push('<rect class="tRail" x="' + X + '" y="' + (Y + 46) + '" width="30" height="' + (H - 64) + '"/>');
  for (let i = 0; i < 8; i++) {
    g.push('<rect class="tTool" x="' + (X + 6) + '" y="' + (Y + 52 + i * 23) +
           '" width="18" height="17" rx="3"/>');
  }
  /* viewport */
  g.push('<rect class="tView" x="' + (X + 30) + '" y="' + (Y + 46) +
         '" width="' + (W - 190) + '" height="' + (H - 64) + '"/>');
  const cx = X + 30 + (W - 190) / 2;
  g.push('<circle class="tFig" cx="' + cx + '" cy="' + (Y + 100) + '" r="22"/>');
  g.push('<rect class="tFig" x="' + (cx - 15) + '" y="' + (Y + 126) +
         '" width="30" height="64" rx="10"/>');
  /* docks */
  g.push('<rect class="tSide" x="' + (X + W - 160) + '" y="' + (Y + 46) +
         '" width="160" height="' + (H - 64) + '"/>');
  for (let i = 0; i < 5; i++) {
    g.push('<rect class="tDock" x="' + (X + W - 154) + '" y="' + (Y + 52 + i * 38) +
           '" width="148" height="31" rx="3"/>');
  }
  /* status */
  g.push('<rect class="tStat" x="' + X + '" y="' + (Y + H - 18) +
         '" width="' + W + '" height="18"/>');

  /* callouts, each one short and outside the window */
  g.push(tutArrow(X + 250, 24, X + 250, Y + 6, 0));
  g.push(tutLabel(X + 250, 16, '1. actions for the file you have open', 'middle'));

  g.push(tutArrow(86, Y + 36, X - 4, Y + 36, 0));
  g.push(tutLabel(82, Y + 33, '2. open', 'end'));
  g.push(tutLabel(82, Y + 46, 'documents', 'end'));

  g.push(tutArrow(66, Y + 150, X + 4, Y + 150, 0));
  g.push(tutLabel(62, Y + 147, '3. drawing', 'end'));
  g.push(tutLabel(62, Y + 160, 'tools', 'end'));

  g.push(tutArrow(cx, Y + H + 40, cx, Y + H + 4, 0));
  g.push(tutLabel(cx, Y + H + 54, '4. the canvas', 'middle'));

  g.push(tutArrow(X + W + 36, Y + 120, X + W + 2, Y + 120, 0));
  g.push(tutLabel(X + W + 40, Y + 117, '5. panels', 'start'));
  g.push(tutLabel(X + W + 40, Y + 130, 'for what is', 'start'));
  g.push(tutLabel(X + W + 40, Y + 143, 'open', 'start'));

  g.push(tutArrow(X + 180, Y + H + 40, X + 60, Y + H - 6, -30));
  g.push(tutLabel(X + 186, Y + H + 44, '6. does it write back unchanged', 'start'));
  return g.join('');
}

/* ------------------------------ content -------------------------- */
const TUTORIAL = [
{
  id: 'start',
  title: 'The shape of the window',
  body: function () {
    return '' +
    '<p>Five regions, and each one keeps to its job. Nothing moves around ' +
    'as you work, so once you know where a thing lives it stays there.</p>' +
    '<figure class="tFigW"><svg viewBox="0 0 660 390" class="tSvg">' +
      tutShell() +
    '</svg></figure>' +
    '<ol class="tSteps">' +
    '<li><b>The action bar</b> across the top holds what you can <i>do</i> ' +
    'with the file that is open. It changes with the kind of file, the way ' +
    'a tool palette changes with the tool, so you never see a button that ' +
    'cannot apply.</li>' +
    '<li><b>The tab row</b> under it lists everything open. A texture you ' +
    'are editing appears as a small tab <i>inside</i> its own file, beside ' +
    'a <code>model</code> tab, so the file never disappears while you work ' +
    'on a piece of it.</li>' +
    '<li><b>The tool rail</b> on the left is the brush, the eraser, the ' +
    'selection and so on. It only appears while the pixel editor is open, ' +
    'because every tool on it acts on pixels.</li>' +
    '<li><b>The canvas</b> in the middle is the 3D view, the sprite ' +
    'playback or the pixel editor, depending on what you are looking at.</li>' +
    '<li><b>The panels</b> on the right describe and change what is open. ' +
    'Click a heading to fold one away.</li>' +
    '</ol>' +
    '<p class="tNote">Everything runs in your browser. Nothing you open ' +
    'is uploaded anywhere, and nothing is written back to your files ' +
    'until you save.</p>';
  }
},
{
  id: 'open',
  title: 'Opening something',
  body: function () {
    return '' +
    '<p>Drop a file anywhere on the page, or press <b>Open</b>. Several at ' +
    'once is fine.</p>' +
    '<table class="tTable"><thead><tr><th>extension</th><th>what it is</th>' +
    '<th>what you get</th></tr></thead><tbody>' +
    '<tr><td><code>.bin</code> <code>.MXW</code></td><td>a mesh container</td>' +
    '<td>3D view, textures, skeleton, motion</td></tr>' +
    '<tr><td><code>.gra</code> <code>.spr</code></td><td>a sprite sheet</td>' +
    '<td>frame playback, recolouring, pixel editing</td></tr>' +
    '<tr><td><code>.obj</code></td><td>geometry from a modeller</td>' +
    '<td>a new mesh, or new geometry for the one open</td></tr>' +
    '<tr><td>any image</td><td>PNG, GIF, JPEG</td>' +
    '<td>replaces the selected texture or sprite frame</td></tr>' +
    '</tbody></table>' +
    '<p>Load a body and some clothes together, then turn on <b>Dress-up</b> ' +
    'in the View panel. Every piece is authored in one shared coordinate ' +
    'space, so they line up with no fitting at all.</p>' +
    '<p class="tNote">The status line at the bottom right always says ' +
    'whether the file would write back <b>byte for byte identical</b>. ' +
    'While it says <i>unchanged</i>, you have altered nothing.</p>';
  }
},
{
  id: 'view',
  title: 'Looking at a model',
  body: function () {
    return '' +
    '<p>Drag to orbit, wheel to zoom, right button to pan. The <b>View</b> ' +
    'panel has the named angles.</p>' +
    '<figure class="tFigW"><svg viewBox="0 0 580 230" class="tSvg">' +
      '<rect class="tWin" x="10" y="10" width="360" height="200" rx="6"/>' +
      '<rect class="tView" x="10" y="10" width="360" height="200"/>' +
      '<circle class="tFig" cx="150" cy="70" r="26"/>' +
      '<rect class="tFig" x="132" y="100" width="36" height="80" rx="12"/>' +
      '<rect class="tSide" x="382" y="10" width="188" height="200" rx="6"/>' +
      tutLabel(392, 30, 'View') +
      '<rect class="tBtnOn" x="392" y="38" width="40" height="16" rx="3"/>' +
      '<rect class="tBtn" x="436" y="38" width="40" height="16" rx="3"/>' +
      '<rect class="tBtn" x="480" y="38" width="40" height="16" rx="3"/>' +
      tutLabel(392, 78, 'Display') +
      '<rect class="tBtn" x="392" y="86" width="52" height="16" rx="3"/>' +
      '<rect class="tBtn" x="448" y="86" width="52" height="16" rx="3"/>' +
      '<rect class="tBtn" x="504" y="86" width="52" height="16" rx="3"/>' +
      tutArrow(300, 215, 412, 60, 20) +
      tutLabel(290, 226, 'Face, Front, Back, Left, Right, Top, Whole', 'middle') +
      tutArrow(520, 140, 420, 108, -20) +
      tutLabel(530, 152, 'wireframe, normals, skeleton, axes, Dress-up', 'end') +
    '</svg></figure>' +
    '<p>The figures face away from you at first glance for a reason worth ' +
    'knowing: they are authored facing <b>minus Z</b>. That was measured, ' +
    'not assumed. The toes reach that way, an item worn on the back sits ' +
    'at plus Z, and a hair band worn as a fringe sits at minus Z. So ' +
    '<b>Front</b>, <b>Face</b> and <b>Whole</b> all look from that side ' +
    'and the model faces you.</p>' +
    '<p>Right-click inside the view for the same angles plus the display ' +
    'toggles, without reaching for the panel.</p>';
  }
},
{
  id: 'textures',
  title: 'Textures, and which ones go where',
  body: function () {
    return '' +
    '<p>The <b>Textures</b> panel shows every image the file carries, each ' +
    'one captioned with the slot it belongs to.</p>' +
    '<p>A body names two textures and ships ten. Image 0 is the body skin, ' +
    'image 1 a blank head, and images 2 to 9 are facial expressions. ' +
    'Clicking one shows it <b>where it belongs</b>, on the head, without ' +
    'moving the camera. Picking a texture is choosing what to look at, not ' +
    'where to look from.</p>' +
    '<figure class="tFigW"><svg viewBox="0 0 580 250" class="tSvg">' +
      '<rect class="tSide" x="10" y="10" width="270" height="230" rx="6"/>' +
      tutLabel(20, 30, 'Textures') +
      (function () {
        const out = [];
        for (let i = 0; i < 9; i++) {
          const x = 22 + (i % 3) * 86, y = 40 + Math.floor(i / 3) * 66;
          out.push('<rect class="' + (i === 4 ? 'tThumbOn' : 'tThumb') +
                   '" x="' + x + '" y="' + y + '" width="76" height="56" rx="4"/>');
          out.push(tutLabel(x + 38, y + 68, 'tex' + i, 'middle'));
        }
        return out.join('');
      })() +
      '<rect class="tView" x="300" y="10" width="270" height="230" rx="6"/>' +
      '<circle class="tFig" cx="435" cy="90" r="46"/>' +
      '<rect class="tRing" x="410" y="70" width="50" height="34" rx="6"/>' +
      tutArrow(190, 130, 404, 92, -30) +
      tutLabel(150, 235, 'the one you click appears on the head', 'start') +
    '</svg></figure>' +
    '<p>Under the grid, the <b>UV layout</b> of the faces that use this ' +
    'texture is drawn over it, so you can see where to paint. Two colours ' +
    'matter there:</p>' +
    '<ul class="tList">' +
    '<li><span class="tSwatch tCy"></span><b>Cyan</b>: this face uses these ' +
    'texels and nothing else does.</li>' +
    '<li><span class="tSwatch tAm"></span><b>Amber</b>: another face samples ' +
    'the same texels, so whatever you paint there appears more than once.</li>' +
    '</ul>' +
    '<p>About half a head is mapped that way. Paint the forehead and it ' +
    'shows on both sides, which is the file being economical rather than a ' +
    'fault. Each eye has its own space, so those you can paint ' +
    'independently. Measured on one body: the texel at 12,20 is used by ' +
    'faces at x +820 and x -820, while the texel at 34,72 is used by one ' +
    'face at x -369 alone.</p>' +
    '<p>Right-click a thumbnail for everything you can do to that one ' +
    'image: edit it, show it on the model, replace it from a file, save it, ' +
    'save the whole slot as one animation, or save its UV layout as a ' +
    'PNG guide.</p>';
  }
},
{
  id: 'paint',
  title: 'The pixel editor',
  body: function () {
    return '' +
    '<p>Press <b>Edit texture</b>, or <b>Edit frame</b> on a sprite, or ' +
    'right-click what you want and choose it. The editor opens as a tab ' +
    'inside the file it came from.</p>' +
    '<figure class="tFigW"><svg viewBox="0 0 580 250" class="tSvg">' +
      '<rect class="tTabs" x="10" y="10" width="560" height="26" rx="4"/>' +
      '<rect class="tTabOn" x="14" y="13" width="150" height="20" rx="3"/>' +
      tutLabel(24, 27, '1210001.bin') +
      '<rect class="tSub" x="170" y="16" width="46" height="14" rx="3"/>' +
      tutLabel(178, 27, 'model') +
      '<rect class="tSubOn" x="222" y="16" width="56" height="14" rx="3"/>' +
      tutLabel(230, 27, 'tex3') +
      '<circle class="tDot" cx="266" cy="23" r="3"/>' +
      tutArrow(150, 90, 192, 38, -20) + tutLabel(148, 104, 'back to the model, edit still open', 'middle') +
      tutArrow(420, 90, 272, 38, 30) + tutLabel(430, 104, 'the dot means not applied yet', 'start') +
      '<rect class="tRail" x="10" y="130" width="40" height="110" rx="4"/>' +
      (function () {
        const o = [];
        for (let i = 0; i < 4; i++) {
          o.push('<rect class="tTool" x="17" y="' + (138 + i * 25) + '" width="26" height="20" rx="3"/>');
        }
        return o.join('');
      })() +
      '<rect class="tView" x="58" y="130" width="170" height="110" rx="4"/>' +
      '<rect class="tRing" x="70" y="142" width="146" height="86" rx="3"/>' +
      tutArrow(330, 200, 234, 185, 0) +
      tutLabel(340, 205, 'the texture, with its UV layout on top', 'start') +
    '</svg></figure>' +
    '<h4>The tools</h4>' +
    '<p>Brush, eraser, flood fill, eyedropper, line, rectangle, filled ' +
    'rectangle, rectangular select, and move the selection. Under them: ' +
    'undo and redo, then flip, centre and erase the selection, then the ' +
    'pixel grid and the UV overlay.</p>' +
    '<h4>Worth knowing</h4>' +
    '<ul class="tList">' +
    '<li><b>Layers.</b> Draw over the original without destroying it. No ' +
    'file format here stores layers, so they are flattened when you apply, ' +
    'but until then you can back out of anything.</li>' +
    '<li><b>Mirror.</b> Set it to left and right and the other half is ' +
    'painted as you go, about the middle of the image. A face is drawn ' +
    'symmetrically, so this halves the work.</li>' +
    '<li><b>Onion skin.</b> On a sprite frame, the frames either side show ' +
    'through faintly underneath, so a pose is judged against the one ' +
    'before it rather than on its own.</li>' +
    '<li><b>Reserved colours.</b> 64 values are substituted at run time, ' +
    'which is how one sheet serves every team colour. The panel shows them ' +
    'and warns you when the colour in your hand is one of them. Paint with ' +
    'one by accident and it looks right here and changes colour later.</li>' +
    '</ul>' +
    '<h4>Keys</h4>' +
    '<p><code>B</code> brush, <code>E</code> eraser, <code>G</code> fill, ' +
    '<code>I</code> pick, <code>L</code> line, <code>R</code> rectangle, ' +
    '<code>F</code> filled, <code>M</code> select, <code>V</code> move. ' +
    '<code>[</code> and <code>]</code> size the brush, <code>+</code> and ' +
    '<code>-</code> zoom, <code>alt</code> picks a colour without leaving ' +
    'the brush, <code>ctrl+Z</code> undoes, <code>Esc</code> steps back to ' +
    'the model and keeps the edit.</p>' +
    '<p class="tNote">Several edits can be open at once, one per slot. A ' +
    'face and a body together is fine and both show on the model at the ' +
    'same time. Two faces is not, because the model can only wear one, so ' +
    'opening a second face replaces the first and asks first if there is ' +
    'unapplied work.</p>';
  }
},
{
  id: 'sprites',
  title: 'Sprite sheets',
  body: function () {
    return '' +
    '<p>Drop a <code>.gra</code> or <code>.spr</code> and the page switches ' +
    'to sprite mode: the frame strip, playback, the colour grid.</p>' +
    '<ul class="tList">' +
    '<li><b>Remap a colour</b> or <b>shift hue, saturation and lightness</b> ' +
    'across <i>every frame at once</i>. The frames of one sheet are the same ' +
    'artwork in different poses, so a colour change belongs to the whole ' +
    'animation. Both tools default to all frames.</li>' +
    '<li><b>Team preview</b> shows how the runtime will recolour the sheet, ' +
    'and the panel reports what fraction sits in the reserved ramp. On a ' +
    'character sheet that is usually more than half.</li>' +
    '<li><b>Frames</b> can be added, duplicated and deleted.</li>' +
    '<li><b>Export a frame or a strip as PNG</b>, edit it anywhere, and drop ' +
    'it back. A strip exactly as wide as all the frames side by side is ' +
    'sliced across them. Anything else replaces the current frame, scaled ' +
    'to fit.</li>' +
    '</ul>';
  }
},
{
  id: 'motion',
  title: 'Posing and motion',
  body: function () {
    return '' +
    '<p>Open a body and the <b>Motion</b> panel comes alive. The eight ' +
    'actions at the top are named after the action set the sprite sheets ' +
    'carry, with their frame counts.</p>' +
    '<figure class="tFigW"><svg viewBox="0 0 580 210" class="tSvg">' +
      '<rect class="tSide" x="200" y="10" width="370" height="190" rx="6"/>' +
      tutLabel(212, 30, 'Motion') +
      (function () {
        const names = ['Stand ST', 'Walk WA', 'Carry MO', 'Hit PA',
                       'Push PU', 'Throw TH', 'Down DD', 'Win WI'];
        const o = [];
        names.forEach((n, i) => {
          const x = 212 + (i % 4) * 88, y = 38 + Math.floor(i / 4) * 24;
          o.push('<rect class="' + (i === 1 ? 'tBtnOn' : 'tBtn') + '" x="' + x +
                 '" y="' + y + '" width="82" height="18" rx="3"/>');
          o.push(tutLabel(x + 41, y + 13, n, 'middle'));
        });
        return o.join('');
      })() +
      '<rect class="tBtn" x="212" y="94" width="60" height="16" rx="3"/>' +
      tutLabel(218, 106, 'Play') +
      '<rect class="tBtn" x="276" y="94" width="60" height="16" rx="3"/>' +
      tutLabel(282, 106, 'Stop') +
      '<rect class="tSlider" x="212" y="120" width="340" height="6" rx="3"/>' +
      '<circle class="tKnob" cx="290" cy="123" r="6"/>' +
      tutLabel(212, 146, 'frame') +
      '<rect class="tSlider" x="212" y="158" width="340" height="6" rx="3"/>' +
      '<circle class="tKnob" cx="380" cy="161" r="6"/>' +
      tutLabel(212, 184, 'a slider per axis, for the bone you pick') +
      '<rect class="tView" x="10" y="10" width="180" height="190" rx="6"/>' +
      '<circle class="tFig" cx="100" cy="60" r="22"/>' +
      '<rect class="tFig" x="86" y="86" width="28" height="60" rx="9"/>' +
      tutArrow(120, 175, 100, 150, 0) +
      tutLabel(120, 192, 'it moves as you scrub', 'middle') +
    '</svg></figure>' +
    '<p>Under the list, <b>Pose a bone</b> gives you a bone by name and a ' +
    'slider per axis. Which axis does what was measured on the rig rather ' +
    'than guessed, and it is not the same for every part:</p>' +
    '<table class="tTable"><thead><tr><th>part</th><th>swing</th>' +
    '<th>lift</th><th>twist</th></tr></thead><tbody>' +
    '<tr><td>hips, spine, chest</td><td>bends sideways</td>' +
    '<td>leans forward or back</td><td>turns on the spot</td></tr>' +
    '<tr><td>neck</td><td>nods</td><td>turns</td><td></td></tr>' +
    '<tr><td>upper arm</td><td>swings forward</td><td>raises sideways</td>' +
    '<td>rolls</td></tr>' +
    '<tr><td>forearm</td><td>bends the elbow</td>' +
    '<td>crosses the chest</td><td></td></tr>' +
    '<tr><td>thigh</td><td>steps</td><td>spreads</td><td></td></tr>' +
    '<tr><td>shin</td><td>bends the knee</td><td></td><td></td></tr>' +
    '</tbody></table>' +
    '<p><b>Clothes follow the body.</b> An item carries a bone table that ' +
    'indexes the body skeleton, so hair follows the head bone and a jacket ' +
    'follows the hips, spine, chest, arms and wrists. Dress-up plus a ' +
    'motion is a dressed figure in movement, with nothing to set up.</p>' +
    '<p class="tNote">The joint angles in these motions are ours, not ' +
    'original data. No motion file for the 3D bodies survives anywhere we ' +
    'could find, and the docs list everything that was ruled out looking ' +
    'for it. What is original is the rig: the bone order, the parent chain, ' +
    'the rest pose and which vertices follow which bone. A real motion file ' +
    'carries one track per bone, 74 on one body and 75 on the other, which ' +
    'is the shape the player here already expects. Load one with <b>Load a ' +
    'motion</b>.</p>';
  }
},
{
  id: 'create',
  title: 'Starting a mesh from nothing',
  body: function () {
    return '' +
    '<p>The <b>Create and transform</b> panel builds a card, a box, a ' +
    'cylinder, a cone, a sphere or a ring. Each opens as its own file, so ' +
    'starting something new never costs you what you had open.</p>' +
    '<p>Sizes are in the units the meshes use, where a body runs about 7090 ' +
    'tall:</p>' +
    '<table class="tTable"><tbody>' +
    '<tr><td><code>1000</code></td><td>roughly a hand</td></tr>' +
    '<tr><td><code>4300</code></td><td>shoulder height</td></tr>' +
    '<tr><td><code>5600</code></td><td>head height</td></tr>' +
    '</tbody></table>' +
    '<p>The <b>height</b> slider lifts the new shape off the floor, which is ' +
    'how a piece lands where it is worn instead of at the feet.</p>' +
    '<h4>Moving a finished mesh</h4>' +
    '<p>Scale, 90 degree turns about each axis, mirror on each axis, raise, ' +
    'centre on X and Z, drop to the floor. Two of those are less obvious ' +
    'than they look:</p>' +
    '<ul class="tList">' +
    '<li><b>Mirror</b> flips the face winding along with the geometry. ' +
    'Without that the mesh comes out inside out, lit as though you were ' +
    'seeing the back of every surface.</li>' +
    '<li><b>Centre</b> deliberately leaves the vertical alone. A piece is ' +
    'worn at a height, and centring it on Y would take it off the body.</li>' +
    '</ul>' +
    '<p>Coordinates are stored as 16 bit integers, so anything pushed past ' +
    '32767 is clamped and the message says how much.</p>' +
    '<p class="tNote">A new shape carries no texture. Drop an image on it, ' +
    'or use <b>Replace texture</b>. A mesh with an empty texture list ' +
    'references no image at all, which a reader may refuse.</p>';
  }
},
{
  id: 'export',
  title: 'Saving and exporting',
  body: function () {
    return '' +
    '<p>Two different things, worth keeping apart.</p>' +
    '<h4>Saving the file itself</h4>' +
    '<p><b>Save .bin</b> writes the container back. <b>Save sprite</b> does ' +
    'the same for a sheet. The badge at the bottom right tells you whether ' +
    'anything has changed: while it reads <i>unchanged, writes back byte ' +
    'identical</i>, the file you would save is the file you opened, to the ' +
    'byte.</p>' +
    '<h4>Save .GIF, which follows what you are looking at</h4>' +
    '<p>One button per mode, and the rule is: <b>whatever is on screen, and ' +
    'if it is one of a set, the whole set</b>.</p>' +
    '<table class="tTable"><thead><tr><th>where you are</th>' +
    '<th>what you get</th></tr></thead><tbody>' +
    '<tr><td>the model, a motion loaded</td><td>the motion, transparent, ' +
    'cropped to what is drawn</td></tr>' +
    '<tr><td>the model, no motion</td><td>a turntable</td></tr>' +
    '<tr><td>editing a texture</td><td>every texture of that slot as one ' +
    'animation</td></tr>' +
    '<tr><td>a texture with no siblings</td><td>that one image, and if you ' +
    'have not painted on it, the stored bytes rather than a re-encode</td></tr>' +
    '<tr><td>a sprite</td><td>the whole animation</td></tr>' +
    '</tbody></table>' +
    '<p>It asks for a size first, as a percentage, and shows the pixels it ' +
    'will produce. The percentage works the way the wheel does. A frame or ' +
    'texture part way through an edit goes in as it stands, so what you save ' +
    'is what you see, and nothing has to be applied first.</p>' +
    '<p>The axis cross and the skeleton overlay are left out. They belong to ' +
    'the editor, not to the model.</p>' +
    '<h4>Other ways out</h4>' +
    '<ul class="tList">' +
    '<li><b>Export .OBJ</b> and <b>Import .OBJ</b>, so geometry can go ' +
    'through any modeller. The round trip is lossless against this editor ' +
    'own export. An OBJ carries no textures, no material bindings and no ' +
    'skeleton, so importing into a loaded file keeps those and swaps only ' +
    'the geometry.</li>' +
    '<li><b>Save UV .PNG</b> for a painting guide.</li>' +
    '<li><b>Save frame .PNG</b> and <b>Save strip .PNG</b> on a sprite.</li>' +
    '</ul>';
  }
},
{
  id: 'compat',
  title: 'What will load again, and what will not',
  body: function () {
    return '' +
    '<p>The honest answer to "can I edit this and use it": for meshes and ' +
    'sprites, yes, and it is measured rather than hoped. Every distinct ' +
    'file in a 3.1 GB archive was read, written back and compared:</p>' +
    '<table class="tTable"><thead><tr><th>class</th><th>read</th>' +
    '<th>written back identical</th><th>editable here</th></tr></thead>' +
    '<tbody>' +
    '<tr><td>mesh <code>.bin</code> <code>.MXW</code></td><td>50</td>' +
    '<td class="tYes">50 of 50</td><td>geometry, textures, names, ' +
    'bindings, mesh id</td></tr>' +
    '<tr><td>sprite <code>.gra</code> <code>.spr</code></td><td>1535</td>' +
    '<td class="tYes">1535 of 1535</td><td>frames, colours, pixels</td></tr>' +
    '<tr><td>item index</td><td>1</td><td class="tYes">identical</td>' +
    '<td>through the Python decoder</td></tr>' +
    '<tr><td>effects <code>.eft</code></td><td>first group only</td>' +
    '<td class="tNo">not written</td><td class="tNo">no</td></tr>' +
    '<tr><td>map block and layout</td><td>recognised</td>' +
    '<td class="tNo">not written</td><td class="tNo">not yet</td></tr>' +
    '<tr><td>encrypted caches</td><td class="tNo">no</td>' +
    '<td class="tNo">no</td><td class="tNo">no</td></tr>' +
    '</tbody></table>' +
    '<p>So: a skin, a face, an item, a bomb sheet, a character sheet, a ' +
    'ring effect that ships as <code>.gra</code>, all of those you can edit ' +
    'here and write back with nothing else touched. Byte identical when you ' +
    'change nothing is the whole point of that column: it means the writer ' +
    'agrees with the reader on every field, including the ones this editor ' +
    'does not expose.</p>' +
    '<p><b>What you cannot do yet.</b> Most effects are ' +
    '<code>.eft</code>, and that is 130 files against 27 <code>.gra</code> ' +
    'in the effect folders. The first group of an <code>.eft</code> decodes ' +
    'and the section after it does not, so they are refused rather than ' +
    'opened wrongly and written back broken. Map grids are recognised but ' +
    'have no editor. The encrypted caches sit at 8.000 bits of entropy per ' +
    'byte with no known plaintext foothold.</p>' +
    '<p class="tNote">Two guards are worth trusting. A file that is not ' +
    'what it claims is <b>refused with a reason</b> rather than opened and ' +
    'mangled. And the <b>Health</b> section reports what parses fine but is ' +
    'still worth knowing before you save: faces with no area, unused ' +
    'vertices, texture coordinates out of bounds, faces wound against their ' +
    'own normals, a bone table that does not cover every vertex.</p>';
  }
},
{
  id: 'menus',
  title: 'Right-click, everywhere',
  body: function () {
    return '' +
    '<p>Every part of the interface offers what applies to it. Faster than ' +
    'the panels once you know it is there.</p>' +
    '<table class="tTable"><thead><tr><th>right-click on</th>' +
    '<th>you get</th></tr></thead><tbody>' +
    '<tr><td>a texture thumbnail</td><td>edit, show on the model, replace, ' +
    'save one, save the slot, save its UV</td></tr>' +
    '<tr><td>a file tab</td><td>save, export and import OBJ, edit the ' +
    'texture, close</td></tr>' +
    '<tr><td>an open edit tab</td><td>open it, apply it, discard it</td></tr>' +
    '<tr><td>a layer</td><td>hide, merge down, delete, add above, erase the ' +
    'selection</td></tr>' +
    '<tr><td>a sprite frame</td><td>edit, duplicate, delete, save PNG, ' +
    'replace, save the animation</td></tr>' +
    '<tr><td>the 3D view</td><td>the angles, wireframe, skeleton, axes, ' +
    'spin, Dress-up</td></tr>' +
    '<tr><td>the pixel canvas</td><td>undo, redo, selection, flips, layers, ' +
    'apply, discard</td></tr>' +
    '</tbody></table>';
  }
},
{
  id: 'recipes',
  title: 'Four things, start to finish',
  body: function () {
    return '' +
    '<h4>Repaint a face</h4>' +
    '<ol class="tSteps">' +
    '<li>Open a body <code>.bin</code>.</li>' +
    '<li>In <b>Textures</b>, right-click the expression you want and choose ' +
    '<b>Edit this texture</b>.</li>' +
    '<li>Turn <b>mirror</b> to left and right, and paint. Watch the model ' +
    'panel: every stroke lands on the figure as you make it.</li>' +
    '<li>Stay inside the cyan outlines. Amber means both sides.</li>' +
    '<li><b>Apply</b>, then <b>Save .bin</b>.</li>' +
    '</ol>' +
    '<h4>Recolour a sprite sheet</h4>' +
    '<ol class="tSteps">' +
    '<li>Open a <code>.gra</code>.</li>' +
    '<li>Pick a colour in the grid, choose the new one, press <b>Remap ' +
    'colour</b>. It applies to every frame, which is almost always what you ' +
    'want.</li>' +
    '<li>Check <b>Team preview</b>. If the panel says a large fraction sits ' +
    'in the reserved ramp, expect the runtime to recolour that much.</li>' +
    '<li><b>Save sprite</b>.</li>' +
    '</ol>' +
    '<h4>Build an item from nothing</h4>' +
    '<ol class="tSteps">' +
    '<li><b>Create and transform</b>, set the size and the height, press ' +
    '<b>Card</b> or <b>Box</b>.</li>' +
    '<li>Drop an image on it to give it a texture.</li>' +
    '<li>Use the turns and mirrors until it sits right. Open a body ' +
    'alongside and turn on <b>Dress-up</b> to see it in place.</li>' +
    '<li>Check the <b>Health</b> section, then <b>Save .bin</b>.</li>' +
    '</ol>' +
    '<h4>Make a picture of your work</h4>' +
    '<ol class="tSteps">' +
    '<li>Dress the figure, pick a motion, set the angle you like.</li>' +
    '<li><b>Save .GIF</b>, choose a percentage, save. Transparent ' +
    'background, cropped tight, no axis lines.</li>' +
    '</ol>';
  }
}
];

/* ------------------------------ the panel ------------------------ */
let tutAt = 0;

function tutOpen(id) {
  const box = $('tut');
  if (!box) return;
  if (id) {
    const i = TUTORIAL.findIndex(s => s.id === id);
    if (i >= 0) tutAt = i;
  }
  box.hidden = false;
  tutRender();
}

function tutClose() {
  const box = $('tut');
  if (box) box.hidden = true;
}

function tutRender() {
  const nav = $('tutNav'), body = $('tutBody');
  if (!nav || !body) return;
  nav.innerHTML = TUTORIAL.map((s, i) =>
    '<button data-i="' + i + '"' + (i === tutAt ? ' class="on"' : '') + '>' +
    '<span class="tNum">' + (i + 1) + '</span>' + esc(s.title) + '</button>').join('');
  nav.querySelectorAll('button').forEach(b => b.onclick = () => {
    tutAt = +b.dataset.i;
    tutRender();
    body.scrollTop = 0;
  });
  const s = TUTORIAL[tutAt];
  body.innerHTML = '<h3>' + esc(s.title) + '</h3>' + s.body() +
    '<div class="tNav">' +
    (tutAt > 0 ? '<button id="tutPrev">Back: ' +
      esc(TUTORIAL[tutAt - 1].title) + '</button>' : '<span></span>') +
    (tutAt < TUTORIAL.length - 1 ? '<button id="tutNext" class="primary">Next: ' +
      esc(TUTORIAL[tutAt + 1].title) + '</button>' : '<span></span>') +
    '</div>';
  if ($('tutPrev')) $('tutPrev').onclick = () => { tutAt--; tutRender(); body.scrollTop = 0; };
  if ($('tutNext')) $('tutNext').onclick = () => { tutAt++; tutRender(); body.scrollTop = 0; };
  $('tutStep').textContent = (tutAt + 1) + ' of ' + TUTORIAL.length;
}

function tutWire() {
  if (!$('tut')) return;
  $('bTut').onclick = () => tutOpen();
  $('tutX').onclick = tutClose;
  $('tut').addEventListener('click', e => { if (e.target === $('tut')) tutClose(); });
  addEventListener('keydown', e => {
    if ($('tut').hidden) return;
    if (e.key === 'Escape') tutClose();
    if (e.key === 'ArrowRight' && tutAt < TUTORIAL.length - 1) { tutAt++; tutRender(); }
    if (e.key === 'ArrowLeft' && tutAt > 0) { tutAt--; tutRender(); }
  });
}
