/* ═══════════════════════════════════════════════
   game.js — Main game controller & loop
   ═══════════════════════════════════════════════ */

// ── DOM refs ──────────────────────────────────
const canvas       = document.getElementById('gameCanvas');
const ctx          = canvas.getContext('2d');
const screenStart  = document.getElementById('screen-start');
const screenGame   = document.getElementById('screen-game');
const screenPause  = document.getElementById('screen-pause');
const screenResults= document.getElementById('screen-results');
const screenHowto  = document.getElementById('screen-howto');

// ── Global game state (exposed as window._gameState for magnifier) ──
let G = {
    mode: null,           // MODES object
    ballotIndex: 0,       // current ballot (0-based)
    targetSymbolId: null,
    targetSymbol: null,
    timeRemaining: 0,
    score: 0,
    results: [],          // [{ symbol, valid, stampX, stampY }]
    paused: false,
    over: false,
    highlightPulse: 0,
    currentStampRadius: 24,
    stampAllowed: true,   // false during feedback animation
    practiceAttempts: 0,
    wobbleOffsetX: 0,
    wobbleOffsetY: 0,
    // dim mode
    dimScheduled: false,
};
window._gameState = G;

let animId = null;
let lastTimestamp = 0;

// ── Screen management ─────────────────────────
function showScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(`screen-${name}`);
    if (el) el.classList.add('active');
}

// ── Resize canvas ─────────────────────────────
function resizeCanvas() {
    const hud = document.querySelector('.game-hud');
    canvas.width  = screenGame.clientWidth;
    canvas.height = screenGame.clientHeight - (hud ? hud.offsetHeight : 58);
    computeBallotLayout(canvas);
    G.currentStampRadius = getStampRadius(
        ballotLayout.cellW, ballotLayout.cellH
    );
}

window.addEventListener('resize', () => {
    if (screenGame.classList.contains('active')) {
        resizeCanvas();
    }
});

// ── Input ─────────────────────────────────────
let mouseX = -999, mouseY = -999;

canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
    stamp.visible = true;
    stamp.x = mouseX;
    stamp.y = mouseY;
});

canvas.addEventListener('mouseleave', () => {
    stamp.visible = false;
});

canvas.addEventListener('click', e => {
    const rect = canvas.getBoundingClientRect();
    handleStampPress(e.clientX - rect.left, e.clientY - rect.top);
});

canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const t = e.touches[0];
    mouseX = t.clientX - rect.left;
    mouseY = t.clientY - rect.top;
    stamp.visible = true;
    stamp.x = mouseX;
    stamp.y = mouseY;
}, { passive: false });

canvas.addEventListener('touchend', e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    if (e.changedTouches.length > 0) {
        const t = e.changedTouches[0];
        handleStampPress(t.clientX - rect.left, t.clientY - rect.top);
    }
}, { passive: false });

// Prevent default cursor
document.addEventListener('mousemove', e => {
    if (screenGame.classList.contains('active')) {
        e.preventDefault();
    }
});

// Keyboard
document.addEventListener('keydown', e => {
    if (e.code === 'Escape' || e.code === 'KeyP') {
        if (screenGame.classList.contains('active') && !G.over) {
            togglePause();
        } else if (screenPause.classList.contains('active')) {
            resumeGame();
        }
    }
    if (e.code === 'KeyM') {
        toggleMagnifier();
    }
});

// ── Stamp press handler ───────────────────────
function handleStampPress(x, y) {
    if (G.paused || G.over || !G.stampAllowed) return;

    // Adjust for wobble offset
    const adjX = x - G.wobbleOffsetX;
    const adjY = y - G.wobbleOffsetY;

    const cell = findCellBySymbolId(G.targetSymbolId);
    if (!cell) return;

    const result = checkStampValidity(adjX, adjY, G.currentStampRadius, cell);

    // Record stamp on cell
    cell.stamped   = true;
    cell.stampX    = adjX;
    cell.stampY    = adjY;
    cell.stampValid = result.valid;

    // Feedback
    G.stampAllowed = false;
    if (result.valid) {
        showToast('✓ मान्य — VALID', 'valid');
        flashScreen('rgba(46,125,50,0.18)');
        G.score += G.mode.pointsPerValid;
        updateHUD();
    } else {
        showToast('✗ अमान्य — SPOILED', 'spoiled');
        flashScreen('rgba(192,57,43,0.25)');
        shakeCanvas();
    }

    // Practice mode feedback
    if (G.mode.id === 'practice') {
        updatePracticePanel(adjX, adjY, G.currentStampRadius, cell, result);
    }

    // Store result
    G.results.push({
        symbol: G.targetSymbol,
        valid:  result.valid,
        stampX: adjX, stampY: adjY,
    });

    // Advance after delay
    const delay = G.mode.id === 'practice' ? 1800 : 1200;
    setTimeout(() => {
        G.stampAllowed = true;
        advanceBallot();
    }, delay);
}

