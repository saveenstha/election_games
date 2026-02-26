/* ═══════════════════════════════════════════════
   stamp.js — Stamp mechanic, hitbox, magnifier
   ═══════════════════════════════════════════════ */

const stamp = {
    x: -999,
    y: -999,
    visible: false,
    magnifierOn: false,
    MAGNIFIER_ZOOM: 1.9,
    MAGNIFIER_RADIUS: 70,
};

/**
 * Core validity check.
 * Returns { valid, distances }
 *   valid: boolean
 *   distances: { left, right, top, bottom } — positive = inside, negative = outside
 */
function checkStampValidity(stampX, stampY, stampRadius, cell) {
    const dLeft   = stampX - stampRadius - cell.x1;  // + = clear of left
    const dRight  = cell.x2 - (stampX + stampRadius); // + = clear of right
    const dTop    = stampY - stampRadius - cell.y1;   // + = clear of top
    const dBottom = cell.y2 - (stampY + stampRadius); // + = clear of bottom

    const valid = dLeft >= 0 && dRight >= 0 && dTop >= 0 && dBottom >= 0;

    return {
        valid,
        distances: { left: dLeft, right: dRight, top: dTop, bottom: dBottom }
    };
}

/**
 * Draw the custom stamp cursor on the overlay canvas / ctx.
 */
function drawStampCursor(ctx, x, y, radius, isNearTarget) {
    if (x < 0 || y < 0) return;
    ctx.save();
    ctx.translate(x, y);

    // Outer rubber stamp body (circle)
    ctx.strokeStyle = isNearTarget ? '#C9A84C' : '#1A3A8F';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(0, 0, radius + 6, 0, Math.PI * 2);
    ctx.stroke();

    // Preview of swastika mark (ghost)
    ctx.globalAlpha = 0.35;
    drawStampMark(ctx, 0, 0, radius, true);
    ctx.globalAlpha = 1;

    // Cross-hair lines
    ctx.strokeStyle = isNearTarget ? 'rgba(201,168,76,0.6)' : 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    const ch = radius + 18;
    ctx.beginPath();
    ctx.moveTo(-ch, 0); ctx.lineTo(ch, 0);
    ctx.moveTo(0, -ch); ctx.lineTo(0, ch);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.restore();
}

/**
 * Draw the magnifying glass effect on the main canvas.
 * Creates a zoomed circular viewport centered on the stamp.
 */
function drawMagnifier(ctx, canvas, stampX, stampY) {
    if (!stamp.magnifierOn) return;

    const zoom = stamp.MAGNIFIER_ZOOM;
    const mr   = stamp.MAGNIFIER_RADIUS;

    // Position magnifier above and to the left of stamp
    const mx = Math.max(mr + 10, Math.min(canvas.width  - mr - 10, stampX - mr * 0.8));
    const my = Math.max(mr + 10, Math.min(canvas.height - mr - 10, stampY - mr * 1.8));

    ctx.save();

    // Draw the zoomed content by scaling around the stamp point
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.clip();

    // Fill with paper color first
    ctx.fillStyle = '#F5F0E8';
    ctx.fill();

    // Translate so zoom is centered on stampX, stampY → mx, my
    ctx.translate(mx - stampX * zoom, my - stampY * zoom);
    ctx.scale(zoom, zoom);

    // Redraw the ballot content in the zoomed context
    drawBallot(ctx, canvas, window._gameState ? window._gameState.targetSymbolId : null,
               window._gameState ? window._gameState.highlightPulse : 0);

    // Also draw the stamp preview in the magnifier
    const stampR = window._gameState ? window._gameState.currentStampRadius : 20;
    ctx.globalAlpha = 0.4;
    drawStampMark(ctx, stampX, stampY, stampR, true);
    ctx.globalAlpha = 1;

    ctx.restore();

    // Magnifier border + lens shine
    ctx.save();
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.strokeStyle = '#5D4037';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Lens glare
    ctx.beginPath();
    ctx.arc(mx - mr * 0.28, my - mr * 0.28, mr * 0.22, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Handle
    ctx.strokeStyle = '#3E2723';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(mx + mr * 0.68, my + mr * 0.68);
    ctx.lineTo(mx + mr * 1.2, my + mr * 1.2);
    ctx.stroke();

    // 🔍 label
    ctx.font = '10px "Special Elite", monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('×' + zoom.toFixed(1), mx, my + mr - 4);

    ctx.restore();
}

/**
 * Draw ink splat particle effect on canvas
 */
function createInkSplat(ctx, x, y, radius, valid) {
    const color = valid ? '#2E7D32' : '#1A3A8F';
    const count = valid ? 10 : 14;
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
        const dist  = radius * 0.7 + Math.random() * radius * 0.8;
        const r     = 1.5 + Math.random() * 3;
        ctx.beginPath();
        ctx.arc(
            x + Math.cos(angle) * dist,
            y + Math.sin(angle) * dist,
            r, 0, Math.PI * 2
        );
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.3 + Math.random() * 0.4;
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info', duration = 1400) {
    const wrap = document.getElementById('toastWrap');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), duration);
}

