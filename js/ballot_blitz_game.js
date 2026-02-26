/* =============================================
   BALLOT BOX BLITZ — Game Engine
   ============================================= */

// ── DOM References ──────────────────────────────
const screens = {
    start:    document.getElementById('screen-start'),
    game:     document.getElementById('screen-game'),
    pause:    document.getElementById('screen-pause'),
    gameover: document.getElementById('screen-gameover'),
    levelup:  document.getElementById('screen-levelup'),
};

const canvas      = document.getElementById('gameCanvas');
const ctx         = canvas.getContext('2d');
const popupLayer  = document.getElementById('popupLayer');
const hudScore    = document.getElementById('hudScore');
const hudBest     = document.getElementById('hudBest');
const hudLives    = document.getElementById('hudLives');
const hudLevel    = document.getElementById('hudLevel');

// ── Game State ──────────────────────────────────
let state = {};
let animId = null;
let lastTime = 0;
let bestScore = parseInt(localStorage.getItem('bbBest') || '0');

const BALLOON_TYPES = {
    valid:   { emoji: '✅', label: 'VALID',   color: '#2DC653', points: +10, hitsLife: false, isBomb: false, weight: 50 },
    golden:  { emoji: '⭐', label: 'GOLDEN',  color: '#FFD60A', points: +30, hitsLife: false, isBomb: false, weight: 8  },
    spoiled: { emoji: '❌', label: 'SPOILED', color: '#E63946', points:   0, hitsLife: true,  isBomb: false, weight: 28 },
    bomb:    { emoji: '💣', label: 'BOMB',    color: '#FF6B35', points: -20, hitsLife: false, isBomb: true,  weight: 14 },
};

const LEVEL_CONFIG = [
    /* L1 */ { speed: 1.8, spawnRate: 1800, maxItems: 5  },
    /* L2 */ { speed: 2.4, spawnRate: 1500, maxItems: 7  },
    /* L3 */ { speed: 3.0, spawnRate: 1300, maxItems: 9  },
    /* L4 */ { speed: 3.6, spawnRate: 1100, maxItems: 11 },
    /* L5 */ { speed: 4.3, spawnRate:  950, maxItems: 13 },
    /* L6 */ { speed: 5.1, spawnRate:  800, maxItems: 15 },
    /* L7 */ { speed: 6.0, spawnRate:  700, maxItems: 17 },
];

const POINTS_PER_LEVEL = 100;
const MAX_LIVES = 3;

// ── Utility ─────────────────────────────────────
function rnd(min, max) { return Math.random() * (max - min) + min; }
function rndInt(min, max) { return Math.floor(rnd(min, max + 1)); }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function weightedRandom(types) {
    const keys = Object.keys(types);
    const total = keys.reduce((s, k) => s + types[k].weight, 0);
    let r = Math.random() * total;
    for (const k of keys) {
        r -= types[k].weight;
        if (r <= 0) return k;
    }
    return keys[keys.length - 1];
}

// ── Screens ──────────────────────────────────────
function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
}

// ── Start Screen FX ─────────────────────────────
function initStartFX() {
    const sf = document.getElementById('starField');
    sf.innerHTML = '';
    for (let i = 0; i < 60; i++) {
        const s = document.createElement('div');
        s.className = 'star';
        const sz = rnd(1, 3);
        s.style.cssText = `width:${sz}px;height:${sz}px;top:${rnd(0,100)}%;left:${rnd(0,100)}%;animation-delay:${rnd(0,2)}s;animation-duration:${rnd(1.5,3)}s;`;
        sf.appendChild(s);
    }

    const cb = document.getElementById('confettiBg');
    cb.innerHTML = '';
    const colors = ['#E63946','#FFD60A','#1D3557','#2DC653','#457B9D','#FF6B35'];
    for (let i = 0; i < 40; i++) {
        const c = document.createElement('div');
        c.className = 'c-piece';
        c.style.cssText = `
            left:${rnd(0,100)}%;
            background:${colors[rndInt(0,colors.length-1)]};
            animation-delay:${rnd(0,5)}s;
            animation-duration:${rnd(4,8)}s;
            width:${rndInt(6,14)}px;
            height:${rndInt(6,14)}px;
            border-radius:${Math.random()>0.5 ? '50%' : '2px'};
        `;
        cb.appendChild(c);
    }
}