// ── Advance to next ballot ────────────────────
function advanceBallot() {
    G.ballotIndex++;

    if (G.mode.id === 'practice') {
        // Restart same ballot with new target
        loadBallot();
        document.getElementById('practicePanel').style.display = 'none';
        return;
    }

    if (G.ballotIndex >= G.mode.totalBallots) {
        // All done
        endGame();
        return;
    }

    loadBallot();
}

// ── Load / refresh ballot ─────────────────────
function loadBallot() {
    computeBallotLayout(canvas);
    G.currentStampRadius = getStampRadius(ballotLayout.cellW, ballotLayout.cellH);

    // Pick a new random target from the shuffled grid
    const available = ballotCells.filter(c => c.symbol);
    const target = available[Math.floor(Math.random() * available.length)];
    G.targetSymbolId = target.symbol.id;
    G.targetSymbol   = target.symbol;

    // Update target panel
    document.getElementById('targetSymbol').textContent   = target.symbol.emoji;
    document.getElementById('targetNameNp').textContent   = target.symbol.np;
    document.getElementById('targetNameEn').textContent   = target.symbol.en;

    // Update ballot counter
    const total = G.mode.totalBallots;
    const current = G.mode.id === 'practice' ? G.practiceAttempts + 1 : G.ballotIndex + 1;
    const label = G.mode.id === 'practice'
        ? `अभ्यास ${current} · Practice ${current}`
        : `मतपत्र ${current}/${total} · Ballot ${current}/${total}`;
    document.getElementById('hudBallot').textContent = label;

    if (G.mode.id === 'practice') G.practiceAttempts++;
}

// ── Timer ─────────────────────────────────────
function updateTimer(dt) {
    if (G.mode.timerSeconds === 0) return; // practice has no timer
    G.timeRemaining = Math.max(0, G.timeRemaining - dt / 1000);
    const secs = Math.ceil(G.timeRemaining);
    document.getElementById('timerNum').textContent = secs;

    // Update ring
    const offset = getTimerDashoffset(G.timeRemaining, G.mode.timerSeconds);
    const arc = document.getElementById('timerArc');
    arc.style.strokeDashoffset = offset;
    arc.classList.toggle('warning', G.timeRemaining <= 10);

    if (G.timeRemaining <= 0 && !G.over) {
        endGame();
    }
}

function updateHUD() {
    document.getElementById('hudScore').textContent = G.score;
}

// ── Main loop ─────────────────────────────────
function loop(timestamp) {
    if (G.paused || G.over) return;

    const dt = Math.min(timestamp - lastTimestamp, 60);
    lastTimestamp = timestamp;

    G.highlightPulse += 0.07;

    // Wobble update
    if (G.mode.wobble) {
        updateWobble(dt);
        G.wobbleOffsetX = wobbleState.offsetX;
        G.wobbleOffsetY = wobbleState.offsetY;
    }

    // Timer
    updateTimer(dt);

    // Render
    ctx.save();
    if (G.mode.wobble) {
        ctx.translate(G.wobbleOffsetX, G.wobbleOffsetY);
    }
    drawBallot(ctx, canvas, G.targetSymbolId, G.highlightPulse);
    ctx.restore();

    // Stamp cursor (not affected by wobble)
    if (stamp.visible && stamp.x > 0) {
        const cell = findCellBySymbolId(G.targetSymbolId);
        const isNear = cell && Math.abs(stamp.x - cell.cx) < ballotLayout.cellW * 2
                             && Math.abs(stamp.y - cell.cy) < ballotLayout.cellH * 2;
        drawStampCursor(ctx, stamp.x, stamp.y, G.currentStampRadius, isNear);
    }

    // Magnifier
    if (stamp.magnifierOn && stamp.visible) {
        drawMagnifier(ctx, canvas, stamp.x, stamp.y);
    }

    animId = requestAnimationFrame(loop);
}

