/* ============================================================
 * js/entities.js —— 玩家 / 子弹 / 敌机 / Boss / 道具
 * 坐标单位：世界逻辑像素（图集帧 logicalSize），原点左上。
 * ============================================================ */
(function () {
  'use strict';

  var W = PW.CONFIG.W, H = PW.CONFIG.H;

  /* 旋转绘制（追踪导弹用），角度为「朝上为 0」的航向角 */
  function drawRot(ctx, name, x, y, angle, scale) {
    var f = PW.Assets.frame(name);
    if (!f || !PW.Assets.loaded) return;
    var w = Math.round(f.logicalSize[0] * scale);
    var h = Math.round(f.logicalSize[1] * scale);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.drawImage(PW.Assets.img, f.frame.x, f.frame.y, f.frame.w, f.frame.h, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  function angleTo(x1, y1, x2, y2) {
    return Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
  }

  /* ============================================================
   * 子弹
   * ============================================================ */
  PW.Bullet = function (o) {
    this.x = o.x;
    this.y = o.y;
    this.vx = o.vx || 0;
    this.vy = o.vy || 0;
    this.frameName = o.frame;
    this.r = o.r == null ? 4 : o.r;
    this.dmg = o.dmg == null ? 1 : o.dmg;
    this.owner = o.owner || 'player';
    this.scale = o.scale == null ? 1 : o.scale;
    this.piercing = !!o.piercing;
    this.homing = !!o.homing;
    this.life = o.life == null ? 5 : o.life;
    this.t = 0;
    this.rot = 0;
    this.dead = false;
    this.hitIds = this.piercing ? [] : null;
  };

  PW.Bullet.prototype.update = function (dt, game) {
    if (this.dead) return;

    if (this.homing) {
      var target = game.nearestTarget(this.x, this.y);
      if (target) {
        var speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy) || 1;
        var cur = Math.atan2(this.vx, -this.vy);
        var want = Math.atan2(target.x - this.x, -(target.y - this.y));
        var diff = want - cur;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        cur += Math.max(-4.2 * dt, Math.min(4.2 * dt, diff));
        this.vx = Math.sin(cur) * speed;
        this.vy = -Math.cos(cur) * speed;
        this.rot = cur;
      }
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.t += dt;
    this.life -= dt;

    if (this.life <= 0 || this.x < -40 || this.x > W + 40 || this.y < -60 || this.y > H + 60) {
      this.dead = true;
    }
  };

  PW.Bullet.prototype.draw = function (ctx) {
    if (this.rot) {
      drawRot(ctx, this.frameName, this.x, this.y, this.rot, this.scale);
    } else {
      PW.Sprite.draw(ctx, this.frameName, this.x, this.y, { scale: this.scale });
    }
  };

  /* ============================================================
   * 玩家
   * ============================================================ */
  PW.Player = function (game) {
    this.game = game;
    this.radius = 7;
    this.reset();
  };

  PW.Player.prototype.reset = function () {
    this.x = W / 2;
    this.y = H - 64;
    this.hp = 3;
    this.maxHp = 5;
    this.power = 1;
    this.bombs = 1;
    this.alive = true;
    this.shieldUntil = 0;
    this.invUntil = 0;
    this.fireCd = 0.3;
    this.vx = 0;
    this.drag = false;
    this.offX = 0;
    this.offY = 0;
    this.hitAnim = new PW.Anim('player_hit_blink');
  };

  PW.Player.prototype.update = function (dt) {
    var keys = PW.Input.keys();
    var p = PW.Input.pointer;
    var kx = 0, ky = 0;
    if (keys.KeyA || keys.a || keys.ArrowLeft) kx -= 1;
    if (keys.KeyD || keys.d || keys.ArrowRight) kx += 1;
    if (keys.KeyW || keys.w || keys.ArrowUp) ky -= 1;
    if (keys.KeyS || keys.s || keys.ArrowDown) ky += 1;

    var oldX = this.x, oldY = this.y;

    if (kx || ky) {
      var len = Math.sqrt(kx * kx + ky * ky);
      this.x += (kx / len) * PW.CONFIG.PLAYER_SPEED * dt;
      this.y += (ky / len) * PW.CONFIG.PLAYER_SPEED * dt;
      this.drag = false;
    } else if (p.touch) {
      /* 触控：按下时记录相对偏移，拖动时整机跟随，避免手指落下瞬间跳变 */
      if (p.down) {
        if (!this.drag) {
          this.drag = true;
          this.offX = this.x - p.x;
          this.offY = this.y - p.y;
        }
        var tx = p.x + this.offX, ty = p.y + this.offY;
        this.x += (tx - this.x) * Math.min(1, dt * 20);
        this.y += (ty - this.y) * Math.min(1, dt * 20);
      } else {
        this.drag = false;
      }
    } else {
      /* 鼠标：在画布内直接跟随 */
      this.drag = false;
      if (p.hover) {
        this.x += (p.x - this.x) * Math.min(1, dt * 22);
        this.y += (p.y - this.y) * Math.min(1, dt * 22);
      }
    }

    this.x = Math.max(16, Math.min(W - 16, this.x));
    this.y = Math.max(30, Math.min(H - 22, this.y));

    this.vx = dt > 0 ? (this.x - oldX) / dt : 0;

    if (this.shieldUntil && this.shieldUntil <= this.game.clock) this.shieldUntil = 0;

    if (!this.alive) return;

    if (this.invUntil > this.game.clock) this.hitAnim.update(dt);

    this.fireCd -= dt;
    if (this.fireCd <= 0) {
      this.fireCd = PW.CONFIG.FIRE['l' + this.power] || 0.16;
      this.fire(this.game);
    }
  };

  PW.Player.prototype.fire = function (game) {
    var y = this.y - 18;
    var p = this.power;

    if (p === 1) {
      game.addPlayerBullet({ x: this.x, y: y, vy: -420, frame: 'bullet_player_basic', dmg: 1, r: 4 });
      PW.Audio.play('shoot');
      PW.Fx.muzzle(this.x, y - 2);
    } else if (p === 2) {
      game.addPlayerBullet({ x: this.x - 6, y: y + 2, vy: -420, frame: 'bullet_player_basic', dmg: 1, r: 4 });
      game.addPlayerBullet({ x: this.x + 6, y: y + 2, vy: -420, frame: 'bullet_player_basic', dmg: 1, r: 4 });
      PW.Audio.play('shoot');
      PW.Fx.muzzle(this.x, y - 2);
    } else if (p === 3) {
      game.addPlayerBullet({ x: this.x, y: y, vy: -440, frame: 'bullet_player_power', dmg: 2, r: 5 });
      var rad = 12 * Math.PI / 180;
      game.addPlayerBullet({ x: this.x - 7, y: y + 4, vx: -Math.sin(rad) * 430, vy: -Math.cos(rad) * 430, frame: 'bullet_player_power', dmg: 2, r: 5 });
      game.addPlayerBullet({ x: this.x + 7, y: y + 4, vx: Math.sin(rad) * 430, vy: -Math.cos(rad) * 430, frame: 'bullet_player_power', dmg: 2, r: 5 });
      PW.Audio.play('shootBig');
      PW.Fx.muzzle(this.x, y - 2);
    } else {
      /* L4：中央激光柱 + 两枚追踪导弹 */
      game.addPlayerBullet({
        x: this.x, y: y - 10, vy: -540, frame: 'bullet_player_laser',
        dmg: 2, r: 6, piercing: true, life: 2
      });
      game.addPlayerBullet({
        x: this.x - 11, y: y + 6, vy: -300, frame: 'bullet_player_missile',
        dmg: 2, r: 5, homing: true, life: 2.6
      });
      game.addPlayerBullet({
        x: this.x + 11, y: y + 6, vy: -300, frame: 'bullet_player_missile',
        dmg: 2, r: 5, homing: true, life: 2.6
      });
      PW.Audio.play('shootBig');
      PW.Fx.muzzle(this.x, y - 4);
    }
  };

  /* 返回 true 表示这次碰撞被处理（无论是否真的掉血） */
  PW.Player.prototype.hit = function (game) {
    if (!this.alive) return false;
    if (this.invUntil > game.clock) return false;

    if (this.shieldUntil > game.clock) {
      this.shieldUntil = 0;
      this.invUntil = game.clock + 0.8;
      PW.Fx.shieldBreak(this.x, this.y);
      PW.Audio.play('hit');
      game.shake(3, 0.25);
      return true;
    }

    this.hp -= 1;
    if (this.power > 1) this.power -= 1;
    this.invUntil = game.clock + 1.5;
    this.hitAnim.t = 0;
    this.hitAnim.i = 0;
    this.hitAnim.done = false;

    PW.Audio.play('hit');
    game.shake(5, 0.35);
    game.flash(0.22, '#ff5566');

    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      PW.Fx.explosion(this.x, this.y, true);
      PW.Audio.play('explosion', true);
      game.shake(9, 0.7);
    }
    return true;
  };

  PW.Player.prototype.draw = function (ctx, game) {
    if (!this.alive) return;
    var name;
    if (this.shieldUntil > game.clock) {
      name = 'player_shielded';
    } else if (this.invUntil > game.clock) {
      name = this.hitAnim.frame() || 'player_hit';
    } else if (Math.abs(this.vx) > 35) {
      name = this.vx < 0 ? 'player_bank_left' : 'player_bank_right';
    } else {
      name = 'player_idle';
    }
    PW.Sprite.draw(ctx, name, this.x, this.y);
  };

  /* ============================================================
   * 敌机（6 种，数据对齐图集 aircraft 分区）
   * ============================================================ */
  PW.ENEMY_UID = 0;

  PW.ENEMY_TYPES = {
    small_a: { frame: 'enemy_small_a', hp: 1, speed: 55, score: 20, drop: 0.06, pattern: 'straight' },
    small_b: { frame: 'enemy_small_b', hp: 1, speed: 62, score: 25, drop: 0.06, pattern: 'sine' },
    medium_a: { frame: 'enemy_medium_a', hp: 3, speed: 42, score: 60, drop: 0.13, pattern: 'sine' },
    medium_b: { frame: 'enemy_medium_b', hp: 4, speed: 48, score: 80, drop: 0.16, pattern: 'dive', fire: 'dart', fireStage: 3, fireCd: 2.6 },
    heavy: { frame: 'enemy_heavy', hp: 9, speed: 36, score: 180, drop: 0.32, pattern: 'straight', fire: 'orbFan', fireStage: 4, fireCd: 2.0 },
    heavy_elite: { frame: 'enemy_heavy_elite', hp: 12, speed: 34, score: 300, drop: 0.42, pattern: 'sine', fire: 'ring', fireStage: 4, fireCd: 2.4 }
  };

  PW.Enemy = function (game, type, x, y, opt) {
    opt = opt || {};
    var cfg = PW.ENEMY_TYPES[type];
    var f = PW.Assets.frame(cfg.frame);
    this.uid = ++PW.ENEMY_UID;
    this.game = game;
    this.type = type;
    this.cfg = cfg;
    this.frameName = cfg.frame;
    this.w = f ? f.logicalSize[0] : 22;
    this.h = f ? f.logicalSize[1] : 22;
    this.hw = this.w * 0.42;
    this.hh = this.h * 0.42;
    this.x = x;
    this.y = y == null ? -30 : y;
    this.baseX = x;
    this.phase = opt.phase || 0;
    this.pattern = opt.pattern || cfg.pattern;
    this.hp = Math.max(1, Math.round(cfg.hp * Math.pow(1.25, game.cycle - 1)));
    this.maxHp = this.hp;
    this.speed = cfg.speed * Math.min(1.8, Math.pow(1.12, game.cycle - 1));
    this.t = this.phase;
    this.flash = 0;
    this.dead = false;
    this.fireCd = cfg.fireCd ? cfg.fireCd * (0.6 + Math.random() * 0.6) : 0;
  };

  PW.Enemy.prototype.hurt = function (dmg, game) {
    if (this.dead) return;
    this.hp -= dmg;
    this.flash = 0.12;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      game.onEnemyKilled(this);
    } else {
      PW.Fx.impact(this.x, this.y + (Math.random() - 0.5) * 6);
    }
  };

  PW.Enemy.prototype.update = function (dt, game) {
    if (this.dead) return;
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt);

    switch (this.pattern) {
      case 'sine':
        this.y += this.speed * dt;
        this.x = this.baseX + Math.sin(this.t * 2.2) * 26;
        break;
      case 'group':
        this.y += this.speed * dt;
        this.x = this.baseX + Math.sin(this.t * 2.6) * 34;
        break;
      case 'dive':
        this.y += this.speed * 1.25 * dt;
        this.x += (game.player.x - this.x) * 0.5 * dt;
        break;
      default:
        this.y += this.speed * dt;
        this.x += Math.sin(this.t * 1.2) * 6 * dt;
    }

    this.x = Math.max(12, Math.min(W - 12, this.x));

    if (this.y > H + 46 || this.x < -70 || this.x > W + 70) {
      this.dead = true;
      return;
    }

    var cfg = this.cfg;
    if (cfg.fire && game.stage >= cfg.fireStage && this.y > 20 && this.y < H * 0.66) {
      this.fireCd -= dt;
      if (this.fireCd <= 0) {
        this.fireCd = cfg.fireCd || 2;
        this.fire(game);
      }
    }
  };

  PW.Enemy.prototype.fire = function (game) {
    var kind = this.cfg.fire;
    var i, a, n;
    if (kind === 'dart') {
      var aim = angleTo(this.x, this.y, game.player.x, game.player.y);
      game.spawnEnemyBullet(this.x, this.y + this.h / 2 - 4, aim, 132, 'bullet_enemy_dart', 1, 4);
    } else if (kind === 'orbFan') {
      for (i = -1; i <= 1; i++) {
        a = 90 + i * 22;
        game.spawnEnemyBullet(this.x, this.y + this.h / 2 - 4, a, 96, 'bullet_enemy_orb', 1, 5.5);
      }
    } else if (kind === 'ring') {
      n = 8;
      for (i = 0; i < n; i++) {
        a = i * (360 / n) + this.t * 12;
        game.spawnEnemyBullet(this.x, this.y + 4, a, 88, 'bullet_enemy_ring', 1, 5.5);
      }
    }
  };

  PW.Enemy.prototype.draw = function (ctx) {
    PW.Sprite.draw(ctx, this.frameName, this.x, this.y);
    if (this.flash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, this.flash * 5) * 0.55;
      PW.Sprite.draw(ctx, this.frameName, this.x, this.y);
      ctx.restore();
    }
    /* 重型/精英显示小血条 */
    if (this.maxHp >= 8) {
      var bw = Math.max(18, this.w * 0.7);
      var bx = Math.round(this.x - bw / 2);
      var by = Math.round(this.y - this.h / 2 - 6);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(bx - 1, by - 1, bw + 2, 3);
      ctx.fillStyle = '#ff6b6b';
      ctx.fillRect(bx, by, Math.round(bw * (this.hp / this.maxHp)), 1);
    }
  };

  /* ============================================================
   * Boss（单张 boss_heavy，三阶段弹幕）
   * ============================================================ */
  PW.Boss = function (game, cycle) {
    this.uid = ++PW.ENEMY_UID;
    this.game = game;
    this.x = W / 2;
    this.y = -56;
    this.hw = 34;
    this.hh = 24;
    this.maxHp = Math.round(600 * Math.pow(1.25, cycle - 1));
    this.hp = this.maxHp;
    this.t = 0;
    this.phase = 1;
    this.fireCd = 1.3;
    this.flash = 0;
    this.entering = true;
    this.dying = false;
    this.dead = false;
    this.deathT = 0;
    this.deathStep = -1;
    this.ringOff = 0;
  };

  PW.Boss.prototype.hurt = function (dmg, game) {
    if (this.dying || this.dead) return;
    this.hp -= dmg;
    this.flash = 0.1;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dying = true;
      this.deathT = 0;
      this.deathStep = -1;
      PW.Audio.play('bossDie');
      game.shake(6, 0.8);
    }
  };

  PW.Boss.prototype.update = function (dt, game) {
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt);
    var ratio = this.hp / this.maxHp;
    this.phase = ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3;

    if (this.dying) {
      this.deathT += dt;
      var step = Math.floor(this.deathT / 0.16);
      while (this.deathStep < step) {
        this.deathStep++;
        PW.Fx.explosion(
          this.x + (Math.random() - 0.5) * 62,
          this.y + (Math.random() - 0.5) * 40,
          Math.random() < 0.35
        );
        PW.Audio.play('explosion', false);
      }
      if (this.deathT > 1.5) {
        this.dead = true;
        game.onBossKilled(this);
      }
      return;
    }

    if (this.entering) {
      this.y += 42 * dt;
      if (this.y >= 66) {
        this.y = 66;
        this.entering = false;
      }
      return;
    }

    var amp = this.phase === 3 ? 62 : 48;
    this.x = W / 2 + Math.sin(this.t * (this.phase === 3 ? 0.9 : 0.6)) * amp;

    this.fireCd -= dt;
    if (this.fireCd <= 0) this.fire(game);
  };

  PW.Boss.prototype.fire = function (game) {
    var p = game.player;
    var i, a, n;
    if (this.phase === 1) {
      n = 7;
      for (i = 0; i < n; i++) {
        a = 90 - 40 + i * (80 / (n - 1));
        game.spawnEnemyBullet(this.x, this.y + 18, a, 88, 'bullet_enemy_orb', 1, 5.5);
      }
      this.fireCd = 1.2;
      PW.Audio.play('shoot');
    } else if (this.phase === 2) {
      var aim = angleTo(this.x, this.y + 16, p.x, p.y);
      var offs = [-9, 0, 9];
      var spd = [145, 180, 215];
      for (i = 0; i < 3; i++) {
        game.spawnEnemyBullet(this.x, this.y + 16, aim + offs[i], spd[i], 'bullet_enemy_dart', 1, 4);
      }
      this.fireCd = 0.9;
      PW.Audio.play('shootBig');
    } else {
      this.ringOff += 0.28;
      n = 16;
      for (i = 0; i < n; i++) {
        a = this.ringOff + i * (360 / n);
        game.spawnEnemyBullet(this.x, this.y + 4, a, 82, 'bullet_enemy_ring', 1, 5.5);
      }
      var aim2 = angleTo(this.x, this.y + 12, p.x, p.y);
      game.spawnEnemyBullet(this.x - 22, this.y + 8, aim2, 72, 'bullet_enemy_plasma', 1, 7);
      game.spawnEnemyBullet(this.x + 22, this.y + 8, aim2, 72, 'bullet_enemy_plasma', 1, 7);
      this.fireCd = 1.6;
      PW.Audio.play('shootBig');
    }
  };

  PW.Boss.prototype.draw = function (ctx) {
    PW.Sprite.draw(ctx, 'boss_heavy', this.x, this.y);
    if (this.flash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, this.flash * 6) * 0.6;
      PW.Sprite.draw(ctx, 'boss_heavy', this.x, this.y);
      ctx.restore();
    }
  };

  /* ============================================================
   * 道具
   * ============================================================ */
  PW.PICKUP_FRAMES = {
    power: 'pickup_power',
    shield: 'pickup_shield',
    health: 'pickup_health',
    bomb: 'pickup_bomb'
  };

  PW.Pickup = function (x, y, kind) {
    this.x = x;
    this.y = y;
    this.kind = kind;
    this.frameName = PW.PICKUP_FRAMES[kind];
    this.vy = 46;
    this.t = 0;
    this.dead = false;
    this.r = 9;
  };

  PW.Pickup.prototype.update = function (dt) {
    this.t += dt;
    this.y += this.vy * dt;
    this.x += Math.sin(this.t * 2.4) * 10 * dt;
    if (this.y > H + 20) this.dead = true;
  };

  PW.Pickup.prototype.draw = function (ctx) {
    var pulse = 0.72 + Math.sin(this.t * 4) * 0.05;
    PW.Sprite.draw(ctx, this.frameName, this.x, this.y, { scale: pulse });
  };
})();
