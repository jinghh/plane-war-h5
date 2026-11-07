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
  var stars = [], clouds = [], rocks = [], meteors = [], nebulas = [], planet = null;

  function range(a, b) { return a + Math.random() * (b - a); }

  function makeStars() {
    stars = [];
    var defs = [
      { count: 34, frame: 'bg_star_small', speed: 16, scale: 0.5, alpha: 0.55 },
      { count: 20, frame: 'bg_star_medium', speed: 30, scale: 0.5, alpha: 0.8 },
      { count: 12, frame: 'bg_star_bright', speed: 52, scale: 0.5, alpha: 0.95 }
    ];
    defs.forEach(function (d) {
      for (var i = 0; i < d.count; i++) {
        var twinkle = Math.random() < 0.16;
        stars.push({
          x: range(0, PW.CONFIG.W), y: range(0, PW.CONFIG.H),
          speed: d.speed, frame: d.frame,
          scale: d.scale * range(0.85, 1.15),
          alpha: d.alpha * range(0.7, 1),
          anim: twinkle ? new PW.Anim('star_twinkle') : null
        });
      }
    });
  }

  return {
    init: function () {
      makeStars();
      clouds = [];
      for (var i = 0; i < 4; i++) {
        clouds.push({
          x: range(0, PW.CONFIG.W), y: range(-40, PW.CONFIG.H),
          speed: range(10, 18),
          frame: Math.random() < 0.5 ? 'bg_cloud_a' : 'bg_cloud_b',
          scale: 0.75, alpha: range(0.18, 0.32)
        });
      }
      rocks = [];
      for (var j = 0; j < 3; j++) {
        rocks.push({
          x: range(0, PW.CONFIG.W), y: range(-60, PW.CONFIG.H),
          speed: range(16, 26), scale: range(0.45, 0.6),
          frame: Math.random() < 0.5 ? 'bg_asteroid_small' : 'bg_asteroid_large',
          alpha: 0.55
        });
      }
      meteors = [];
      for (var k = 0; k < 2; k++) {
        meteors.push({
          x: range(0, PW.CONFIG.W), y: range(-80, -20),
          speed: range(80, 120), scale: 0.5,
          frame: Math.random() < 0.5 ? 'bg_meteor_small' : 'bg_meteor_large',
          alpha: 0.7
        });
      }
      nebulas = [
        { x: 40, y: 120, speed: 6, scale: 1.0, alpha: 0.35, frame: 'bg_nebula_puff' },
        { x: 180, y: 330, speed: 9, scale: 1.2, alpha: 0.28, frame: 'bg_nebula_puff' }
      ];
      planet = { x: PW.CONFIG.W - 34, y: -36, speed: 3.5, scale: 0.8, alpha: 0.55, frame: 'bg_planet_small' };
    },

    update: function (dt, mult) {
      mult = mult || 1;
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        s.y += s.speed * mult * dt;
        if (s.anim) s.anim.update(dt);
        if (s.y > PW.CONFIG.H + 20) { s.y = -20; s.x = range(0, PW.CONFIG.W); }
      }
      for (var c = 0; c < clouds.length; c++) {
        clouds[c].y += clouds[c].speed * mult * dt;
        if (clouds[c].y > PW.CONFIG.H + 40) { clouds[c].y = -50; clouds[c].x = range(0, PW.CONFIG.W); }
      }
      for (var r = 0; r < rocks.length; r++) {
        rocks[r].y += rocks[r].speed * mult * dt;
        if (rocks[r].y > PW.CONFIG.H + 50) { rocks[r].y = -60; rocks[r].x = range(0, PW.CONFIG.W); }
      }
      for (var m = 0; m < meteors.length; m++) {
        meteors[m].y += meteors[m].speed * mult * dt;
        if (meteors[m].y > PW.CONFIG.H + 60) {
          meteors[m].y = range(-120, -40); meteors[m].x = range(0, PW.CONFIG.W);
          meteors[m].frame = Math.random() < 0.5 ? 'bg_meteor_small' : 'bg_meteor_large';
        }
      }
      planet.y += planet.speed * dt;
      if (planet.y > PW.CONFIG.H + 60) { planet.y = -60; planet.x = range(20, PW.CONFIG.W - 20); }
      for (var n = 0; n < nebulas.length; n++) {
        nebulas[n].y += nebulas[n].speed * mult * dt;
        if (nebulas[n].y > PW.CONFIG.H + 60) { nebulas[n].y = -70; nebulas[n].x = range(0, PW.CONFIG.W); }
      }
    },

    draw: function (ctx) {
      // 星云
      for (var n = 0; n < nebulas.length; n++) {
        PW.Sprite.draw(ctx, nebulas[n].frame, nebulas[n].x, nebulas[n].y, { scale: nebulas[n].scale, alpha: nebulas[n].alpha });
      }
      // 行星
      PW.Sprite.draw(ctx, planet.frame, planet.x, planet.y, { scale: planet.scale, alpha: planet.alpha });
      // 云
      for (var c = 0; c < clouds.length; c++) {
        PW.Sprite.draw(ctx, clouds[c].frame, clouds[c].x, clouds[c].y, { scale: clouds[c].scale, alpha: clouds[c].alpha });
      }
      // 陨石
      for (var r = 0; r < rocks.length; r++) {
        PW.Sprite.draw(ctx, rocks[r].frame, rocks[r].x, rocks[r].y, { scale: rocks[r].scale, alpha: rocks[r].alpha });
      }
      // 流星
      for (var m = 0; m < meteors.length; m++) {
        PW.Sprite.draw(ctx, meteors[m].frame, meteors[m].x, meteors[m].y, { scale: meteors[m].scale, alpha: meteors[m].alpha });
      }
      // 星星
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        var f = s.anim ? (s.anim.frame() || s.frame) : s.frame;
        PW.Sprite.draw(ctx, f, s.x, s.y, { scale: s.scale, alpha: s.alpha });
      }
    }
  };
})();