/**
 * Update practice feedback panel
 */
function updatePracticePanel(stampX, stampY, stampRadius, cell, result) {
    const panel = document.getElementById('practicePanel');
    const dists = document.getElementById('ppDistances');
    const verdict = document.getElementById('ppVerdict');
    const diagramCanvas = document.getElementById('ppDiagram');

    panel.style.display = 'block';

    const { distances, valid } = result;
    const fmt = v => `${v >= 0 ? '+' : ''}${Math.round(v)}px`;
    const cls = v => v >= 0 ? 'safe' : 'danger';

    dists.innerHTML = `
        <div class="pp-dist-row">
            <span>बायाँ/Left</span>
            <span class="pp-dist-val ${cls(distances.left)}">${fmt(distances.left)}</span>
        </div>
        <div class="pp-dist-row">
            <span>दायाँ/Right</span>
            <span class="pp-dist-val ${cls(distances.right)}">${fmt(distances.right)}</span>
        </div>
        <div class="pp-dist-row">
            <span>माथि/Top</span>
            <span class="pp-dist-val ${cls(distances.top)}">${fmt(distances.top)}</span>
        </div>
        <div class="pp-dist-row">
            <span>तल/Bottom</span>
            <span class="pp-dist-val ${cls(distances.bottom)}">${fmt(distances.bottom)}</span>
        </div>
    `;

    verdict.textContent = valid
        ? '✅ मान्य — VALID'
        : '❌ अमान्य — SPOILED';
    verdict.className = `pp-verdict ${valid ? 'valid' : 'spoiled'}`;

    // Draw mini diagram
    drawPracticeDiagram(diagramCanvas, stampX, stampY, stampRadius, cell, valid);
}

function drawPracticeDiagram(canvas, stampX, stampY, stampRadius, cell, valid) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Scale everything to fit
    const cellW = cell.x2 - cell.x1;
    const cellH = cell.y2 - cell.y1;
    const scale = Math.min((W - 20) / cellW, (H - 20) / cellH) * 0.85;
    const offX  = W / 2 - (cell.cx - cell.x1) * scale;
    const offY  = H / 2 - (cell.cy - cell.y1) * scale;

    const toCanX = x => offX + (x - cell.x1) * scale;
    const toCanY = y => offY + (y - cell.y1) * scale;

    // Background
    ctx.fillStyle = '#F5F0E8';
    ctx.fillRect(0, 0, W, H);

    // Cell box
    ctx.strokeStyle = '#1A1A1A';
    ctx.lineWidth = 2;
    ctx.strokeRect(toCanX(cell.x1), toCanY(cell.y1),
                   cellW * scale, cellH * scale);

    // Stamp circle
    const scaledR = stampRadius * scale;
    const sx = toCanX(stampX);
    const sy = toCanY(stampY);
    ctx.beginPath();
    ctx.arc(sx, sy, scaledR, 0, Math.PI * 2);
    ctx.strokeStyle = valid ? '#2E7D32' : '#1A3A8F';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = valid ? 'rgba(46,125,50,0.12)' : 'rgba(192,57,43,0.12)';
    ctx.fill();

    // Center dot
    ctx.beginPath();
    ctx.arc(sx, sy, 3, 0, Math.PI * 2);
    ctx.fillStyle = valid ? '#2E7D32' : '#C0392B';
    ctx.fill();
}
