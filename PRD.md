# 飞机大战 H5（纵版射击）PRD

- 项目目录：`D:\AI\plane-war-h5`
- 版本：v1.0（首个可玩版本）
- 目标形态：纯静态 H5，双击 `index.html` 即可游玩，无需联网、无需构建工具、无第三方运行时依赖。

---

## 1. 目标与范围

### 1.1 目标
做一个“能完整打通一局”的纵版射击小游戏：移动 → 自动射击 → 打敌机 → 吃道具 → 打 Boss → 计分 → 死亡结算 → 重开。全部视觉资源来自上一阶段生成的原创像素雪碧图。

### 1.2 本次实现范围（In Scope）
- 玩家战机：左右倾斜姿态、受损姿态、护盾状态（4 张玩家帧全部用上）
- 敌机：小型（a/b 两种配色）、中型（a/b）、重型、精英重甲（共 6 种）
- Boss：`boss_heavy` 单体，带血条与三阶段弹幕
- 双方子弹：4 种玩家弹 + 4 种敌方弹（图集里的 8 张子弹帧全部用上）
- 8 帧爆炸动画（大爆炸全序列 / 小爆炸用 00–04 子序列）
- 道具：火力、护盾、血包、炸弹（4 张拾取图）
- 背景：星空（4 种星星帧，含 `star_twinkle` 闪烁动画）、云、陨石/流星、行星、星云，多层视差滚动
- HUD/UI 图标：心形生命、金币/星星分数图标、炸弹图标
- 桌面键鼠 + 移动端触控；暂停、重开、死亡结算、最高分本地保存
- WebAudio 程序化音效（无音频文件）

### 1.3 不做（Out of Scope）
- 关卡场景切换、剧情、多关卡地图、商店/成长系统
- 联网排行榜、账号、云存档
- 复杂物理/寻路 AI；敌机采用预设轨迹 + 简单瞄准
- 背景音乐（BGM）：仅做少量循环音效，不做完整配乐
- 手柄适配、无障碍朗读
- 像素级精确像素碰撞（改用圆形/矩形近似碰撞，见 §7.4）

---

## 2. 资源依据（严格对齐 `assets/plane_war_atlas.json`）

### 2.1 雪碧图规格
| 项 | 值 |
|---|---|
| 文件 | `plane_war_sprite_sheet.png`（RGBA8888，透明背景） |
| 尺寸 | 912 × 2128 |
| 像素缩放 | `scale = 4`（图集中每个逻辑像素在 PNG 中占 4×4 物理像素） |
| 分区间距 | `padding = 16`（分区之间的空隙） |
| 锚点 | 所有帧 `anchor = {x:0.5, y:0.5}`（以帧中心定位绘制） |

### 2.2 六个分区（每区内部为统一网格，可按格切图）
| 分区 id | rect (x,y,w,h) | 单元格 | 列×行 | 帧数 |
|---|---|---|---|---|
| aircraft | 0, 0, 704, 528 | 176×176 | 4×3 | 11 |
| boss | 0, 544, 320, 256 | 320×256 | 1×1 | 1 |
| bullets | 336, 544, 576, 288 | 144×144 | 4×2 | 8 |
| fx | 0, 848, 704, 528 | 176×176 | 4×3 | 12 |
| items | 0, 1392, 480, 240 | 120×120 | 4×2 | 8 |
| decor | 0, 1648, 640, 480 | 160×160 | 4×3 | 12 |

