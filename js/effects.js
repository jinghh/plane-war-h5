/* ============================================================
 * js/effects.js —— 爆炸/火花特效，以及星空视差背景
 * ============================================================ */
PW.Fx = (function () {
  var list = [];

  function pushAnim(x, y, animName, scale) {
    list.push({
      anim: new PW.Anim(animName),
      x: x, y: y, scale: scale, alpha: 1, ttl: 0, t: 0, dead: false
    });
  }

  function pushFrame(name, x, y, scale, ttl, alpha) {
    list.push({
      anim: null, frame: name, x: x, y: y, scale: scale,
      alpha: alpha == null ? 1 : alpha, ttl: ttl || 0.1, t: 0, dead: false
    });
  }

  return {
    /* 爆炸：big=true 播 8 帧全序列，否则播 00-04 小爆炸 */
    explosion: function (x, y, big) {
      pushAnim(x, y, big ? 'explosion' : 'explosion_small', big ? 1.15 : 0.62);
      if (big) pushFrame('fx_smoke', x + 4, y + 6, 0.55, 0.5, 0.5);
    },
    muzzle: function (x, y) { pushFrame('fx_muzzle_flash', x, y, 0.42, 0.07, 0.9); },
    impact: function (x, y) { pushFrame('fx_impact', x, y, 0.35, 0.12, 1); },
    shieldBreak: function (x, y) { pushFrame('fx_shield_break', x, y, 1.0, 0.35, 0.9); },
    smoke: function (x, y, scale, ttl) { pushFrame('fx_smoke', x, y, scale || 0.4, ttl || 0.6, 0.55); },
    shockwave: function (x, y, scale) { pushFrame('fx_shockwave', x, y, scale || 1.0, 0.42, 0.9); },

    update: function (dt) {
      for (var i = 0; i < list.length; i++) {
        var e = list[i];
        if (e.anim) {
          e.anim.update(dt);
          e.dead = e.anim.done;
        } else {
          e.t += dt;
          if (e.t >= e.ttl) e.dead = true;
        }
      }
      list = list.filter(function (e) { return !e.dead; });
    },

    draw: function (ctx) {
      for (var i = 0; i < list.length; i++) {
        var e = list[i];
        if (e.anim) {
          var f = e.anim.frame();
          if (f) PW.Sprite.draw(ctx, f, e.x, e.y, { scale: e.scale, alpha: e.alpha });
        } else {
          var a = e.alpha * (1 - e.t / e.ttl);
          PW.Sprite.draw(ctx, e.frame, e.x, e.y, { scale: e.scale, alpha: Math.max(0, a) });
        }
      }
    },

    clear: function () { list = []; }
  };
})();

