// Основной игровой код. Оставлен классическим скриптом, чтобы сохранить совместимость
// с существующими HTML-обработчиками onclick и глобальными функциями игры.
'use strict';
const MAX_STACK = 5;
const PROD_TURNS = { infantry:1, militia:1, archer:2, cavalry:3, settler:4, courier:1, scout:3, worker:3 };
const FORT_TURNS = 10;
const FORT_COST = 100;
const FORT_DESTROY_GOLD = 50;
const START_GOLD = 50;
let aiDiff = 'normal';
let barbDiff = 'normal';
let mapSize = 'small';
let noBarbs = false;
let opponentCount = 3; // number of AI opponents (3..30)
let COLS = 24, ROWS = 16;
let TILE_PX = 48;
function updatePlayersCount() {
  opponentCount = parseInt(document.getElementById('players-slider').value) || 3;
  document.getElementById('players-count-label').textContent = opponentCount;
  const totalEl = document.getElementById('total-civs-label');
  if (totalEl) totalEl.textContent = opponentCount + 1;
  // Auto-suggest larger map for many opponents
  if (opponentCount >= 12 && mapSize === 'small') {
    // soft recommend, but don't force
  }
}
function setDiff(type, val) {
  if (type === 'ai') { aiDiff = val; document.querySelectorAll('#ai-diff .diff-btn').forEach(b => b.classList.toggle('active', b.dataset.val === val)); }
  else { barbDiff = val; document.querySelectorAll('#barb-diff .diff-btn').forEach(b => b.classList.toggle('active', b.dataset.val === val)); }
}
function setMapSize(val) { mapSize = val; document.querySelectorAll('#map-size .diff-btn').forEach(b => b.classList.toggle('active', b.dataset.val === val)); }
function toggleNoBarbs() {
  noBarbs = !noBarbs;
  const btn = document.getElementById('no-barb-btn');
  const desc = document.getElementById('no-barb-desc');
  btn.classList.toggle('active', noBarbs);
  desc.textContent = noBarbs ? 'Варвары отключены' : 'Варвары включены';
  document.querySelectorAll('#barb-diff .diff-btn').forEach(b => { b.disabled = noBarbs; b.style.opacity = noBarbs ? '0.4' : '1'; });
}
function computeTilePx() {
  const isMobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 900;
  const vw = window.innerWidth, vh = window.innerHeight;
  if (mapSize === 'small') {
    const availH = document.body.classList.contains('compact') ? vh * 0.7 : vh * 0.55;
    return Math.max(28, Math.floor(Math.min((vw - 24) / COLS, availH / ROWS, 60)));
  } else if (mapSize === 'medium') return isMobile ? 30 : 33;
  else return isMobile ? 18 : 21;
}
function applyMapSize() {
  if (mapSize === 'small') { COLS = 24; ROWS = 16; }
  else if (mapSize === 'medium') { COLS = 48; ROWS = 32; }
  else { COLS = 96; ROWS = 64; }
  TILE_PX = computeTilePx();
  applyMapSizeFixed();
}
function applyMapSizeFixed() {
  const canvas = document.getElementById('map-canvas');
  if (!canvas) return;
  const gap = 1;
  const w = COLS * (TILE_PX + gap);
  const h = ROWS * (TILE_PX + gap);
  // Set internal resolution
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  // CSS size matches internal for 1:1 then scaled by transform
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
}
const TECHS = {
  bronze:      { id:'bronze', name:'Обработка бронзы', cost:40, desc:'Пехота и ополчение +2 силы / +2 защиты', requires:[] },
  archery:     { id:'archery', name:'Лучное дело', cost:50, desc:'Лучники +3 силы', requires:[] },
  riding:      { id:'riding', name:'Верховая езда', cost:60, desc:'Конница +3 силы и +1 ход', requires:[] },
  medicine:    { id:'medicine', name:'Медицина', cost:55, desc:'Лечение в городе за 1 ход (вместо 3)', requires:[] },
  tactics:     { id:'tactics', name:'Военная тактика', cost:75, desc:'Все боевые юниты +1 силы / +1 защиты', requires:['bronze'] },
  engineering: { id:'engineering', name:'Инженерия', cost:80, desc:'Поселенец 40 золота, +3 науки с каждого города', requires:['bronze'] },
  iron:        { id:'iron', name:'Железное оружие', cost:90, desc:'Пехота и ополчение ещё +3 силы / +3 защиты', requires:['bronze','tactics'] },
  fieldmed:    { id:'fieldmed', name:'Полевая медицина', cost:100, desc:'Можно лечить юнитов вне городов (3 хода)', requires:['medicine'] },
  masonry:     { id:'masonry', name:'Каменная кладка', cost:70, desc:'Крепости строятся за 7 ходов вместо 10', requires:['engineering'] },
  currency:    { id:'currency', name:'Денежное обращение', cost:85, desc:'+1 золота дохода с каждого города', requires:['engineering'] },
  warfare:     { id:'warfare', name:'Военное Искусство', cost:120, desc:'Открывает создание и объединение Армий', requires:['tactics','currency'] }
};
let CIVS = {};
function getCivColor(idx) {
  const colors = ['#4a9eff','#ff5c5c','#5cff8d','#c084fc','#fbbf24','#22d3ee','#fb7185','#a3e635','#f97316','#818cf8'];
  return colors[idx % colors.length];
}
function initCivs() {
  CIVS = {};
  CIVS.player = { id:'player', name:'Северная Империя', treasury:0, science:0, researched:new Set(), currentResearch:null, researchProgress:0, color:'#4a9eff' };
  const aiNames = [
    'Орда Крови','Зелёный Союз','Пурпурный Легион','Золотая Орда','Кибер-Синдикат',
    'Багровый Клан','Небесные','Железные','Теневые','Северный Ветер',
    'Южный Огонь','Восточный Щит','Западный Клинок','Лесной Народ','Горные Кланы',
    'Речные Лорды','Степные Всадники','Пустынные','Морские Волки','Каменные',
    'Буря','Тьма','Свет','Пепел','Кристалл','Гром','Лёд','Пламя','Тень','Звезда'
  ];
  for (let i = 1; i <= opponentCount; i++) {
    const key = 'ai' + i;
    const nameBase = aiNames[(i-1) % aiNames.length];
    const suffix = i > aiNames.length ? ' ' + Math.ceil(i / aiNames.length) : '';
    CIVS[key] = { id:key, name:nameBase + suffix, treasury:0, science:0, researched:new Set(), currentResearch:null, researchProgress:0, color:getCivColor(i) };
  }
  CIVS.barb = { id:'barb', name:'Варвары', treasury:0, science:0, researched:new Set(), currentResearch:null, researchProgress:0, color:'#c4a35a' };
}
function getCivClass(owner) { if (owner === 'player') return 'player'; if (owner === 'barb') return 'barb'; return 'ai'; }
function unitIconHtml(type, sizePx = 28) {
  if (UNIT_SPRITES[type] && UNIT_SPRITES[type].complete) {
    const names = { infantry: 'Пехота', cavalry: 'Конница', archer: 'Лучник', militia: 'Ополчение' };
    return `<img src="${UNIT_SPRITES[type].src}" alt="${names[type]||type}" style="width:${sizePx}px;height:${sizePx}px;object-fit:contain;vertical-align:middle">`;
  }
  const def = BASE_UNITS[type];
  return def ? def.icon : '?';
}
const BASE_UNITS = {
  infantry: { name:'Пехота', icon:'⚔', cost:20, strength:10, defense:10, hp:100, move:2, canAttack:true, isMilitia:false, isCourier:false, isCavalry:false },
  militia:  { name:'Гор. ополчение', icon:'🛡', cost:12, strength:7,  defense:7,  hp:120, move:1, canAttack:false, isMilitia:true, isCourier:false, isCavalry:false },
  archer:   { name:'Лучник', icon:'🏹', cost:28, strength:20, defense:5,  hp:70,  move:2, canAttack:true, isMilitia:false, isCourier:false, isCavalry:false },
  cavalry:  { name:'Конница', icon:'🐴', cost:40, strength:30, defense:5,  hp:90,  move:4, canAttack:true, isMilitia:false, isCourier:false, isCavalry:true },
  settler:  { name:'Поселенец', icon:'🚩', cost:55, strength:2,  defense:2,  hp:50,  move:2, canAttack:false, isMilitia:false, isCourier:false, isCavalry:false },
  courier:  { name:'Курьер', icon:'🐎🛒', iconRender:['🐎','🛒'], cost:100, strength:0, defense:0, hp:30, move:4, canAttack:false, isMilitia:false, isCourier:true, isCavalry:false },
  scout:    { name:'Разведчик', icon:'🐎', cost:30, strength:5, defense:5, hp:70, move:4, canAttack:true, isMilitia:false, isCourier:false, isCavalry:true },
  worker:   { name:'Рабочий', icon:'🧑‍🌾', cost:30, strength:3, defense:3, hp:80, move:2, canAttack:true, isMilitia:false, isCourier:false, isCavalry:false, isWorker:true },
  barbarian:{ name:'Варвар', icon:'🪓', cost:0,  strength:4,  defense:4,  hp:45, move:2, canAttack:true, isMilitia:false, isCourier:false, isCavalry:false }
};
// Custom unit sprites (embedded PNG)
const UNIT_SPRITES = { infantry: null, cavalry: null, archer: null, militia: null, scout: null, worker: null };
(function loadUnitSprites() {
  function loadOne(key, b64) {
    const img = new Image();
    img.onload = () => { UNIT_SPRITES[key] = img; if (typeof render === 'function') try { render(); } catch(e){} };
    img.src = 'data:image/png;base64,' + b64;
  }
  loadOne('infantry', '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');
  loadOne('cavalry', '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');
  loadOne('archer', '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');
  loadOne('militia', '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');
})();
function getUnitDef(type, civId) {
  const base = { ...BASE_UNITS[type] };
  if (type === 'barbarian') return base;
  const res = CIVS[civId] ? CIVS[civId].researched : new Set();
  if (type === 'infantry') {
    if (res.has('bronze')) { base.strength += 2; base.defense += 2; }
    if (res.has('iron')) { base.strength += 3; base.defense += 3; }
    if (res.has('tactics')) { base.strength += 1; base.defense += 1; }
  }
  if (type === 'militia') {
    if (res.has('bronze')) { base.strength += 1; base.defense += 1; }
    if (res.has('iron')) { base.strength += 2; base.defense += 2; base.hp += 10; }
    if (res.has('tactics')) base.hp += 10;
  }
  if (type === 'archer') {
    if (res.has('archery')) base.strength += 3;
    if (res.has('tactics')) { base.strength += 1; base.defense += 1; }
  }
  if (type === 'cavalry') {
    if (res.has('riding')) { base.strength += 3; base.move += 1; }
    if (res.has('tactics')) { base.strength += 1; base.defense += 1; }
  }
  if (type === 'settler' && res.has('engineering')) base.cost = 40;
  return base;
}
let map = [], units = [], cities = [], camps = [], forts = [], buildings = [];
let nextBuildingId = 1;
const BUILDING_DEFS = { watchtower: { name:'Наблюдательная башня', icon:'🗼', cost:300, turns:10, vision:4, capacity:2 }, trench: { name:'Ров', icon:'🕳️', cost:50, turns:5, vision:1, capacity:0 } };
const ARMY_TECH = 'warfare';
let pendingArmyMerge = null;
let turn = 1, currentCiv = 'player';
let selected = null, movableTiles = [], attackableTiles = [], mergeableTiles = [];
let nextUnitId = 1, nextCityId = 1, nextCampId = 1;
let combatBusy = false;
let pendingCombats = [];
function getStackAt(x, y, owner = null) {
  const out = [];
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (u.x === x && u.y === y && (owner === null || u.owner === owner)) out.push(u);
  }
  return out;
}
function getEnemyStackAt(x, y, myOwner) {
  const out = [];
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (u.x === x && u.y === y && u.owner !== myOwner) out.push(u);
  }
  return out;
}
function hasFort(x, y) { return forts.some(f => f.x === x && f.y === y); }
function getFort(x, y) { return forts.find(f => f.x === x && f.y === y); }
function getBuildingAt(x, y) { return buildings.find(b => b.x === x && b.y === y); }
function getTileUnitCapacity(x, y) { const b = getBuildingAt(x, y); return b ? (BUILDING_DEFS[b.type]?.capacity || 0) : MAX_STACK; }
function manhattan(a, b, x, y) { return Math.abs(a - x) + Math.abs(b - y); }
function isTileVisibleToCiv(civId, x, y) {
  const sees = (sx, sy, radius) => manhattan(sx, sy, x, y) <= radius;
  for (const u of units) if (u.owner === civId && sees(u.x, u.y, u.type === 'scout' ? 4 : 2)) return true;
  for (const c of cities) if (c.owner === civId && sees(c.x, c.y, 5)) return true;
  for (const f of forts) if (f.owner === civId && sees(f.x, f.y, 4)) return true;
  for (const b of buildings) if (b.owner === civId && sees(b.x, b.y, BUILDING_DEFS[b.type]?.vision || 1)) return true;
  return false;
}
function getVisibleTileSet(civId) { const set = new Set(); for (let y=0;y<ROWS;y++) for(let x=0;x<COLS;x++) if(isTileVisibleToCiv(civId,x,y)) set.add(x+','+y); return set; }
function getCityAt(x, y) { return cities.find(c => c.x === x && c.y === y); }
function getCityGold(city) { return city ? (city.gold || 0) : 0; }
function getCapital(civId) {
  return cities.find(c => c.owner === civId && c.isCapital) || cities.find(c => c.owner === civId) || null;
}
function getTreasury(civId) {
  if (civId === 'barb' || !CIVS[civId]) return 0;
  const cap = getCapital(civId);
  if (cap) return cap.gold || 0;
  return CIVS[civId].treasury || 0;
}
function addToTreasury(civId, amount) {
  if (civId === 'barb' || !CIVS[civId] || !amount) return;
  const cap = getCapital(civId);
  if (cap) {
    cap.gold = (cap.gold || 0) + amount;
  } else {
    CIVS[civId].treasury = (CIVS[civId].treasury || 0) + amount;
  }
}
function spendTreasury(civId, amount) {
  if (civId === 'barb' || !CIVS[civId] || amount <= 0) return false;
  const cap = getCapital(civId);
  if (cap) {
    if ((cap.gold || 0) < amount) return false;
    cap.gold -= amount;
    return true;
  }
  if ((CIVS[civId].treasury || 0) < amount) return false;
  CIVS[civId].treasury -= amount;
  return true;
}
function tileGoldYield(terrain) {
  if (terrain === 'bridge') return 2;
  if (terrain === 'grass' || terrain === 'forest' || terrain === 'mountain' || terrain === 'river' || terrain === 'water') return 1;
  return 0;
}
function cityIncome(city) {
  if (!city) return 0;
  // Клетка города: +2
  let gold = 2;
  // 8 соседних клеток
  for (const [dx, dy] of [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]]) {
    const nx = city.x + dx, ny = city.y + dy;
    if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
    const t = map[ny][nx];
    const enemyHere = units.some(u => u.x === nx && u.y === ny && u.owner !== city.owner);
    if (enemyHere) continue;
    gold += tileGoldYield(t);
  }
  if (CIVS[city.owner]?.researched?.has('currency')) gold += 1;
  return gold;
}
function initMap() {
  map = [];
  for (let y = 0; y < ROWS; y++) {
    map[y] = [];
    for (let x = 0; x < COLS; x++) {
      let t = 'grass';
      if ((x === 0 || x === COLS-1 || y === 0 || y === ROWS-1) && Math.random() < 0.22) t = 'water';
      if (Math.random() < 0.05) t = 'mountain';
      if (t === 'grass' && Math.random() < 0.13) t = 'forest';
      map[y][x] = t;
    }
  }
  const riverCount = mapSize === 'large' ? 3 : mapSize === 'medium' ? 2 : 1;
  const MIN_BRIDGE_GAP = 6;
  const canRiver = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS && map[y][x] !== 'water' && map[y][x] !== 'mountain' && map[y][x] !== 'bridge';
  for (let r = 0; r < riverCount; r++) {
    const horizontal = Math.random() < 0.5;
    const path = [];
    let x, y, dx, dy, steps;
    if (horizontal) { x=0; y=2+((r+1)*Math.floor(ROWS/(riverCount+1)))%(ROWS-4); dx=1; dy=0; steps=COLS; }
    else { x=2+((r+1)*Math.floor(COLS/(riverCount+1)))%(COLS-4); y=0; dx=0; dy=1; steps=ROWS; }
    let drift = 0;
    for (let s = 0; s < steps; s++) {
      if (canRiver(x, y)) { map[y][x]='river'; path.push(x | (y << 16)); }
      if (horizontal && canRiver(x, y+1) && Math.random() < 0.28) map[y+1][x]='river';
      if (!horizontal && canRiver(x+1, y) && Math.random() < 0.28) map[y][x+1]='river';
      if (Math.random() < 0.22) drift = Math.max(-1, Math.min(1, drift + (Math.random() < 0.5 ? -1 : 1)));
      if (Math.random() < 0.12) drift = 0;
      if (horizontal) { x+=dx; y=Math.max(1, Math.min(ROWS-2, y+drift)); }
      else { y+=dy; x=Math.max(1, Math.min(COLS-2, x+drift)); }
    }
    const n = path.length;
    if (n > 2) {
      const stride = Math.max(MIN_BRIDGE_GAP, Math.floor(n / Math.max(1, Math.floor(n / MIN_BRIDGE_GAP))));
      const start = Math.min(3, Math.floor(n / 4));
      for (let i = start; i < n - 2; i += stride) {
        const packed = path[i];
        const bx = packed & 0xffff, by = packed >>> 16;
        if (map[by][bx] === 'river') map[by][bx] = 'bridge';
      }
    }
  }
}
function spawnUnit(type, x, y, owner) {
  // Нельзя появляться на непроходимой местности (горы, вода, река)
  if (isBlockedTerrain(x, y)) {
    const alt = findSpawnTile(x, y, owner);
    if (!alt) return null;
    x = alt.x; y = alt.y;
  }
  if (getStackAt(x, y).length >= getTileUnitCapacity(x, y)) { const alt = findSpawnTile(x, y, owner); if (!alt) return null; x = alt.x; y = alt.y; }
  const def = getUnitDef(type, owner);
  const u = { id: nextUnitId++, type, x, y, owner, hp: def.hp, moved: false, healTurns: 0, buildFort: 0, buildStructure: null, buildStructureTurns: 0, carryGold: 0, retreated: false };
  units.push(u);
  return u;
}
function isBlockedTerrain(x, y) {
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return true;
  const t = map[y][x];
  return t === 'water' || t === 'mountain' || t === 'river' || getBuildingAt(x, y)?.type === 'trench';
}
function isFree(x, y) {
  if (isBlockedTerrain(x, y)) return false;
  if (units.some(u => u.x === x && u.y === y)) return false;
  if (cities.some(c => c.x === x && c.y === y)) return false;
  if (camps.some(c => c.x === x && c.y === y)) return false;
  if (getStackAt(x, y).length >= getTileUnitCapacity(x, y)) return false;
  return true;
}
function clearSelection() {
  selected = null; movableTiles = []; attackableTiles = []; mergeableTiles = [];
  updateUI(); render();
}
function aiAggro() { return aiDiff === 'easy' ? 0.35 : aiDiff === 'hard' ? 0.85 : 0.55; }
function aiProdChance() { return aiDiff === 'easy' ? 0.15 : aiDiff === 'hard' ? 0.45 : 0.3; }
function barbCampCount() { return barbDiff === 'easy' ? 3 : barbDiff === 'hard' ? 7 : 5; }
function barbSpawnChance() { return barbDiff === 'easy' ? 0.12 : barbDiff === 'hard' ? 0.35 : 0.22; }
function barbSackChance() { return barbDiff === 'easy' ? 0.5 : barbDiff === 'hard' ? 1.0 : 0.8; }
function barbDmgMult() { return barbDiff === 'easy' ? 0.7 : barbDiff === 'hard' ? 1.35 : 1.0; }
function openMainMenu() { document.getElementById('main-menu').classList.add('open'); }
function closeMainMenu() { document.getElementById('main-menu').classList.remove('open'); }
function menuSaveGame() { closeMainMenu(); saveGame(); }
function menuLoadGame() { closeMainMenu(); loadGame(); }
function menuNewGame() {
  closeMainMenu();
  document.getElementById('victory-screen').style.display = 'none';
  document.getElementById('game-header').style.display = 'none';
  document.getElementById('game-container').style.display = 'none';
  document.getElementById('start-screen').style.display = 'flex';
  closeCityPanel(); closeTechModal(); closeArmyModal(); closeSidebarDrawer();
}
function startGame() {
  updatePlayersCount();
  // For many opponents force larger map to avoid overcrowding
  if (opponentCount >= 15 && mapSize === 'small') {
    mapSize = 'medium';
    document.querySelectorAll('#map-size .diff-btn').forEach(b => b.classList.toggle('active', b.dataset.val === mapSize));
  }
  if (opponentCount >= 25 && mapSize !== 'large') {
    mapSize = 'large';
    document.querySelectorAll('#map-size .diff-btn').forEach(b => b.classList.toggle('active', b.dataset.val === mapSize));
  }
  applyMapSize();
  initCivs();
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('game-header').style.display = 'block';
  document.getElementById('game-container').style.display = 'flex';
  const labels = { easy:'легко', normal:'средне', hard:'сложно' };
  const sizeLabels = { small:'мал.', medium:'сред.', large:'бол.' };
  const barbLabel = noBarbs ? 'нет' : labels[barbDiff];
  const totalCivs = opponentCount + 1;
  document.getElementById('diff-label').textContent = `Соперников: ${opponentCount} (всего ${totalCivs}) / ИИ: ${labels[aiDiff]} / Варвары: ${barbLabel} / Карта: ${sizeLabels[mapSize]}`;
  initGame();
  if (window.innerWidth < 900 && !document.body.classList.contains('compact')) toggleCompactMode();
  if (window.matchMedia('(pointer: coarse)').matches && !document.fullscreenElement) {
    document.documentElement.requestFullscreen?.().catch(() => {});
  }
}
function backToMenu() {
  document.getElementById('victory-screen').style.display = 'none';
  document.getElementById('game-header').style.display = 'none';
  document.getElementById('game-container').style.display = 'none';
  document.getElementById('start-screen').style.display = 'flex';
  closeSidebarDrawer(); closeCityPanel(); closeTechModal(); closeArmyModal();
}
function initGame() {
  initMap();
  units = []; cities = []; camps = []; forts = []; buildings = []; nextBuildingId = 1;
  turn = 1; currentCiv = 'player';
  clearSelection();
  nextUnitId = 1; nextCityId = 1; nextCampId = 1;
  for (const c of Object.values(CIVS)) {
    c.treasury = 0; // казна теперь хранится в столице (city.gold)
    c.science = 0; c.researched = new Set(); c.currentResearch = null; c.researchProgress = 0;
  }
  const totalCivs = opponentCount + 1;
  // Случайно распределяем столицы по карте с максимально равномерными промежутками.
  const landCells = [];
  for (let y = 2; y < ROWS - 2; y++) for (let x = 2; x < COLS - 2; x++) {
    const t = map[y][x];
    if (t !== 'water' && t !== 'mountain' && t !== 'river' && t !== 'bridge') landCells.push([x, y]);
  }
  const startPositions = [];
  const minStartDist = Math.max(4, Math.sqrt((COLS * ROWS) / Math.max(1, totalCivs)) * 0.58);
  while (startPositions.length < totalCivs && landCells.length) {
    let best = [], bestScore = -1;
    // Случайная выборка кандидатов позволяет получить разнообразную, но равномерную рассадку.
    const sampleCount = Math.min(500, landCells.length);
    for (let n = 0; n < sampleCount; n++) {
      const idx = Math.floor(Math.random() * landCells.length);
      const cell = landCells[idx];
      const nearest = startPositions.length ? Math.min(...startPositions.map(([px, py]) => Math.hypot(px-cell[0], py-cell[1]))) : Infinity;
      const score = nearest + Math.random() * 0.35;
      if (score > bestScore) { bestScore = score; best = [cell]; }
      else if (Math.abs(score - bestScore) < 0.25) best.push(cell);
    }
    const chosen = best[Math.floor(Math.random() * best.length)];
    if (!chosen) break;
    startPositions.push(chosen);
    // Исключаем уже выбранную клетку и слишком близкие варианты, но не допускаем срыва генерации.
    const remaining = landCells.filter(([x,y]) => !(x===chosen[0] && y===chosen[1]));
    const spaced = remaining.filter(([x,y]) => Math.hypot(x-chosen[0], y-chosen[1]) >= minStartDist);
    landCells.length = 0;
    landCells.push(...(spaced.length >= totalCivs-startPositions.length ? spaced : remaining));
  }
  // На тесных картах используем оставшиеся проходимые клетки, не создавая одинаковых координат.
  if (startPositions.length < totalCivs) {
    for (const cell of landCells) {
      if (startPositions.length >= totalCivs) break;
      if (!startPositions.some(([x,y]) => x===cell[0] && y===cell[1])) startPositions.push(cell);
    }
  }
  const civOrder = ['player'];
  for (let i = 1; i <= opponentCount; i++) civOrder.push('ai' + i);
  civOrder.forEach((civId, idx) => {
    const [px, py] = startPositions[idx];
    cities.push({ id: nextCityId++, x: px, y: py, owner: civId, name: CIVS[civId].name + ' (столица)', gold: START_GOLD, isCapital: true, production: null, progress: 0, needed: 0 });
    // Стартовые юниты только на проходимых клетках
    const offsets = [[0,0],[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
    const placeNear = (type) => {
      for (const [dx, dy] of offsets) {
        const nx = px + dx, ny = py + dy;
        if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
        if (isBlockedTerrain(nx, ny)) continue;
        if (getStackAt(nx, ny).length >= MAX_STACK) continue;
        spawnUnit(type, nx, ny, civId);
        return;
      }
      spawnUnit(type, px, py, civId); // fallback на клетку города
    };
    placeNear('militia');
    placeNear('infantry');
    placeNear('archer');
  });
  cities.forEach(c => {
    if (map[c.y][c.x] === 'river' || map[c.y][c.x] === 'bridge' || map[c.y][c.x] === 'water' || map[c.y][c.x] === 'mountain') map[c.y][c.x] = 'grass';
    for (const [dx, dy] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = c.x + dx, ny = c.y + dy;
      if (nx >= 0 && ny >= 0 && nx < COLS && ny < ROWS && map[ny][nx] === 'river') map[ny][nx] = 'grass';
    }
  });
  if (!noBarbs) {
    const baseCount = barbCampCount() + (mapSize === 'medium' ? 3 : mapSize === 'large' ? 8 : 0);
    // Scale barb camps a bit with map and opponents
    const count = Math.min(baseCount + Math.floor(opponentCount / 8), mapSize === 'large' ? 18 : mapSize === 'medium' ? 12 : 6);
    let placed = 0, tries = 0;
    while (placed < count && tries < 400) {
      tries++;
      const cx = 2 + Math.floor(Math.random() * (COLS - 4));
      const cy = 2 + Math.floor(Math.random() * (ROWS - 4));
      if (map[cy][cx] === 'water' || map[cy][cx] === 'mountain' || map[cy][cx] === 'river' || map[cy][cx] === 'bridge') continue;
      if (cities.some(c => Math.abs(c.x - cx) + Math.abs(c.y - cy) < 4)) continue;
      if (camps.some(c => Math.abs(c.x - cx) + Math.abs(c.y - cy) < 3)) continue;
      camps.push({ id: nextCampId++, x: cx, y: cy });
      spawnUnit('barbarian', cx, cy, 'barb');
      const extra = barbDiff === 'hard' ? 2 : 1;
      let added = 0;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1]]) {
        if (added >= extra) break;
        if (isFree(cx + dx, cy + dy)) { spawnUnit('barbarian', cx + dx, cy + dy, 'barb'); added++; }
      }
      placed++;
    }
  }
  document.getElementById('log').innerHTML = '';
  log('Война началась!', 'info');
  log(`Соперников: ${opponentCount}, всего цивилизаций: ${totalCivs}, карта ${COLS}×${ROWS}, ИИ: ${aiDiff}, варвары: ${noBarbs ? 'выкл' : barbDiff}`, 'info');
  log(`💰 У каждого по ${START_GOLD} золота в казне столицы`, 'gold');
  log('🟣 Армия — до 5 юнитов. Сила складывается.', 'army');
  log('🏥 В городах юниты лечатся автоматически (3 хода, Медицина — 1 ход).', 'good');
  updateUI(); render();
  initPinchZoom();
  initCanvasHandlers();
  startMapAnimation();
  // Центрируем камеру на столице игрока
  setTimeout(() => centerOnPlayerCapital(), 50);
}
let mapZoom = 1, mapPanX = 0, mapPanY = 0, pinchState = null, panState = null;
function applyMapTransform() {
  const canvas = document.getElementById('map-canvas');
  const vp = document.getElementById('map-viewport');
  if (!canvas || !vp) return;
  const vpW = vp.clientWidth, vpH = vp.clientHeight;
  const mapW = COLS * (TILE_PX + 1), mapH = ROWS * (TILE_PX + 1);
  const scaledW = mapW * mapZoom, scaledH = mapH * mapZoom;
  const minX = Math.min(0, vpW - scaledW);
  const minY = Math.min(0, vpH - scaledH);
  mapPanX = Math.max(minX, Math.min(0, mapPanX));
  mapPanY = Math.max(minY, Math.min(0, mapPanY));
  canvas.style.transform = `translate(${mapPanX}px, ${mapPanY}px) scale(${mapZoom})`;
}
function screenToTile(clientX, clientY) {
  const vp = document.getElementById('map-viewport');
  if (!vp) return null;
  const rect = vp.getBoundingClientRect();
  const localX = (clientX - rect.left - mapPanX) / mapZoom;
  const localY = (clientY - rect.top - mapPanY) / mapZoom;
  const gap = 1;
  const tx = Math.floor(localX / (TILE_PX + gap));
  const ty = Math.floor(localY / (TILE_PX + gap));
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return null;
  return { x: tx, y: ty };
}
function initPinchZoom() {
  const vp = document.getElementById('map-viewport');
  if (!vp || vp.dataset.zoomInit) return;
  vp.dataset.zoomInit = '1';
  vp.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const t1 = e.touches[0], t2 = e.touches[1];
      pinchState = { startDist: Math.hypot(t2.clientX-t1.clientX,t2.clientY-t1.clientY), startZoom:mapZoom, startPanX:mapPanX, startPanY:mapPanY, midX:(t1.clientX+t2.clientX)/2, midY:(t1.clientY+t2.clientY)/2 };
      panState = null;
    } else if (e.touches.length === 1 && mapZoom > 1) {
      const t = e.touches[0];
      panState = { startX:t.clientX, startY:t.clientY, startPanX:mapPanX, startPanY:mapPanY, moved:false };
    }
  }, { passive:false });
  vp.addEventListener('touchmove', (e) => {
    if (pinchState && e.touches.length === 2) {
      e.preventDefault();
      const t1 = e.touches[0], t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX-t1.clientX,t2.clientY-t1.clientY);
      const scale = dist / pinchState.startDist;
      const newZoom = Math.max(1, Math.min(3, pinchState.startZoom * scale));
      const vpRect = vp.getBoundingClientRect();
      const cx = pinchState.midX - vpRect.left, cy = pinchState.midY - vpRect.top;
      const ratio = newZoom / pinchState.startZoom;
      mapPanX = cx - (cx - pinchState.startPanX) * ratio;
      mapPanY = cy - (cy - pinchState.startPanY) * ratio;
      mapZoom = newZoom;
      applyMapTransform();
    } else if (panState && e.touches.length === 1 && mapZoom > 1) {
      e.preventDefault();
      const t = e.touches[0];
      const dx = t.clientX - panState.startX, dy = t.clientY - panState.startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) panState.moved = true;
      mapPanX = panState.startPanX + dx;
      mapPanY = panState.startPanY + dy;
      applyMapTransform();
      if (panState.moved) vp.dataset.panning = '1';
    }
  }, { passive:false });
  vp.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) pinchState = null;
    if (e.touches.length === 0) { panState = null; setTimeout(() => { delete vp.dataset.panning; }, 50); }
  }, { passive:true });
}
let combatSkip = false;
function skipCombat() { combatSkip = true; }
function sleep(ms, respectCombatSkip = true) {
  return new Promise(r => {
    const t0 = Date.now();
    const tick = () => {
      if (respectCombatSkip && combatSkip) return r();
      if (Date.now() - t0 >= ms) return r();
      requestAnimationFrame(tick);
    };
    tick();
  });
}
function delay(ms) { return sleep(ms, false); }
let eventModalQueue = [], eventModalOpen = false, eventModalCallback = null;
function showEventModal(icon, title, body, options = null) {
  eventModalQueue.push({ icon, title, body, options });
  if (!eventModalOpen) nextEventModal();
}
function nextEventModal() {
  if (!eventModalQueue.length) {
    eventModalOpen = false; eventModalCallback = null;
    document.getElementById('event-modal').style.display = 'none';
    document.getElementById('event-box').classList.remove('has-input');
    const btn = document.getElementById('event-close');
    btn.classList.remove('attack-btn'); btn.classList.remove('tech-btn');
    return;
  }
  eventModalOpen = true;
  const ev = eventModalQueue.shift();
  document.getElementById('event-icon').textContent = ev.icon;
  document.getElementById('event-title').textContent = ev.title;
  document.getElementById('event-body').textContent = ev.body;
  const box = document.getElementById('event-box');
  const input = document.getElementById('event-input');
  const btn = document.getElementById('event-close');
  btn.classList.remove('attack-btn'); btn.classList.remove('tech-btn');
  if (ev.options && ev.options.input) {
    box.classList.add('has-input');
    input.value = ev.options.defaultValue || '';
    input.placeholder = ev.options.placeholder || 'Введите название...';
    btn.textContent = 'Подтвердить';
    eventModalCallback = ev.options.onConfirm || null;
    setTimeout(() => input.focus(), 50);
  } else if (ev.options && ev.options.attack) {
    box.classList.remove('has-input'); input.value = '';
    btn.textContent = '⚔ В атаку!';
    btn.classList.add('attack-btn');
    eventModalCallback = ev.options.onConfirm || null;
  } else if (ev.options && ev.options.newTech) {
    box.classList.remove('has-input'); input.value = '';
    btn.textContent = '🔬 Новое исследование';
    btn.classList.add('tech-btn');
    eventModalCallback = ev.options.onConfirm || null;
  } else {
    box.classList.remove('has-input'); input.value = '';
    btn.textContent = 'Закрыть';
    eventModalCallback = null;
  }
  document.getElementById('event-modal').style.display = 'flex';
}
function closeEventModal() {
  const input = document.getElementById('event-input');
  const cb = eventModalCallback;
  const val = input.value.trim();
  document.getElementById('event-modal').style.display = 'none';
  document.getElementById('event-box').classList.remove('has-input');
  const btn = document.getElementById('event-close');
  btn.classList.remove('attack-btn'); btn.classList.remove('tech-btn');
  eventModalCallback = null;
  if (cb) cb(val);
  setTimeout(nextEventModal, 150);
}
function playCombatAnim(atkUnits, defUnits, totalDmgToDef, totalDmgToAtk, label) {
  return new Promise(async resolve => {
    combatBusy = true; combatSkip = false;
    const overlay = document.getElementById('combat-overlay');
    const field = document.getElementById('combat-field');
    const title = document.getElementById('combat-title');
    const teamL = document.getElementById('combat-team-left');
    const teamR = document.getElementById('combat-team-right');
    const line = document.getElementById('combat-log-line');
    const hpL = document.getElementById('hp-fill-left');
    const hpR = document.getElementById('hp-fill-right');
    const labL = document.getElementById('hp-label-left');
    const labR = document.getElementById('hp-label-right');
    field.innerHTML = '';
    title.textContent = '⚔ ' + (label || 'СРАЖЕНИЕ');
    teamL.textContent = (CIVS[atkUnits[0].owner]?.name || '?') + ' (' + atkUnits.length + ')';
    teamR.textContent = (CIVS[defUnits[0].owner]?.name || '?') + ' (' + defUnits.length + ')';
    line.textContent = 'Войска сходятся...';
    overlay.style.display = 'flex';
    const left = atkUnits.map(u => ({ id:u.id, type:u.type, icon: getUnitDef(u.type,u.owner).icon, hp:u.hp, maxHp: getUnitDef(u.type,u.owner).hp, el:null, dead:false, isCourier: getUnitDef(u.type,u.owner).isCourier, isCavalry: getUnitDef(u.type,u.owner).isCavalry, retreated:false }));
    const right = defUnits.map(u => ({ id:u.id, type:u.type, icon: getUnitDef(u.type,u.owner).icon, hp:u.hp, maxHp: getUnitDef(u.type,u.owner).hp, el:null, dead:false, isCourier: getUnitDef(u.type,u.owner).isCourier, isCavalry: getUnitDef(u.type,u.owner).isCavalry, retreated:false }));
    const attackerHasCavalry = left.some(u => u.isCavalry);
    function makeCombatEl(u, sideClass) {
      const el = document.createElement('div');
      el.className = 'combat-unit ' + sideClass;
      if (UNIT_SPRITES[u.type] && UNIT_SPRITES[u.type].complete) {
        const img = document.createElement('img');
        img.src = UNIT_SPRITES[u.type].src;
        img.alt = u.icon;
        el.appendChild(img);
      } else {
        el.textContent = u.icon;
      }
      return el;
    }
    function placeUnits() {
      field.innerHTML = '';
      const h = field.clientHeight || 220;
      const placeSide = (side, cls) => {
        const alive = side.filter(x => !x.dead && !x.retreated);
        alive.forEach((u, idx) => {
          const el = makeCombatEl(u, cls);
          el.style.top = Math.max(0, ((idx + 0.5) / Math.max(alive.length, 1)) * h - 24) + 'px';
          el.style.animationDelay = (idx * 0.12) + 's';
          field.appendChild(el);
          u.el = el;
        });
      };
      placeSide(left, 'attacker');
      placeSide(right, 'defender');
    }
    function totalHp(side) { return side.filter(u=>!u.dead && !u.retreated).reduce((s,u)=>s+Math.max(0,u.hp),0); }
    function maxHp(side) { return side.reduce((s,u)=>s+u.maxHp,0)||1; }
    function updateBars() {
      const lp = Math.max(0,totalHp(left)/maxHp(left)*100);
      const rp = Math.max(0,totalHp(right)/maxHp(right)*100);
      hpL.style.width=lp+'%'; hpR.style.width=rp+'%';
      labL.textContent=`ОЗ: ${Math.round(lp)}% (${left.filter(u=>!u.dead && !u.retreated).length} жив.)`;
      labR.textContent=`ОЗ: ${Math.round(rp)}% (${right.filter(u=>!u.dead && !u.retreated).length} жив.)`;
    }
    function spawnFx(xPct, yPct, emoji) { const fx=document.createElement('div'); fx.className='combat-fx pop'; fx.textContent=emoji; fx.style.left=xPct+'%'; fx.style.top=yPct+'%'; field.appendChild(fx); setTimeout(()=>fx.remove(),500); }
    function spawnDmg(xPct, yPct, dmg) { const d=document.createElement('div'); d.className='combat-float-dmg show'; d.textContent='-'+dmg; d.style.left=xPct+'%'; d.style.top=yPct+'%'; field.appendChild(d); setTimeout(()=>d.remove(),900); }
    placeUnits(); updateBars();
    const stage = document.getElementById('combat-stage');
    await sleep(600);
    if (combatSkip) { overlay.style.display='none'; combatBusy=false; resolve(); return; }
    const rounds = 7;
    const roundTime = 1000;
    let dmgDefLeft = totalDmgToDef, dmgAtkLeft = totalDmgToAtk;
    const phrases = ['Удар!','Контратака!','Столкновение!','Яростный бой!','Клинки скрестились!','Натиск!','Ответный удар!','Сеча!'];
    for (let r=0; r<rounds; r++) {
      if (combatSkip) break;
      const aliveL=left.filter(u=>!u.dead && !u.retreated), aliveR=right.filter(u=>!u.dead && !u.retreated);
      if (!aliveL.length||!aliveR.length) break;
      const weight = 0.6 + (r/rounds)*0.8;
      let dmgR = Math.max(1,Math.round((totalDmgToDef/rounds)*weight*(0.7+Math.random()*0.6)));
      let dmgL = Math.max(1,Math.round((totalDmgToAtk/rounds)*weight*(0.7+Math.random()*0.6)));
      if (r===rounds-1) { dmgR=Math.max(dmgR,dmgDefLeft); dmgL=Math.max(dmgL,dmgAtkLeft); }
      dmgR=Math.min(dmgR,dmgDefLeft); dmgL=Math.min(dmgL,dmgAtkLeft);
      dmgDefLeft-=dmgR; dmgAtkLeft-=dmgL;
      line.textContent = phrases[r%phrases.length];
      const dUnit = aliveR.find(u=>u.isCourier) || aliveR[Math.floor(Math.random()*aliveR.length)];
      const aUnit = aliveL[Math.floor(Math.random()*aliveL.length)];
      if (aUnit.el) { aUnit.el.classList.remove('lunge-a'); void aUnit.el.offsetWidth; aUnit.el.classList.add('lunge-a'); }
      await sleep(roundTime * 0.28);
      if (combatSkip) break;
      if (stage) { stage.classList.remove('shake'); void stage.offsetWidth; stage.classList.add('shake'); }
      spawnFx(55, 28+Math.random()*40, ['💥','⚔️','🔥','💢'][Math.floor(Math.random()*4)]);
      spawnFx(60, 35+Math.random()*30, ['✨','💢'][Math.floor(Math.random()*2)]);
      if (dUnit.el) { dUnit.el.classList.remove('hurt'); void dUnit.el.offsetWidth; dUnit.el.classList.add('hurt'); }
      spawnDmg(70, 25+Math.random()*30, dmgR);
      let pool = dmgR;
      const sortedR = [...aliveR].sort((a,b)=>(b.isCourier?1:0)-(a.isCourier?1:0)||a.hp-b.hp);
      for (const u of sortedR) { if (pool<=0) break; const take=Math.min(u.hp,pool); u.hp-=take; pool-=take; if (u.hp<=0) { u.dead=true; if (u.el) { u.el.classList.add('dying'); line.textContent = u.isCourier ? `🐎 Курьер уничтожен!` : `${u.icon} пал в бою!`; } } }
      updateBars();
      await sleep(roundTime/3);
      if (combatSkip) break;
      const aliveR2=right.filter(u=>!u.dead && !u.retreated), aliveL2=left.filter(u=>!u.dead && !u.retreated);
      if (aliveR2.length && aliveL2.length) {
        const d2 = aliveR2[Math.floor(Math.random()*aliveR2.length)];
        let a2 = aliveL2.find(u=>u.isCourier) || aliveL2[Math.floor(Math.random()*aliveL2.length)];
        const defenderAttackerIsCavalry = aliveL2.some(u => u.isCavalry);
        const canRetreat = a2.isCavalry && !defenderAttackerIsCavalry && !attackerHasCavalry;
        const damagePercent = dmgL / (a2.maxHp || 1);
        if (canRetreat && damagePercent > 0.5 && !a2.retreated) {
          a2.retreated = true;
          if (a2.el) { a2.el.classList.add('retreating'); }
          line.textContent = `🐴 ${a2.icon} Конница отступает!`;
          await sleep(roundTime/3);
          continue;
        }
        if (d2.el) { d2.el.classList.remove('lunge-d'); void d2.el.offsetWidth; d2.el.classList.add('lunge-d'); }
        await sleep(roundTime * 0.28);
        if (combatSkip) break;
        if (stage) { stage.classList.remove('shake'); void stage.offsetWidth; stage.classList.add('shake'); }
        spawnFx(45, 28+Math.random()*40, ['💥','🛡️','⚡'][Math.floor(Math.random()*3)]);
        spawnFx(40, 35+Math.random()*30, ['💢','✨'][Math.floor(Math.random()*2)]);
        if (a2.el) { a2.el.classList.remove('hurt'); void a2.el.offsetWidth; a2.el.classList.add('hurt'); }
        spawnDmg(25, 25+Math.random()*30, dmgL);
        let pool2 = dmgL;
        const sortedL = [...aliveL2].sort((a,b)=>(b.isCourier?1:0)-(a.isCourier?1:0)||a.hp-b.hp);
        for (const u of sortedL) { if (pool2<=0) break; const take=Math.min(u.hp,pool2); u.hp-=take; pool2-=take; if (u.hp<=0) { u.dead=true; if (u.el) { u.el.classList.add('dying'); line.textContent = u.isCourier ? `🐎 Курьер уничтожен!` : `${u.icon} пал в бою!`; } } }
        updateBars();
      }
      await sleep(roundTime/3);
      if (combatSkip) break;
      placeUnits();
    }
    if (!combatSkip) {
      const leftAlive=left.filter(u=>!u.dead && !u.retreated).length, rightAlive=right.filter(u=>!u.dead && !u.retreated).length;
      if (rightAlive===0 && leftAlive>0) line.textContent='🏆 Победа атакующих!';
      else if (leftAlive===0 && rightAlive>0) line.textContent='🛡 Защитники держатся!';
      else line.textContent='Бой окончен.';
      await sleep(400);
    }
    overlay.style.display='none';
    combatBusy=false; combatSkip=false;
    resolve();
  });
}
// ============== CANVAS MAP RENDERER ==============
let animTime = 0;
let animFrameId = null;
let lastAnimRender = 0;
function startMapAnimation() {
  if (animFrameId) return;
  const loop = (ts) => {
    animFrameId = requestAnimationFrame(loop);
    // ~14 fps idle animation is enough and saves CPU
    if (ts - lastAnimRender < 70) return;
    lastAnimRender = ts;
    animTime = ts;
    // Only animate while game is visible
    if (document.getElementById('game-container')?.style.display === 'flex' && !combatBusy) {
      render();
    }
  };
  animFrameId = requestAnimationFrame(loop);
}
function stopMapAnimation() {
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
}
const TERRAIN_COLORS = {
  grass: ['#3d7a35', '#2d5a27'],
  forest: ['#2a4f24', '#1a3218'],
  mountain: ['#7a7a7a', '#4a4a4a'],
  water: ['#1e4a7a', '#153a5c'],
  river: ['#1a6b8a', '#2a8ab0'],
  bridge: ['#8b6914', '#5c4510']
};
const CITY_COLORS = {
  player: ['#1e40af', '#1e3a5f', '#4a9eff'],
  ai1: ['#991b1b', '#4a1e1e', '#ff5c5c'],
  ai2: ['#15803d', '#1e4a2e', '#5cff8d'],
  ai: ['#581c87', '#3b0764', '#c084fc'],
  barb: ['#5a4a28', '#3d3420', '#c4a35a']
};
function getCityColorKey(owner) {
  if (owner === 'player') return 'player';
  if (owner === 'ai1') return 'ai1';
  if (owner === 'ai2') return 'ai2';
  if (owner === 'barb') return 'barb';
  return 'ai';
}
function drawRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function render() {
  const canvas = document.getElementById('map-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const gap = 1;
  const ts = TILE_PX;
  const fontSize = Math.max(12, Math.floor(ts * 0.42));
  const smallFont = Math.max(8, Math.floor(ts * 0.22));
  // Ensure size
  const needW = COLS * (ts + gap);
  const needH = ROWS * (ts + gap);
  if (canvas.width !== needW || canvas.height !== needH) {
    canvas.width = needW;
    canvas.height = needH;
    canvas.style.width = needW + 'px';
    canvas.style.height = needH + 'px';
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // Build stack index once
  const stackIndex = new Map();
  for (const u of units) {
    const k = u.x + ',' + u.y;
    let arr = stackIndex.get(k);
    if (!arr) { arr = []; stackIndex.set(k, arr); }
    arr.push(u);
  }
  // Precompute highlight sets for O(1)
  const movableSet = new Set(movableTiles.map(t => t.x + ',' + t.y));
  const attackableSet = new Set(attackableTiles.map(t => t.x + ',' + t.y));
  const mergeableSet = new Set(mergeableTiles.map(t => t.x + ',' + t.y));
  const visibleSet = getVisibleTileSet('player');
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const px = x * (ts + gap);
      const py = y * (ts + gap);
      if (!visibleSet.has(x + ',' + y)) {
        ctx.fillStyle = '#101522'; ctx.fillRect(px, py, ts, ts);
        ctx.strokeStyle = 'rgba(120,140,170,0.12)'; ctx.lineWidth = 1; ctx.strokeRect(px + .5, py + .5, ts - 1, ts - 1);
        continue;
      }
      const city = getCityAt(x, y);
      const building = getBuildingAt(x, y);
      const camp = camps.find(c => c.x === x && c.y === y);
      const fort = getFort(x, y);
      const stack = stackIndex.get(x + ',' + y) || [];
      const key = x + ',' + y;
      // Background
      if (city) {
        const ck = getCityColorKey(city.owner);
        const cols = CITY_COLORS[ck] || CITY_COLORS.ai;
        const grad = ctx.createLinearGradient(px, py, px + ts, py + ts);
        grad.addColorStop(0, cols[0]);
        grad.addColorStop(1, cols[1]);
        ctx.fillStyle = grad;
        ctx.fillRect(px, py, ts, ts);
        ctx.strokeStyle = CIVS[city.owner]?.color || cols[2];
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 1, py + 1, ts - 2, ts - 2);
      } else if (camp) {
        const grad = ctx.createLinearGradient(px, py, px + ts, py + ts);
        grad.addColorStop(0, '#5a4a28');
        grad.addColorStop(1, '#3d3420');
        ctx.fillStyle = grad;
        ctx.fillRect(px, py, ts, ts);
        ctx.setLineDash([3, 2]);
        ctx.strokeStyle = '#c4a35a';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(px + 1, py + 1, ts - 2, ts - 2);
        ctx.setLineDash([]);
      } else {
        const terrain = map[y][x] || 'grass';
        const cols = TERRAIN_COLORS[terrain] || TERRAIN_COLORS.grass;
        const grad = ctx.createLinearGradient(px, py, px + ts, py + ts);
        grad.addColorStop(0, cols[0]);
        grad.addColorStop(1, cols[1]);
        ctx.fillStyle = grad;
        ctx.fillRect(px, py, ts, ts);
        if (terrain === 'bridge') {
          ctx.strokeStyle = '#c4a35a';
          ctx.lineWidth = 1;
          ctx.strokeRect(px + 0.5, py + 0.5, ts - 1, ts - 1);
        }
      }
      // Fort glow
      if (fort) {
        const fo = fort.owner;
        let fortCol = '#a78bfa';
        if (fo === 'player') fortCol = '#60a5fa';
        else if (fo === 'ai1') fortCol = '#f87171';
        else if (fo === 'ai2') fortCol = '#4ade80';
        else if (fo === 'barb') fortCol = '#c4a35a';
        ctx.strokeStyle = fortCol;
        ctx.lineWidth = 2.5;
        ctx.strokeRect(px + 1.5, py + 1.5, ts - 3, ts - 3);
        ctx.strokeStyle = 'rgba(167,139,250,0.35)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px - 1, py - 1, ts + 2, ts + 2);
      }
      // Контур клетки с войсками показывает цвет их владельца.
      if (stack.length) {
        const ownerColor = CIVS[stack[0].owner]?.color || '#ffffff';
        ctx.strokeStyle = ownerColor;
        ctx.lineWidth = 2.5;
        ctx.strokeRect(px + 1.5, py + 1.5, ts - 3, ts - 3);
      }
      // Highlights
      if (movableSet.has(key)) {
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(px + 1, py + 1, ts - 2, ts - 2);
      }
      if (attackableSet.has(key)) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(px + 1, py + 1, ts - 2, ts - 2);
      }
      if (mergeableSet.has(key)) {
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(px + 1, py + 1, ts - 2, ts - 2);
      }
      // Selected
      let isSelected = false;
      if (selected) {
        if (selected.type === 'stack' && selected.x === x && selected.y === y) isSelected = true;
        if (selected.type === 'city' && city && city.id === selected.id) isSelected = true;
      }
      if (isSelected) {
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 3;
        ctx.strokeRect(px + 0.5, py + 0.5, ts - 1, ts - 1);
      }
      // Content
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = Math.max(24, fontSize * 2) + 'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
      if (city) {
        ctx.fillText('🏛', px + ts / 2, py + ts / 2 + (city.isCapital ? 2 : 0));
        if (city.isCapital) {
          ctx.font = Math.max(20, Math.floor(ts * 0.64)) + 'px "Apple Color Emoji","Segoe UI Emoji",sans-serif';
          ctx.fillText('👑', px + ts / 2, py + 8);
        }
        if (stack.length > 0) {
          ctx.fillStyle = '#7c3aed';
          ctx.fillRect(px + ts - 14, py + ts - 12, 13, 11);
          ctx.fillStyle = '#fff';
          ctx.font = 'bold ' + smallFont + 'px sans-serif';
          ctx.fillText(String(stack.length), px + ts - 7.5, py + ts - 6);
        }
        const cityGold = getCityGold(city);
        if (cityGold > 0) {
          ctx.fillStyle = '#b45309';
          const gtxt = '💰' + (cityGold >= 1000 ? Math.floor(cityGold / 1000) + 'k' : cityGold);
          ctx.font = smallFont + 'px sans-serif';
          const tw = ctx.measureText(gtxt).width + 4;
          ctx.fillRect(px + 1, py + ts - 12, tw, 11);
          ctx.fillStyle = '#fbbf24';
          ctx.textAlign = 'left';
          ctx.fillText(gtxt, px + 3, py + ts - 6);
          ctx.textAlign = 'center';
        }
        if (stack.length >= 2) {
          const flagColor = CIVS[stack[0].owner]?.color || '#ffffff';
          const fx = px + ts * 0.50, fy = py + ts * 0.08;
          ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = Math.max(1, ts * 0.035);
          ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, fy + ts * 0.30); ctx.stroke();
          ctx.fillStyle = flagColor; ctx.beginPath();
          ctx.moveTo(fx, fy); ctx.quadraticCurveTo(fx + ts * (0.18 + Math.sin(animTime * 0.006 + x) * 0.025), fy + ts * 0.04, fx + ts * 0.30, fy + ts * 0.07);
          ctx.lineTo(fx + ts * 0.28, fy + ts * 0.21); ctx.quadraticCurveTo(fx + ts * 0.14, fy + ts * 0.17, fx, fy + ts * 0.19); ctx.closePath(); ctx.fill();
        }
      } else if (stack.length) {
        // Unit icons / sprites with idle bob animation
        const drawList = [];
        stack.slice(0, MAX_STACK).forEach(u => {
          const def = getUnitDef(u.type, u.owner);
          if (UNIT_SPRITES[u.type] && UNIT_SPRITES[u.type].complete) {
            drawList.push({ type: 'sprite', img: UNIT_SPRITES[u.type] });
          } else if (def.iconRender) {
            def.iconRender.forEach(ic => drawList.push({ type: 'emoji', icon: ic }));
          } else {
            drawList.push({ type: 'emoji', icon: def.icon });
          }
        });
        const iconCount = Math.min(drawList.length, 5);
        const spacing = ts / (iconCount + 1);
        const spriteSize = Math.max(18, Math.floor(ts * 0.72));
        ctx.font = Math.max(14, Math.floor(ts * 0.4)) + 'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
        for (let i = 0; i < iconCount; i++) {
          const phase = animTime * 0.004 + i * 0.7 + (x * 0.3 + y * 0.2);
          const bob = Math.sin(phase) * Math.max(1.5, ts * 0.04);
          const sway = Math.sin(phase * 0.8) * 0.8;
          const cx = px + spacing * (i + 1) + sway;
          const cy = py + ts / 2 + bob;
          const item = drawList[i];
          if (item.type === 'sprite' && item.img) {
            ctx.drawImage(item.img, cx - spriteSize / 2, cy - spriteSize / 2, spriteSize, spriteSize);
          } else {
            ctx.fillText(item.icon, cx, cy);
          }
        }
        if (stack.length > 1) {
          ctx.fillStyle = '#7c3aed';
          ctx.fillRect(px + ts - 14, py + 1, 13, 11);
          ctx.fillStyle = '#fff';
          ctx.font = 'bold ' + smallFont + 'px sans-serif';
          ctx.fillText(String(stack.length), px + ts - 7.5, py + 7);
        }
        const courier = stack.find(u => getUnitDef(u.type, u.owner).isCourier);
        if (courier && courier.carryGold > 0) {
          ctx.fillStyle = '#b45309';
          const gtxt = '💰' + (courier.carryGold >= 1000 ? Math.floor(courier.carryGold / 1000) + 'k' : courier.carryGold);
          ctx.font = smallFont + 'px sans-serif';
          const tw = ctx.measureText(gtxt).width + 4;
          ctx.fillRect(px + 1, py + ts - 12, tw, 11);
          ctx.fillStyle = '#fbbf24';
          ctx.textAlign = 'left';
          ctx.fillText(gtxt, px + 3, py + ts - 6);
          ctx.textAlign = 'center';
        }
        if (stack.some(u => u.healTurns > 0 || u.buildFort > 0 || u.buildStructureTurns > 0)) {
          const maxF = Math.max(...stack.map(u => u.buildFort || 0));
          const maxH = Math.max(...stack.map(u => u.healTurns || 0));
          const maxB = Math.max(...stack.map(u => u.buildStructureTurns || 0));
          const htxt = maxF > 0 ? '🏰' + maxF : maxB > 0 ? '🛠' + maxB : '❤' + maxH;
          ctx.fillStyle = '#059669';
          ctx.font = smallFont + 'px sans-serif';
          const tw = ctx.measureText(htxt).width + 4;
          ctx.fillRect(px + 1, py + 1, tw, 11);
          ctx.fillStyle = '#fff';
          ctx.textAlign = 'left';
          ctx.fillText(htxt, px + 3, py + 7);
          ctx.textAlign = 'center';
        }
        // HP bar
        const pct = stackMaxHp(stack) > 0 ? (stackCurrentHp(stack) / stackMaxHp(stack)) * 100 : 0;
        ctx.fillStyle = '#333';
        ctx.fillRect(px + 1, py + ts - 4, ts - 2, 3);
        ctx.fillStyle = pct < 40 ? '#ef4444' : pct < 70 ? '#f59e0b' : '#22c55e';
        ctx.fillRect(px + 1, py + ts - 4, (ts - 2) * (pct / 100), 3);
        // Постройки рисуются поверх юнитов: гарнизон остаётся виден внутри сооружения.
        if (building?.type === 'watchtower') {
          ctx.font = Math.max(13, Math.floor(ts * 0.38)) + 'px "Apple Color Emoji","Segoe UI Emoji",sans-serif';
          ctx.fillText('🗼', px + ts - 11, py + 12);
        }
        if (fort) {
          ctx.font = Math.max(12, Math.floor(ts * 0.34)) + 'px "Apple Color Emoji","Segoe UI Emoji",sans-serif';
          ctx.fillText('🏰', px + ts - 11, py + 12);
        }
        if (stack.length >= 2) {
          const flagColor = CIVS[stack[0].owner]?.color || '#ffffff';
          const fx = px + ts * 0.50, fy = py + ts * 0.10;
          ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = Math.max(1, ts * 0.035);
          ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, fy + ts * 0.32); ctx.stroke();
          ctx.fillStyle = flagColor; ctx.beginPath();
          ctx.moveTo(fx, fy); ctx.quadraticCurveTo(fx + ts * (0.18 + Math.sin(animTime * 0.006 + x) * 0.025), fy + ts * 0.04, fx + ts * 0.30, fy + ts * 0.07);
          ctx.lineTo(fx + ts * 0.28, fy + ts * 0.22); ctx.quadraticCurveTo(fx + ts * 0.14, fy + ts * 0.18, fx, fy + ts * 0.20); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1; ctx.stroke();
        }
      } else if (building?.type === 'trench') {
        ctx.font = Math.max(26, Math.floor(ts * 0.92)) + 'px "Apple Color Emoji","Segoe UI Emoji",sans-serif';
        ctx.fillText('🕳️', px + ts / 2, py + ts / 2);
      } else if (building?.type === 'watchtower') {
        ctx.font = Math.max(28, Math.floor(ts * 0.95)) + 'px "Apple Color Emoji","Segoe UI Emoji",sans-serif';
        ctx.fillText('🗼', px + ts / 2, py + ts / 2);
      } else if (camp) {
        ctx.font = Math.max(28, Math.floor(ts * 1.0)) + 'px "Apple Color Emoji","Segoe UI Emoji",sans-serif';
        ctx.fillText('⛺', px + ts / 2, py + ts / 2);
      } else if (fort) {
        ctx.font = Math.max(14, Math.floor(ts * 0.55)) + 'px "Apple Color Emoji","Segoe UI Emoji",sans-serif';
        ctx.fillText('🏰', px + ts / 2, py + ts / 2);
      } else {
        const terrain = map[y][x];
        if (terrain === 'bridge') {
          ctx.font = Math.max(32, Math.floor(ts * 1.1)) + 'px "Apple Color Emoji","Segoe UI Emoji",sans-serif';
          ctx.fillText('🌉', px + ts / 2, py + ts / 2);
        } else if (terrain === 'river') {
          const flow = (animTime * 0.025 + x * 7 + y * 3) % (ts + 12);
          ctx.save(); ctx.beginPath(); ctx.rect(px + 2, py + 2, ts - 4, ts - 4); ctx.clip();
          ctx.strokeStyle = 'rgba(170,230,255,0.72)'; ctx.lineWidth = Math.max(1, ts * 0.045);
          for (let lane = 0; lane < 3; lane++) {
            const yy = py + ts * (0.28 + lane * 0.22);
            ctx.beginPath();
            for (let q = -1; q <= 4; q++) {
              const xx = px + ((flow + q * ts / 2) % (ts + 8)) - 4;
              const waveY = yy + Math.sin((xx + animTime * 0.018) * 0.12 + lane) * ts * 0.045;
              if (q === -1) ctx.moveTo(xx, waveY); else ctx.lineTo(xx, waveY);
            }
            ctx.stroke();
          }
          ctx.restore();
        } else if (terrain === 'mountain') {
          ctx.font = Math.max(32, Math.floor(ts * 1.1)) + 'px "Apple Color Emoji","Segoe UI Emoji",sans-serif';
          ctx.fillText('⛰', px + ts / 2, py + ts / 2);
        } else if (terrain === 'forest') {
          ctx.font = Math.max(28, Math.floor(ts * 0.9)) + 'px "Apple Color Emoji","Segoe UI Emoji",sans-serif';
          ctx.globalAlpha = 0.75;
          ctx.fillText('🌲', px + ts / 2, py + ts / 2);
          ctx.globalAlpha = 1;
        }
      }
    }
  }
  applyMapTransform();
}
function stackStrength(stack, defending = false) {
  const fighters = stack.filter(u => !getUnitDef(u.type, u.owner).isCourier);
  let s = fighters.reduce((sum, u) => sum + (defending ? getUnitDef(u.type, u.owner).defense : getUnitDef(u.type, u.owner).strength), 0);
  if (defending && fighters.length) {
    const fort = getFort(stack[0].x, stack[0].y);
    if (fort && fort.owner === stack[0].owner) s *= 2;
  }
  return s;
}
function stackMaxHp(stack) { return stack.reduce((s, u) => s + getUnitDef(u.type, u.owner).hp, 0); }
function stackCurrentHp(stack) { return stack.reduce((s, u) => s + u.hp, 0); }
// Canvas interaction handlers
let canvasPressTimer = null, canvasMoved = false, canvasLongPressed = false;
let mousePan = null;
let mouseDownPos = null;
let didMouseDrag = false;
function initCanvasHandlers() {
  const canvas = document.getElementById('map-canvas');
  const vp = document.getElementById('map-viewport');
  if (!canvas || !vp || canvas.dataset.handlersInit) return;
  canvas.dataset.handlersInit = '1';
  // Touch long-press for tile info
  const startPress = (e) => {
    canvasMoved = false; canvasLongPressed = false;
    const touch = e.touches ? e.touches[0] : e;
    canvasPressTimer = setTimeout(() => {
      if (!canvasMoved && !combatBusy) {
        const tile = screenToTile(touch.clientX, touch.clientY);
        if (tile) {
          canvasLongPressed = true;
          showTileInfo(tile.x, tile.y);
          if (navigator.vibrate) navigator.vibrate(20);
        }
      }
    }, 450);
  };
  const cancelPress = () => { if (canvasPressTimer) { clearTimeout(canvasPressTimer); canvasPressTimer = null; } };
  canvas.addEventListener('touchstart', startPress, { passive: true });
  canvas.addEventListener('touchmove', () => { canvasMoved = true; cancelPress(); }, { passive: true });
  canvas.addEventListener('touchend', (e) => {
    cancelPress();
    if (vp.dataset.panning) return;
    if (canvasMoved || canvasLongPressed) return;
    e.preventDefault();
    if (combatBusy) return;
    const touch = e.changedTouches[0];
    const tile = screenToTile(touch.clientX, touch.clientY);
    if (tile) onTileClick(tile.x, tile.y);
  }, { passive: false });
  // Mouse: left button drag = pan, click without drag = select
  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0 && e.button !== 1) return;
    mouseDownPos = { x: e.clientX, y: e.clientY };
    didMouseDrag = false;
    mousePan = { startX: e.clientX, startY: e.clientY, startPanX: mapPanX, startPanY: mapPanY };
    // Middle button always pans; left button pans after small movement
  });
  window.addEventListener('mousemove', (e) => {
    if (!mousePan) return;
    const dx = e.clientX - mousePan.startX;
    const dy = e.clientY - mousePan.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      didMouseDrag = true;
      mapPanX = mousePan.startPanX + dx;
      mapPanY = mousePan.startPanY + dy;
      applyMapTransform();
      canvas.style.cursor = 'grabbing';
    }
  });
  window.addEventListener('mouseup', (e) => {
    if (mousePan) {
      canvas.style.cursor = 'crosshair';
      // If it was a short left click without drag — treat as tile click
      if (e.button === 0 && !didMouseDrag && mouseDownPos && !combatBusy) {
        const tile = screenToTile(e.clientX, e.clientY);
        if (tile) onTileClick(tile.x, tile.y);
      }
      mousePan = null;
      mouseDownPos = null;
    }
  });
  // Prevent default click (we handle via mouseup)
  canvas.addEventListener('click', (e) => {
    if (e.pointerType === 'touch') return;
    e.preventDefault();
    e.stopPropagation();
  });
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (combatBusy) return;
    const tile = screenToTile(e.clientX, e.clientY);
    if (tile) showTileInfo(tile.x, tile.y);
  });
  // Wheel zoom
  vp.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(1, Math.min(3, mapZoom * delta));
    const rect = vp.getBoundingClientRect();
    const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
    const ratio = newZoom / mapZoom;
    mapPanX = cx - (cx - mapPanX) * ratio;
    mapPanY = cy - (cy - mapPanY) * ratio;
    mapZoom = newZoom;
    applyMapTransform();
  }, { passive: false });
}
function centerOnPlayerCapital() {
  const capital = cities.find(c => c.owner === 'player' && c.isCapital) || cities.find(c => c.owner === 'player');
  if (!capital) return;
  const vp = document.getElementById('map-viewport');
  if (!vp) return;
  const gap = 1;
  const mapW = COLS * (TILE_PX + gap);
  const mapH = ROWS * (TILE_PX + gap);
  const cx = capital.x * (TILE_PX + gap) + TILE_PX / 2;
  const cy = capital.y * (TILE_PX + gap) + TILE_PX / 2;
  const vpW = vp.clientWidth, vpH = vp.clientHeight;
  // Center capital in viewport at current zoom
  mapPanX = vpW / 2 - cx * mapZoom;
  mapPanY = vpH / 2 - cy * mapZoom;
  // Clamp
  const scaledW = mapW * mapZoom, scaledH = mapH * mapZoom;
  const minX = Math.min(0, vpW - scaledW);
  const minY = Math.min(0, vpH - scaledH);
  mapPanX = Math.max(minX, Math.min(0, mapPanX));
  mapPanY = Math.max(minY, Math.min(0, mapPanY));
  applyMapTransform();
}
function onTileClick(x, y) {
  if (currentCiv !== 'player' || combatBusy) return;
  if (!isTileVisibleToCiv('player', x, y)) { closeTileInfo(); return; }
  if (selected && selected.type === 'stack') {
    const stack = getStackAt(selected.x, selected.y, 'player');
    if (stack.length && stack.some(u => !u.moved && u.healTurns === 0 && u.buildFort === 0 && !u.buildStructure && !(u.destroyStructureTurns > 0))) {
      if (movableTiles.some(t => t.x === x && t.y === y)) { moveStack(stack, x, y); return; }
      if (attackableTiles.some(t => t.x === x && t.y === y)) {
        const camp = camps.find(c => c.x === x && c.y === y);
        if (camp) { destroyCamp(stack, camp); return; }
        const enemies = getEnemyStackAt(x, y, 'player');
        if (enemies.length) { attackStack(stack, enemies, x, y); return; }
        const city = cities.find(c => c.x === x && c.y === y && c.owner !== 'player');
        if (city) { captureCity(stack, city); return; }
      }
      if (mergeableTiles.some(t => t.x === x && t.y === y)) { askCreateArmy(stack, x, y); return; }
    }
  }
  const city = cities.find(c => c.x === x && c.y === y);
  if (city) {
    selected = { type: 'city', id: city.id };
    movableTiles = []; attackableTiles = []; mergeableTiles = [];
    updateUI(); render();
    openCityPanel(city.id);
    return;
  }
  const stack = getStackAt(x, y);
  if (stack.length) { selectStack(x, y); if (stack.length >= 2 || stack.some(u => u.type === 'worker')) openArmyModal(x, y); return; }
  clearSelection();
  showTileInfo(x, y);
}
function selectStack(x, y) {
  selected = { type: 'stack', x, y };
  movableTiles = []; attackableTiles = []; mergeableTiles = [];
  const stack = getStackAt(x, y);
  if (!stack.length || stack[0].owner !== 'player' || currentCiv !== 'player') { updateUI(); render(); return; }
  const canMove = stack.filter(u => !u.moved && u.healTurns === 0 && u.buildFort === 0 && !u.buildStructure && !(u.destroyStructureTurns > 0));
  if (!canMove.length) { updateUI(); render(); return; }
  const canAttack = canMove.some(u => getUnitDef(u.type, u.owner).canAttack);
  const moveRange = Math.min(...canMove.map(u => getUnitDef(u.type, u.owner).move));
  for (let dy = -moveRange; dy <= moveRange; dy++) {
    for (let dx = -moveRange; dx <= moveRange; dx++) {
      if (Math.abs(dx) + Math.abs(dy) === 0 || Math.abs(dx) + Math.abs(dy) > moveRange) continue;
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      if (isBlockedTerrain(nx, ny)) continue;
      const allies = getStackAt(nx, ny, 'player');
      const enemies = getEnemyStackAt(nx, ny, 'player');
      const city = cities.find(c => c.x === nx && c.y === ny);
      const camp = camps.find(c => c.x === nx && c.y === ny);
      if (enemies.length && canAttack) attackableTiles.push({ x: nx, y: ny });
      else if (city && city.owner !== 'player' && canAttack) attackableTiles.push({ x: nx, y: ny });
      else if (camp && canAttack) attackableTiles.push({ x: nx, y: ny });
      else if (allies.length > 0 && CIVS.player.researched.has(ARMY_TECH) && stack.length === 1 && canMove.length === 1 && allies.length === 1 && allies.length + canMove.length <= getTileUnitCapacity(nx, ny)) mergeableTiles.push({ x: nx, y: ny });
      else if (allies.length === 0 && canMove.length <= getTileUnitCapacity(nx, ny)) {
        if (city && city.owner === 'player') movableTiles.push({ x: nx, y: ny });
        else if (!camp) movableTiles.push({ x: nx, y: ny });
      }
    }
  }
  updateUI(); render();
}
function moveStack(stack, x, y) {
  const moving = stack.filter(u => !u.moved && u.healTurns === 0 && u.buildFort === 0 && !u.buildStructure && !(u.destroyStructureTurns > 0));
  if (getStackAt(x, y, moving[0]?.owner).length + moving.length > getTileUnitCapacity(x, y)) { log('В этой постройке недостаточно места.', 'info'); return; }
  moving.forEach(u => { u.x = x; u.y = y; u.moved = true; });
  if (moving.length) {
    tryCaptureFort(x, y, moving[0].owner);
    const city = getCityAt(x, y);
    if (city && city.owner === moving[0].owner) {
      const courier = moving.find(u => getUnitDef(u.type, u.owner).isCourier && u.carryGold > 0);
      if (courier) { city.gold = (city.gold || 0) + courier.carryGold; log(`🐎 Доставлено ${courier.carryGold} золота в «${city.name}»`, 'gold'); courier.carryGold = 0; }
    }
  }
  clearSelection(); checkVictory();
}
function askCreateArmy(stack, x, y) {
  if (!CIVS.player.researched.has(ARMY_TECH)) { log('Для создания Армии изучите технологию «Военное Искусство».', 'tech'); return; }
  const moving = stack.filter(u => !u.moved && u.healTurns === 0 && u.buildFort === 0 && !u.buildStructure && !(u.destroyStructureTurns > 0));
  const target = getStackAt(x, y, 'player');
  if (stack.length !== 1 || moving.length !== 1 || target.length !== 1) return;
  pendingArmyMerge = { sourceX: stack[0].x, sourceY: stack[0].y, targetX:x, targetY:y };
  const modal = document.getElementById('army-create-modal');
  const name = document.getElementById('army-create-name');
  name.value = '';
  modal.style.display = 'flex';
  name.focus();
}
function closeArmyCreateModal() { document.getElementById('army-create-modal').style.display = 'none'; pendingArmyMerge = null; }
function confirmArmyCreate(yes) {
  if (!pendingArmyMerge) return;
  const pending = pendingArmyMerge;
  if (yes) {
    const name = (document.getElementById('army-create-name').value || '').trim().slice(0,32) || 'Армия';
    const source = getStackAt(pending.sourceX, pending.sourceY, 'player');
    if (source.length) mergeStacks(source, pending.targetX, pending.targetY, name);
  }
  closeArmyCreateModal();
}
function mergeStacks(stack, x, y, armyName = '') {
  if (!CIVS.player.researched.has(ARMY_TECH)) { log('Сначала изучите технологию «Военное Искусство».', 'tech'); return; }
  const moving = stack.filter(u => !u.moved && u.healTurns === 0 && u.buildFort === 0 && !u.buildStructure && !(u.destroyStructureTurns > 0));
  const target = getStackAt(x, y, 'player');
  if (moving.length !== 1 || target.length !== 1 || target.length + moving.length > getTileUnitCapacity(x, y)) { log('Армию можно создать только из двух одиночных юнитов на одной клетке.', 'combat'); return; }
  moving.forEach(u => { u.x = x; u.y = y; u.moved = true; });
  target.forEach(u => { u.armyName = armyName || 'Армия'; });
  moving.forEach(u => { u.armyName = armyName || 'Армия'; });
  clearSelection();
  log(`🟣 Создана армия «${armyName || 'Армия'}»`, 'army');
}
function tryCaptureFort(x, y, newOwner) {
  const fort = getFort(x, y);
  if (!fort) return false;
  if (fort.owner === newOwner) return false;
  const defenders = getStackAt(x, y).filter(u => u.owner === fort.owner && u.hp > 0);
  if (defenders.length) return false;
  const old = fort.owner;
  fort.owner = newOwner;
  if (newOwner === 'player') { log(`🏰 Крепость захвачена у ${CIVS[old]?.name || old}!`, 'fort'); showEventModal('🏰', 'Крепость захвачена!', `Вы заняли крепость (${CIVS[old]?.name || old}). Защита ×2.`); }
  else if (old === 'player') { log(`🏰 Крепость захвачена ${CIVS[newOwner]?.name || newOwner}!`, 'combat'); showEventModal('🏰', 'Крепость потеряна!', `${CIVS[newOwner]?.name || newOwner} заняли вашу крепость.`); }
  else log(`🏰 Крепость перешла к ${CIVS[newOwner]?.name || newOwner}`, 'info');
  return true;
}
async function attackStack(attackers, defenders, tx, ty) {
  const atk = attackers.filter(u => !u.moved && u.healTurns === 0 && u.buildFort === 0 && !u.buildStructure && !(u.destroyStructureTurns > 0) && getUnitDef(u.type, u.owner).canAttack);
  if (!atk.length) { log('Нет атакующих.', 'combat'); return; }
  const aStr = stackStrength(atk, false);
  const dStr = stackStrength(defenders, true);
  let dmgToDef = Math.max(12, Math.floor(aStr * 2.4 + Math.random() * 18));
  let dmgToAtk = Math.max(8, Math.floor(dStr * 1.6 + Math.random() * 12));
  showEventModal('⚔', 'Начинается бой!', `${CIVS[atk[0].owner]?.name || '?'} атакует ${CIVS[defenders[0].owner]?.name || '?'}.\n\nАтакующие: ${atk.length}\nЗащитники: ${defenders.length}\n\nНажмите «⚔ В атаку!» чтобы начать сражение.`, { attack: true, onConfirm: async () => {
    await playCombatAnim(atk, defenders, dmgToDef, dmgToAtk, `${CIVS[atk[0].owner]?.name || '?'} vs ${CIVS[defenders[0].owner]?.name || '?'}`);
    applyDamageNoCaptureBarb(defenders, dmgToDef, atk[0].owner);
    applyDamage(atk, dmgToAtk);
    atk.forEach(u => u.moved = true);
    log(`⚔ Урон: ${dmgToDef}/${dmgToAtk}`, 'combat');
    const atkLost = atk.filter(u => u.hp <= 0).length;
    const defLost = defenders.filter(u => u.hp <= 0 && u.owner !== atk[0].owner).length;
    const lootGold = defenders.filter(u => getUnitDef(u.type, u.owner).isCourier).reduce((s,u)=>s+(u.carryGold||0),0);
    if (lootGold > 0 && atk[0].owner !== 'barb') { addToTreasury(atk[0].owner, lootGold); if (atk[0].owner === 'player') log(`🐎 Захвачено золото курьеров: +${lootGold}`, 'gold'); }
    units = units.filter(u => u.hp > 0);
    if (getEnemyStackAt(tx, ty, atk[0].owner).length === 0) {
      const survivors = atk.filter(u => u.hp > 0 && !u.retreated);
      const space = getTileUnitCapacity(tx, ty) - getStackAt(tx, ty, atk[0].owner).length;
      survivors.slice(0, Math.max(0, space)).forEach(u => { u.x = tx; u.y = ty; });
      if (hasFort(tx, ty)) destroyFort(tx, ty, atk[0].owner);
      tryCaptureFort(tx, ty, atk[0].owner);
    }
    if (atk[0].owner === 'player') {
      let result = `Нанесён урон: ${dmgToDef}. Получен урон: ${dmgToAtk}.`;
      if (defLost) result += `\nУничтожено врагов: ${defLost}.`;
      if (atkLost) result += `\nПотеряно своих: ${atkLost}.`;
      if (lootGold) result += `\n💰 Захвачено золота: ${lootGold}`;
      showEventModal('🏆', 'Итоги боя', result);
    }
    clearSelection(); checkVictory();
    setTimeout(nextEventModal, 200);
  }});
}
function applyDamage(stack, totalDmg) {
  let remaining = totalDmg;
  const sorted = [...stack].sort((a,b) => { const ac = getUnitDef(a.type,a.owner).isCourier?1:0, bc = getUnitDef(b.type,b.owner).isCourier?1:0; return bc-ac || a.hp-b.hp; });
  sorted.forEach(u => { if (remaining<=0) return; const dmg=Math.min(u.hp,remaining); u.hp-=dmg; remaining-=dmg; });
}
function applyDamageNoCaptureBarb(stack, totalDmg, winnerOwner) {
  let remaining = totalDmg;
  const sorted = [...stack].sort((a,b) => { const ac = getUnitDef(a.type,a.owner).isCourier?1:0, bc = getUnitDef(b.type,b.owner).isCourier?1:0; return bc-ac || a.hp-b.hp; });
  sorted.forEach(u => {
    if (remaining<=0) return;
    const dmg = Math.min(u.hp,remaining); u.hp-=dmg; remaining-=dmg;
    if (u.hp<=0) {
      if (getUnitDef(u.type,u.owner).isCourier && u.carryGold > 0) {
        if (winnerOwner !== 'barb') addToTreasury(winnerOwner, u.carryGold);
        if (winnerOwner === 'player') log(`🐎 Захвачено ${u.carryGold} золота курьера!`, 'gold');
        u.carryGold = 0;
      }
      if (u.owner === 'barb') {
        if (winnerOwner !== 'barb') { addToTreasury(winnerOwner, 5); if (winnerOwner==='player') log(`🪓 Варвар убит! +5 в казну`, 'barb'); }
      } else if (winnerOwner !== 'barb' && u.owner !== 'barb' && Math.random() < 0.5 && !getUnitDef(u.type,u.owner).isCourier) {
        u.hp = Math.floor(getUnitDef(u.type,u.owner).hp * 0.4);
        u.owner = winnerOwner; u.moved = true; u.healTurns = 0; u.buildFort = 0;
        if (winnerOwner === 'player') log(`⛓ Захвачен ${getUnitDef(u.type, winnerOwner).name}!`, 'capture');
      }
    }
  });
}
function captureCity(stack, city) {
  const atk = stack.filter(u => !u.moved && u.healTurns === 0 && u.buildFort === 0 && !u.buildStructure && !(u.destroyStructureTurns > 0) && getUnitDef(u.type, u.owner).canAttack);
  if (!atk.length) return;
  const wasCapital = city.isCapital;
  city.owner = 'player'; city.isCapital = false;
  atk.forEach(u => { u.moved = true; u.x = city.x; u.y = city.y; });
  const loot = city.gold || 0;
  addToTreasury('player', loot);
  city.gold = 0;
  if (wasCapital) log(`👑 Столица захвачена! ${loot} в казну.`, 'gold');
  log(`🏛 «${city.name}» захвачен! +${loot}`, 'good');
  showEventModal('🏛', 'Город захвачен!', `«${city.name}» теперь ваш.\n\nЗахвачено золота: ${loot}`);
  clearSelection(); checkVictory();
}
async function destroyCamp(stack, camp) {
  const atk = stack.filter(u => !u.moved && u.healTurns === 0 && u.buildFort === 0 && !u.buildStructure && !(u.destroyStructureTurns > 0) && getUnitDef(u.type, u.owner).canAttack);
  if (!atk.length) return;
  const tx = camp.x, ty = camp.y;
  let barbsHere = units.filter(u => u.x === tx && u.y === ty && u.owner === 'barb' && u.hp > 0);
  // Бой со стражей стойбища (с анимацией)
  if (barbsHere.length) {
    const aStr = stackStrength(atk, false);
    const dStr = stackStrength(barbsHere, true);
    let dmgToDef = Math.max(14, Math.floor(aStr * 2.5 + Math.random() * 20));
    let dmgToAtk = Math.max(6, Math.floor(dStr * 1.5 * barbDmgMult() + Math.random() * 10));
    showEventModal('⛺', 'Нападение на стойбище!', `Ваши войска атакуют стойбище варваров.\n\nАтакующие: ${atk.length}\nВарвары: ${barbsHere.length}\n\nНажмите «⚔ В атаку!»`, {
      attack: true,
      onConfirm: async () => {
        await playCombatAnim(atk, barbsHere, dmgToDef, dmgToAtk, 'Набег на стойбище');
        applyDamage(barbsHere, dmgToDef);
        applyDamage(atk, dmgToAtk);
        atk.forEach(u => u.moved = true);
        const killedBarbs = barbsHere.filter(u => u.hp <= 0).length;
        units = units.filter(u => u.hp > 0);
        barbsHere = units.filter(u => u.x === tx && u.y === ty && u.owner === 'barb' && u.hp > 0);
        // Если варвары ещё живы — стойбище не захвачено
        if (barbsHere.length > 0) {
          log(`⛺ Варвары отбились! Убито: ${killedBarbs}, осталось: ${barbsHere.length}`, 'barb');
          showEventModal('🪓', 'Стойбище не захвачено', `Варвары удержали лагерь.\n\nУбито варваров: ${killedBarbs}\nОсталось защитников: ${barbsHere.length}`);
          clearSelection();
          checkVictory();
          return;
        }
        // Победа — зачистка и лут
        finishCampCapture(atk, camp, killedBarbs);
      }
    });
    return;
  }
  // Пустое стойбище — сразу захват
  atk.forEach(u => { u.moved = true; });
  finishCampCapture(atk, camp, 0);
}
function finishCampCapture(atk, camp, killedBarbs) {
  const tx = camp.x, ty = camp.y;
  camps = camps.filter(c => c.id !== camp.id);
  // Убрать оставшихся варваров на клетке (на всякий случай)
  const leftover = units.filter(u => u.x === tx && u.y === ty && u.owner === 'barb');
  const goldFromBarbs = 5 * (killedBarbs + leftover.length);
  units = units.filter(u => !(u.x === tx && u.y === ty && u.owner === 'barb'));
  const loot = 10 + Math.floor(Math.random() * 41);
  const totalGold = loot + goldFromBarbs;
  addToTreasury('player', totalGold);
  // Занять клетку выжившими
  const survivors = atk.filter(u => u.hp > 0);
  const space = MAX_STACK - getStackAt(tx, ty, 'player').length;
  survivors.slice(0, Math.max(0, space)).forEach(u => { u.x = tx; u.y = ty; });
  log(`⛺ Стойбище уничтожено! +${totalGold} в казну`, 'gold');
  let body = `Стойбище варваров разорено!\n\n`;
  if (killedBarbs > 0) body += `Убито варваров: ${killedBarbs} (+${killedBarbs * 5} з)\n`;
  body += `Добыча из лагеря: +${loot} золота\n`;
  body += `\n💰 Всего захвачено: ${totalGold} золота`;
  showEventModal('💰', 'Стойбище захвачено!', body);
  clearSelection();
  checkVictory();
}
function destroyFort(x, y, attackerOwner) {
  const fort = getFort(x, y);
  if (!fort) return;
  forts = forts.filter(f => !(f.x === x && f.y === y));
  addToTreasury(attackerOwner, FORT_DESTROY_GOLD);
  if (attackerOwner === 'player') { log(`🔥 Крепость уничтожена! +${FORT_DESTROY_GOLD} в казну`, 'gold'); showEventModal('🔥', 'Крепость уничтожена!', `В казну: +${FORT_DESTROY_GOLD}.`); }
  else if (fort.owner === 'player') { log(`💥 Ваша крепость уничтожена ${CIVS[attackerOwner]?.name || attackerOwner}!`, 'combat'); showEventModal('💥', 'Крепость уничтожена!', `${CIVS[attackerOwner]?.name || attackerOwner} разрушили вашу крепость.`); }
}
let cityPanelCityId = null, selectedCityUnitId = null, selectedArmyUnitId = null;
function openCityPanel(cityId) {
  const city = cities.find(c => c.id === cityId);
  if (!city) return;
  cityPanelCityId = cityId;
  selectedCityUnitId = null;
  renderCityPanel();
  document.getElementById('city-panel').style.display = 'flex';
  closeTileInfo();
}
function closeCityPanel() { cityPanelCityId = null; document.getElementById('city-panel').style.display = 'none'; }
function renderCityPanel() {
  const city = cities.find(c => c.id === cityPanelCityId);
  if (!city) { closeCityPanel(); return; }
  document.getElementById('city-panel-icon').textContent = '🏛';
  document.getElementById('city-panel-title').textContent = city.name;
  document.getElementById('city-panel-coords').textContent = `Координаты: ${city.x}, ${city.y} · ${CIVS[city.owner]?.name || city.owner}`;
  document.getElementById('city-panel-capital-tag').style.display = city.isCapital ? 'block' : 'none';
  document.getElementById('city-panel-gold').textContent = getCityGold(city);
  document.getElementById('city-panel-income').textContent = `(+${cityIncome(city)}/ход)`;
  const unitsBox = document.getElementById('city-panel-units');
  unitsBox.innerHTML = '';
  const stack = getStackAt(city.x, city.y);
  if (!stack.length) unitsBox.innerHTML = '<div style="color:var(--muted);font-size:.85rem;padding:8px">Нет юнитов</div>';
  else stack.forEach(u => {
    const def = getUnitDef(u.type, u.owner);
    const row = document.createElement('div');
    row.className = 'city-unit-row ' + getCivClass(u.owner) + (selectedCityUnitId === u.id ? ' unit-row-selected' : '');
    row.tabIndex = 0;
    row.setAttribute('role','button');
    row.onclick = () => { selectedCityUnitId = u.id; renderCityPanel(); };
    const goldTxt = (def.isCourier && u.carryGold > 0) ? ` · 💰 ${u.carryGold}` : '';
    const healTxt = u.healTurns > 0 ? ` · ❤ ${u.healTurns}` : '';
    row.innerHTML = `<div class="city-unit-icon">${unitIconHtml(u.type, 28)}</div><div><div class="city-unit-name">${def.name}</div><div class="city-unit-stats">ОЗ: ${u.hp}/${def.hp} · Ход: ${def.move}${goldTxt}${healTxt}</div></div>`;
    unitsBox.appendChild(row);
  });
  if (city.owner === 'player' && selectedCityUnitId && stack.some(u => u.id === selectedCityUnitId)) {
    const takeOut = document.createElement('button');
    takeOut.className = 'success';
    takeOut.textContent = '↗ Вывести выбранного юнита из города';
    takeOut.onclick = () => { extractUnitFromStack(selectedCityUnitId, true); selectedCityUnitId = null; renderCityPanel(); };
    unitsBox.appendChild(takeOut);
  }
  const prodBox = document.getElementById('city-panel-prod');
  prodBox.innerHTML = '';
  const actionsBox = document.getElementById('city-panel-actions');
  actionsBox.innerHTML = '';
  if (city.owner === 'player') {
    if (city.production) {
      const def = getUnitDef(city.production, 'player');
      const div = document.createElement('div');
      div.style.cssText = 'padding:10px;background:#1f2937;border-radius:8px;font-size:.85rem';
      div.innerHTML = `🏗 ${def.name}<br>Прогресс: ${city.progress}/${city.needed} ходов`;
      prodBox.appendChild(div);
      const cancel = document.createElement('button');
      cancel.className = 'danger'; cancel.textContent = 'Отменить производство';
      cancel.onclick = () => { city.production = null; city.progress = 0; city.needed = 0; renderCityPanel(); updateUI(); render(); };
      actionsBox.appendChild(cancel);
    } else {
      prodBox.innerHTML = '<div style="color:var(--muted);font-size:.85rem;padding:8px">Не задано</div>';
      for (const key of ['infantry','militia','archer','cavalry','settler','courier','scout','worker']) {
        const def = getUnitDef(key, 'player');
        const btn = document.createElement('button');
        btn.className = key === 'courier' ? 'courier-btn' : 'prod-btn';
        btn.style.marginTop = '5px';
        if (UNIT_SPRITES[key] && UNIT_SPRITES[key].complete) {
          btn.innerHTML = `${unitIconHtml(key, 22)} ${def.name} — ${def.cost} з / ${PROD_TURNS[key]} х`;
        } else {
          btn.textContent = `${def.icon} ${def.name} — ${def.cost} з / ${PROD_TURNS[key]} х`;
        }
        btn.disabled = (getCityGold(city) < def.cost);
        btn.onclick = () => startProduction(city.id, key);
        actionsBox.appendChild(btn);
      }
    }
    if (!city.isCapital) {
      const btn = document.createElement('button');
      btn.className = 'gold-btn';
      btn.textContent = '👑 Сделать столицей';
      btn.onclick = () => makeCapital(city);
      actionsBox.appendChild(btn);
    }
    const courier = stack.find(u => getUnitDef(u.type, u.owner).isCourier);
    if (courier && getCityGold(city) > 0) {
      const btn = document.createElement('button');
      btn.className = 'gold-btn';
      const maxLoad = Math.min(getCityGold(city), 9999);
      btn.textContent = `💰 Загрузить золото в курьера (до ${maxLoad})`;
      btn.onclick = () => loadGoldToCourier(city, courier, maxLoad);
      actionsBox.appendChild(btn);
    }
    if (courier && courier.carryGold > 0) {
      const btn = document.createElement('button');
      btn.className = 'success';
      btn.textContent = `💰 Разгрузить курьера (${courier.carryGold} з)`;
      btn.onclick = () => unloadCourier(city, courier);
      actionsBox.appendChild(btn);
    }
  } else {
    prodBox.innerHTML = '<div style="color:var(--muted);font-size:.85rem;padding:8px">Город противника</div>';
  }
  updateUI(); render();
}
function makeCapital(city) { cities.filter(c => c.owner === city.owner).forEach(c => c.isCapital = false); city.isCapital = true; log(`👑 «${city.name}» стал столицей`, 'gold'); renderCityPanel(); }
function loadGoldToCourier(city, courier, amount) {
  const toLoad = Math.min(amount, getCityGold(city), 9999);
  if (toLoad <= 0) return;
  city.gold -= toLoad;
  courier.carryGold = (courier.carryGold || 0) + toLoad;
  log(`💰 Загружено ${toLoad} в курьера`, 'gold');
  renderCityPanel();
}
function unloadCourier(city, courier) {
  const amount = courier.carryGold || 0;
  if (amount <= 0) return;
  city.gold = (city.gold || 0) + amount;
  courier.carryGold = 0;
  log(`💰 Разгружено ${amount} в «${city.name}»`, 'gold');
  renderCityPanel();
}
function goToCity() { if (selected && selected.type === 'city') { const cityId = selected.id; closeTileInfo(); setTimeout(() => openCityPanel(cityId), 200); } }
function openTechModal() { renderTechModal(); document.getElementById('tech-modal').style.display = 'flex'; }
function closeTechModal() { document.getElementById('tech-modal').style.display = 'none'; }
function renderTechModal() {
  const civ = CIVS.player;
  const cur = document.getElementById('tech-modal-current');
  const barWrap = document.getElementById('tech-modal-bar-wrap');
  const bar = document.getElementById('tech-modal-bar');
  if (civ.currentResearch) {
    const tech = TECHS[civ.currentResearch];
    cur.innerHTML = `📖 <strong>${tech.name}</strong> (${civ.researchProgress}/${tech.cost})`;
    barWrap.style.display = 'block';
    bar.style.width = Math.min(100, civ.researchProgress / tech.cost * 100) + '%';
  } else { cur.textContent = '📖 Нет исследований. Выберите технологию ниже.'; barWrap.style.display = 'none'; }
  const list = document.getElementById('tech-modal-list');
  list.innerHTML = '';
  for (const tech of Object.values(TECHS)) {
    const btn = document.createElement('button');
    btn.className = 'tech-btn';
    const done = civ.researched.has(tech.id);
    const available = canResearch(tech.id, 'player');
    const active = civ.currentResearch === tech.id;
    if (done) { btn.classList.add('done'); btn.innerHTML = `✓ ${tech.name}<div class="tech-effect">${tech.desc}</div>`; btn.disabled = true; }
    else if (active) { btn.classList.add('tech-active'); btn.innerHTML = `▶ ${tech.name} (${tech.cost})<div class="tech-effect">${tech.desc}</div>`; }
    else if (available) { btn.innerHTML = `${tech.name} (${tech.cost})<div class="tech-effect">${tech.desc}</div>`; btn.onclick = () => { startResearch(tech.id); renderTechModal(); }; }
    else { btn.classList.add('locked'); btn.innerHTML = `🔒 ${tech.name}<div class="tech-effect">${tech.requires.map(r=>TECHS[r].name).join(', ')}</div>`; btn.disabled = true; }
    list.appendChild(btn);
  }
}
let armyModalX = null, armyModalY = null;
function openArmyModal(x, y) { armyModalX = x; armyModalY = y; selectedArmyUnitId = null; renderArmyModal(); document.getElementById('army-modal').style.display = 'flex'; }
function closeArmyModal() { armyModalX = armyModalY = null; document.getElementById('army-modal').style.display = 'none'; }
function renderArmyModal() {
  if (armyModalX === null) return;
  const stack = getStackAt(armyModalX, armyModalY);
  if (!stack.length) { closeArmyModal(); return; }
  const totalStr = stackStrength(stack);
  const strEl = document.getElementById('army-modal-total-str');
  strEl.textContent = `⚔ Суммарная сила армии: ${totalStr}`;
  strEl.style.display = 'block';
  document.getElementById('army-modal-limit').textContent = `${stack.find(u => u.armyName)?.armyName ? '«' + stack.find(u => u.armyName).armyName + '» · ' : ''}Юнитов в армии: ${stack.length} / ${MAX_STACK}`;
  const box = document.getElementById('army-modal-units');
  box.innerHTML = '';
  box.style.display = 'flex';
  box.style.flexDirection = 'column';
  stack.forEach(u => {
    const def = getUnitDef(u.type, u.owner);
    const row = document.createElement('div');
    row.className = 'army-unit-row ' + getCivClass(u.owner) + (selectedArmyUnitId === u.id ? ' unit-row-selected' : '');
    row.tabIndex = 0;
    row.setAttribute('role','button');
    row.onclick = () => { selectedArmyUnitId = u.id; renderArmyModal(); };
    const goldTxt = (def.isCourier && u.carryGold > 0) ? ` · 💰 ${u.carryGold}` : '';
    row.innerHTML = `<div class="army-unit-icon">${unitIconHtml(u.type, 28)}</div><div><div class="army-unit-name">${def.name}</div><div class="army-unit-stats">${CIVS[u.owner]?.name || u.owner} · ОЗ ${u.hp}/${def.hp} · Ход ${def.move} · Атака ${def.strength} · Защита ${def.defense}${goldTxt}</div></div>`;
    box.appendChild(row);
  });
  const actions = document.getElementById('army-modal-actions');
  actions.innerHTML = '';
  const isMine = stack[0].owner === 'player' && currentCiv === 'player';
  if (isMine && stack.length > 1 && selectedArmyUnitId && stack.some(u => u.id === selectedArmyUnitId)) {
    const takeOut = document.createElement('button');
    takeOut.className = 'success';
    takeOut.textContent = '↗ Вывести выбранного юнита из армии';
    takeOut.onclick = () => { extractUnitFromStack(selectedArmyUnitId, false); selectedArmyUnitId = null; renderArmyModal(); };
    actions.appendChild(takeOut);
  }
  if (isMine) {
    const chosen = stack.find(u => u.id === selectedArmyUnitId);
    if (chosen && chosen.type === 'worker' && !chosen.moved && !chosen.buildStructure && chosen.healTurns === 0) {
      const terrain = map[armyModalY]?.[armyModalX];
      const occupiedSpecial = getCityAt(armyModalX, armyModalY) || camps.some(c => c.x === armyModalX && c.y === armyModalY) || hasFort(armyModalX, armyModalY) || getBuildingAt(armyModalX, armyModalY);
      const clearGround = !occupiedSpecial && terrain !== 'mountain' && terrain !== 'water' && terrain !== 'river' && terrain !== 'bridge';
      const towerBtn = document.createElement('button'); towerBtn.className = 'fort-build-btn'; towerBtn.textContent = '🗼 Построить наблюдательную башню (300 золота, 10 ходов)';
      towerBtn.disabled = !clearGround || stack.length > 2 || getTreasury('player') < 300;
      towerBtn.onclick = () => { startBuildStructure(chosen, 'watchtower'); renderArmyModal(); };
      actions.appendChild(towerBtn);
      const trenchBtn = document.createElement('button'); trenchBtn.className = 'fort-build-btn'; trenchBtn.textContent = '🕳️ Выкопать ров (50 золота, 5 ходов)';
      const hasExit = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]].some(([dx,dy]) => isFree(armyModalX+dx, armyModalY+dy));
      trenchBtn.disabled = !clearGround || stack.length !== 1 || !hasExit || getTreasury('player') < 50;
      trenchBtn.onclick = () => { startBuildStructure(chosen, 'trench'); renderArmyModal(); };
      actions.appendChild(trenchBtn);
    }
    const workerSelected = chosen && chosen.type === 'worker' && !chosen.moved && !chosen.buildStructure && !(chosen.destroyStructureTurns > 0);
    if (workerSelected) {
      const nearby = buildings.filter(b => Math.abs(b.x-armyModalX)+Math.abs(b.y-armyModalY) <= 1);
      nearby.forEach(b => {
        const btn = document.createElement('button'); btn.className = 'destroy-btn';
        const cost = b.type === 'trench' ? 50 : 0;
        btn.textContent = chosen.destroyStructureTurns > 0 ? `⏳ Разрушение: ${chosen.destroyStructureTurns} ходов` : `🛠 Разрушать ${BUILDING_DEFS[b.type].name} (${b.type === 'trench' ? '5 ходов, 50 золота' : '1 ход'})`;
        btn.disabled = chosen.destroyStructureTurns > 0 || getTreasury('player') < cost;
        btn.onclick = () => { destroyBuilding(b, chosen); renderArmyModal(); };
        actions.appendChild(btn);
      });
    }
    const fortHere = hasFort(armyModalX, armyModalY);
    const onCamp = camps.some(c => c.x === armyModalX && c.y === armyModalY);
    const onCity = getCityAt(armyModalX, armyModalY);
    const anyBuilding = stack.some(u => u.buildFort > 0);
    const terr = map[armyModalY] && map[armyModalY][armyModalX];
    const badTerrain = terr === 'mountain' || terr === 'water' || terr === 'river' || terr === 'bridge';
    const canBuild = stack.length >= 2 && !fortHere && !onCamp && !onCity && !getBuildingAt(armyModalX, armyModalY) && !anyBuilding && !stack.some(u => u.buildStructure) && !badTerrain;
    if (canBuild) {
      const btn = document.createElement('button');
      btn.className = 'fort-build-btn';
      const ft = CIVS.player.researched.has('masonry') ? 7 : FORT_TURNS;
      btn.textContent = `🏰 Строить крепость (${ft} ходов, ${FORT_COST} з из казны)`;
      btn.disabled = getTreasury('player') < FORT_COST;
      btn.onclick = () => { startBuildFort(armyModalX, armyModalY); closeArmyModal(); };
      actions.appendChild(btn);
    }
    if (anyBuilding) {
      const div = document.createElement('div');
      div.style.cssText = 'padding:8px;background:#1f2937;border-radius:8px;font-size:.82rem;color:#a78bfa;text-align:center';
      const b = stack.find(u => u.buildFort > 0);
      div.textContent = `🏰 Строится крепость: осталось ${b.buildFort} ходов`;
      actions.appendChild(div);
    }
    if (fortHere) {
      const btn = document.createElement('button');
      btn.className = 'destroy-btn';
      btn.textContent = `🔥 Уничтожить крепость (+${FORT_DESTROY_GOLD} в казну)`;
      btn.onclick = () => { destroyFort(armyModalX, armyModalY, 'player'); closeArmyModal(); clearSelection(); };
      actions.appendChild(btn);
    }
  }
  if (actions.children.length === 0) actions.style.display = 'none'; else actions.style.display = 'flex';
}
function startProduction(cityId, unitType) {
  const city = cities.find(c => c.id === cityId);
  if (!city) return;
  const def = getUnitDef(unitType, 'player');
  if (getCityGold(city) < def.cost) { log(`Мало золота в городе (${getCityGold(city)}/${def.cost})`, 'combat'); return; }
  city.gold -= def.cost;
  city.production = unitType;
  city.progress = 0;
  city.needed = PROD_TURNS[unitType] || 1;
  log(`🏗 Производство: ${def.name} (${city.needed} х)`, 'info');
  renderCityPanel(); updateUI(); render();
}
function processProduction(civId) {
  cities.filter(c => c.owner === civId && c.production).forEach(city => {
    city.progress += 1;
    if (city.progress >= city.needed) {
      const stackOnCity = getStackAt(city.x, city.y, civId);
      let spawnPos = stackOnCity.length < MAX_STACK ? { x: city.x, y: city.y } : findSpawnTile(city.x, city.y, civId);
      if (spawnPos) {
        const produced = city.production;
        spawnUnit(produced, spawnPos.x, spawnPos.y, civId);
        if (civId === 'player') { const def = getUnitDef(produced, civId); log(`Произведён: ${def.name}`, 'good'); showEventModal(def.icon, 'Юнит готов!', `В городе «${city.name}»: ${def.name}`); }
      } else { city.gold = (city.gold || 0) + Math.floor(getUnitDef(city.production, civId).cost * 0.5); }
      city.production = null; city.progress = 0; city.needed = 0;
    }
  });
}
function findSpawnTile(cx, cy, owner) {
  for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1],[0,0]]) {
    const nx = cx + dx, ny = cy + dy;
    if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
    if (isBlockedTerrain(nx, ny)) continue;
    if (getEnemyStackAt(nx, ny, owner).length) continue;
    if (camps.some(c => c.x === nx && c.y === ny)) continue;
    if (getStackAt(nx, ny, owner).length < getTileUnitCapacity(nx, ny)) return { x: nx, y: ny };
  }
  return null;
}
function applyCityAutoHeal(civId) {
  const civ = CIVS[civId];
  const healTurns = civ.researched.has('medicine') ? 1 : 3;
  cities.filter(c => c.owner === civId).forEach(city => {
    const stack = getStackAt(city.x, city.y, civId);
    stack.forEach(u => {
      const maxHp = getUnitDef(u.type, u.owner).hp;
      if (u.hp < maxHp && u.buildFort === 0 && !u.buildStructure && u.healTurns === 0) { u.healTurns = healTurns; }
    });
  });
}
function startHeal(x, y, cost, turns) {
  if (!spendTreasury('player', cost)) return;
  getStackAt(x, y, 'player').forEach(u => { if (u.hp < getUnitDef(u.type, u.owner).hp && u.buildFort === 0) { u.healTurns = turns; u.moved = true; } });
  log(`❤ Лечение (${turns} х).`, 'good');
  clearSelection();
}
function processHealing(civId) {
  units.filter(u => u.owner === civId && u.healTurns > 0).forEach(u => {
    u.healTurns -= 1;
    if (u.healTurns <= 0) { u.hp = getUnitDef(u.type, u.owner).hp; u.healTurns = 0; if (civId === 'player') log(`${getUnitDef(u.type, u.owner).name} исцелён.`, 'good'); }
  });
}
function startBuildFort(x, y) {
  const stack = getStackAt(x, y, 'player');
  if (stack.length < 2) { log('Крепость строит только Армия (2+ юнитов).', 'fort'); showEventModal('🏰', 'Нужна Армия', 'Крепость может строить только Армия — отряд из 2 и более юнитов.'); return; }
  const terrain = map[y] && map[y][x];
  if (terrain === 'mountain' || terrain === 'water' || terrain === 'river' || terrain === 'bridge') {
    log('На этой местности нельзя строить крепость.', 'fort');
    showEventModal('⛰', 'Нельзя строить', 'Крепость нельзя возвести на горах, воде, реке или мосту.');
    return;
  }
  if (getCityAt(x, y) || camps.some(c => c.x === x && c.y === y) || getBuildingAt(x, y)) {
    log('Нельзя строить крепость на городе или стойбище.', 'fort');
    return;
  }
  const tre = getTreasury('player');
  if (tre < FORT_COST) { log(`Не хватает золота в казне (${tre}/${FORT_COST}).`, 'gold'); showEventModal('💰', 'Не хватает золота', `Нужно ${FORT_COST} золота в казне столицы.\n\nУ вас: ${tre}`); return; }
  const builders = stack.filter(u => !u.moved && u.healTurns === 0 && u.buildFort === 0 && !u.buildStructure && !(u.destroyStructureTurns > 0));
  if (!builders.length) { log('Все юниты уже ходили.', 'fort'); return; }
  spendTreasury('player', FORT_COST);
  const fortTurns = (CIVS.player.researched.has('masonry')) ? 7 : FORT_TURNS;
  builders[0].buildFort = fortTurns;
  builders[0].moved = true;
  log(`🏰 Строительство крепости начато (${fortTurns} ходов, −${FORT_COST})`, 'fort');
  showEventModal('🏰', 'Строительство начато', `Армия строит крепость.\n\nОсталось: ${fortTurns} ходов.\nСписано ${FORT_COST} золота из казны столицы.`);
  clearSelection();
}
function processForts(civId) {
  units.filter(u => u.owner === civId && u.buildFort > 0).forEach(u => {
    u.buildFort -= 1;
    if (u.buildFort <= 0) {
      u.buildFort = 0;
      const t = map[u.y] && map[u.y][u.x];
      const blocked = !t || t === 'mountain' || t === 'water' || t === 'river' || t === 'bridge' || getCityAt(u.x, u.y) || camps.some(c => c.x === u.x && c.y === u.y) || getBuildingAt(u.x, u.y);
      if (!hasFort(u.x, u.y) && !blocked) {
        forts.push({ x: u.x, y: u.y, owner: civId });
        if (civId === 'player') log(`🏰 Крепость готова!`, 'fort');
      } else if (civId === 'player' && blocked) {
        log('🏰 Строительство сорвалось: неподходящая местность.', 'fort');
        addToTreasury(civId, Math.floor(FORT_COST * 0.5));
      }
    }
  });
}
function startBuildStructure(worker, type) {
  const def = BUILDING_DEFS[type];
  if (!worker || worker.type !== 'worker' || worker.owner !== 'player' || currentCiv !== 'player' || !def) return false;
  const x = worker.x, y = worker.y, stack = getStackAt(x, y, worker.owner);
  const terrain = map[y]?.[x];
  if (worker.moved || worker.buildStructure || worker.buildFort > 0 || worker.healTurns > 0) return false;
  if (getCityAt(x,y) || camps.some(c=>c.x===x&&c.y===y) || getFort(x,y) || getBuildingAt(x,y) || ['mountain','water','river','bridge'].includes(terrain)) {
    log('На этой клетке нельзя строить.', 'fort'); return false;
  }
  if (type === 'watchtower' && stack.length > 2) { log('Башня вмещает не более двух юнитов.', 'fort'); return false; }
  if (type === 'trench') {
    const hasExit = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]].some(([dx,dy]) => isFree(x+dx,y+dy));
    if (stack.length !== 1 || !hasExit) { log('Для рва рабочий должен стоять один и иметь свободную соседнюю клетку для выхода.', 'fort'); return false; }
  }
  if (!spendTreasury(worker.owner, def.cost)) { log(`Не хватает золота: нужно ${def.cost}.`, 'gold'); return false; }
  worker.buildStructure = type; worker.buildStructureTurns = def.turns; worker.moved = true;
  log(`🛠 Начато строительство: ${def.name} (${def.turns} ходов, −${def.cost} золота).`, 'fort');
  showEventModal(def.icon, 'Строительство начато', `${def.name}\n\nОсталось ходов: ${def.turns}\nСтоимость: ${def.cost} золота.`);
  render(); updateUI(); return true;
}
function processStructures(civId) {
  units.filter(u => u.owner === civId && u.buildStructure && u.buildStructureTurns > 0).slice().forEach(worker => {
    worker.buildStructureTurns -= 1;
    if (worker.buildStructureTurns > 0) return;
    const type = worker.buildStructure, def = BUILDING_DEFS[type];
    const x = worker.x, y = worker.y;
    const valid = !getBuildingAt(x,y) && !getCityAt(x,y) && !camps.some(c=>c.x===x&&c.y===y) && !getFort(x,y);
    if (!valid) {
      addToTreasury(civId, Math.floor(def.cost/2));
      log(`Строительство ${def.name} сорвалось: клетка занята. Возвращено ${Math.floor(def.cost/2)} золота.`, 'fort');
    } else {
      buildings.push({ id: nextBuildingId++, type, x, y, owner: civId });
      if (type === 'trench') {
        const exit = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]].map(([dx,dy])=>({x:x+dx,y:y+dy})).find(pos=>isFree(pos.x,pos.y));
        if (exit) { worker.x = exit.x; worker.y = exit.y; worker.moved = true; }
        else {
          buildings = buildings.filter(b => !(b.x===x && b.y===y && b.type==='trench'));
          addToTreasury(civId, Math.floor(def.cost/2));
          log('Ров не завершён: рабочему некуда выйти. Возвращена половина стоимости.', 'fort');
        }
      }
      if (civId === 'player') log(`${def.icon} ${def.name} построена!`, 'good');
    }
    worker.buildStructure = null; worker.buildStructureTurns = 0; worker.moved = true;
  });
  render(); updateUI();
}
function destroyBuilding(building, worker) {
  if (!building || !worker || worker.type !== 'worker' || worker.owner !== 'player' || currentCiv !== 'player' || worker.moved || worker.buildStructure) return false;
  if (Math.abs(building.x-worker.x)+Math.abs(building.y-worker.y) > 1) return false;
  const cost = building.type === 'trench' ? 50 : 0;
  if (worker.destroyStructureTurns > 0) return false;
  if (cost && !spendTreasury('player', cost)) { log('Для разрушения рва нужно 50 золота в казне.', 'gold'); return false; }
  worker.destroyStructureId = building.id; worker.destroyStructureTurns = building.type === 'trench' ? 5 : 1; worker.moved = true;
  log(`🛠 Начато разрушение ${BUILDING_DEFS[building.type].name}: ${worker.destroyStructureTurns} ходов.`, 'good');
  render(); updateUI();
  return true;
}
function processDemolitions(civId) {
  units.filter(u => u.owner === civId && u.destroyStructureTurns > 0).forEach(worker => {
    worker.destroyStructureTurns--;
    if (worker.destroyStructureTurns > 0) return;
    const target = buildings.find(b => b.id === worker.destroyStructureId);
    if (target) {
      buildings = buildings.filter(b => b.id !== target.id);
      log(`🛠 ${BUILDING_DEFS[target.type].name} разрушена.`, 'good');
    }
    worker.destroyStructureId = null; worker.destroyStructureTurns = 0;
  });
}
function aiWorkerActions(civId) {
  units.filter(u => u.owner === civId && u.type === 'worker' && !u.moved && !u.buildStructure).forEach(worker => {
    const target = buildings.find(b => b.owner !== civId && Math.abs(b.x-worker.x)+Math.abs(b.y-worker.y) <= 1);
    if (!target) return;
    const cost = target.type === 'trench' ? 50 : 0;
    if (cost && getTreasury(civId) < cost) return;
    if (cost) spendTreasury(civId, cost);
    buildings = buildings.filter(b => b.id !== target.id);
    worker.moved = true;
  });
}
function extractUnitFromStack(unitId, allowLast = false) {
  const unit = units.find(u => u.id === unitId);
  if (!unit || unit.owner !== 'player' || currentCiv !== 'player') return false;
  const source = getStackAt(unit.x, unit.y, 'player');
  if (!allowLast && source.length <= 1) { log('В армии должен остаться хотя бы один юнит.', 'info'); return false; }
  for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
    const nx = unit.x + dx, ny = unit.y + dy;
    if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
    if (isBlockedTerrain(nx, ny)) continue;
    if (getEnemyStackAt(nx, ny, 'player').length) continue;
    if (getStackAt(nx, ny, 'player').length >= getTileUnitCapacity(nx, ny)) continue;
    unit.x = nx; unit.y = ny; unit.moved = true;
    log(`Выведен ${getUnitDef(unit.type, unit.owner).name}.`, 'army');
    render(); updateUI();
    return true;
  }
  log('Нет свободной клетки рядом.', 'combat');
  return false;
}
function splitUnit(unitId) { return extractUnitFromStack(unitId, false); }
function cityTooClose(x, y, minDist = 3) { return cities.some(c => Math.abs(c.x - x) + Math.abs(c.y - y) < minDist); }
function foundCity(settler) {
  const x = settler.x, y = settler.y;
  if (cities.some(c => c.x === x && c.y === y) || camps.some(c => c.x === x && c.y === y) || getBuildingAt(x, y)) return;
  if (map[y][x] === 'water' || map[y][x] === 'mountain' || map[y][x] === 'river' || map[y][x] === 'bridge') return;
  if (cityTooClose(x, y, 3)) { log('Слишком близко.', 'combat'); showEventModal('🚫','Нельзя основать город','Минимум 3 клетки от другого города.'); return; }
  const defaultNames = ['Новый Форт','Застава','Оплот','Твердыня','Страж','Бастион'];
  const defName = defaultNames[Math.floor(Math.random()*defaultNames.length)];
  const settlerId = settler.id;
  units = units.filter(u => u.id !== settlerId);
  clearSelection();
  showEventModal('🏛', 'Основание города', 'Название нового города:', { input: true, placeholder: 'Название', defaultValue: defName, onConfirm: (val) => {
    const name = (val && val.trim()) ? val.trim().slice(0, 24) : defName;
    cities.push({ id: nextCityId++, x, y, owner: 'player', name, gold: 0, isCapital: false, production: null, progress: 0, needed: 0 });
    log(`🏛 Город «${name}» основан!`, 'good');
    updateUI(); render(); checkVictory();
  }});
}
const logFilters = new Set(['all','combat','good','info','army','tech','capture','barb','fort','gold']);
function setLogFilter(filter) {
  if (filter === 'all') { logFilters.clear(); ['all','combat','good','info','army','tech','capture','barb','fort','gold'].forEach(f => logFilters.add(f)); }
  else {
    logFilters.delete('all');
    if (logFilters.has(filter)) { logFilters.delete(filter); if (logFilters.size === 0) ['all','combat','good','info','army','tech','capture','barb','fort','gold'].forEach(f => logFilters.add(f)); }
    else logFilters.add(filter);
    const types = ['combat','good','info','army','tech','capture','barb','fort','gold'];
    if (types.every(t => logFilters.has(t))) logFilters.add('all');
  }
  document.querySelectorAll('.log-filter-btn').forEach(btn => btn.classList.toggle('active', logFilters.has(btn.dataset.filter)));
  applyLogFilter();
}
function applyLogFilter() {
  const el = document.getElementById('log');
  if (!el) return;
  const showAll = logFilters.has('all');
  el.querySelectorAll('div').forEach(div => {
    const type = div.dataset.logType || '';
    if (showAll) div.classList.remove('log-hidden');
    else if (!type) div.classList.toggle('log-hidden', !logFilters.has('info'));
    else div.classList.toggle('log-hidden', !logFilters.has(type));
  });
}
function log(msg, type = '') {
  const el = document.getElementById('log');
  if (!el) return;
  const div = document.createElement('div');
  const t = type || 'info';
  div.className = t; div.dataset.logType = t; div.textContent = msg;
  if (!logFilters.has('all') && !logFilters.has(t)) div.classList.add('log-hidden');
  el.prepend(div);
  while (el.children.length > 200) el.removeChild(el.lastChild);
}
function startResearch(techId) { if (!canResearch(techId, 'player')) return; CIVS.player.currentResearch = techId; CIVS.player.researchProgress = 0; log(`Начато: ${TECHS[techId].name}`, 'tech'); updateUI(); }
function getSciencePerTurn(civId) {
  if (civId === 'barb' || !CIVS[civId]) return 0;
  let sci = cities.filter(c => c.owner === civId).length * 5;
  if (CIVS[civId].researched.has('engineering')) sci += cities.filter(c => c.owner === civId).length * 3;
  return sci;
}
function canResearch(techId, civId) { if (civId === 'barb') return false; const tech = TECHS[techId]; if (CIVS[civId].researched.has(techId)) return false; return tech.requires.every(r => CIVS[civId].researched.has(r)); }
function progressResearch(civId) {
  if (civId === 'barb' || !CIVS[civId]) return;
  const civ = CIVS[civId];
  if (!civ.currentResearch) {
    if (civId !== 'player') { const available = Object.keys(TECHS).filter(t => canResearch(t, civId)); if (available.length) { civ.currentResearch = available[Math.floor(Math.random()*available.length)]; civ.researchProgress = 0; } }
    return;
  }
  const tech = TECHS[civ.currentResearch];
  const sci = getSciencePerTurn(civId);
  civ.science += sci; civ.researchProgress += sci;
  if (civ.researchProgress >= tech.cost) {
    civ.researched.add(tech.id);
    log(`${CIVS[civId].name}: ${tech.name}!`, 'tech');
    if (civId === 'player') showEventModal('🔬', 'Исследование завершено!', `${tech.name}\n\n${tech.desc}`, { newTech: true, onConfirm: () => { openTechModal(); } });
    civ.currentResearch = null; civ.researchProgress = 0;
  }
}
async function playPendingCombats() {
  if (!pendingCombats.length) return;
  const queue = pendingCombats.slice(); pendingCombats = [];
  for (const c of queue) {
    await playCombatAnim(c.atk, c.def, c.dmgToDef, c.dmgToAtk, c.label);
    if (c.def.some(u => u.owner === 'player') || c.atk.some(u => u.owner === 'player')) {
      showEventModal('⚔', 'Итоги боя', `${c.label}\n\nНанесён урон: ${c.dmgToDef}. Получен урон: ${c.dmgToAtk}.`);
    }
  }
  updateUI(); render();
}
async function endTurn() {
  if (currentCiv !== 'player' || combatBusy || eventModalOpen) return;
  applyCityAutoHeal('player');
  processProduction('player'); processHealing('player'); processForts('player'); processStructures('player'); processDemolitions('player'); progressResearch('player');
  cities.filter(c => c.owner === 'player').forEach(c => { c.gold = (c.gold || 0) + cityIncome(c); });
  pendingCombats = [];
  for (let i = 1; i <= opponentCount; i++) {
    const aiId = 'ai' + i;
    if (!CIVS[aiId]) continue;
    if (cities.filter(c => c.owner === aiId).length === 0) continue;
    currentCiv = aiId;
    showTurnBanner(CIVS[aiId].name);
    await delay(220);
    aiTurn(aiId);
    await playPendingCombats();
  }
  if (!noBarbs) { currentCiv = 'barb'; showTurnBanner('Варвары'); await delay(300); barbTurn(); await playPendingCombats(); }
  turn++;
  currentCiv = 'player';
  units.forEach(u => { if (u.healTurns === 0 && u.buildFort === 0 && !u.buildStructure && !(u.destroyStructureTurns > 0)) u.moved = false; });
  if (!noBarbs) {
    camps.forEach(camp => {
      if (Math.random() < barbSpawnChance() && getStackAt(camp.x, camp.y, 'barb').length < 2) {
        for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { if (isFree(camp.x+dx, camp.y+dy)) { spawnUnit('barbarian', camp.x+dx, camp.y+dy, 'barb'); break; } }
      }
    });
    spawnRandomBarbCamps();
  }
  log(`——— Ход ${turn} ———`, 'info');
  showTurnBanner('Твой ход!');
  clearSelection(); checkVictory();
}
function spawnRandomBarbCamps() {
  if (noBarbs) return;
  const tries = mapSize === 'large' ? 12 : mapSize === 'medium' ? 8 : 5;
  let placed = 0; const maxPlace = barbDiff === 'hard' ? 2 : 1;
  for (let t = 0; t < tries && placed < maxPlace; t++) {
    const cx = 2 + Math.floor(Math.random()*(COLS-4));
    const cy = 2 + Math.floor(Math.random()*(ROWS-4));
    if (map[cy][cx] === 'water' || map[cy][cx] === 'mountain' || map[cy][cx] === 'river' || map[cy][cx] === 'bridge') continue;
    if (cities.some(c => c.x===cx && c.y===cy) || camps.some(c => c.x===cx && c.y===cy) || getBuildingAt(cx,cy)) continue;
    if (hasFort(cx, cy)) continue;
    const blocked = units.some(u => u.owner !== 'barb' && Math.max(Math.abs(u.x-cx), Math.abs(u.y-cy)) <= 4);
    if (blocked) continue;
    if (camps.some(c => Math.abs(c.x-cx) + Math.abs(c.y-cy) < 4)) continue;
    camps.push({ id: nextCampId++, x: cx, y: cy });
    spawnUnit('barbarian', cx, cy, 'barb');
    if (barbDiff !== 'easy' && isFree(cx + 1, cy)) spawnUnit('barbarian', cx + 1, cy, 'barb');
    placed++;
    log(`⛺ Новое стойбище варваров!`, 'barb');
  }
}
function aiTurn(civId) {
  applyCityAutoHeal(civId);
  processProduction(civId); processHealing(civId); processForts(civId); processStructures(civId); processDemolitions(civId); progressResearch(civId);
  cities.filter(c => c.owner === civId).forEach(c => { c.gold = (c.gold || 0) + cityIncome(c); });
  aiWorkerActions(civId);
  const aggro = aiAggro();
  const positions = {};
  units.filter(u => u.owner === civId).forEach(u => { const key = u.x + ',' + u.y; if (!positions[key]) positions[key] = []; positions[key].push(u); });
  Object.values(positions).forEach(stack => {
    const canMove = stack.filter(u => !u.moved && u.healTurns === 0 && u.buildFort === 0 && !u.buildStructure && !(u.destroyStructureTurns > 0));
    if (!canMove.length) return;
    const attackers = canMove.filter(u => getUnitDef(u.type, u.owner).canAttack);
    let acted = false;
    if (attackers.length && Math.random() < aggro + 0.3) {
      for (let dy = -1; dy <= 1 && !acted; dy++) {
        for (let dx = -1; dx <= 1 && !acted; dx++) {
          if (!dx && !dy) continue;
          const nx = stack[0].x + dx, ny = stack[0].y + dy;
          if (!isTileVisibleToCiv(civId, nx, ny)) continue;
          const enemies = getEnemyStackAt(nx, ny, civId);
          if (enemies.length) {
            const hasCourier = enemies.some(e => getUnitDef(e.type, e.owner).isCourier);
            const shouldAttack = hasCourier || Math.random() < aggro + 0.2;
            if (!shouldAttack) continue;
            const dmgToDef = Math.max(16, Math.floor(stackStrength(attackers) * 2.4 + Math.random() * 18));
            const dmgToAtk = Math.max(7, Math.floor(stackStrength(enemies, true) * 1.4 + Math.random() * 10));
            if (enemies.some(e => e.owner === 'player') || attackers[0].owner === 'player') {
              pendingCombats.push({ atk: attackers.map(u => ({ ...u })), def: enemies.map(u => ({ ...u })), dmgToDef, dmgToAtk, label: `${CIVS[attackers[0].owner]?.name || attackers[0].owner} vs ${CIVS[enemies[0].owner]?.name || enemies[0].owner}` });
            }
            const lootGold = enemies.filter(u => getUnitDef(u.type,u.owner).isCourier).reduce((s,u)=>s+(u.carryGold||0),0);
            if (lootGold > 0) addToTreasury(civId, lootGold);
            applyDamageNoCaptureBarb(enemies, dmgToDef, civId);
            applyDamage(attackers, dmgToAtk);
            attackers.forEach(u => u.moved = true);
            units = units.filter(u => u.hp > 0);
            if (!getEnemyStackAt(nx, ny, civId).length) {
              attackers.filter(u => u.hp > 0).slice(0, getTileUnitCapacity(nx, ny) - getStackAt(nx, ny, civId).length).forEach(u => { u.x = nx; u.y = ny; });
              if (hasFort(nx, ny)) destroyFort(nx, ny, civId);
              tryCaptureFort(nx, ny, civId);
            }
            acted = true;
          }
          const city = isTileVisibleToCiv(civId, nx, ny) ? cities.find(c => c.x === nx && c.y === ny && c.owner !== civId) : null;
          if (city && !acted && Math.random() < aggro) {
            const loot = city.gold || 0;
            city.owner = civId; city.gold = 0; city.isCapital = false;
            addToTreasury(civId, loot);
            attackers.forEach(u => { u.moved = true; u.x = city.x; u.y = city.y; });
            acted = true;
          }
          const camp = camps.find(c => c.x === nx && c.y === ny);
          if (camp && !acted) {
            const bh = units.filter(u => u.x===camp.x && u.y===camp.y && u.owner==='barb');
            addToTreasury(civId, 5*bh.length + 10 + Math.floor(Math.random()*41));
            units = units.filter(u => !(u.x===camp.x && u.y===camp.y && u.owner==='barb'));
            camps = camps.filter(c => c.id !== camp.id);
            attackers.forEach(u => { u.moved = true; u.x = camp.x; u.y = camp.y; });
            acted = true;
          }
        }
      }
    }
    if (!acted && canMove.length) {
      let targets = cities.filter(c => c.owner !== civId && isTileVisibleToCiv(civId, c.x, c.y));
      if (!targets.length) { const bu = units.filter(u => u.owner !== civId && isTileVisibleToCiv(civId, u.x, u.y)); if (bu.length) targets = bu.map(b => ({x:b.x,y:b.y})); }
      if (!targets.length) return;
      targets.sort((a,b) => (Math.abs(a.x-stack[0].x)+Math.abs(a.y-stack[0].y)) - (Math.abs(b.x-stack[0].x)+Math.abs(b.y-stack[0].y)));
      const target = targets[0];
      const moveRange = Math.min(...canMove.map(u => getUnitDef(u.type, u.owner).move));
      let best = null, bestDist = 999;
      for (let dy = -moveRange; dy <= moveRange; dy++) {
        for (let dx = -moveRange; dx <= moveRange; dx++) {
          if (!dx && !dy || Math.abs(dx)+Math.abs(dy) > moveRange) continue;
          const nx = stack[0].x + dx, ny = stack[0].y + dy;
          if (nx<0||ny<0||nx>=COLS||ny>=ROWS) continue;
          if (isBlockedTerrain(nx,ny)) continue;
          if (getEnemyStackAt(nx,ny,civId).length) continue;
          if (getStackAt(nx,ny,civId).length + canMove.length > getTileUnitCapacity(nx,ny)) continue;
          const dist = Math.abs(target.x-nx) + Math.abs(target.y-ny);
          if (dist < bestDist) { bestDist = dist; best = { x: nx, y: ny }; }
        }
      }
      if (best) { canMove.forEach(u => { u.x = best.x; u.y = best.y; u.moved = true; }); if (hasFort(best.x, best.y)) destroyFort(best.x, best.y, civId); tryCaptureFort(best.x, best.y, civId); }
    }
  });
  const pc = aiProdChance();
  cities.filter(c => c.owner === civId && !c.production).forEach(city => {
    const cg = getCityGold(city);
    if (cg >= 40 && Math.random() < pc) { city.gold -= 40; city.production = 'cavalry'; city.progress = 0; city.needed = PROD_TURNS.cavalry; }
    else if (cg >= 28 && Math.random() < pc + 0.12) { city.gold -= 28; city.production = 'archer'; city.progress = 0; city.needed = PROD_TURNS.archer; }
    else if (cg >= 20 && Math.random() < pc + 0.2) { city.gold -= 20; city.production = 'infantry'; city.progress = 0; city.needed = PROD_TURNS.infantry; }
    else if (cg >= 12 && Math.random() < 0.28) { city.gold -= 12; city.production = 'militia'; city.progress = 0; city.needed = PROD_TURNS.militia; }
  });
  updateUI(); render();
}
function barbTurn() {
  const mult = barbDmgMult();
  const positions = {};
  units.filter(u => u.owner === 'barb').forEach(u => { const key = u.x + ',' + u.y; if (!positions[key]) positions[key] = []; positions[key].push(u); });
  Object.values(positions).forEach(stack => {
    const canMove = stack.filter(u => !u.moved);
    if (!canMove.length) return;
    let acted = false;
    for (let dy = -1; dy <= 1 && !acted; dy++) {
      for (let dx = -1; dx <= 1 && !acted; dx++) {
        if (!dx && !dy) continue;
        const nx = stack[0].x + dx, ny = stack[0].y + dy;
        if (!isTileVisibleToCiv('barb', nx, ny)) continue;
        const enemies = getEnemyStackAt(nx, ny, 'barb');
        if (enemies.length) {
          const hasCourier = enemies.some(e => getUnitDef(e.type,e.owner).isCourier);
          let dmg = Math.max(10, Math.floor(stackStrength(canMove) * 2.2 * mult + Math.random() * 15));
          if (hasCourier) dmg = Math.max(dmg, 25);
          if (enemies.some(e => e.type === 'settler')) dmg = Math.max(dmg, 70);
          const dmgToAtk = Math.max(5, Math.floor(stackStrength(enemies, true) * 1.2 + Math.random() * 8));
          if (enemies.some(e => e.owner === 'player')) { pendingCombats.push({ atk: canMove.map(u => ({...u})), def: enemies.map(u => ({...u})), dmgToDef: dmg, dmgToAtk, label: `Варвары vs ${CIVS[enemies[0].owner]?.name || enemies[0].owner}` }); }
          applyDamage(enemies, dmg);
          applyDamage(canMove, dmgToAtk);
          canMove.forEach(u => u.moved = true);
          units = units.filter(u => u.hp > 0);
          if (!getEnemyStackAt(nx, ny, 'barb').length) {
            canMove.filter(u => u.hp > 0).slice(0, getTileUnitCapacity(nx,ny)).forEach(u => { u.x = nx; u.y = ny; });
            if (hasFort(nx, ny)) destroyFort(nx, ny, 'barb');
            tryCaptureFort(nx, ny, 'barb');
          }
          log(`🪓 Варвары напали!`, 'barb');
          acted = true;
        }
        const city = cities.find(c => c.x===nx && c.y===ny);
        if (city && !acted && Math.random() < barbSackChance()) {
          if (!getStackAt(city.x, city.y).length) {
            const stolen = Math.min(city.gold || 0, 30 + Math.floor(Math.random()*40));
            city.gold = Math.max(0, (city.gold||0) - stolen);
            const cName = city.name;
            cities = cities.filter(c => c.id !== city.id);
            canMove.forEach(u => { u.moved = true; u.x = nx; u.y = ny; });
            log(`🔥 Варвары уничтожили «${cName}»! −${stolen}`, 'barb');
            acted = true;
          }
        }
      }
    }
    if (!acted) {
      const prey = [...units.filter(u => u.owner !== 'barb' && isTileVisibleToCiv('barb',u.x,u.y)), ...cities.filter(c=>isTileVisibleToCiv('barb',c.x,c.y)).map(c => ({x:c.x,y:c.y}))];
      if (!prey.length) return;
      prey.sort((a,b) => (Math.abs(a.x-stack[0].x)+Math.abs(a.y-stack[0].y)) - (Math.abs(b.x-stack[0].x)+Math.abs(b.y-stack[0].y)));
      const target = prey[0];
      let best = null, bestDist = 999;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (!dx && !dy || Math.abs(dx)+Math.abs(dy) > 2) continue;
          const nx = stack[0].x + dx, ny = stack[0].y + dy;
          if (nx<0||ny<0||nx>=COLS||ny>=ROWS) continue;
          if (isBlockedTerrain(nx,ny)) continue;
          if (getEnemyStackAt(nx,ny,'barb').length) continue;
          if (getStackAt(nx,ny,'barb').length + canMove.length > getTileUnitCapacity(nx,ny)) continue;
          const dist = Math.abs(target.x-nx) + Math.abs(target.y-ny);
          if (dist < bestDist) { bestDist = dist; best = { x: nx, y: ny }; }
        }
      }
      if (best) { canMove.forEach(u => { u.x = best.x; u.y = best.y; u.moved = true; }); if (hasFort(best.x, best.y)) destroyFort(best.x, best.y, 'barb'); tryCaptureFort(best.x, best.y, 'barb'); }
    }
  });
  updateUI(); render(); checkVictory();
}
function serializeCiv(c) { return { id:c.id, name:c.name, color:c.color, treasury:c.treasury, science:c.science, researched:[...c.researched], currentResearch:c.currentResearch, researchProgress:c.researchProgress }; }
function deserializeCiv(data, target) { target.treasury = data.treasury || 0; target.science = data.science; target.color = data.color || target.color; target.researched = new Set(data.researched || []); target.currentResearch = data.currentResearch; target.researchProgress = data.researchProgress || 0; }
function saveGame() {
  try {
    const civsSerialized = {};
    for (const [k, v] of Object.entries(CIVS)) civsSerialized[k] = serializeCiv(v);
    const data = { version: 12, turn, currentCiv, aiDiff, barbDiff, mapSize, noBarbs, opponentCount, COLS, ROWS, TILE_PX, nextUnitId, nextCityId, nextCampId, nextBuildingId, map, units, cities, camps, forts, buildings, civs: civsSerialized };
    localStorage.setItem('war_civ_save', JSON.stringify(data));
    log('Игра сохранена.', 'good');
    showEventModal('💾', 'Сохранено', 'Прогресс записан.');
  } catch (e) { log('Ошибка сохранения: ' + e.message, 'combat'); showEventModal('⚠️', 'Ошибка', String(e.message || e)); }
}
function loadGame() {
  try {
    const raw = localStorage.getItem('war_civ_save');
    if (!raw) { showEventModal('📂', 'Нет сохранения', 'Сохранённая игра не найдена.'); return; }
    const data = JSON.parse(raw);
    turn = data.turn; currentCiv = 'player';
    aiDiff = data.aiDiff || 'normal'; barbDiff = data.barbDiff || 'normal';
    mapSize = data.mapSize || 'small'; noBarbs = !!data.noBarbs;
    // Support old saves (playerCount) and new (opponentCount)
    if (data.opponentCount != null) opponentCount = data.opponentCount;
    else if (data.playerCount != null) opponentCount = Math.max(3, (data.playerCount || 4) - 1);
    else opponentCount = 3;
    COLS = data.COLS || 24; ROWS = data.ROWS || 16; TILE_PX = data.TILE_PX || 48;
    nextUnitId = data.nextUnitId || 1; nextCityId = data.nextCityId || 1; nextCampId = data.nextCampId || 1;
    map = data.map; units = data.units || []; cities = data.cities || []; camps = data.camps || []; forts = data.forts || []; buildings = data.buildings || []; nextBuildingId = data.nextBuildingId || (buildings.reduce((m,b)=>Math.max(m,b.id||0),0)+1);
    units.forEach(u => { if (u.healTurns == null) u.healTurns = 0; if (u.buildFort == null) u.buildFort = 0; if (u.buildStructure == null) u.buildStructure = null; if (u.buildStructureTurns == null) u.buildStructureTurns = 0; if (u.destroyStructureTurns == null) u.destroyStructureTurns = 0; if (u.destroyStructureId == null) u.destroyStructureId = null; if (u.moved == null) u.moved = false; if (u.carryGold == null) u.carryGold = 0; if (u.retreated == null) u.retreated = false; });
    cities.forEach(c => { if (c.gold == null) c.gold = 0; if (c.isCapital == null) c.isCapital = false; });
    CIVS = {};
    if (data.civs) {
      for (const [k, v] of Object.entries(data.civs)) {
        CIVS[k] = { id:k, name:v.name, color:v.color || getCivColor(0), treasury:v.treasury||0, science:v.science||0, researched:new Set(), currentResearch:null, researchProgress:0 };
        deserializeCiv(v, CIVS[k]);
      }
    } else { initCivs(); }
    // Ensure opponentCount matches loaded AIs
    const loadedAis = Object.keys(CIVS).filter(k => k.startsWith('ai')).length;
    if (loadedAis > 0) opponentCount = loadedAis;
    ['player'].concat(Object.keys(CIVS).filter(k => k.startsWith('ai'))).forEach(civ => {
      if (cities.some(c => c.owner === civ) && !cities.some(c => c.owner === civ && c.isCapital)) {
        const first = cities.find(c => c.owner === civ);
        if (first) first.isCapital = true;
      }
      // Migrate old treasury into capital if capital has no gold
      const cap = cities.find(c => c.owner === civ && c.isCapital);
      if (cap && (cap.gold || 0) === 0 && (CIVS[civ].treasury || 0) > 0) {
        cap.gold = CIVS[civ].treasury;
        CIVS[civ].treasury = 0;
      }
    });
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('game-header').style.display = 'block';
    document.getElementById('game-container').style.display = 'flex';
    applyMapSizeFixed();
    selected = null; movableTiles = []; attackableTiles = []; mergeableTiles = [];
    const labels = { easy:'легко', normal:'средне', hard:'сложно' };
    const sizeLabels = { small:'мал.', medium:'сред.', large:'бол.' };
    document.getElementById('diff-label').textContent = `Соперников: ${opponentCount} (всего ${opponentCount+1}) / ИИ: ${labels[aiDiff]||aiDiff} / Варвары: ${noBarbs?'нет':(labels[barbDiff]||barbDiff)} / Карта: ${sizeLabels[mapSize]||mapSize}`;
    document.getElementById('log').innerHTML = '';
    log('Игра загружена.', 'good');
    log(`Ход ${turn}, карта ${COLS}×${ROWS}, соперников: ${opponentCount}`, 'info');
    updateUI(); render();
    initPinchZoom();
    initCanvasHandlers();
    startMapAnimation();
    setTimeout(() => centerOnPlayerCapital(), 50);
    showEventModal('📂', 'Игра загружена', `Продолжение с хода ${turn}.`);
  } catch (e) { log('Ошибка загрузки: ' + e.message, 'combat'); showEventModal('⚠️', 'Ошибка', String(e.message || e)); }
}
function updateUI() {
  document.getElementById('turn-num').textContent = turn;
  const el = document.getElementById('current-civ');
  el.textContent = CIVS[currentCiv]?.name || currentCiv;
  el.className = 'civ-' + (currentCiv === 'player' ? 'player' : currentCiv === 'barb' ? 'barb' : 'ai');
  document.getElementById('player-treasury').textContent = getTreasury('player');
  const totalCityGold = cities.filter(c=>c.owner==='player').reduce((s,c)=>s+getCityGold(c),0);
  document.getElementById('player-city-gold').textContent = totalCityGold;
  const income = cities.filter(c => c.owner === 'player').reduce((s, c) => s + cityIncome(c), 0);
  document.getElementById('player-city-income').textContent = `(+${income}/ход)`;
  document.getElementById('player-science').textContent = CIVS.player?.science || 0;
  document.getElementById('science-per-turn').textContent = `(+${getSciencePerTurn('player')})`;
  const resEl = document.getElementById('player-research');
  if (resEl) {
    if (CIVS.player?.currentResearch && TECHS[CIVS.player.currentResearch]) {
      const t = TECHS[CIVS.player.currentResearch];
      resEl.textContent = `${t.name} (${CIVS.player.researchProgress}/${t.cost})`;
      resEl.style.color = 'var(--tech)';
    } else {
      resEl.textContent = 'нет';
      resEl.style.color = 'var(--muted)';
    }
  }
  document.getElementById('player-cities').textContent = cities.filter(c => c.owner === 'player').length;
  document.getElementById('player-units').textContent = units.filter(u => u.owner === 'player').length;
  const info = document.getElementById('selected-info');
  const actions = document.getElementById('actions');
  const hint = document.getElementById('hint-text');
  actions.innerHTML = ''; actions.style.display = 'none'; hint.textContent = '';
  if (!selected) { info.innerHTML = 'ЛКМ — выбор • ПКМ — инфо клетки'; return; }
  if (selected.type === 'stack') {
    const stack = getStackAt(selected.x, selected.y);
    if (!stack.length) { clearSelection(); return; }
    const owner = stack[0].owner;
    const fortHere = hasFort(selected.x, selected.y);
    const cityHere = getCityAt(selected.x, selected.y);
    let html = `<div style="margin-bottom:3px"><strong>${stack.length > 1 ? '🟣 Армия ('+stack.length+')' : 'Юнит'}</strong> — <span class="civ-${getCivClass(owner)}">${CIVS[owner]?.name || owner}</span>${fortHere ? ' 🏰' : ''}</div>`;
    stack.forEach(u => {
      const def = getUnitDef(u.type, u.owner);
      const goldTxt = (def.isCourier && u.carryGold > 0) ? ` 💰${u.carryGold}` : '';
      html += `<div class="unit-card ${getCivClass(owner)}">${def.icon} <strong>${def.name}</strong>${def.isCourier ? ' <span style="color:#22d3ee">(курьер)</span>' : ''}${goldTxt}<br>Атака: ${def.strength} • Защита: ${def.defense} • ОЗ: ${u.hp}/${def.hp} • Ход: ${def.move}${u.moved ? ' ✓' : ''}</div>`;
    });
    info.innerHTML = html;
    if (owner === 'player' && currentCiv === 'player') {
      actions.style.display = 'flex';
      if (stack.length >= 2) {
        const btn = document.createElement('button'); btn.className = 'gold-btn'; btn.textContent = '🟣 Открыть окно Армии';
        btn.onclick = () => openArmyModal(selected.x, selected.y); actions.appendChild(btn);
      }
      if (cityHere && cityHere.owner === 'player') {
        const btn = document.createElement('button'); btn.className = 'gold-btn'; btn.textContent = `🏛 Перейти в город «${cityHere.name}»`;
        btn.onclick = () => openCityPanel(cityHere.id); actions.appendChild(btn);
      }
      const courier = stack.find(u => getUnitDef(u.type, u.owner).isCourier);
      if (courier && cityHere && cityHere.owner === 'player') {
        if (getCityGold(cityHere) > 0) {
          const btn = document.createElement('button'); btn.className = 'gold-btn'; btn.textContent = `💰 Загрузить ${getCityGold(cityHere)} з в курьера`;
          btn.onclick = () => loadGoldToCourier(cityHere, courier, getCityGold(cityHere)); actions.appendChild(btn);
        }
        if (courier.carryGold > 0) {
          const btn = document.createElement('button'); btn.className = 'success'; btn.textContent = `💰 Разгрузить курьера (${courier.carryGold} з)`;
          btn.onclick = () => unloadCourier(cityHere, courier); actions.appendChild(btn);
        }
      }
    }
  }
  if (selected.type === 'city') {
    const c = cities.find(c => c.id === selected.id);
    if (!c) { clearSelection(); return; }
    info.innerHTML = `<div class="unit-card ${getCivClass(c.owner)}"><strong>🏛 ${c.name}</strong>${c.isCapital?' 👑':''}<br>Золото: ${getCityGold(c)}<br>Доход: +${cityIncome(c)}/ход</div>`;
    if (c.owner === 'player') {
      actions.style.display = 'flex';
      const btn = document.createElement('button'); btn.className = 'gold-btn'; btn.textContent = '🏛 Открыть город';
      btn.onclick = () => openCityPanel(c.id); actions.appendChild(btn);
    }
  }
}
const TILE_INFO = {
  grass:{icon:'🌿',art:'art-grass',name:'Равнина',desc:'Открытая местность.'},
  forest:{icon:'🌲',art:'art-forest',name:'Лес',desc:'Густой лес.'},
  mountain:{icon:'⛰',art:'art-mountain',name:'Горы',desc:'Непроходимые горы. Юниты не могут заходить, строить здесь нельзя.'},
  water:{icon:'🌊',art:'art-water',name:'Вода',desc:'Непроходима.'},
  river:{icon:'〜',art:'art-river',name:'Река',desc:'Переход только по мосту.'},
  bridge:{icon:'🌉',art:'art-bridge',name:'Мост',desc:'Переправа через реку.'}
};
const UNIT_INFO = {
  infantry:{icon:'⚔',name:'Пехота',desc:'Основной боец. Атака 10 / Защита 10.'},
  militia:{icon:'🛡',name:'Ополчение',desc:'Защитник, не атакует.'},
  archer:{icon:'🏹',name:'Лучник',desc:'Атака 20 (×2 от пехоты), защита 5 (×0.5).'},
  cavalry:{icon:'🐴',name:'Конница',desc:'Атака 30 (×3), защита 5. Может отступать при уроне >50%, если атакует не кавалерия.'},
  settler:{icon:'🚩',name:'Поселенец',desc:'Основание городов.'},
  courier:{icon:'🐎🛒',name:'Курьер',desc:'Возит золото. Не атакует/не защищается.'},
  scout:{icon:'🐎',name:'Разведчик',desc:'Быстрый разведчик. Радиус обзора 4 клетки.'},
  worker:{icon:'🧑‍🌾',name:'Рабочий',desc:'Строит наблюдательные башни и рвы, а также разрушает постройки.'},
  barbarian:{icon:'🪓',name:'Варвар',desc:'Слабый налётчик.'}
};
function showTileInfo(x, y) {
  if (!isTileVisibleToCiv('player', x, y)) return;
  const terrain = map[y][x];
  const info = TILE_INFO[terrain] || TILE_INFO.grass;
  const city = cities.find(c => c.x === x && c.y === y);
  const camp = camps.find(c => c.x === x && c.y === y);
  const fort = getFort(x, y);
  const building = getBuildingAt(x, y);
  const stack = getStackAt(x, y);
  const art = document.getElementById('tile-info-art');
  const title = document.getElementById('tile-info-title');
  const coords = document.getElementById('tile-info-coords');
  const desc = document.getElementById('tile-info-desc');
  const extra = document.getElementById('tile-info-extra');
  const cityBtn = document.getElementById('tile-info-city-btn');
  let artClass = info.art, icon = info.icon, name = info.name, description = info.desc;
  if (city) { artClass='art-city'; icon='🏛'; name=`Город «${city.name}»`; description = `Доход: ${cityIncome(city)} золота/ход.`; }
  else if (camp) { artClass='art-camp'; icon='⛺'; name='Стойбище варваров'; description='Лагерь варваров.'; }
  else if (building) { artClass='art-fort'; icon=BUILDING_DEFS[building.type].icon; name=BUILDING_DEFS[building.type].name; description=building.type==='watchtower'?'Занимает клетку. Вместимость: 2 юнита. Обзор: 4 клетки.':'Непроходимое оборонительное сооружение. Обзор: 1 клетка.'; }
  else if (fort && !stack.length) { artClass='art-fort'; icon='🏰'; name='Крепость'; description='×2 к защите. Обзор: 4 клетки.'; }
  art.className=''; art.id='tile-info-art'; art.classList.add(artClass); art.textContent=icon;
  title.textContent=name; coords.textContent=`Координаты: ${x}, ${y} · ${info.name}`; desc.textContent=description;
  const lines = [];
  if (city) {
    lines.push(`Владелец: ${CIVS[city.owner]?.name || city.owner}${city.isCapital?' 👑':''}`);
    lines.push(`💰 Золото: ${getCityGold(city)} (+${cityIncome(city)}/ход)`);
    if (city.production) { const def = getUnitDef(city.production, city.owner); lines.push(`🏗 ${def.name} (${city.progress}/${city.needed})`); }
    else lines.push('🏗 Производство: не задано');
  }
  if (camp) lines.push('Нейтральные варвары');
  if (fort) { lines.push(`Крепость: ${CIVS[fort.owner]?.name || fort.owner}`); lines.push('×2 защиты · обзор 4 клетки'); }
  if (building) lines.push(`${BUILDING_DEFS[building.type].name}: ${CIVS[building.owner]?.name || building.owner} · обзор ${BUILDING_DEFS[building.type].vision} клетки`);
  const unitsBox = document.getElementById('tile-info-units');
  unitsBox.innerHTML = '';
  if (stack.length) {
    lines.push(`Юнитов: ${stack.length}`);
    stack.forEach(u => {
      const def = getUnitDef(u.type, u.owner);
      const lore = UNIT_INFO[u.type] || { icon: def.icon, name: def.name, desc:'' };
      const card = document.createElement('div');
      card.className = 'tile-unit-card owner-' + getCivClass(u.owner);
      const status = [];
      if (u.moved) status.push('уже ходил');
      if (u.healTurns > 0) status.push('лечение: '+u.healTurns);
      if (u.buildFort > 0) status.push('строит крепость: '+u.buildFort);
      if (u.buildStructureTurns > 0) status.push('строит '+BUILDING_DEFS[u.buildStructure]?.name+': '+u.buildStructureTurns);
      if (def.isCourier && u.carryGold > 0) status.push(`💰 ${u.carryGold}`);
      const iconHtml = UNIT_SPRITES[u.type] ? unitIconHtml(u.type, 32) : `<span class="tile-unit-icon">${lore.icon}</span>`;
      card.innerHTML = `<div class="tile-unit-head">${iconHtml}<div><div class="tile-unit-name">${lore.name}</div><div class="tile-unit-meta">${CIVS[u.owner]?.name || u.owner}${status.length?' · '+status.join(', '):''}</div></div></div><div class="tile-unit-desc">${lore.desc}</div><div class="tile-unit-stats"><span>⚔ Атака: ${def.strength}</span><span>🛡 Защита: ${def.defense}</span><span>❤ ОЗ: ${u.hp}/${def.hp}</span><span>👣 Ход: ${def.move}</span></div>`;
      unitsBox.appendChild(card);
    });
  } else if (!city && !camp) lines.push('Клетка свободна от юнитов');
  if (building?.type === 'trench') lines.push('⚠ Ров непроходим для любых юнитов');
  if (terrain === 'mountain' || terrain === 'water' || terrain === 'river') lines.push('⚠ Непроходимо' + (terrain === 'river' ? ' (нужен мост)' : ''));
  if (terrain === 'bridge') lines.push('✓ Можно переходить реку');
  if (building?.type === 'watchtower') lines.push('✓ В башне могут находиться до 2 юнитов');
  extra.textContent = lines.join('\n');
  if (city) { cityBtn.style.display='block'; cityBtn.textContent = `🏛 Перейти в город «${city.name}»`; }
  else cityBtn.style.display = 'none';
  const overlay = document.getElementById('tile-info');
  overlay.classList.remove('closing');
  overlay.style.display = 'flex';
  requestAnimationFrame(() => { requestAnimationFrame(() => overlay.classList.add('open')); });
}
function closeTileInfo() {
  const overlay = document.getElementById('tile-info');
  if (!overlay || overlay.style.display === 'none') return;
  overlay.classList.remove('open');
  overlay.classList.add('closing');
  setTimeout(() => { overlay.style.display='none'; overlay.classList.remove('closing'); }, 220);
}
function showTurnBanner(text) { const el = document.getElementById('turn-banner'); el.textContent = text; el.style.display = 'block'; setTimeout(() => { el.style.display = 'none'; }, 500); }
function checkVictory() {
  const p = cities.filter(c => c.owner === 'player').length;
  if (p === 0) { showVictory(false, 'Все твои города потеряны...'); return; }
  const aiWithCities = [];
  for (let i = 1; i <= opponentCount; i++) {
    const aiId = 'ai' + i;
    if (cities.filter(c => c.owner === aiId).length > 0) aiWithCities.push(aiId);
  }
  if (aiWithCities.length === 0 && p > 0) showVictory(true, 'Все вражеские города пали!');
}
function showVictory(won, text) {
  document.getElementById('victory-title').textContent = won ? '🏆 ПОБЕДА!' : '💀 ПОРАЖЕНИЕ';
  document.getElementById('victory-text').textContent = text;
  document.getElementById('victory-screen').style.display = 'flex';
}
function toggleFullscreen() {
  const el = document.documentElement;
  if (!document.fullscreenElement) { (el.requestFullscreen?.() || el.webkitRequestFullscreen?.())?.catch(() => {}); document.getElementById('fs-btn').textContent = '⛶ Свернуть'; }
  else { (document.exitFullscreen?.() || document.webkitExitFullscreen?.())?.catch(() => {}); document.getElementById('fs-btn').textContent = '⛶ Развернуть'; }
}
function toggleCompactMode() {
  const isCompact = document.body.classList.toggle('compact');
  const btn = document.getElementById('compact-btn');
  if (btn) btn.textContent = isCompact ? '📱 Обычно' : '📱 Компактно';
  setTimeout(() => {
    if (document.getElementById('game-container').style.display === 'flex') { TILE_PX = computeTilePx(); applyMapSizeFixed(); render(); }
  }, 60);
}
function toggleGameSidebar() {
  // На телефонах и в компактном режиме используем выдвижную панель.
  if (window.innerWidth <= 900 || document.body.classList.contains('compact')) {
    if (document.getElementById('drawer-overlay')?.classList.contains('open')) closeSidebarDrawer();
    else openSidebarDrawer();
    return;
  }
  document.body.classList.toggle('sidebar-hidden');
  const hidden = document.body.classList.contains('sidebar-hidden');
  const btn = document.getElementById('sidebar-toggle-btn');
  if (btn) btn.textContent = hidden ? '☷ Показать панель' : '☷ Скрыть панель';
  setTimeout(() => {
    if (document.getElementById('game-container').style.display === 'flex') {
      TILE_PX = computeTilePx();
      applyMapSizeFixed();
      render();
    }
  }, 80);
}
function scrollToSidebar() {
  if (document.body.classList.contains('compact')) { openSidebarDrawer(); return; }
  const selPanel = document.getElementById('selected-panel');
  if (selPanel && window.innerWidth <= 900) selPanel.scrollIntoView({ behavior:'smooth', inline:'start', block:'nearest' });
  else if (selPanel) selPanel.scrollIntoView({ behavior:'smooth', block:'nearest' });
}
function openSidebarDrawer() {
  const overlay = document.getElementById('drawer-overlay');
  const panel = document.getElementById('drawer-panel');
  if (!overlay || !panel) return;
  const sidebar = document.getElementById('sidebar');
  panel.innerHTML = '';
  const closeBtn = document.createElement('button'); closeBtn.id = 'drawer-close'; closeBtn.textContent = '✕'; closeBtn.onclick = closeSidebarDrawer;
  panel.appendChild(closeBtn);
  panel.appendChild(sidebar);
  sidebar.style.display='flex'; sidebar.style.flexDirection='column';
  sidebar.style.maxHeight='none'; sidebar.style.overflowY='auto'; sidebar.style.maxWidth='100%';
  overlay.classList.add('open');
}
function closeSidebarDrawer() {
  const overlay = document.getElementById('drawer-overlay');
  const panel = document.getElementById('drawer-panel');
  if (!overlay || !panel) return;
  const sidebar = document.getElementById('sidebar');
  const gameContainer = document.getElementById('game-container');
  if (sidebar && gameContainer && sidebar.parentElement === panel) {
    gameContainer.appendChild(sidebar);
    sidebar.style.display=''; sidebar.style.flexDirection=''; sidebar.style.maxHeight=''; sidebar.style.overflowY=''; sidebar.style.maxWidth='';
    if (window.innerWidth <= 900) { sidebar.style.flexDirection='row'; sidebar.style.overflowX='auto'; sidebar.style.overflowY='hidden'; }
  }
  overlay.classList.remove('open');
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && eventModalOpen && document.getElementById('event-box').classList.contains('has-input')) { e.preventDefault(); closeEventModal(); }
  if (e.key === 'Escape') { closeTileInfo(); closeCityPanel(); closeTechModal(); closeArmyModal(); closeMainMenu(); }
});
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouchEnd <= 300) { if (e.target.closest('#map-canvas') || e.target.closest('#map-viewport')) e.preventDefault(); }
  lastTouchEnd = now;
}, { passive: false });
let resizeTimeout = null;
window.addEventListener('resize', () => {
  if (resizeTimeout) clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    if (document.getElementById('game-container').style.display === 'flex') { TILE_PX = computeTilePx(); applyMapSizeFixed(); render(); }
  }, 250);
}, { passive: true });
// Init UI labels
try { updatePlayersCount(); } catch(e) {}
