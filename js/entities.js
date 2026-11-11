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
   * 玩家皮肤（只换外观，数值完全一致）
   * ============================================================ */
  PW.SKINS = [
    { id: 'azure', name: '苍蓝', prefix: 'player', hitAnim: 'player_hit_blink', shielded: 'player_shielded' },
    { id: 'verdant', name: '苍穹', prefix: 'player2', hitAnim: 'player2_hit_blink', shielded: 'player2_shielded' },
    { id: 'ember', name: '烈焰', prefix: 'player3', hitAnim: 'player3_hit_blink', shielded: 'player3_shielded' }
  ];

  PW.Skin = (function () {
    var KEY = 'planeWarSkin';
    var current = 'azure';

    function find(id) {
      for (var i = 0; i < PW.SKINS.length; i++) {
        if (PW.SKINS[i].id === id) return PW.SKINS[i];
      }
      return null;
    }

    try {
      var saved = localStorage.getItem(KEY);
      if (saved && find(saved)) current = saved;
    } catch (e) {}

    return {
      list: PW.SKINS,
      id: function () { return current; },
      def: function () { return find(current) || PW.SKINS[0]; },
      set: function (id) {
        if (!find(id)) return false;
        current = id;
        try { localStorage.setItem(KEY, id); } catch (e) {}
        return true;
      }
    };
  })();

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
    this.rapidUntil = 0;
    this.magnetUntil = 0;
    this.wingUntil = 0;
    this.setSkin();
  };

  PW.Player.prototype.setSkin = function (def) {
    this.skin = def || PW.Skin.def();
    this.hitAnim = new PW.Anim(this.skin.hitAnim);
    this.hitAnim.t = 0;
    this.hitAnim.i = 0;
    this.hitAnim.done = false;
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
    if (this.rapidUntil && this.rapidUntil <= this.game.clock) this.rapidUntil = 0;
    if (this.magnetUntil && this.magnetUntil <= this.game.clock) this.magnetUntil = 0;
    if (this.wingUntil && this.wingUntil <= this.game.clock) this.wingUntil = 0;

    if (!this.alive) return;

    if (this.invUntil > this.game.clock) this.hitAnim.update(dt);

    this.fireCd -= dt;
    if (this.fireCd <= 0) {
      var base = PW.CONFIG.FIRE['l' + this.power] || 0.16;
      this.fireCd = this.rapidUntil > this.game.clock ? base * 0.55 : base;
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

    /* 僚机道具：两侧同时补射轻弹 */
    if (this.wingUntil > game.clock) {
      var bob = Math.sin(game.clock * 6) * 1;
      game.addPlayerBullet({ x: this.x - 17, y: this.y + 9 + bob, vy: -400, frame: 'bullet_player_wing', dmg: 1, r: 3 });
      game.addPlayerBullet({ x: this.x + 17, y: this.y + 9 + bob, vy: -400, frame: 'bullet_player_wing', dmg: 1, r: 3 });
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
    var skin = this.skin || PW.Skin.def();
    var name;
    if (this.shieldUntil > game.clock) {
      name = skin.shielded;
    } else if (this.invUntil > game.clock) {
      name = this.hitAnim.frame() || (skin.prefix + '_hit');
    } else if (Math.abs(this.vx) > 35) {
      name = skin.prefix + (this.vx < 0 ? '_bank_left' : '_bank_right');
    } else {
      name = skin.prefix + '_idle';
    }

    var i, wx, wy;
    if (this.wingUntil > game.clock) {
      for (i = -1; i <= 1; i += 2) {
        wx = this.x + i * 17;
        wy = this.y + 9 + Math.sin(game.clock * 6 + i) * 1.2;
        PW.Sprite.draw(ctx, 'ally_wing', wx, wy, { alpha: 0.92 });
      }
    }

    PW.Sprite.draw(ctx, name, this.x, this.y);
  };

  /* ============================================================
   * 敌机（11 种，数据对齐图集 aircraft 分区）
   * pattern: straight/sine/group/dive/drone/kamikaze/orbit/hover
   * ============================================================ */
  PW.ENEMY_UID = 0;

  PW.ENEMY_TYPES = {
    small_a: { frame: 'enemy_small_a', hp: 1, speed: 55, score: 20, drop: 0.06, pattern: 'straight' },
    small_b: { frame: 'enemy_small_b', hp: 1, speed: 62, score: 25, drop: 0.06, pattern: 'sine' },
    medium_a: { frame: 'enemy_medium_a', hp: 3, speed: 42, score: 60, drop: 0.13, pattern: 'sine' },
    medium_b: { frame: 'enemy_medium_b', hp: 4, speed: 48, score: 80, drop: 0.16, pattern: 'dive', fire: 'dart', fireStage: 3, fireCd: 2.6 },
    heavy: { frame: 'enemy_heavy', hp: 9, speed: 36, score: 180, drop: 0.32, pattern: 'straight', fire: 'orbFan', fireStage: 4, fireCd: 2.0 },
    heavy_elite: { frame: 'enemy_heavy_elite', hp: 12, speed: 34, score: 300, drop: 0.42, pattern: 'sine', fire: 'ring', fireStage: 4, fireCd: 2.4 },

    /* —— 新增：行为各不相同的五种 —— */
    /* 小型无人机：速度快、小幅蛇形，纯数量压制 */
    drone: { frame: 'enemy_drone', hp: 1, speed: 82, score: 30, drop: 0.05, pattern: 'drone' },
    /* 自爆冲撞机：锁定玩家位置持续加速度直冲，撞到就爆 */
    ram: { frame: 'enemy_ram', hp: 2, speed: 92, score: 45, drop: 0.1, pattern: 'kamikaze' },
    /* 轨道机：降到半空绕圈，绕满一圈后突进 */
    orbiter: { frame: 'enemy_orbiter', hp: 4, speed: 58, score: 90, drop: 0.2, pattern: 'orbit', fire: 'burst', fireStage: 3, fireCd: 2.3 },
    /* 护盾机：外层能量盾先吸收伤害，破盾后本体很脆 */
    shielded: { frame: 'enemy_shielded', hp: 5, speed: 34, score: 150, drop: 0.28, pattern: 'sine', shield: 4, fire: 'dart', fireStage: 4, fireCd: 2.8 },
    /* 远程炮台：悬停在半空连发火箭，超时后离场 */
    turret: { frame: 'enemy_turret', hp: 8, speed: 24, score: 220, drop: 0.36, pattern: 'hover', fire: 'rockets', fireStage: 4, fireCd: 2.0 }
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
    this.shield = Math.round((cfg.shield || 0) * Math.pow(1.2, game.cycle - 1));
    this.maxShield = this.shield;
    this.speed = cfg.speed * Math.min(1.8, Math.pow(1.12, game.cycle - 1));
    this.t = this.phase;
    this.flash = 0;
    this.dead = false;
    this.fireCd = cfg.fireCd ? cfg.fireCd * (0.6 + Math.random() * 0.6) : 0;

    /* 新行为用到的运行时状态 */
    this.age = 0;
    this.holdY = H * (0.24 + Math.random() * 0.07);
    this.orbitA = Math.random() * Math.PI * 2;
    this.orbitT = 0;
    this.dashing = false;
    this.dashA = 90;
    this.aimed = null;
    this.aimT = 0;
    this.ramT = 0;
    this.trailCd = 0;
  };

  PW.Enemy.prototype.hurt = function (dmg, game) {
    if (this.dead) return;

    /* 护盾优先吸收：护盾存在时本体不掉血 */
    if (this.shield > 0) {
      this.shield -= dmg;
      this.flash = 0.12;
      PW.Fx.impact(this.x, this.y + (Math.random() - 0.5) * 6);
      if (this.shield <= 0) {
        this.shield = 0;
        PW.Fx.shockwave(this.x, this.y, 0.7);
        PW.Audio.play('hit');
      }
      return;
    }

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
    this.age += dt;
    this.flash = Math.max(0, this.flash - dt);

    var rr, sp;

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
      case 'drone':
        this.y += this.speed * dt;
        this.x = this.baseX + Math.sin(this.t * 4.4) * 12;
        break;
      case 'kamikaze':
        /* 每 0.42s 重新锁定玩家，随时间加速，带尾烟提示 */
        this.ramT += dt;
        this.aimT -= dt;
        if (this.aimed == null || this.aimT <= 0) {
          this.aimT = 0.42;
          this.aimed = angleTo(this.x, this.y, game.player.x, game.player.y);
        }
        rr = this.aimed * Math.PI / 180;
        sp = this.speed * (1 + Math.min(1.1, this.ramT * 0.7));
        this.x += Math.cos(rr) * sp * dt;
        this.y += Math.sin(rr) * sp * dt;
        this.trailCd -= dt;
        if (this.trailCd <= 0) {
          this.trailCd = 0.12;
          PW.Fx.smoke(this.x, this.y - 4, 0.26, 0.32);
        }
        break;
      case 'orbit':
        this.baseX = Math.max(46, Math.min(W - 46, this.baseX));
        if (this.y < this.holdY) {
          this.y += this.speed * dt;
        } else if (!this.dashing) {
          this.orbitA += dt * 2.1;
          this.x = this.baseX + Math.cos(this.orbitA) * 40;
          this.y = this.holdY + Math.sin(this.orbitA) * 13;
          this.orbitT += dt;
          if (this.orbitT > 3.6) {
            this.dashing = true;
            this.dashA = angleTo(this.x, this.y, game.player.x, game.player.y);
          }
        } else {
          rr = this.dashA * Math.PI / 180;
          this.x += Math.cos(rr) * this.speed * 1.9 * dt;
          this.y += Math.sin(rr) * this.speed * 1.9 * dt;
        }
        break;
      case 'hover':
        if (this.y < this.holdY) {
          this.y += this.speed * dt;
        } else if (this.age < 20) {
          this.x = this.baseX + Math.sin(this.t * 0.9) * 16;
        } else {
          this.y -= this.speed * 1.4 * dt;
        }
        break;
      default:
        this.y += this.speed * dt;
        this.x += Math.sin(this.t * 1.2) * 6 * dt;
    }

    this.x = Math.max(12, Math.min(W - 12, this.x));

    if (this.y > H + 46 || this.y < -90 || this.x < -70 || this.x > W + 70) {
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
    var i, a, n, aim;
    if (kind === 'dart') {
      aim = angleTo(this.x, this.y, game.player.x, game.player.y);
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
    } else if (kind === 'burst') {
      /* 轨道机：三连瞄准散弹 */
      aim = angleTo(this.x, this.y, game.player.x, game.player.y);
      for (i = -1; i <= 1; i++) {
        game.spawnEnemyBullet(this.x, this.y + this.h / 2 - 4, aim + i * 10, 158, 'bullet_enemy_dart', 1, 4);
      }
    } else if (kind === 'rockets') {
      /* 炮台：双联火箭 */
      aim = angleTo(this.x, this.y, game.player.x, game.player.y);
      game.spawnEnemyBullet(this.x - 6, this.y + this.h / 2 - 4, aim - 4, 150, 'bullet_enemy_missile', 1, 5);
      game.spawnEnemyBullet(this.x + 6, this.y + this.h / 2 - 4, aim + 4, 150, 'bullet_enemy_missile', 1, 5);
    }
  };

  PW.Enemy.prototype.draw = function (ctx) {
    /* 护盾机：外层能量环 */
    if (this.shield > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(120,220,255,' + (0.32 + 0.42 * (this.shield / Math.max(1, this.maxShield))) + ')';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.w * 0.62, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    PW.Sprite.draw(ctx, this.frameName, this.x, this.y);
    if (this.flash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, this.flash * 5) * 0.55;
      PW.Sprite.draw(ctx, this.frameName, this.x, this.y);
      ctx.restore();
    }
    /* 重型/精英/炮台显示小血条 */
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
   * Boss（4 种，移动方式 / 弹幕 / 召唤各不相同）
   * ============================================================ */
  PW.BOSSES = {
    heavy: { name: '铁壁·重装舰', frame: 'boss_heavy', hp: 600, hw: 34, hh: 24 },
    twin: { name: '双子·镜像舰', frame: 'boss_twin', hp: 640, hw: 31, hh: 22 },
    laser: { name: '棱光·仲裁者', frame: 'boss_laser', hp: 700, hw: 30, hh: 21 },
    hive: { name: '蜂巢·母舰', frame: 'boss_hive', hp: 680, hw: 32, hh: 22 }
  };
  PW.BOSS_ORDER = ['heavy', 'twin', 'laser', 'hive'];

  PW.Boss = function (game, cycle, type) {
    this.uid = ++PW.ENEMY_UID;
    this.game = game;
    this.cycle = cycle;
    this.type = type || PW.BOSS_ORDER[(cycle - 1) % PW.BOSS_ORDER.length];

    var def = PW.BOSSES[this.type] || PW.BOSSES.heavy;
    this.def = def;
    this.name = def.name;
    this.frameName = def.frame;
    this.x = W / 2;
    this.y = -56;
    this.hw = def.hw;
    this.hh = def.hh;
    this.maxHp = Math.round(def.hp * Math.pow(1.25, cycle - 1));
    this.hp = this.maxHp;
    this.t = 0;
    this.phase = 1;
    this.lastPhase = 1;
    this.fireCd = 1.3;
    this.flash = 0;
    this.entering = true;
    this.dying = false;
    this.dead = false;
    this.deathT = 0;
    this.deathStep = -1;
    this.ringOff = 0;

    /* 棱光 Boss：idle -> charge -> fire 的扫射激光 */
    this.beamState = 'idle';
    this.beamT = 0;
    this.beamAng = 90;
    this.beamSweep = 1;
    this.beamCd = 5;
    /* 蜂巢 Boss：召唤僚机计时 */
    this.minionCd = 3.4;
  };

  PW.Boss.prototype.hurt = function (dmg, game) {
    if (this.dying || this.dead) return;
    this.hp -= dmg;
    this.flash = 0.1;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dying = true;
      this.beamState = 'idle';
      this.deathT = 0;
      this.deathStep = -1;
      PW.Audio.play('bossDie');
      game.shake(6, 0.8);
    }
  };

  PW.Boss.prototype.update = function (dt, game) {
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt);

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

    var ratio = this.hp / this.maxHp;
    this.phase = ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3;
    if (this.phase > this.lastPhase) {
      this.lastPhase = this.phase;
      PW.Fx.shockwave(this.x, this.y, 1.6);
      PW.Audio.play('warn');
    }

    if (this.entering) {
      this.y += 42 * dt;
      if (this.y >= 66) {
        this.y = 66;
        this.entering = false;
      }
      return;
    }

    /* 移动方式按 Boss 类型区分 */
    if (this.type === 'twin') {
      this.x = W / 2 + Math.sin(this.t * 0.75) * 62;
      this.y = 66 + Math.sin(this.t * 1.5) * 8;
    } else if (this.type === 'laser') {
      this.x = W / 2 + Math.sin(this.t * 0.45) * 40;
      this.y = 66 + Math.sin(this.t * 0.9) * 4;
    } else if (this.type === 'hive') {
      this.x = W / 2 + Math.sin(this.t * 0.4) * 30;
      this.y = 68 + Math.sin(this.t * 0.8) * 5;
    } else {
      var amp = this.phase === 3 ? 62 : 48;
      this.x = W / 2 + Math.sin(this.t * (this.phase === 3 ? 0.9 : 0.6)) * amp;
    }

    if (this.type === 'hive') this.updateMinions(dt, game);

    if (this.type === 'laser') {
      this.updateBeam(dt, game);
      if (this.beamState === 'fire') return; /* 扫射期间不叠加普通弹幕 */
    }

    this.fireCd -= dt;
    if (this.fireCd <= 0) this.fire(game);
  };

  /* 蜂巢：定期从机库放出无人机 / 小型机 */
  PW.Boss.prototype.updateMinions = function (dt, game) {
    if (game.enemies.length >= 22) return;
    this.minionCd -= dt;
    if (this.minionCd > 0) return;
    this.minionCd = this.phase === 3 ? 2.4 : this.phase === 2 ? 3.2 : 4.2;

    var n = this.phase === 1 ? 2 : this.phase === 2 ? 3 : 4;
    for (var i = 0; i < n; i++) {
      var off = (i - (n - 1) / 2) * 20;
      game.spawnMinion(i % 2 === 0 ? 'drone' : 'small_b', this.x + off, this.y + 12);
    }
    PW.Fx.impact(this.x, this.y + 16);
  };

  /* 棱光：充能 -> 锁定 -> 扫射 */
  PW.Boss.prototype.updateBeam = function (dt, game) {
    var p = game.player;

    if (this.beamState === 'idle') {
      this.beamCd -= dt;
      if (this.phase >= 2 && this.beamCd <= 0) {
        this.beamState = 'charge';
        this.beamT = 0.85;
        this.beamAng = angleTo(this.x, this.y + 14, p.x, p.y);
        PW.Audio.play('warn');
      }
      return;
    }

    if (this.beamState === 'charge') {
      this.beamT -= dt;
      var want = angleTo(this.x, this.y + 14, p.x, p.y);
      this.beamAng += (want - this.beamAng) * Math.min(1, dt * 3);
      if (this.beamT <= 0) {
        this.beamState = 'fire';
        this.beamT = 1.35;
        this.beamSweep = p.x < this.x ? -1 : 1;
        PW.Audio.play('shootBig');
        game.shake(2, 0.2);
      }
      return;
    }

    /* fire：左右扫射，限制在下方 ±65° 内 */
    this.beamT -= dt;
    this.beamAng += this.beamSweep * 52 * dt;
    if (this.beamAng < 25) { this.beamAng = 25; this.beamSweep = 1; }
    if (this.beamAng > 155) { this.beamAng = 155; this.beamSweep = -1; }
    if (this.beamT <= 0) {
      this.beamState = 'idle';
      this.beamCd = this.phase === 3 ? 4.2 : 5.6;
    }
  };

  PW.Boss.prototype.fire = function (game) {
    var p = game.player;
    var i, a, n, aim;

    if (this.type === 'twin') {
      if (this.phase === 1) {
        aim = angleTo(this.x - 24, this.y + 14, p.x, p.y);
        game.spawnEnemyBullet(this.x - 24, this.y + 14, aim, 148, 'bullet_enemy_dart', 1, 4);
        aim = angleTo(this.x + 24, this.y + 14, p.x, p.y);
        game.spawnEnemyBullet(this.x + 24, this.y + 14, aim, 148, 'bullet_enemy_dart', 1, 4);
        this.fireCd = 0.78;
      } else if (this.phase === 2) {
        for (i = -2; i <= 2; i++) {
          game.spawnEnemyBullet(this.x - 24, this.y + 12, 90 + i * 15, 96, 'bullet_enemy_orb', 1, 5.5);
          game.spawnEnemyBullet(this.x + 24, this.y + 12, 90 + i * 15, 96, 'bullet_enemy_ring', 1, 5.0);
        }
        this.fireCd = 1.35;
      } else {
        this.ringOff += 0.5;
        for (i = 0; i < 6; i++) {
          a = this.ringOff + i * 60;
          game.spawnEnemyBullet(this.x - 24, this.y + 6, a, 88, 'bullet_enemy_ring', 1, 5.0);
          game.spawnEnemyBullet(this.x + 24, this.y + 6, 180 - a, 88, 'bullet_enemy_orb', 1, 5.0);
        }
        aim = angleTo(this.x, this.y + 16, p.x, p.y);
        game.spawnEnemyBullet(this.x, this.y + 16, aim, 185, 'bullet_enemy_dart', 1, 4);
        this.fireCd = 1.25;
      }
      PW.Audio.play(this.phase > 1 ? 'shootBig' : 'shoot');
      return;
    }

    if (this.type === 'laser') {
      if (this.phase === 1) {
        aim = angleTo(this.x, this.y + 14, p.x, p.y);
        for (i = -1; i <= 1; i++) {
          game.spawnEnemyBullet(this.x, this.y + 14, aim + i * 11, 155, 'bullet_enemy_dart', 1, 4);
        }
        this.fireCd = 1.05;
      } else {
        aim = angleTo(this.x, this.y + 14, p.x, p.y);
        for (i = -2; i <= 2; i++) {
          game.spawnEnemyBullet(this.x, this.y + 14, aim + i * 12, 118, 'bullet_enemy_laser', 1, 4.5);
        }
        game.spawnEnemyBullet(this.x - 20, this.y + 8, aim, 100, 'bullet_enemy_plasma', 1, 7);
        game.spawnEnemyBullet(this.x + 20, this.y + 8, aim, 100, 'bullet_enemy_plasma', 1, 7);
        this.fireCd = 1.5;
      }
      PW.Audio.play('shoot');
      return;
    }

    if (this.type === 'hive') {
      if (this.phase === 1) {
        n = 10;
        for (i = 0; i < n; i++) {
          game.spawnEnemyBullet(this.x, this.y + 8, i * (360 / n) + this.t * 10, 78, 'bullet_enemy_ring', 1, 5.0);
        }
        this.fireCd = 1.7;
      } else if (this.phase === 2) {
        n = 6;
        for (i = 0; i < n; i++) {
          game.spawnEnemyBullet(this.x, this.y + 8, i * 60 + this.t * 24, 84, 'bullet_enemy_orb', 1, 5.0);
        }
        aim = angleTo(this.x, this.y + 16, p.x, p.y);
        game.spawnEnemyBullet(this.x - 26, this.y + 12, aim, 112, 'bullet_enemy_plasma', 1, 7);
        game.spawnEnemyBullet(this.x + 26, this.y + 12, aim, 112, 'bullet_enemy_plasma', 1, 7);
        this.fireCd = 1.45;
      } else {
        this.ringOff += 0.4;
        n = 14;
        for (i = 0; i < n; i++) {
          game.spawnEnemyBullet(this.x, this.y + 6, this.ringOff + i * (360 / n), 88, 'bullet_enemy_ring', 1, 5.0);
        }
        aim = angleTo(this.x, this.y + 16, p.x, p.y);
        game.spawnEnemyBullet(this.x - 20, this.y + 14, aim, 170, 'bullet_enemy_missile', 1, 5);
        game.spawnEnemyBullet(this.x + 20, this.y + 14, aim, 170, 'bullet_enemy_missile', 1, 5);
        this.fireCd = 1.4;
      }
      PW.Audio.play('shoot');
      return;
    }

    /* heavy：保持原有三阶段弹幕 */
    if (this.phase === 1) {
      n = 7;
      for (i = 0; i < n; i++) {
        a = 90 - 40 + i * (80 / (n - 1));
        game.spawnEnemyBullet(this.x, this.y + 18, a, 88, 'bullet_enemy_orb', 1, 5.5);
      }
      this.fireCd = 1.2;
      PW.Audio.play('shoot');
    } else if (this.phase === 2) {
      aim = angleTo(this.x, this.y + 16, p.x, p.y);
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

  PW.Boss.prototype.drawBeam = function (ctx) {
    if (this.type !== 'laser' || this.beamState === 'idle' || this.dying) return;
    var f = PW.Assets.frame('fx_laser_core');
    if (!f || !PW.Assets.loaded) return;

    var charging = this.beamState === 'charge';
    var t = charging ? Math.max(0, 1 - this.beamT / 0.85) : 1;
    var w = charging ? (4 + t * 12) : 20;
    var len = charging ? (24 + t * 240) : 300;

    ctx.save();
    ctx.translate(this.x, this.y + 14);
    ctx.rotate((this.beamAng - 90) * Math.PI / 180);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = charging ? (0.45 + t * 0.4) : 0.9;
    ctx.drawImage(PW.Assets.img, f.frame.x, f.frame.y, f.frame.w, f.frame.h, -w / 2, 0, w, len);
    ctx.restore();

    if (charging) {
      PW.Sprite.draw(ctx, 'fx_shockwave', this.x, this.y + 14, { scale: 0.5 + t * 0.7, alpha: t * 0.7 });
    }
  };

  PW.Boss.prototype.draw = function (ctx) {
    if (this.beamState !== 'idle') this.drawBeam(ctx);
    PW.Sprite.draw(ctx, this.frameName, this.x, this.y);
    if (this.flash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, this.flash * 6) * 0.6;
      PW.Sprite.draw(ctx, this.frameName, this.x, this.y);
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
    bomb: 'pickup_bomb',
    wing: 'pickup_wing',
    magnet: 'pickup_magnet',
    rapid: 'pickup_rapid'
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

  PW.Pickup.prototype.update = function (dt, game) {
    this.t += dt;

    /* 磁铁道具：靠近时被玩家吸过去 */
    var p = game && game.player;
    if (p && p.alive && p.magnetUntil > game.clock) {
      var dx = p.x - this.x, dy = p.y - this.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d > 0.001 && d < 120) {
        this.x += (dx / d) * 180 * dt;
        this.y += (dy / d) * 180 * dt;
        if (this.y > H + 20) this.dead = true;
        return;
      }
    }

    this.y += this.vy * dt;
    this.x += Math.sin(this.t * 2.4) * 10 * dt;
    if (this.y > H + 20) this.dead = true;
  };

  PW.Pickup.prototype.draw = function (ctx) {
    var pulse = 0.72 + Math.sin(this.t * 4) * 0.05;
    PW.Sprite.draw(ctx, this.frameName, this.x, this.y, { scale: pulse });
  };
})();