// ── Canvas resize ────────────────────────────────
function resizeCanvas() {
    const gameDiv = document.getElementById('screen-game');
    const hud     = document.querySelector('.hud');
    const legend  = document.querySelector('.legend');

    // Use window dimensions as fallback when screen-game is not yet visible
    canvas.width  = gameDiv.clientWidth  || window.innerWidth;
    canvas.height = (gameDiv.clientHeight || window.innerHeight)
                    - (hud     ? hud.offsetHeight     : 0)
                    - (legend  ? legend.offsetHeight  : 0);
}

// ── Game Init ────────────────────────────────────
function initGame() {
    showScreen('game');
    resizeCanvas();
    state = {
        score:       0,
        lives:       MAX_LIVES,
        level:       1,
        caught:      0,
        paused:      false,
        over:        false,
        items:       [],
        particles:   [],
        spawnTimer:  0,
        levelTimer:  0,
        box: {
            x: canvas.width / 2,
            y: canvas.height - 50,
            w: 120,
            h: 60,
            targetX: canvas.width / 2,
        },
        bgStars: generateBgStars(),
        flashTimer: 0,
        flashColor: '',
    };

    hudBest.textContent = bestScore;
    updateHUD();

    lastTime = performance.now();
    cancelAnimationFrame(animId);
    animId = requestAnimationFrame(loop);
}

function generateBgStars() {
    const stars = [];
    for (let i = 0; i < 80; i++) {
        stars.push({ x: rnd(0, canvas.width), y: rnd(0, canvas.height), r: rnd(0.5, 2), a: rnd(0.1, 0.5) });
    }
    return stars;
}

// ── Input ────────────────────────────────────────
let mouseX = -1;
const keys = {};

document.addEventListener('mousemove', e => {
    if (!screens.game.classList.contains('active')) return;
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
});
document.addEventListener('touchmove', e => {
    if (!screens.game.classList.contains('active')) return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    mouseX = e.touches[0].clientX - rect.left;
}, { passive: false });
document.addEventListener('keydown', e => { keys[e.code] = true; });
document.addEventListener('keyup',   e => { keys[e.code] = false; });

// ── Spawning ─────────────────────────────────────
function spawnItem() {
    const cfg  = LEVEL_CONFIG[Math.min(state.level - 1, LEVEL_CONFIG.length - 1)];
    if (state.items.length >= cfg.maxItems) return;

    const type    = weightedRandom(BALLOON_TYPES);
    const typeData = BALLOON_TYPES[type];
    const size    = rndInt(36, 54);
    const speed   = rnd(cfg.speed * 0.7, cfg.speed * 1.3);

    state.items.push({
        type,
        x:      rnd(size, canvas.width - size),
        y:      -size,
        size,
        speed,
        wobble: rnd(0, Math.PI * 2),
        wobbleSpeed: rnd(0.02, 0.06),
        wobbleAmp:   rnd(0.5, 2.5),
        rotation: 0,
        rotSpeed: rnd(-0.04, 0.04),
        emoji:    typeData.emoji,
        color:    typeData.color,
        alive:    true,
    });
}

// ── Particles ────────────────────────────────────
function spawnParticles(x, y, color, count = 12) {
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + rnd(-0.3, 0.3);
        const speed = rnd(2, 7);
        state.particles.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            r:  rnd(3, 8),
            color,
            alpha: 1,
            decay: rnd(0.03, 0.07),
        });
    }
}