// ── Start game ────────────────────────────────
function startGame(modeId) {
    const mode = MODES[modeId];
    G = {
        mode,
        ballotIndex: 0,
        targetSymbolId: null,
        targetSymbol: null,
        timeRemaining: mode.timerSeconds,
        score: 0,
        results: [],
        paused: false,
        over: false,
        highlightPulse: 0,
        currentStampRadius: 24,
        stampAllowed: true,
        practiceAttempts: 0,
        wobbleOffsetX: 0,
        wobbleOffsetY: 0,
    };
    window._gameState = G;

    showScreen('game');
    resizeCanvas();

    // HUD setup
    document.getElementById('hudMode').textContent  = mode.nameEn;
    document.getElementById('hudScore').textContent = '0';
    const timerNum = document.getElementById('timerNum');
    timerNum.textContent = mode.timerSeconds > 0 ? mode.timerSeconds : '∞';
    document.getElementById('timerArc').style.strokeDashoffset = 0;
    document.getElementById('timerArc').classList.remove('warning');

    // Hide/show timer for practice
    document.querySelector('.timer-wrap').style.opacity = mode.timerSeconds > 0 ? '1' : '0.3';

    // Magnifier default state
    stamp.magnifierOn = mode.magnifierDefault;
    document.getElementById('btnMagnifier').classList.toggle('active', stamp.magnifierOn);

    // Dim mode effects
    applyDimFilter(canvas, mode.blurAmount);
    setVignette(mode.vignette);
    if (mode.wobble) initWobble();

    // Practice panel
    document.getElementById('practicePanel').style.display = 'none';

    // Load first ballot
    loadBallot();

    // Start loop
    lastTimestamp = performance.now();
    cancelAnimationFrame(animId);
    animId = requestAnimationFrame(loop);
}

// ── End game ──────────────────────────────────
function endGame() {
    G.over = true;
    cancelAnimationFrame(animId);

    removeDimFilter(canvas);
    setVignette(false);
    stopWobble();

    // For practice, just show a simple message instead of full results
    if (G.mode.id === 'practice') {
        showToast(`अभ्यास सम्पन्न! ${G.practiceAttempts} पटक प्रयास — Practice complete!`, 'info', 2000);
        setTimeout(() => showScreen('start'), 2200);
        return;
    }

    // Fill any missing results (ran out of time)
    while (G.results.length < G.mode.totalBallots) {
        G.results.push({ symbol: null, valid: false, stampX: 0, stampY: 0 });
    }

    const calc = calculateFinalScore(G.results, G.timeRemaining, G.mode.id);

    showResultsScreen(calc);
}

// ── Results screen ────────────────────────────
function showResultsScreen(calc) {
    const { score, validCount, timeBonus } = calc;
    const total = G.mode.totalBallots;

    document.getElementById('resFinalScore').textContent = score;
    document.getElementById('resValid').textContent      = `${validCount}/${total}`;
    document.getElementById('resTimeBonus').textContent  = `+${timeBonus}`;

    // Icon & title
    const icons   = ['📋', '🗳️', '🏛️', '📜'];
    document.getElementById('resultsIcon').textContent   = icons[Math.floor(Math.random() * icons.length)];
    document.getElementById('resultsTitleNp').textContent = 'मतगणना सम्पन्न';
    document.getElementById('resultsTitleEn').textContent = 'COUNTING COMPLETE';

    // Per-ballot verdicts
    const list = document.getElementById('verdictsList');
    list.innerHTML = '';
    G.results.forEach((r, i) => {
        const row = document.createElement('div');
        row.className = 'verdict-row';
        row.style.animationDelay = `${i * 0.15}s`;

        const symEmoji = r.symbol ? r.symbol.emoji : '—';
        const symName  = r.symbol ? `${r.symbol.np} / ${r.symbol.en}` : 'No stamp';

        row.innerHTML = `
            <span class="verdict-num">मतपत्र ${i + 1}</span>
            <span class="verdict-symbol">${symEmoji}</span>
            <span class="verdict-name">${symName}</span>
            <span class="verdict-mark ${r.valid ? 'valid' : 'spoiled'}">${r.valid ? '✓ मान्य' : '✗ अमान्य'}</span>
            <span class="verdict-pts ${r.valid ? 'pos' : 'zero'}">${r.valid ? `+${G.mode.pointsPerValid}` : '0'}</span>
        `;
        list.appendChild(row);
    });

    // Official verdict message
    document.getElementById('verdictMsg').textContent =
        getOfficialVerdict(validCount, total, G.mode.id);

    showScreen('results');
}

