/* ============================================================
 * js/game.js —— 状态机 / 波次 / 碰撞 / 计分 / HUD / 主渲染
 * ============================================================ */
(function () {
  'use strict';

  var W = PW.CONFIG.W, H = PW.CONFIG.H;

  var SPAWN_INTERVAL = {
    small: [0, 0.95, 0.9, 0.85, 0.78],
    medA: [0, 0, 2.4, 2.3, 2.4],
    medB: [0, 0, 0, 2.6, 2.2],
    heavy: [0, 0, 0, 0, 4.8],
    elite: [0, 0, 0, 0, 7.5],
    group: [0, 0, 0, 7.5, 8],
    drone: [0, 0, 1.7, 1.4, 1.2],
    ram: [0, 0, 0, 3.2, 2.8],
    orbiter: [0, 0, 0, 4.0, 3.6],
    shielded: [0, 0, 0, 0, 6.2],
    turret: [0, 0, 0, 0, 7.0]
  };

  var BASE_TIMERS = {
    small: 0.8, medA: 2.2, medB: 2.6, heavy: 3, elite: 5, group: 4,
    drone: 3.2, ram: 6.0, orbiter: 7.0, shielded: 9.0, turret: 10.5
  };

  function freshTimers() {
    return {
      small: BASE_TIMERS.small, medA: BASE_TIMERS.medA, medB: BASE_TIMERS.medB,
      heavy: BASE_TIMERS.heavy, elite: BASE_TIMERS.elite, group: BASE_TIMERS.group,
      drone: BASE_TIMERS.drone, ram: BASE_TIMERS.ram, orbiter: BASE_TIMERS.orbiter,
      shielded: BASE_TIMERS.shielded, turret: BASE_TIMERS.turret
    };
  }

  function rand(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function circleRect(cx, cy, r, x, y, hw, hh) {
    return Math.abs(cx - x) < hw + r && Math.abs(cy - y) < hh + r;
  }

  function label(ctx, str, x, y, size, color, align, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.font = 'bold ' + (size || 7) + 'px "Courier New", monospace';
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillText(str, x + 1, y + 1);
    ctx.fillStyle = color || '#e8f4ff';
    ctx.fillText(str, x, y);
    ctx.restore();
  }

  PW.Game = function (canvas, hooks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.hooks = hooks || {};
    this.scale = 2;
    this.state = 'boot';

    this.player = new PW.Player(this);
    this.bullets = [];
    this.enemyBullets = [];
    this.enemies = [];
    this.pickups = [];
    this.boss = null;

    this.clock = 0;
    this.waveTime = 0;
    this.cycle = 1;
    this.stage = 1;
    this.score = 0;
    this.kills = 0;
    this.warned = false;

    this.bannerText = '';
    this.bannerT = 0;
    this.bannerDur = 0;
    this.bannerColor = '#dfe9ff';

    this.shakeMag = 0;
    this.shakeT = 0;
    this.flashA = 0;
    this.flashColor = '#ffffff';

    this.deathT = 0;
    this.timers = freshTimers();
    this._grad = null;

    try { this.best = parseInt(localStorage.getItem('planeWarBest') || '0', 10) || 0; }
    catch (e) { this.best = 0; }
  };

  PW.Game.prototype.setViewport = function (scale) {
    this.scale = scale;
    this._grad = null;
  };

  PW.Game.prototype.setState = function (state) {
    this.state = state;
    if (this.hooks.onState) this.hooks.onState(state, this);
  };

  /* ---------------- 流程 ---------------- */

  PW.Game.prototype.reset = function () {
    this.bullets = [];
    this.enemyBullets = [];
    this.enemies = [];
    this.pickups = [];
    this.boss = null;
    this.player.reset();

    this.clock = 0;
    this.waveTime = 0;
    this.cycle = 1;
    this.stage = 1;
    this.score = 0;
    this.kills = 0;
    this.warned = false;
    this.deathT = 0;

    this.bannerText = '';
    this.bannerT = 0;
    this.bannerDur = 0;
    this.shakeMag = 0;
    this.shakeT = 0;
    this.flashA = 0;

    this.timers = freshTimers();
    if (PW.Background.setTheme('space')) this._grad = null;
    PW.Fx.clear();
    PW.Input.clearFlags();
  };

  PW.Game.prototype.start = function () {
    PW.Audio.play('click');
    this.reset();
    this.setState('playing');
  };

  PW.Game.prototype.pause = function () {
    if (this.state !== 'playing') return;
    this.setState('paused');
    PW.Audio.play('click');
  };

  PW.Game.prototype.resume = function () {
    if (this.state !== 'paused') return;
    PW.Input.clearFlags();
    this.setState('playing');
    PW.Audio.play('click');
  };

  PW.Game.prototype.togglePause = function () {
    if (this.state === 'playing') this.pause();
    else if (this.state === 'paused') this.resume();
  };

  PW.Game.prototype.gameOver = function () {
    if (this.state !== 'playing') return;
    if (this.score > this.best) {
      this.best = this.score;
      try { localStorage.setItem('planeWarBest', String(this.best)); } catch (e) {}
    }
    this.setState('gameover');
  };

  /* ---------------- 主更新 ---------------- */

  PW.Game.prototype.update = function (dt) {
    dt = Math.min(dt, 1 / 30);
    if (!dt) return;

    /* 全局按键在非 playing 状态也要响应 */
    if (PW.Input.consume('pause')) {
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused') this.resume();
    }
    if (PW.Input.consume('restart')) {
      if (this.state === 'playing' || this.state === 'paused' || this.state === 'gameover') this.start();
    }
    if (PW.Input.consume('start') && this.state === 'title') this.start();

    if (this.state !== 'playing') return;

    if (PW.Input.consume('bomb')) this.useBomb();

    this.clock += dt;
    this.waveTime += dt;

    this._updateStage();
    this._spawnLogic(dt);

    this.player.update(dt);
    if (!this.player.alive) this.deathT += dt;
    else this.deathT = 0;

    var i;
    for (i = 0; i < this.enemies.length; i++) this.enemies[i].update(dt, this);
    if (this.boss) this.boss.update(dt, this);
    for (i = 0; i < this.bullets.length; i++) this.bullets[i].update(dt, this);
    for (i = 0; i < this.enemyBullets.length; i++) this.enemyBullets[i].update(dt, this);
    for (i = 0; i < this.pickups.length; i++) this.pickups[i].update(dt, this);

    this._collisions();

    this.bullets = this.bullets.filter(function (b) { return !b.dead; });
    this.enemyBullets = this.enemyBullets.filter(function (b) { return !b.dead; });
    this.enemies = this.enemies.filter(function (e) { return !e.dead; });
    this.pickups = this.pickups.filter(function (p) { return !p.dead; });

    PW.Fx.update(dt);
    PW.Background.update(dt, 1);

    if (this.bannerT > 0) this.bannerT = Math.max(0, this.bannerT - dt);
    if (this.shakeT > 0) {
      this.shakeT = Math.max(0, this.shakeT - dt);
      if (this.shakeT === 0) this.shakeMag = 0;
    }
    if (this.flashA > 0) this.flashA = Math.max(0, this.flashA - dt * 1.4);

    if (this.player.alive === false && this.deathT > 1.2) this.gameOver();
  };

  PW.Game.prototype._updateStage = function () {
    var st;
    if (this.boss || this.waveTime >= 72) st = 5;
    else st = this.waveTime < 18 ? 1 : this.waveTime < 36 ? 2 : this.waveTime < 54 ? 3 : 4;

    if (st !== this.stage) {
      this.stage = st;
      if (st <= 4) this.banner('WAVE ' + st, 1.6, '#9fe8ff');
    }

    if (!this.warned && this.waveTime >= 69 && this.waveTime < 72) {
      this.warned = true;
      this.banner('WARNING', 2.4, '#ff7591');
      PW.Audio.play('warn');
    }
  };

  PW.Game.prototype._spawnLogic = function (dt) {
    if (this.waveTime >= 72) {
      if (!this.boss) {
        this.boss = new PW.Boss(this, this.cycle);
        this.stage = 5;
        this.banner('BOSS \u00b7 ' + this.boss.name, 2.0, '#ff7591');
        PW.Audio.play('warn');
      }
      return;
    }

    var T = this.timers;
    var stage = this.stage;

    T.small -= dt;
    if (T.small <= 0) {
      T.small = SPAWN_INTERVAL.small[stage] || 0.9;
      var type = Math.random() < 0.5 ? 'small_a' : 'small_b';
      this.enemies.push(new PW.Enemy(this, type, rand(22, W - 22), -28));
    }

    T.medA -= dt;
    if (T.medA <= 0) {
      T.medA = SPAWN_INTERVAL.medA[stage] || 2.4;
      if (stage >= 2) this.enemies.push(new PW.Enemy(this, 'medium_a', rand(30, W - 30), -36));
    }

    T.medB -= dt;
    if (T.medB <= 0) {
      T.medB = SPAWN_INTERVAL.medB[stage] || 2.4;
      if (stage >= 3) this.enemies.push(new PW.Enemy(this, 'medium_b', rand(30, W - 30), -36));
    }

    T.heavy -= dt;
    if (T.heavy <= 0) {
      T.heavy = SPAWN_INTERVAL.heavy[stage] || 5;
      if (stage >= 4) this.enemies.push(new PW.Enemy(this, 'heavy', rand(36, W - 36), -40));
    }

    T.elite -= dt;
    if (T.elite <= 0) {
      T.elite = SPAWN_INTERVAL.elite[stage] || 8;
      if (stage >= 4) this.enemies.push(new PW.Enemy(this, 'heavy_elite', rand(40, W - 40), -40));
    }

    T.group -= dt;
    if (T.group <= 0) {
      T.group = SPAWN_INTERVAL.group[stage] || 8;
      if (stage >= 3) {
        var cx = rand(58, W - 58);
        for (var i = 0; i < 5; i++) {
          this.enemies.push(new PW.Enemy(this, 'small_b', cx, -30 - i * 24, {
            pattern: 'group', phase: i * 0.55
          }));
        }
      }
    }

    /* —— 新增敌机：按 stage 逐步解锁，避免难度突然拔高 —— */
    T.drone -= dt;
    if (T.drone <= 0) {
      T.drone = SPAWN_INTERVAL.drone[stage] || 1.7;
      if (stage >= 2 && this.enemies.length < 24) {
        this.enemies.push(new PW.Enemy(this, 'drone', rand(20, W - 20), -26));
      }
    }

    T.ram -= dt;
    if (T.ram <= 0) {
      T.ram = SPAWN_INTERVAL.ram[stage] || 3.2;
      if (stage >= 3 && this.enemies.length < 24) {
        this.enemies.push(new PW.Enemy(this, 'ram', rand(26, W - 26), -30));
      }
    }

    T.orbiter -= dt;
    if (T.orbiter <= 0) {
      T.orbiter = SPAWN_INTERVAL.orbiter[stage] || 4.0;
      if (stage >= 3 && this.enemies.length < 24) {
        this.enemies.push(new PW.Enemy(this, 'orbiter', rand(56, W - 56), -32));
      }
    }

    T.shielded -= dt;
    if (T.shielded <= 0) {
      T.shielded = SPAWN_INTERVAL.shielded[stage] || 6.2;
      if (stage >= 4 && this.enemies.length < 24) {
        this.enemies.push(new PW.Enemy(this, 'shielded', rand(40, W - 40), -38));
      }
    }

    T.turret -= dt;
    if (T.turret <= 0) {
      T.turret = SPAWN_INTERVAL.turret[stage] || 7.0;
      if (stage >= 4 && this.enemies.length < 24) {
        this.enemies.push(new PW.Enemy(this, 'turret', rand(46, W - 46), -38));
      }
    }
  };

  /* ---------------- 生成 / 掉落 ---------------- */

  PW.Game.prototype.addPlayerBullet = function (o) {
    o.owner = 'player';
    this.bullets.push(new PW.Bullet(o));
  };

  PW.Game.prototype.spawnEnemyBullet = function (x, y, angleDeg, speed, frame, dmg, r) {
    var rad = angleDeg * Math.PI / 180;
    this.enemyBullets.push(new PW.Bullet({
      x: x, y: y,
      vx: Math.cos(rad) * speed,
      vy: Math.sin(rad) * speed,
      frame: frame, dmg: dmg, r: r,
      owner: 'enemy', life: 9
    }));
  };

  /* Boss 召唤的僚机（蜂巢专用），带数量上限防止刷屏 */
  PW.Game.prototype.spawnMinion = function (type, x, y) {
    if (this.enemies.length >= 24) return;
    this.enemies.push(new PW.Enemy(this, type, x, y == null ? -26 : y));
  };

  PW.Game.prototype.nearestTarget = function (x, y) {
    var best = null, bd = 1e9;
    for (var i = 0; i < this.enemies.length; i++) {
      var e = this.enemies[i];
      if (e.dead) continue;
      var d = (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y);
      if (d < bd) { bd = d; best = e; }
    }
    if (this.boss && !this.boss.dying && !this.boss.dead) {
      var db = (this.boss.x - x) * (this.boss.x - x) + (this.boss.y - y) * (this.boss.y - y);
      if (db < bd) { bd = db; best = this.boss; }
    }
    return best;
  };

  PW.Game.prototype.maybeDrop = function (x, y, chance) {
    if (Math.random() > chance) return;
    var kinds = ['power', 'shield', 'health', 'bomb', 'wing', 'magnet', 'rapid'];
    var weights = [12, 8, 7, 5, 6, 5, 5];
    var total = 48;
    var r = Math.random() * total;
    var acc = 0;
    for (var i = 0; i < kinds.length; i++) {
      acc += weights[i];
      if (r <= acc) {
        this.pickups.push(new PW.Pickup(x, y, kinds[i]));
        return;
      }
    }
  };

  PW.Game.prototype.onEnemyKilled = function (e) {
    var big = e.cfg.hp >= 8;
    PW.Fx.explosion(e.x, e.y, big);
    PW.Audio.play('explosion', big);
    this.score += e.cfg.score;
    this.kills += 1;
    /* 只有大体型敌机才震屏：此前普通敌机每次被击杀都会让整个场景抖一下，
       密集击杀时表现为「每隔几秒所有单位集体跳一下」。
       炮台虽然血量 8 但刷新频繁，不参与震屏，避免复现该问题 */
    if (e.cfg.hp >= 9) this.shake(4, 0.32);
    this.maybeDrop(e.x, e.y, e.cfg.drop);
  };

  PW.Game.prototype.onBossKilled = function () {
    this.boss = null;
    this.enemyBullets = [];
    this.score += 2000 * this.cycle;
    this.flash(0.6, '#ffffff');
    this.shake(9, 0.8);
    this.cycle += 1;
    this.waveTime = 0;
    this.stage = 1;
    this.warned = false;
    this.timers = freshTimers();

    /* 每轮换一张背景，形成推进感；回到深空后循环 */
    var order = PW.Background.THEME_ORDER;
    var nextTheme = order[(this.cycle - 1) % order.length];
    if (PW.Background.setTheme(nextTheme)) this._grad = null;

    this.banner('第 ' + this.cycle + ' 轮 \u00b7 ' + PW.Background.themeName(), 2.4, '#ffe08a');
  };

  PW.Game.prototype.useBomb = function () {
    var p = this.player;
    if (this.state !== 'playing' || !p.alive || p.bombs <= 0) return;
    p.bombs -= 1;

    this.enemyBullets = [];
    for (var i = 0; i < this.enemies.length; i++) {
      if (!this.enemies[i].dead) this.enemies[i].hurt(999, this);
    }
    if (this.boss && !this.boss.dying) this.boss.hurt(120, this);

    for (var k = 0; k < 6; k++) {
      PW.Fx.explosion(rand(30, W - 30), rand(60, H - 120), k === 0);
    }
    PW.Audio.play('bomb');
    this.flash(0.85, '#ffffff');
    this.shake(8, 0.55);
  };

  /* ---------------- 碰撞 ---------------- */

  PW.Game.prototype._collisions = function () {
    var i, j, b, e, p = this.player;
    var boss = this.boss;

    for (i = 0; i < this.bullets.length; i++) {
      b = this.bullets[i];
      if (b.dead) continue;

      if (boss && !boss.dying && !boss.dead &&
          circleRect(b.x, b.y, b.r, boss.x, boss.y, boss.hw, boss.hh)) {
        var already = b.piercing && b.hitIds.indexOf(boss.uid) >= 0;
        if (!already) {
          if (b.piercing) b.hitIds.push(boss.uid);
          boss.hurt(b.dmg, this);
          PW.Fx.impact(b.x, b.y);
          if (!b.piercing) { b.dead = true; continue; }
        }
      }

      for (j = 0; j < this.enemies.length; j++) {
        e = this.enemies[j];
        if (e.dead) continue;
        if (circleRect(b.x, b.y, b.r, e.x, e.y, e.hw, e.hh)) {
          if (b.piercing) {
            if (b.hitIds.indexOf(e.uid) >= 0) continue;
            b.hitIds.push(e.uid);
          }
          e.hurt(b.dmg, this);
          if (!b.piercing) { b.dead = true; break; }
        }
      }
    }

    if (p.alive) {
      for (i = 0; i < this.enemyBullets.length; i++) {
        b = this.enemyBullets[i];
        if (b.dead) continue;
        var dx = b.x - p.x, dy = b.y - p.y;
        if (dx * dx + dy * dy < (b.r + p.radius) * (b.r + p.radius)) {
          b.dead = true;
          p.hit(this);
          if (!p.alive) break;
        }
      }
    }

    if (p.alive) {
      for (i = 0; i < this.enemies.length; i++) {
        e = this.enemies[i];
        if (e.dead) continue;
        if (circleRect(p.x, p.y, p.radius, e.x, e.y, e.hw, e.hh)) {
          e.dead = true;
          PW.Fx.explosion(e.x, e.y, false);
          PW.Audio.play('explosion', false);
          p.hit(this);
        }
      }
    }

    if (p.alive && boss && !boss.dying && !boss.dead &&
        circleRect(p.x, p.y, p.radius, boss.x, boss.y, boss.hw, boss.hh)) {
      p.hit(this);
    }

    /* 棱光 Boss 的扫射激光：点到射线的距离判定 */
    if (p.alive && boss && boss.type === 'laser' && boss.beamState === 'fire' && !boss.dying) {
      var ox = boss.x, oy = boss.y + 14;
      var rad = boss.beamAng * Math.PI / 180;
      var cosA = Math.cos(rad), sinA = Math.sin(rad);
      var rx = p.x - ox, ry = p.y - oy;
      var proj = rx * cosA + ry * sinA;
      if (proj > 0 && proj < 300) {
        var perp = Math.abs(-rx * sinA + ry * cosA);
        if (perp < 7) p.hit(this);
      }
    }

    if (p.alive) {
      for (i = 0; i < this.pickups.length; i++) {
        var pk = this.pickups[i];
        if (pk.dead) continue;
        if (circleRect(p.x, p.y, 11, pk.x, pk.y, pk.r, pk.r)) {
          pk.dead = true;
          this._collect(pk);
        }
      }
    }
  };

  PW.Game.prototype._collect = function (pk) {
    var p = this.player;
    PW.Audio.play('pickup');
    PW.Fx.impact(pk.x, pk.y);
    this.score += 50;

    if (pk.kind === 'power') {
      if (p.power < 4) p.power += 1;
      else this.score += 300;
    } else if (pk.kind === 'shield') {
      p.shieldUntil = this.clock + 6;
    } else if (pk.kind === 'health') {
      if (p.hp < p.maxHp) p.hp += 1;
    } else if (pk.kind === 'bomb') {
      if (p.bombs < 3) p.bombs += 1;
    } else if (pk.kind === 'wing') {
      p.wingUntil = this.clock + 9;
    } else if (pk.kind === 'magnet') {
      p.magnetUntil = this.clock + 8;
    } else if (pk.kind === 'rapid') {
      p.rapidUntil = this.clock + 8;
    }
  };

  /* ---------------- 杂项 ---------------- */

  PW.Game.prototype.banner = function (text, dur, color) {
    this.bannerText = text;
    this.bannerDur = dur;
    this.bannerT = dur;
    this.bannerColor = color || '#dfe9ff';
  };

  PW.Game.prototype.shake = function (mag, dur) {
    this.shakeMag = Math.max(this.shakeMag, mag);
    this.shakeT = Math.max(this.shakeT, dur);
  };

  PW.Game.prototype.flash = function (alpha, color) {
    this.flashA = Math.max(this.flashA, alpha);
    this.flashColor = color || '#ffffff';
  };

  /* ---------------- 渲染 ---------------- */

  PW.Game.prototype.render = function () {
    var ctx = this.ctx;
    if (!ctx || !PW.Assets.loaded) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 1;

    if (!this._grad) {
      var sky = PW.Background.sky();
      var g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, sky[0]);
      g.addColorStop(0.55, sky[1]);
      g.addColorStop(1, sky[2]);
      this._grad = g;
    }
    ctx.fillStyle = this._grad;
    ctx.fillRect(0, 0, W, H);

    PW.Background.draw(ctx);

    ctx.save();
    if (this.shakeT > 0 && this.shakeMag > 0) {
      ctx.translate(
        Math.round((Math.random() - 0.5) * this.shakeMag * 2),
        Math.round((Math.random() - 0.5) * this.shakeMag * 2)
      );
    }

    var i;
    for (i = 0; i < this.pickups.length; i++) this.pickups[i].draw(ctx);
    for (i = 0; i < this.enemies.length; i++) this.enemies[i].draw(ctx);
    if (this.boss && !this.boss.dead) this.boss.draw(ctx);
    this.player.draw(ctx, this);
    for (i = 0; i < this.bullets.length; i++) this.bullets[i].draw(ctx);
    for (i = 0; i < this.enemyBullets.length; i++) this.enemyBullets[i].draw(ctx);
    PW.Fx.draw(ctx);

    ctx.restore();

    if (this.state !== 'title') this.drawHud(ctx);
    this.drawBanner(ctx);

    if (this.flashA > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.85, this.flashA);
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  };

  PW.Game.prototype.drawHud = function (ctx) {
    var p = this.player;
    var i;

    /* 生命 */
    for (i = 0; i < p.hp; i++) {
      PW.Sprite.draw(ctx, 'ui_heart', 10 + i * 11, 13, { scale: 0.32 });
    }

    /* 分数 */
    ctx.save();
    ctx.font = 'bold 7px "Courier New", monospace';
    var scoreStr = String(this.score);
    var tw = ctx.measureText(scoreStr).width;
    ctx.restore();
    PW.Sprite.draw(ctx, 'ui_coin', W - 12 - tw - 10, 13, { scale: 0.3 });
    label(ctx, scoreStr, W - 10, 16, 7, '#e8f4ff', 'right', 1);

    /* 炸弹 / 火力 */
    PW.Sprite.draw(ctx, 'pickup_bomb', 12, H - 15, { scale: 0.36 });
    label(ctx, '\u00d7' + p.bombs, 21, H - 12, 6.5, '#ffd27a', 'left', 1);

    PW.Sprite.draw(ctx, 'pickup_power', 49, H - 15, { scale: 0.36 });
    label(ctx, 'Lv' + p.power, 58, H - 12, 6.5, '#8fe6ff', 'left', 1);

    /* 新道具 buff 的剩余时间条 */
    var buffs = [
      { until: p.rapidUntil, frame: 'pickup_rapid', color: '#8fe6ff' },
      { until: p.magnetUntil, frame: 'pickup_magnet', color: '#c79bff' },
      { until: p.wingUntil, frame: 'pickup_wing', color: '#7dffd2' }
    ];
    var bx0 = 78;
    for (i = 0; i < buffs.length; i++) {
      if (buffs[i].until <= this.clock) continue;
      PW.Sprite.draw(ctx, buffs[i].frame, bx0, H - 15, { scale: 0.34 });
      var left = Math.max(0, Math.min(1, (buffs[i].until - this.clock) / 8));
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(bx0 - 6, H - 8, 12, 2);
      ctx.fillStyle = buffs[i].color;
      ctx.fillRect(bx0 - 6, H - 8, Math.round(12 * left), 1);
      bx0 += 21;
    }

    /* Boss 血条 + 名称 */
    var b = this.boss;
    if (b && !b.dead) {
      PW.Sprite.draw(ctx, 'ui_gem', 53, 24, { scale: 0.3 });
      label(ctx, b.name, 60, 14, 5.5, '#ffb8c6', 'left', 0.92);
      var bx = 60, by = 21, bw = 116, bh = 4;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
      ctx.fillStyle = b.phase === 1 ? '#ff5d5d' : b.phase === 2 ? '#ffb347' : '#ff3bd4';
      var fw = Math.round(bw * Math.max(0, b.hp / b.maxHp));
      if (fw > 0) ctx.fillRect(bx, by, fw, bh);
      ctx.strokeStyle = 'rgba(160,200,255,0.5)';
      ctx.strokeRect(bx - 0.5, by - 0.5, bw + 1, bh + 1);
    }
  };

  PW.Game.prototype.drawBanner = function (ctx) {
    if (this.bannerT <= 0 || !this.bannerText) return;
    var a = Math.min(1, Math.min((this.bannerDur - this.bannerT) / 0.3, this.bannerT / 0.4));
    if (a <= 0) return;

    var y = H * 0.4;
    label(ctx, this.bannerText, W / 2, y, 13, this.bannerColor, 'center', a);
    PW.Sprite.draw(ctx, 'ui_star', W / 2 - 44, y, { scale: 0.32, alpha: a });
    PW.Sprite.draw(ctx, 'ui_star', W / 2 + 44, y, { scale: 0.32, alpha: a });
  };
})();