// ── Score Popups ─────────────────────────────────
function showPopup(x, y, text, cls) {
    const el = document.createElement('div');
    el.className = `score-popup ${cls}`;
    el.textContent = text;
    el.style.left = `${x - 20}px`;
    el.style.top  = `${y}px`;
    popupLayer.appendChild(el);
    setTimeout(() => el.remove(), 900);
}

// ── Update HUD ───────────────────────────────────
function updateHUD() {
    hudScore.textContent = state.score;
    hudBest.textContent  = bestScore;
    hudLevel.textContent = `LEVEL ${state.level}`;

    const lifeEls = hudLives.querySelectorAll('.life');
    lifeEls.forEach((el, i) => {
        el.classList.toggle('lost', i >= state.lives);
    });
}

// ── Level Up ─────────────────────────────────────
function checkLevelUp() {
    const newLevel = Math.floor(state.score / POINTS_PER_LEVEL) + 1;
    if (newLevel > state.level && newLevel <= LEVEL_CONFIG.length + 1) {
        state.level = newLevel;
        updateHUD();
        showLevelUp(newLevel);
    }
}

function showLevelUp(lvl) {
    const msgs = [
        '', '', 'THINGS ARE HEATING UP!', 'DEMOCRACY IN OVERDRIVE!',
        'POLLS ARE WILD TODAY!', 'BALLOT CHAOS INCOMING!',
        'YOU\'RE UNSTOPPABLE!', 'LEGENDARY VOTE CATCHER!',
    ];
    document.getElementById('levelupText').textContent = `LEVEL ${lvl}`;
    document.getElementById('levelup-sub') && (document.getElementById('levelup-sub').textContent = msgs[lvl] || 'KEEP GOING!');
    const sub = screens.levelup.querySelector('.levelup-sub');
    if (sub) sub.textContent = msgs[Math.min(lvl, msgs.length-1)];

    screens.levelup.classList.add('active');
    // Reset animation
    const blast = screens.levelup.querySelector('.levelup-blast');
    blast.style.animation = 'none';
    blast.offsetHeight; // reflow
    blast.style.animation = '';
    setTimeout(() => screens.levelup.classList.remove('active'), 1600);
}

// ── Game Over ────────────────────────────────────
function gameOver() {
    state.over = true;
    cancelAnimationFrame(animId);

    if (state.score > bestScore) {
        bestScore = state.score;
        localStorage.setItem('bbBest', bestScore);
    }

    const emojis  = ['📦', '🗳️', '🏛️', '🎉'];
    const titles   = ['POLLS CLOSED!', 'VOTES COUNTED!', 'ELECTION OVER!', 'BALLOT BLITZED!'];
    const msgs     = [
        'The counting is done. Democracy survived!',
        'Every ballot matters — even the ones you dropped.',
        'The people have spoken. So has gravity.',
        'You fought the good vote. The vote won.',
    ];
    const idx = rndInt(0, 3);

    document.getElementById('gameoverEmoji').textContent  = emojis[idx];
    document.getElementById('gameoverTitle').textContent  = titles[idx];
    document.getElementById('gameoverMsg').textContent    = msgs[idx];
    document.getElementById('finalScore').textContent     = state.score;
    document.getElementById('finalBest').textContent      = bestScore;
    document.getElementById('finalLevel').textContent     = state.level;
    document.getElementById('finalCaught').textContent    = state.caught;

    showScreen('gameover');
}