// ── Pause / Resume ────────────────────────────
function togglePause() {
    if (G.over) return;
    G.paused = true;
    showScreen('pause');
}

function resumeGame() {
    G.paused = false;
    showScreen('game');
    lastTimestamp = performance.now();
    animId = requestAnimationFrame(loop);
}

// ── Magnifier toggle ──────────────────────────
function toggleMagnifier() {
    if (G.mode && G.mode.id === 'practice') return; // always on in practice
    stamp.magnifierOn = !stamp.magnifierOn;
    document.getElementById('btnMagnifier').classList.toggle('active', stamp.magnifierOn);
}

// ── Visual effects ────────────────────────────
let flashEl = null;
function flashScreen(color) {
    if (!flashEl) {
        flashEl = document.getElementById('screenFlash');
        if (!flashEl) {
            flashEl = document.createElement('div');
            flashEl.id = 'screenFlash';
            document.body.appendChild(flashEl);
        }
    }
    flashEl.style.background = color;
    flashEl.style.opacity = '1';
    setTimeout(() => { flashEl.style.opacity = '0'; }, 180);
}

function shakeCanvas() {
    canvas.style.transition = 'transform 0.05s';
    const shakes = [[-6,2],[6,-2],[-4,4],[4,-3],[0,0]];
    let i = 0;
    const doShake = () => {
        if (i >= shakes.length) { canvas.style.transform = ''; return; }
        canvas.style.transform = `translate(${shakes[i][0]}px,${shakes[i][1]}px)`;
        i++;
        setTimeout(doShake, 55);
    };
    doShake();
}

// ── Dim vignette element (create if missing) ──
(function ensureVignette() {
    if (!document.getElementById('dimVignette')) {
        const v = document.createElement('div');
        v.id = 'dimVignette';
        document.body.appendChild(v);
    }
    if (!document.getElementById('screenFlash')) {
        const f = document.createElement('div');
        f.id = 'screenFlash';
        document.body.appendChild(f);
    }
})();

// ── Button wiring ─────────────────────────────

// Start screen mode buttons
document.getElementById('btnRush').addEventListener('click', () => startGame('rush'));
document.getElementById('btnDim').addEventListener('click',  () => startGame('dim'));
document.getElementById('btnPractice').addEventListener('click', () => startGame('practice'));

// Pause
document.getElementById('btnPauseGame').addEventListener('click', togglePause);
document.getElementById('btnResume').addEventListener('click', resumeGame);
document.getElementById('btnQuitToHome').addEventListener('click', () => {
    cancelAnimationFrame(animId);
    G.over = true;
    removeDimFilter(canvas);
    setVignette(false);
    stopWobble();
    showScreen('start');
});

// Magnifier
document.getElementById('btnMagnifier').addEventListener('click', toggleMagnifier);

// Results
document.getElementById('btnPlayAgain').addEventListener('click', () => {
    startGame(G.mode.id);
});
document.getElementById('btnResultsHome').addEventListener('click', () => showScreen('start'));

// How to play (add a button if needed, or trigger via click on title)
document.querySelector('.game-title') && document.querySelector('.game-title').addEventListener('click', () => {
    showScreen('howto');
});
document.getElementById('btnHowtoClose') && document.getElementById('btnHowtoClose').addEventListener('click', () => {
    showScreen('start');
});

// ── Boot ──────────────────────────────────────
showScreen('start');