PW.Background = (function () {
  /* 主题配置：sky 为三段渐变，stars/decor 为分层滚动元素。
     每层用 frames 数组随机取帧，保证同一主题下也有变化。 */
  var THEMES = {
    space: {
      name: '深空',
      sky: ['#05070f', '#080d1c', '#0a1020'],
      stars: [
        { count: 34, frame: 'bg_star_small', speed: 16, scale: 0.5, alpha: 0.55 },
        { count: 20, frame: 'bg_star_medium', speed: 30, scale: 0.5, alpha: 0.8 },
        { count: 12, frame: 'bg_star_bright', speed: 52, scale: 0.5, alpha: 0.95 }
      ],
      decor: [
        { count: 2, frames: ['bg_nebula_puff'], speed: 8, scale: 1.05, alpha: 0.32 },
        { count: 4, frames: ['bg_cloud_a', 'bg_cloud_b'], speed: 14, scale: 0.75, alpha: 0.26 },
        { count: 3, frames: ['bg_asteroid_small', 'bg_asteroid_large'], speed: 22, scale: 0.52, alpha: 0.55 },
        { count: 2, frames: ['bg_meteor_small', 'bg_meteor_large'], speed: 100, scale: 0.5, alpha: 0.7, fromTop: true },
        { count: 1, frames: ['bg_planet_small'], speed: 3.5, scale: 0.8, alpha: 0.55, startY: -36 }
      ]
    },
    nebula: {
      name: '星云',
      sky: ['#0a0617', '#160b2c', '#0b0718'],
      stars: [
        { count: 26, frame: 'bg_star_small', speed: 14, scale: 0.44, alpha: 0.5 },
        { count: 12, frame: 'bg_star_twinkle', speed: 26, scale: 0.46, alpha: 0.7, twinkle: true }
      ],
      decor: [
        { count: 1, frames: ['bg_nebula_core'], speed: 5, scale: 1.5, alpha: 0.42 },
        { count: 4, frames: ['bg_nebula_wisp'], speed: 11, scale: 1.2, alpha: 0.36 },
        { count: 3, frames: ['bg_gas_cloud'], speed: 16, scale: 1.15, alpha: 0.3 }
      ]
    },
    belt: {
      name: '行星带',
      sky: ['#070a14', '#101a2a', '#080c16'],
      stars: [
        { count: 24, frame: 'bg_star_small', speed: 15, scale: 0.46, alpha: 0.5 },
        { count: 10, frame: 'bg_star_bright', speed: 40, scale: 0.46, alpha: 0.85 }
      ],
      decor: [
        { count: 4, frames: ['bg_asteroid_large'], speed: 26, scale: 0.72, alpha: 0.6 },
        { count: 6, frames: ['bg_asteroid_small'], speed: 34, scale: 0.5, alpha: 0.55 },
        { count: 2, frames: ['bg_debris'], speed: 40, scale: 0.6, alpha: 0.5 },
        { count: 1, frames: ['bg_planet_big'], speed: 4, scale: 1.1, alpha: 0.72 },
        { count: 1, frames: ['bg_moon'], speed: 6.5, scale: 0.9, alpha: 0.6 }
      ]
    },
    wreck: {
      name: '太空残骸',
      sky: ['#0c0a09', '#1a130e', '#0a0807'],
      stars: [
        { count: 20, frame: 'bg_star_small', speed: 12, scale: 0.42, alpha: 0.42 },
        { count: 8, frame: 'bg_star_bright', speed: 32, scale: 0.44, alpha: 0.7 }
      ],
      decor: [
        { count: 2, frames: ['bg_hull_big'], speed: 9, scale: 0.95, alpha: 0.55 },
        { count: 3, frames: ['bg_hull_small'], speed: 15, scale: 0.8, alpha: 0.5 },
        { count: 5, frames: ['bg_debris'], speed: 26, scale: 0.6, alpha: 0.45 },
        { count: 1, frames: ['bg_meteor_small'], speed: 90, scale: 0.5, alpha: 0.6, fromTop: true }
      ]
    },
    atmo: {
      name: '大气层',
      sky: ['#04121e', '#0a2436', '#08202c'],
      stars: [
        { count: 8, frame: 'bg_star_small', speed: 10, scale: 0.36, alpha: 0.28 }
      ],
      decor: [
        { count: 1, frames: ['bg_sun_glow'], speed: 2, scale: 1.25, alpha: 0.5, startY: -60 },
        { count: 6, frames: ['bg_atmo_cloud'], speed: 18, scale: 0.95, alpha: 0.34 },
        { count: 5, frames: ['bg_atmo_wisp'], speed: 26, scale: 0.9, alpha: 0.28 },
        { count: 2, frames: ['bg_cloud_b'], speed: 12, scale: 0.7, alpha: 0.22 }
      ]
    }
  };

  var THEME_ORDER = ['space', 'nebula', 'belt', 'wreck', 'atmo'];
  var themeId = 'space';
  var stars = [], items = [];
  var built = false;

  function range(a, b) { return a + Math.random() * (b - a); }

  function build() {
    var th = THEMES[themeId] || THEMES.space;

    stars = [];
    th.stars.forEach(function (d) {
      for (var i = 0; i < d.count; i++) {
        stars.push({
          x: range(0, PW.CONFIG.W), y: range(0, PW.CONFIG.H),
          speed: d.speed, frame: d.frame,
          scale: d.scale * range(0.85, 1.15),
          alpha: d.alpha * range(0.7, 1),
          anim: d.twinkle ? new PW.Anim('star_twinkle') : null
        });
      }
    });

    items = [];
    th.decor.forEach(function (d) {
      for (var i = 0; i < d.count; i++) {
        items.push({
          x: range(0, PW.CONFIG.W),
          y: d.startY != null ? d.startY : (d.fromTop ? range(-140, -30) : range(-70, PW.CONFIG.H)),
          speed: d.speed * range(0.85, 1.2),
          frame: d.frames[(Math.random() * d.frames.length) | 0],
          frames: d.frames,
          scale: d.scale * range(0.9, 1.1),
          alpha: d.alpha * range(0.85, 1.1),
          fromTop: !!d.fromTop
        });
      }
    });

    built = true;
  }

  return {
    THEME_ORDER: THEME_ORDER,

    init: function () { build(); },

    /* 切换主题；返回 true 表示真的换了一套 */
    setTheme: function (id) {
      if (!THEMES[id]) return false;
      if (built && id === themeId) return false;
      themeId = id;
      build();
      return true;
    },

    themeId: function () { return themeId; },
    themeName: function () { return (THEMES[themeId] || THEMES.space).name; },
    sky: function () { return (THEMES[themeId] || THEMES.space).sky; },

    update: function (dt, mult) {
      mult = mult || 1;
      var H = PW.CONFIG.H, W = PW.CONFIG.W;
      var i;

      for (i = 0; i < stars.length; i++) {
        var s = stars[i];
        s.y += s.speed * mult * dt;
        if (s.anim) s.anim.update(dt);
        if (s.y > H + 20) { s.y = -20; s.x = range(0, W); }
      }

      for (i = 0; i < items.length; i++) {
        var it = items[i];
        it.y += it.speed * mult * dt;
        if (it.y > H + 70) {
          it.y = it.fromTop ? range(-140, -40) : -70;
          it.x = range(0, W);
          if (it.frames && it.frames.length > 1) {
            it.frame = it.frames[(Math.random() * it.frames.length) | 0];
          }
        }
      }
    },

    draw: function (ctx) {
      var i;
      for (i = 0; i < items.length; i++) {
        PW.Sprite.draw(ctx, items[i].frame, items[i].x, items[i].y, { scale: items[i].scale, alpha: items[i].alpha });
      }
      for (i = 0; i < stars.length; i++) {
        var s = stars[i];
        var f = s.anim ? (s.anim.frame() || s.frame) : s.frame;
        PW.Sprite.draw(ctx, f, s.x, s.y, { scale: s.scale, alpha: s.alpha });
      }
    }
  };
})();
