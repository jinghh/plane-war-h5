/* ============================================================
 * assets/atlas.js
 * 由 plane_war_atlas.json 派生（同目录下 JSON 为原始数据，供工具与校验使用）。
 * file:// 下 fetch/XHR 读取本地 JSON 会被浏览器拦截，故这里用全局变量承载同一份图集数据。
 * 帧矩形计算规则与生成器一致：帧在 grid 单元格内居中 → x = cellX + floor((cellW - w)/2)。
 * ============================================================ */
window.PLANE_WAR_ATLAS = (function () {
  'use strict';

  var META = {
    app: 'plane-war-assets',
    image: 'plane_war_sprite_sheet.png',
    size: { w: 912, h: 2128 },
    scale: 4,          // 图集中每个逻辑像素 = 4×4 PNG 像素
    padding: 16
  };

  // 六个分区：矩形 + 统一网格（与 JSON meta.blocks 一致）
  var BLOCKS = {
    aircraft: { x: 0, y: 0, cw: 176, ch: 176, cols: 4, rows: 3 },
    boss: { x: 0, y: 544, cw: 320, ch: 256, cols: 1, rows: 1 },
    bullets: { x: 336, y: 544, cw: 144, ch: 144, cols: 4, rows: 2 },
    fx: { x: 0, y: 848, cw: 176, ch: 176, cols: 4, rows: 3 },
    items: { x: 0, y: 1392, cw: 120, ch: 120, cols: 4, rows: 2 },
    decor: { x: 0, y: 1648, cw: 160, ch: 160, cols: 4, rows: 3 }
  };

  // [name, block, col, row, w, h]   w/h 为 PNG 像素尺寸（取自 JSON frames）
  var DEF = [
    ['player_idle', 'aircraft', 0, 0, 128, 136],
    ['player_bank_left', 'aircraft', 1, 0, 144, 152],
    ['player_bank_right', 'aircraft', 2, 0, 144, 152],
    ['player_hit', 'aircraft', 3, 0, 136, 144],
    ['enemy_small_a', 'aircraft', 0, 1, 88, 88],
    ['enemy_small_b', 'aircraft', 1, 1, 88, 88],
    ['enemy_medium_a', 'aircraft', 2, 1, 120, 104],
    ['enemy_medium_b', 'aircraft', 3, 1, 120, 104],
    ['enemy_heavy', 'aircraft', 0, 2, 144, 128],
    ['enemy_heavy_elite', 'aircraft', 1, 2, 152, 136],
    ['player_shielded', 'aircraft', 2, 2, 168, 176],

    ['boss_heavy', 'boss', 0, 0, 320, 240],

    ['bullet_player_basic', 'bullets', 0, 0, 32, 64],
    ['bullet_player_power', 'bullets', 1, 0, 48, 80],
    ['bullet_player_laser', 'bullets', 2, 0, 40, 136],
    ['bullet_player_missile', 'bullets', 3, 0, 56, 96],
    ['bullet_enemy_orb', 'bullets', 0, 1, 64, 64],
    ['bullet_enemy_dart', 'bullets', 1, 1, 40, 72],
    ['bullet_enemy_plasma', 'bullets', 2, 1, 80, 80],
    ['bullet_enemy_ring', 'bullets', 3, 1, 80, 80],

    ['explosion_00', 'fx', 0, 0, 168, 168],
    ['explosion_01', 'fx', 1, 0, 168, 168],
    ['explosion_02', 'fx', 2, 0, 168, 168],
    ['explosion_03', 'fx', 3, 0, 168, 168],
    ['explosion_04', 'fx', 0, 1, 168, 168],
    ['explosion_05', 'fx', 1, 1, 168, 168],
    ['explosion_06', 'fx', 2, 1, 168, 168],
    ['explosion_07', 'fx', 3, 1, 168, 168],
    ['fx_muzzle_flash', 'fx', 0, 2, 72, 72],
    ['fx_impact', 'fx', 1, 2, 80, 80],
    ['fx_shield_break', 'fx', 2, 2, 152, 152],
    ['fx_smoke', 'fx', 3, 2, 96, 96],

    ['pickup_power', 'items', 0, 0, 88, 88],
    ['pickup_shield', 'items', 1, 0, 88, 88],
    ['pickup_health', 'items', 2, 0, 88, 88],
    ['pickup_bomb', 'items', 3, 0, 88, 88],
    ['ui_coin', 'items', 0, 1, 88, 88],
    ['ui_heart', 'items', 1, 1, 88, 88],
    ['ui_star', 'items', 2, 1, 88, 88],
    ['ui_gem', 'items', 3, 1, 88, 88],

    ['bg_star_small', 'decor', 0, 0, 44, 44],
    ['bg_star_medium', 'decor', 1, 0, 60, 60],
    ['bg_star_bright', 'decor', 2, 0, 92, 92],
    ['bg_star_twinkle', 'decor', 3, 0, 84, 84],
    ['bg_asteroid_small', 'decor', 0, 1, 108, 100],
    ['bg_asteroid_large', 'decor', 1, 1, 144, 136],
    ['bg_meteor_small', 'decor', 2, 1, 72, 104],
    ['bg_meteor_large', 'decor', 3, 1, 112, 152],
    ['bg_cloud_a', 'decor', 0, 2, 144, 88],
    ['bg_cloud_b', 'decor', 1, 2, 120, 64],
    ['bg_planet_small', 'decor', 2, 2, 136, 128],
    ['bg_nebula_puff', 'decor', 3, 2, 144, 112]
  ];

  function categoryOf(name, block) {
    if (block === 'aircraft') return name.indexOf('player_') === 0 ? 'player' : 'enemy';
    if (block === 'boss') return 'boss';
    if (block === 'bullets') return name.indexOf('bullet_player') === 0 ? 'player' : 'enemy';
    if (block === 'items') return name.indexOf('pickup_') === 0 ? 'pickup' : 'ui';
    if (block === 'fx') return 'fx';
    return 'background';
  }

  var frames = {};
  DEF.forEach(function (d) {
    var name = d[0], b = BLOCKS[d[1]], col = d[2], row = d[3], w = d[4], h = d[5];
    var cellX = b.x + col * b.cw;
    var cellY = b.y + row * b.ch;
    var x = cellX + Math.floor((b.cw - w) / 2);
    var y = cellY + Math.floor((b.ch - h) / 2);
    frames[name] = {
      name: name,
      frame: { x: x, y: y, w: w, h: h },
      block: d[1],
      category: categoryOf(name, d[1]),
      grid: { col: col, row: row, cell: [b.cw, b.ch] },
      anchor: { x: 0.5, y: 0.5 },
      logicalSize: [w / META.scale, h / META.scale],
      scale: META.scale
    };
  });

  var animations = {
    explosion: {
      fps: 18, loop: false,
      frames: ['explosion_00', 'explosion_01', 'explosion_02', 'explosion_03',
        'explosion_04', 'explosion_05', 'explosion_06', 'explosion_07']
    },
    explosion_small: {
      fps: 20, loop: false,
      frames: ['explosion_00', 'explosion_01', 'explosion_02', 'explosion_03', 'explosion_04']
    },
    player_hit_blink: { fps: 10, loop: true, frames: ['player_idle', 'player_hit'] },
    player_bank: { fps: 12, loop: true, frames: ['player_bank_left', 'player_idle', 'player_bank_right', 'player_idle'] },
    star_twinkle: { fps: 6, loop: true, frames: ['bg_star_small', 'bg_star_twinkle', 'bg_star_bright', 'bg_star_twinkle'] },
    enemy_bullet_orb: { fps: 8, loop: true, frames: ['bullet_enemy_orb'] }
  };

  return {
    meta: META,
    blocks: BLOCKS,
    frames: frames,
    animations: animations,
    frameNames: DEF.map(function (d) { return d[0]; })
  };
})();