// ── Main Loop ────────────────────────────────────
function loop(timestamp) {
    if (state.over || state.paused) return;

    const dt = Math.min(timestamp - lastTime, 50); // cap at 50ms
    lastTime = timestamp;

    // Spawn
    state.spawnTimer += dt;
    const spawnRate = LEVEL_CONFIG[Math.min(state.level - 1, LEVEL_CONFIG.length - 1)].spawnRate;
    if (state.spawnTimer >= spawnRate) {
        state.spawnTimer = 0;
        spawnItem();
        if (Math.random() < 0.3) spawnItem(); // occasional double spawn
    }

    // Box movement
    const KEYBOARD_SPEED = 7;
    if (keys['ArrowLeft']  || keys['KeyA']) state.box.targetX -= KEYBOARD_SPEED;
    if (keys['ArrowRight'] || keys['KeyD']) state.box.targetX += KEYBOARD_SPEED;
    if (mouseX >= 0) state.box.targetX = mouseX;

    state.box.targetX = clamp(state.box.targetX, state.box.w / 2, canvas.width - state.box.w / 2);
    state.box.x += (state.box.targetX - state.box.x) * 0.18;

    // Flash timer
    if (state.flashTimer > 0) state.flashTimer -= dt;

    // Update items
    state.items.forEach(item => {
        item.y += item.speed * (dt / 16);
        item.wobble += item.wobbleSpeed;
        item.x += Math.sin(item.wobble) * item.wobbleAmp;
        item.rotation += item.rotSpeed;
        item.x = clamp(item.x, item.size, canvas.width - item.size);

        // Hit box
        if (item.alive && !item.caught) {
            const bx = state.box.x;
            const by = state.box.y;
            const bw = state.box.w;
            const bh = state.box.h;

            if (
                item.x + item.size * 0.6 > bx - bw / 2 &&
                item.x - item.size * 0.6 < bx + bw / 2 &&
                item.y + item.size * 0.6 > by - bh / 2 &&
                item.y - item.size * 0.6 < by + bh / 2
            ) {
                item.caught = true;
                const td = BALLOON_TYPES[item.type];

                if (td.hitsLife) {
                    // Spoiled ballot — lose life
                    state.lives = Math.max(0, state.lives - 1);
                    state.flashTimer = 300;
                    state.flashColor = 'rgba(230,57,70,0.3)';
                    spawnParticles(item.x, item.y, td.color, 16);
                    showPopup(item.x, item.y, '💔 -LIFE', 'negative');
                    updateHUD();
                    if (state.lives <= 0) {
                        setTimeout(gameOver, 300);
                    }
                } else {
                    state.score = Math.max(0, state.score + td.points);
                    state.caught++;
                    spawnParticles(item.x, item.y, td.color, td.points > 0 ? 14 : 10);

                    if (td.points > 0) {
                        const cls = item.type === 'golden' ? 'golden' : 'positive';
                        showPopup(item.x, item.y, `+${td.points}`, cls);
                        state.flashTimer = 120;
                        state.flashColor = 'rgba(45,198,83,0.15)';
                    } else {
                        showPopup(item.x, item.y, `${td.points}`, 'negative');
                        state.flashTimer = 200;
                        state.flashColor = 'rgba(255,107,53,0.25)';
                    }
                    updateHUD();
                    checkLevelUp();
                }
            }
        }

        // Missed — fell off screen
        if (item.y > canvas.height + item.size * 2) {
            item.caught = true; // mark as done
            if (item.type === 'valid' || item.type === 'golden') {
                // Missed valid ballot — small penalty flash
                state.flashTimer = 150;
                state.flashColor = 'rgba(255,214,10,0.1)';
            }
        }
    });

    // Clean up caught/missed items
    state.items = state.items.filter(i => !i.caught && i.y < canvas.height + 100);

    // Update particles
    state.particles.forEach(p => {
        p.x     += p.vx;
        p.y     += p.vy;
        p.vy    += 0.25; // gravity
        p.alpha -= p.decay;
    });
    state.particles = state.particles.filter(p => p.alpha > 0);

    // Draw
    draw();
    animId = requestAnimationFrame(loop);
}

