/* ═══════════════════════════════════════════════
   modes.js — Game mode configurations & logic
   ═══════════════════════════════════════════════ */

const MODES = {
    rush: {
        id: 'rush',
        nameNp: 'प्रिसिन्क्ट रश',
        nameEn: 'PRECINCT RUSH',
        totalBallots: 5,
        timerSeconds: 60,
        blurAmount: 0,
        wobble: false,
        vignette: false,
        magnifierDefault: false,
        pointsPerValid: 20,
        timeBonusMultiplier: 2,
    },
    dim: {
        id: 'dim',
        nameNp: 'अँध्यारो बुथ',
        nameEn: 'DIMLY LIT BOOTH',
        totalBallots: 5,
        timerSeconds: 45,
        blurAmount: 1.5,
        wobble: true,
        vignette: true,
        magnifierDefault: false,
        pointsPerValid: 20,
        timeBonusMultiplier: 2,
    },
    practice: {
        id: 'practice',
        nameNp: 'अभ्यास',
        nameEn: 'PRACTICE',
        totalBallots: 1,
        timerSeconds: 0, // no timer
        blurAmount: 0,
        wobble: false,
        vignette: false,
        magnifierDefault: true,
        pointsPerValid: 0,
        timeBonusMultiplier: 0,
    },
};

/* ── Wobble state ── */
let wobbleState = {
    active: false,
    offsetX: 0,
    offsetY: 0,
    targetX: 0,
    targetY: 0,
    timer: 0,
    interval: 0,
};

function initWobble() {
    wobbleState = { active: true, offsetX: 0, offsetY: 0, targetX: 0, targetY: 0, timer: 0, interval: getWobbleInterval() };
}

function getWobbleInterval() {
    return 2000 + Math.random() * 2000;
}

function updateWobble(dt) {
    if (!wobbleState.active) return;
    wobbleState.timer += dt;
    if (wobbleState.timer >= wobbleState.interval) {
        wobbleState.timer = 0;
        wobbleState.interval = getWobbleInterval();
        wobbleState.targetX = (Math.random() - 0.5) * 16;
        wobbleState.targetY = (Math.random() - 0.5) * 10;
    }
    // Smooth lerp toward target
    wobbleState.offsetX += (wobbleState.targetX - wobbleState.offsetX) * 0.04;
    wobbleState.offsetY += (wobbleState.targetY - wobbleState.offsetY) * 0.04;
}

function stopWobble() {
    wobbleState.active = false;
    wobbleState.offsetX = 0;
    wobbleState.offsetY = 0;
}

/* ── Dim mode canvas filter ── */
function applyDimFilter(canvas, blurAmount) {
    canvas.style.filter = blurAmount > 0 ? `blur(${blurAmount}px)` : '';
}

function removeDimFilter(canvas) {
    canvas.style.filter = '';
}

/* ── Vignette overlay ── */
function setVignette(active) {
    const el = document.getElementById('dimVignette');
    if (!el) return;
    el.classList.toggle('active', active);
}

/* ── Score calculation ── */
function calculateFinalScore(results, timeRemaining, mode) {
    const cfg = MODES[mode];
    let score = 0;
    let validCount = 0;

    results.forEach(r => {
        if (r.valid) {
            score += cfg.pointsPerValid;
            validCount++;
        }
    });

    const timeBonus = Math.floor(timeRemaining * cfg.timeBonusMultiplier);
    score += timeBonus;

    return { score, validCount, timeBonus };
}

/* ── Official verdict message ── */
function getOfficialVerdict(validCount, totalBallots, modeName) {
    const ratio = validCount / totalBallots;

    if (totalBallots === 1) {
        return validCount === 1
            ? '"A textbook placement. The Election Commission thanks you for your democratic precision."'
            : '"The ballot has been rejected. Please practice your stamping technique before election day."';
    }

    if (ratio === 1.0) {
        return '"Perfect score! All ballots are valid. Your steady hand is a credit to democracy."';
    } else if (ratio >= 0.8) {
        return '"Excellent work. Almost all ballots passed inspection. A minor tremor, but democracy survives."';
    } else if (ratio >= 0.6) {
        return '"Acceptable performance. Some ballots were spoiled. The count continues with valid votes only."';
    } else if (ratio >= 0.4) {
        return '"Concerning results. Many ballots were spoiled. The Election Commission urges further practice."';
    } else if (ratio > 0) {
        return '"Deeply troubling. The majority of ballots were invalidated. Democracy teeters on a shaky hand."';
    } else {
        return '"No valid ballots. Every stamp touched a line. The Election Commission is deeply disappointed."';
    }
}

/* ── Timer helpers ── */
function getTimerDashoffset(secondsRemaining, totalSeconds) {
    if (totalSeconds === 0) return 113; // no timer
    const circumference = 113; // 2π×18
    const ratio = secondsRemaining / totalSeconds;
    return circumference * (1 - ratio);
}