### 2.3 帧清单（名称与尺寸直接取自 JSON `frames`）
| 名称 | 帧尺寸(px) | 逻辑尺寸 | 用途 |
|---|---|---|---|
| player_idle | 128×136 | 32×34 | 玩家常态 |
| player_bank_left | 144×152 | 36×38 | 左倾（向左移动） |
| player_bank_right | 144×152 | 36×38 | 右倾（向右移动） |
| player_hit | 136×144 | 34×36 | 受损/无敌闪烁 |
| player_shielded | 168×176 | 42×44 | 护盾生效 |
| enemy_small_a / b | 88×88 | 22×22 | 小型敌机（红/黄） |
| enemy_medium_a / b | 120×104 | 30×26 | 中型敌机（绿/紫） |
| enemy_heavy | 144×128 | 36×32 | 重型敌机 |
| enemy_heavy_elite | 152×136 | 38×34 | 精英重甲 |
| boss_heavy | 320×240 | 80×60 | Boss |
| bullet_player_basic | 32×64 | 8×16 | 普通弹 |
| bullet_player_power | 48×80 | 12×20 | 强化弹 |
| bullet_player_laser | 40×136 | 10×34 | 激光柱 |
| bullet_player_missile | 56×96 | 14×24 | 追踪弹 |
| bullet_enemy_orb | 64×64 | 16×16 | 敌方光球 |
| bullet_enemy_dart | 40×72 | 10×18 | 敌方飞镖弹 |
| bullet_enemy_plasma | 80×80 | 20×20 | 等离子球 |
| bullet_enemy_ring | 80×80 | 20×20 | 环形弹 |
| explosion_00 … 07 | 168×168 | 42×42 | 爆炸序列 8 帧 |
| fx_muzzle_flash | 72×72 | 18×18 | 枪口闪光 |
| fx_impact | 80×80 | 20×20 | 命中火花 |
| fx_shield_break | 152×152 | 38×38 | 护盾破碎 |
| fx_smoke | 96×96 | 24×24 | 烟团（背景/尾迹） |
| pickup_power / shield / health / bomb | 88×88 | 22×22 | 四种道具 |
| ui_coin / ui_heart / ui_star / ui_gem | 88×88 | 22×22 | HUD 图标（分数用 coin/star，生命用 heart，Boss 血条用 gem 装饰） |
| bg_star_small / medium / bright / twinkle | 44…92 | 11…23 | 星空层 |
| bg_asteroid_small / large | 108×100 / 144×136 | 27×25 / 36×34 | 陨石 |
| bg_meteor_small / large | 72×104 / 112×152 | 18×26 / 28×38 | 流星 |
| bg_cloud_a / b | 144×88 / 120×64 | 36×22 / 30×16 | 云层 |
| bg_planet_small | 136×128 | 34×32 | 远景行星 |
| bg_nebula_puff | 144×112 | 36×28 | 星云雾 |

### 2.4 动画（直接使用 JSON `animations`）
| 动画 | fps | loop | 帧序列 | 游戏内用途 |
|---|---|---|---|---|
| explosion | 18 | false | explosion_00 … 07 | 中/大型敌机、Boss 被击毁 |
| explosion_small | 20 | false | explosion_00 … 04 | 小型敌机、子弹命中 |
| player_hit_blink | 10 | true | player_idle ↔ player_hit | 玩家无敌期间闪烁 |
| player_bank | 12 | true | bank_left / idle / bank_right / idle | 玩家水平移动时切姿态 |
| star_twinkle | 6 | true | star_small / twinkle / bright / twinkle | 背景闪烁星（部分星点用该序列） |
| enemy_bullet_orb | 8 | true | bullet_enemy_orb | 光球弹（单帧，按该 fps 做轻微旋转/缩放观感） |

> 说明：JSON 中未包含的“Boss 受击闪烁”“导弹尾迹”等不做新帧，改用已有帧的颜色叠层/缩放实现。

### 2.5 渲染缩放约定（保证不糊图）
- 世界坐标单位 = **逻辑像素**（= PNG 像素 / 4）。
- 世界尺寸固定 **240 × 428**；画布后备尺寸 = `240 × S`、`428 × S`，`S` 为**整数**缩放（按屏幕尺寸与 DPR 在 1–6 之间取整，桌面通常为 2，高 DPR 手机通常为 4–5）。
- 图集帧绘制比例恒为 **1**（按 `logicalSize`，等价于把 PNG 的 4×4 像素块缩为 2×2，仍是整数对齐）。
- 绘制位置一律取整（`Math.round`），`imageSmoothingEnabled = false`；画布再用 CSS 等比缩放到可用视口，`image-rendering: pixelated`，不做平滑插值。