// ── Draw ─────────────────────────────────────────
function draw() {
    // Background
    ctx.fillStyle = '#0D1B2A';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Twinkling stars in background
    if (state.bgStars) {
        state.bgStars.forEach(s => {
            ctx.globalAlpha = s.a;
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
    }

    // Flash overlay
    if (state.flashTimer > 0) {
        ctx.fillStyle = state.flashColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Ground line
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 12]);
    ctx.beginPath();
    ctx.moveTo(0, state.box.y + state.box.h / 2 + 2);
    ctx.lineTo(canvas.width, state.box.y + state.box.h / 2 + 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Particles
    state.particles.forEach(p => {
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle   = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Falling items
    state.items.forEach(item => {
        ctx.save();
        ctx.translate(item.x, item.y);
        ctx.rotate(item.rotation);

        // Shadow
        ctx.shadowColor = item.color;
        ctx.shadowBlur  = 14;

        // Glow circle for golden
        if (item.type === 'golden') {
            ctx.fillStyle = 'rgba(255,214,10,0.15)';
            ctx.beginPath();
            ctx.arc(0, 0, item.size * 0.8, 0, Math.PI * 2);
            ctx.fill();
        }

        // Emoji
        ctx.font      = `${item.size}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 0;
        ctx.fillText(item.emoji, 0, 0);

        ctx.restore();
    });

    // Ballot Box
    drawBox(state.box.x, state.box.y, state.box.w, state.box.h);
}

function drawBox(cx, cy, w, h) {
    const x = cx - w / 2;
    const y = cy - h / 2;
    const r = 8;

    // Box shadow
    ctx.shadowColor = 'rgba(69,123,157,0.6)';
    ctx.shadowBlur  = 20;

    // Box body
    ctx.fillStyle = '#1D3557';
    roundRect(ctx, x, y, w, h, r);
    ctx.fill();

    // Box border
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#457B9D';
    ctx.lineWidth   = 3;
    roundRect(ctx, x, y, w, h, r);
    ctx.stroke();

    // Slot on top
    const slotW = w * 0.45;
    const slotH = 6;
    ctx.fillStyle = '#0D1B2A';
    roundRect(ctx, cx - slotW / 2, y + 8, slotW, slotH, 3);
    ctx.fill();

    // Gold trim line
    ctx.strokeStyle = '#FFD60A';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y + h * 0.38);
    ctx.lineTo(x + w - r, y + h * 0.38);
    ctx.stroke();

    // 🗳️ emoji label
    ctx.font         = `${Math.floor(h * 0.38)}px serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🗳️', cx, cy + h * 0.15);

    ctx.shadowBlur = 0;
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

// ── Button Wiring ────────────────────────────────
document.getElementById('btnStart').addEventListener('click', initGame);

document.getElementById('btnPause').addEventListener('click', () => {
    state.paused = true;
    showScreen('pause');
});

document.getElementById('btnResume').addEventListener('click', () => {
    state.paused = false;
    showScreen('game');
    lastTime = performance.now();
    animId = requestAnimationFrame(loop);
});

document.getElementById('btnQuit').addEventListener('click', () => {
    cancelAnimationFrame(animId);
    showScreen('start');
});

document.getElementById('btnRestart').addEventListener('click', initGame);

document.getElementById('btnHome').addEventListener('click', () => {
    cancelAnimationFrame(animId);
    showScreen('start');
});

// Keyboard pause
document.addEventListener('keydown', e => {
    if (e.code === 'Escape' || e.code === 'KeyP') {
        if (screens.game.classList.contains('active') && !state.over) {
            state.paused = true;
            showScreen('pause');
        } else if (screens.pause.classList.contains('active')) {
            state.paused = false;
            showScreen('game');
            lastTime = performance.now();
            animId = requestAnimationFrame(loop);
        }
    }
});

// ── Window resize ────────────────────────────────
window.addEventListener('resize', () => {
    if (screens.game.classList.contains('active')) {
        resizeCanvas();
        state.box.y = canvas.height - 50;
        state.bgStars = generateBgStars();
    }
});

// ── Boot ─────────────────────────────────────────
initStartFX();
showScreen('start');
hudBest.textContent = bestScore;