---

## 3. 玩法与核心循环

### 3.1 核心循环
`自动射击/移动` → `击杀敌机得分` → `掉落道具强化` → `撑过波次` → `Boss 战` → `进入下一轮更高难度` → `死亡 → 结算 → 重开`。

### 3.2 玩家参数
| 项 | 值 |
|---|---|
| 生命 | 3 心（`ui_heart` 表示），受击 -1，生命归零结算 |
| 无敌时间 | 受击后 1.5s（播放 `player_hit_blink`） |
| 移动 | 跟随指针：移动端相对拖动（按下时记录机体与手指偏移，不跳变）；桌面鼠标在画布内直接跟随；键盘 220 逻辑像素/秒 |
| 射击 | 全自动，按火力等级决定弹型/数量 |
| 判定 | 机身圆形，半径 7 逻辑像素 |

### 3.3 火力等级（吃 `pickup_power` 提升，最高 4 级，受击降 1 级）
| 等级 | 弹型 | 数量/间隔 |
|---|---|---|
| 1 | bullet_player_basic | 1 发 / 0.14s |
| 2 | bullet_player_basic | 2 发（并排）/ 0.13s |
| 3 | bullet_player_power | 3 发（带 ±12° 散射）/ 0.12s |
| 4 | bullet_player_laser + bullet_player_missile | 中央激光 + 每次 2 枚追踪弹 / 0.16s |

### 3.4 道具
| 道具 | 效果 | 掉落权重 |
|---|---|---|
| pickup_power | 火力 +1（已满则 +300 分） | 12% |
| pickup_shield | 护盾，抵挡 1 次伤害，持续 6s（`player_shielded`） | 8% |
| pickup_health | 生命 +1（上限 5） | 8% |
| pickup_bomb | 炸弹 +1（上限 3），按 `B`/`J` 或点击炸弹按钮清屏 | 6% |

### 3.5 炸弹
使用后：全屏敌弹清除、场上敌机受 999 伤害、Boss 受 120 伤害；屏幕白闪 + 多组 `explosion` 播放。

---

## 4. 关卡与难度曲线

单局以“轮次（cycle）”循环推进，每轮约 90s：

| 阶段 | 时间 | 内容 | 敌机血量/速度 |
|---|---|---|---|
| W1 | 0–18s | `enemy_small_a/b` 从上方随机 x 落下 | HP 1 / 速度 55 |
| W2 | 18–36s | 加入 `enemy_medium_a`，间隔 2.2s | HP 3 / 速度 42 |
| W3 | 36–54s | 加入 `enemy_medium_b` 与横向蛇形小机群（5 连） | HP 3–4 / 速度 48 |
| W4 | 54–72s | 加入 `enemy_heavy`、`enemy_heavy_elite`，敌方弹幕开启 | HP 8–10 / 速度 36 |
| BOSS | 72s 起 | 播报 “WARNING”，`boss_heavy` 入场，停刷小怪 | HP 600（每轮 +25%） |
| 通关 | Boss 死亡 | 大量爆炸 + 结算本轮分数奖励，进入下一轮 | 全敌机速度/血量 × 1.15 |

Boss 三阶段（按血量百分比切换）：
1. **100%–66%**：扇形 `bullet_enemy_orb`（每 1.2s，7 发，±40°）
2. **66%–33%**：`bullet_enemy_dart` 瞄准玩家（每 0.9s，3 发速差）+ 缓慢左右巡航
3. **33%–0%**：`bullet_enemy_ring` 环形弹（每 1.6s，16 发旋转）+ `bullet_enemy_plasma` 追踪 2 发

---

## 5. 操作方式

| 动作 | 移动端 | 桌面 |
|---|---|---|
| 移动 | 手指按住屏幕拖动（相对拖动，避免跳变） | 鼠标按住拖动 / 鼠标移动跟随；`WASD`、方向键均可 |
| 开火 | 自动 | 自动；`J` 也可 |
| 炸弹 | 右下角炸弹按钮（显示剩余数） | `B` / `J` |
| 暂停 | 右上角暂停按钮 | `P` / `Esc` |
| 重开 | 结算页按钮 | `R` |

指针交互细节：触控 pointerdown 记录起点，pointermove 时以“增量”移动飞机；鼠标在画布内移动时直接跟随（更顺手），按住时按增量移动。

---

## 6. 数据结构

```js
// 资源
AtlasFrame   = { frame:{x,y,w,h}, block, category, grid:{col,row,cell}, anchor, logicalSize, scale, tags }
Atlas        = { meta:{ size, blocks[], scale }, frames{name->AtlasFrame}, animations{name->{fps,loop,frames[]}} }

// 实体（世界坐标为逻辑像素，原点左上）
Player   = { x, y, hp, maxHp, power, shieldUntil, invUntil, bombs, alive, animState }
Bullet   = { x, y, vx, vy, w, h, r, dmg, owner:'player'|'enemy', frameName, dead }
Enemy    = { x, y, hp, maxHp, type, frameName, speed, pattern, t, fireCd, score, drops }
Boss     = { x, y, hp, maxHp, phase, t, fireCd, entering }
Pickup   = { x, y, vy, kind, frameName }
Effect   = { x, y, animName, t, fps, loop, scale, dead }
Star/BgObj = { x, y, vy, frameName, scale, alpha, layer }

// 运行时
GameState = { mode:'boot'|'loading'|'title'|'playing'|'paused'|'gameover'|'victory',
              time, cycle, wave, score, best, stats:{kills,bombsUsed}, player, entities... }
```

碰撞：统一用圆-圆 / 圆-矩形近似（见 §7.4）。

---

## 7. 系统设计

### 7.1 状态机
```
boot → loading → title ⇄ playing ⇄ paused
                     ↓
                 gameover → (重开) → playing
                     ↓
                 boss 击败 → cycle++ → playing
```
- `title`：显示标题、开始按钮、最高分、操作说明。
- `playing`：主循环（update/collision/render）。
- `paused`：冻结所有计时与动画，显示半透明遮罩与“继续/重开”按钮。
- `gameover`：显示得分、最高分、击杀数、重开按钮。

### 7.2 生成与波次系统
- 时间驱动波次（见 §4），每种敌机有 `spawnFn(t, cycle)`；
- 敌机行为模板：`straight`（直线下落）、`sine`（正弦横移）、`dive`（先降到 y 再横掠）、`aimed`（朝玩家方向加速）；
- 敌方开火仅在中型及以上或 Boss 阶段启用，避免开局劝退。

### 7.3 渲染层级（自下而上）
1. 深空底色（垂直渐变 #05070f → #0a1020）
2. 星云 `bg_nebula_puff`（慢速、低 alpha）
3. 远景行星 `bg_planet_small`、云 `bg_cloud_a/b`（0.25 倍速）
4. 星星三层（0.35 / 0.6 / 1.0 倍速，部分使用 `star_twinkle` 动画）
5. 陨石/流星 `bg_asteroid_*`、`bg_meteor_*`（0.8 倍速，仅视觉，不参与碰撞）
6. 道具 → 敌机 → Boss → 玩家 → 子弹 → 特效
7. HUD（生命/分数/炸弹/火力/Boss 血条）

### 7.4 碰撞
- 玩家：圆（r=7），仅与敌方子弹圆、敌机矩形做判定；
- 敌弹：圆（半径取 `logicalSize.w*0.28`）；
- 敌机：矩形（略缩 20% 的 AABB）；
- 道具：与玩家矩形判定（宽松，便于拾取）。

### 7.5 暂停/重开
- 暂停不销毁世界，仅停止 update；恢复时重置 `lastTime` 防止跳帧；
- 重开：重置全部实体与计时，保留最高分（localStorage `planeWarBest`）。

### 7.6 性能
- 单画布、单分支渲染，`requestAnimationFrame` 固定 `dt` 上限 1/30s；
- 实体数组按需过滤（`dead` 标记 + 每帧 `filter`）；
- 图集只加载一次，全部 `drawImage` 从同一张 912×2128 纹理取样。

---

## 8. UI / HUD

| 元素 | 位置 | 资源/实现 |
|---|---|---|
| 生命 | 左上，`ui_heart` × 当前血量 | 图集帧 |
| 分数 | 右上，`ui_coin` + 数字 | 图集帧 + 文本 |
| 炸弹 | 左下，`pickup_bomb` + 数量 | 图集帧 |
| 火力等级 | 左下（炸弹右侧），`pickup_power` + Lv | 图集帧 |
| Boss 血条 | 顶部中间，受击闪烁 | 绘制矩形 + `ui_gem` 装饰 |
| 波次提示 | 屏幕中部，淡入淡出文字 | 文本 |
| 暂停/炸弹/音效按钮 | 右上/右下，半透明圆形按钮 | DOM 按钮（触控友好） |
| 结算面板 | 居中卡片 | DOM 覆盖层 |

---

## 9. 音效（WebAudio 程序化合成，无外部音频）

| 事件 | 合成方式 |
|---|---|
| 玩家射击 | 短促方波 blip（频率 880Hz、时长 0.05s、低音量） |
| 敌机爆炸 | 白噪声 + 低通滤波 burst，时长随敌机类型 0.2–0.6s |
| 玩家受击 | 低频锯齿 120Hz + 噪声，0.25s |
| 拾取道具 | 双音上行琶音（C5→E5→G5） |
| 炸弹 | 长噪声 + 屏幕震动 |
| Boss 警告 | 两声下行方波 |
| 暂停/按钮 | 极短 click |

首次用户交互后才创建 `AudioContext`（绕过浏览器自动播放限制）；提供静音开关。

---

## 10. 技术方案与文件结构

```
plane-war-h5/
├─ index.html                  入口（双击即玩）
├─ PRD.md                      本文档
├─ css/style.css               页面布局、覆盖层、按钮、整数缩放适配
├─ assets/
│  ├─ plane_war_sprite_sheet.png   雪碧图（拷贝自生成产物）
│  ├─ plane_war_atlas.json         图集描述（原件，供工具/校验）
│  └─ atlas.js                     同一份数据的 JS 包装（file:// 下 fetch 受限，直读全局变量）
├─ js/
│  ├─ assets.js    图集解析、SpriteSheet、帧动画播放器、加载器
│  ├─ audio.js     WebAudio 程序化音效
│  ├─ input.js     键鼠 + 触控指针 → 归一化输入状态
│  ├─ effects.js   爆炸/火花/烟、星空与背景视差层
│  ├─ entities.js  玩家、敌机、Boss、子弹、道具
│  ├─ game.js      状态机、波次、碰撞、计分、HUD 绘制、主循环
│  └─ main.js      启动、事件绑定、DOM UI 与 game 对接
├─ serve.mjs       可选：本地静态服务器（node serve.mjs，无 node 时双击 index.html 亦可）
```

约束：
- 不使用 ES Module（`type="module"` 在 `file://` 下会被 CORS 拦截），全部用经典 `<script>` 顺序加载，各自挂到命名空间 `PW` 上。
- 不通过 `fetch` 读 JSON，改用 `assets/atlas.js`（内容由 JSON 原样生成，字段与 JSON 一致）。
- 图片用 `<img>` 相对路径加载，`file://` 下可直接读取。

---

## 11. 验收标准（Definition of Done）

1. 双击 `index.html` 出现标题页，点击开始可进入战斗。
2. 玩家可用鼠标拖动 / 触控拖动 / 键盘移动，自动开火，左右移动时切换 `player_bank_left/right` 姿态。
3. 能遇到并使用：小/中/重型与精英敌机、8 帧爆炸、4 种敌弹、4 种道具。
4. Boss 出现、有血条、三阶段弹幕、被击毁后进入下一轮。
5. 受击扣血、护盾抵挡、炸弹清屏、死亡结算、重开、暂停/恢复均可正常工作。
6. 高分屏与手机（375×667 及以上）下画面等比不变形、不糊、不出现横向滚动条。
7. 音效正常触发且可静音；无未捕获的 JS 异常。
