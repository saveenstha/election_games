/* ═══════════════════════════════════════════════
   ballot.js — Ballot grid definitions & drawing
   ═══════════════════════════════════════════════ */

const SYMBOLS = [
    { id:'sun',        emoji:'☀️',  np:'सूर्य',        en:'Sun'          },
    { id:'tree',       emoji:'🌳',  np:'रुख',          en:'Tree'         },
    { id:'star',       emoji:'★',   np:'तारा',         en:'Star'         },
    { id:'bell',       emoji:'🔔',  np:'घन्टी',        en:'Bell'         },
    { id:'umbrella',   emoji:'☂️',  np:'छाता',         en:'Umbrella'     },
    { id:'speaker',    emoji:'📣',  np:'लाउडस्पीकर',   en:'Speaker'      },
    { id:'bicycle',    emoji:'🚲',  np:'साइकल',        en:'Bicycle'      },
    { id:'drum',       emoji:'🥁',  np:'ढोल',          en:'Drum'         },
    { id:'glass',      emoji:'🥛',  np:'गिलास',        en:'Glass'        },
    { id:'eye',        emoji:'👁️',  np:'आँखा',         en:'Eye'          },
    { id:'namaste',    emoji:'🙏',  np:'नमस्ते',        en:'Namaste'      },
    { id:'rooster',    emoji:'🐓',  np:'भाले',          en:'Rooster'      },
    { id:'hand',       emoji:'✋',  np:'हात',           en:'Hand'         },
    { id:'basket',     emoji:'🧺',  np:'डोको',          en:'Basket'       },
    { id:'sickle',     emoji:'☭',   np:'हँसिया',        en:'Sickle'       },
    { id:'lotus',      emoji:'🪷',  np:'कमल',           en:'Lotus'        },
    { id:'house',      emoji:'🏠',  np:'घर',            en:'House'        },
    { id:'torch',      emoji:'🔦',  np:'मसाल',          en:'Torch'        },
    { id:'clock',      emoji:'🕐',  np:'घडी',           en:'Clock'        },
    { id:'khukuri',    emoji:'🔪',  np:'खुकुरी',        en:'Khukuri'      },
    { id:'pickaxe',    emoji:'⛏️',  np:'कोदाली',        en:'Pickaxe'      },
    { id:'horn',       emoji:'📯',  np:'सिंगा',         en:'Horn'         },
    { id:'plant',      emoji:'🪴',  np:'बिरुवा',        en:'Plant'        },
    { id:'battery',    emoji:'🔋',  np:'ब्याट्री',      en:'Battery'      },
    { id:'farmer',     emoji:'👨‍🌾', np:'किसान',        en:'Farmer'       },
    { id:'flower',     emoji:'🌸',  np:'फूल',           en:'Flower'       },
    { id:'spectacles', emoji:'👓',  np:'चश्मा',         en:'Spectacles'   },
    { id:'bee',        emoji:'🐝',  np:'मौरी',          en:'Bee'          },
    { id:'trident',    emoji:'🔱',  np:'त्रिशूल',       en:'Trident'      },
    { id:'horse',      emoji:'🐴',  np:'घोडा',          en:'Horse'        },
    { id:'rose',       emoji:'🌹',  np:'गुलाब',         en:'Rose'         },
    { id:'wheel',      emoji:'☸️',  np:'धर्मचक्र',      en:'Dharma Wheel' },
    { id:'handshake',  emoji:'🤝',  np:'मैत्री',        en:'Handshake'    },
    { id:'whistle',    emoji:'🎺',  np:'सिट्ठी',        en:'Whistle'      },
    { id:'stool',      emoji:'🪑',  np:'पिर्का',        en:'Stool'        },
    { id:'mushroom',   emoji:'🍄',  np:'च्याउ',         en:'Mushroom'     },
    { id:'bowl',       emoji:'🥣',  np:'कचौरा',         en:'Bowl'         },
    { id:'bus',        emoji:'🚌',  np:'बस',            en:'Bus'          },
    { id:'vase',       emoji:'🏺',  np:'घैंटो',         en:'Vase'         },
    { id:'book',       emoji:'📖',  np:'किताब',         en:'Book'         },
    { id:'phone',      emoji:'📱',  np:'फोन',           en:'Phone'        },
    { id:'victory',    emoji:'✌️',  np:'जित',           en:'Victory'      },
    { id:'lion',       emoji:'🦁',  np:'सिंह',          en:'Lion'         },
    { id:'boat',       emoji:'⛵',  np:'डुंगा',         en:'Boat'         },
    { id:'cow',        emoji:'🐄',  np:'गाई',           en:'Cow'          },
    { id:'plow',       emoji:'⚒️',  np:'हलो',           en:'Plow'         },
    { id:'cup',        emoji:'🏆',  np:'कप',            en:'Cup'          },
    { id:'kite',       emoji:'🪁',  np:'चंगा',          en:'Kite'         },
    { id:'lantern',    emoji:'🏮',  np:'बत्ती',          en:'Lantern'      },
    { id:'fish',       emoji:'🐟',  np:'माछा',          en:'Fish'         },
    { id:'mountain',   emoji:'⛰️',  np:'हिमाल',         en:'Mountain'     },
    { id:'elephant',   emoji:'🐘',  np:'हात्ती',        en:'Elephant'     },
    { id:'pen',        emoji:'✒️',  np:'कलम',           en:'Pen'          },
    { id:'flame',      emoji:'🔥',  np:'आगो',           en:'Flame'        },
    { id:'crown',      emoji:'👑',  np:'मुकुट',         en:'Crown'        },
    { id:'anchor',     emoji:'⚓',  np:'लंगर',          en:'Anchor'       },
    { id:'bridge',     emoji:'🌉',  np:'पुल',           en:'Bridge'       },
];

// Grid layout: COLS x ROWS
const GRID_COLS = 5;
const GRID_ROWS = 12;

// Computed cell data (filled in by computeBallotLayout)
let ballotCells = [];  // { symbol, x1, y1, x2, y2, row, col, cx, cy, innerW, innerH }
let ballotLayout = {}; // origin, cellW, cellH, etc.

/**
 * Compute the ballot grid layout based on canvas size.
 * Fills ballotCells[] with pixel coordinates.
 */
function computeBallotLayout(canvas) {
    const BORDER_W = 2; // cell border px
    const HEADER_H = 72; // reserved for ballot header text
    const PADDING  = 12;

    const availW = canvas.width  - PADDING * 2;
    const availH = canvas.height - PADDING * 2 - HEADER_H;

    const cellW = Math.floor(availW / GRID_COLS);
    const cellH = Math.floor(availH / GRID_ROWS);

    const gridW = cellW * GRID_COLS;
    const gridH = cellH * GRID_ROWS;

    const originX = PADDING + Math.floor((availW - gridW) / 2);
    const originY = PADDING + HEADER_H;

    ballotLayout = { originX, originY, cellW, cellH, BORDER_W, HEADER_H, PADDING, gridW, gridH };
    ballotCells = [];

    // Shuffle symbols so they're randomised each new ballot
    const shuffled = shuffleArray([...SYMBOLS]);

    for (let row = 0; row < GRID_ROWS; row++) {
        for (let col = 0; col < GRID_COLS; col++) {
            const idx = row * GRID_COLS + col;
            const symbol = idx < shuffled.length ? shuffled[idx] : null;

            const cellLeft = originX + col * cellW;
            const cellTop  = originY + row * cellH;

            // inner border (where stamp must stay)
            const x1 = cellLeft + BORDER_W;
            const y1 = cellTop  + BORDER_W;
            const x2 = cellLeft + cellW - BORDER_W;
            const y2 = cellTop  + cellH - BORDER_W;

            ballotCells.push({
                symbol,
                row, col,
                cellLeft, cellTop,
                x1, y1, x2, y2,
                cx: (x1 + x2) / 2,
                cy: (y1 + y2) / 2,
                innerW: x2 - x1,
                innerH: y2 - y1,
                stamped: false,
                stampX: 0, stampY: 0,
                stampValid: false,
            });
        }
    }
}

/**
 * Find the cell matching a symbol id
 */
function findCellBySymbolId(id) {
    return ballotCells.find(c => c.symbol && c.symbol.id === id) || null;
}

/**
 * Draw the full ballot onto a canvas context.
 */
function drawBallot(ctx, canvas, targetSymbolId, highlightPulse, stampedMark) {
    const { originX, originY, cellW, cellH, BORDER_W, gridW, gridH } = ballotLayout;

    // ── Paper background ──────────────────────────
    ctx.fillStyle = '#F5F0E8';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Paper grain noise
    drawPaperGrain(ctx, canvas);

    // ── Ballot header ─────────────────────────────
    drawBallotHeader(ctx, canvas, originX, gridW);

    // ── Outer double border ───────────────────────
    ctx.strokeStyle = '#1A1A1A';
    ctx.lineWidth = 3;
    ctx.strokeRect(originX - 1, originY - 1, gridW + 2, gridH + 2);
    ctx.lineWidth = 1;
    ctx.strokeRect(originX - 4, originY - 4, gridW + 8, gridH + 8);

    // ── Cells ─────────────────────────────────────
    ballotCells.forEach(cell => {
        if (!cell.symbol) return;

        const isTarget = cell.symbol.id === targetSymbolId;

        // Cell background
        ctx.fillStyle = isTarget ? 'rgba(201,168,76,0.08)' : '#F5F0E8';
        ctx.fillRect(cell.cellLeft, cell.cellTop, cellW, cellH);

        // Target pulsing highlight
        if (isTarget && highlightPulse !== undefined) {
            const alpha = 0.15 + 0.12 * Math.sin(highlightPulse);
            ctx.fillStyle = `rgba(201,168,76,${alpha})`;
            ctx.fillRect(cell.cellLeft, cell.cellTop, cellW, cellH);

            // Pulsing border
            const borderAlpha = 0.5 + 0.5 * Math.sin(highlightPulse);
            ctx.strokeStyle = `rgba(201,168,76,${borderAlpha})`;
            ctx.lineWidth = 2;
            ctx.strokeRect(cell.cellLeft + 1, cell.cellTop + 1, cellW - 2, cellH - 2);
        }

        // Cell border
        ctx.strokeStyle = '#1A1A1A';
        ctx.lineWidth = BORDER_W;
        ctx.strokeRect(cell.cellLeft, cell.cellTop, cellW, cellH);

        // Draw symbol (emoji)
        if (!cell.stamped) {
            const fontSize = Math.min(cellW, cellH) * 0.52;
            ctx.font = `${fontSize}px serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#1A1A1A';
            ctx.fillText(cell.symbol.emoji, cell.cx, cell.cy);
        }

        // Draw stamp mark if stamped
        if (cell.stamped) {
            drawStampMark(ctx, cell.stampX, cell.stampY, getStampRadius(cellW, cellH), cell.stampValid);
            // Also draw symbol faintly behind
            const fontSize = Math.min(cellW, cellH) * 0.52;
            ctx.font = `${fontSize}px serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.globalAlpha = 0.18;
            ctx.fillText(cell.symbol.emoji, cell.cx, cell.cy);
            ctx.globalAlpha = 1;
        }
    });
}

/**
 * Draw the header text on the ballot
 */
function drawBallotHeader(ctx, canvas, originX, gridW) {
    const cx = originX + gridW / 2;
    const { HEADER_H, PADDING } = ballotLayout;

    // Header box
    ctx.strokeStyle = '#1A1A1A';
    ctx.lineWidth = 2;
    ctx.strokeRect(originX - 1, PADDING, gridW + 2, HEADER_H - 4);
    ctx.lineWidth = 1;
    ctx.strokeRect(originX - 4, PADDING - 3, gridW + 8, HEADER_H + 2);

    // Nepali title line 1
    ctx.fillStyle = '#1A3A5C';
    ctx.font = 'bold 13px "Tiro Devanagari Hindi", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('प्रतिनिधि सभा सदस्य निर्वाचन, २०८२', cx, PADDING + 8);

    // Nepali title line 2
    ctx.font = '11px "Tiro Devanagari Hindi", serif';
    ctx.fillStyle = '#1A1A1A';
    ctx.fillText('समानुपातिक निर्वाचन प्रणालीको मतपत्र', cx, PADDING + 26);

    // English subtitle
    ctx.font = '9px "Special Elite", monospace';
    ctx.fillStyle = '#3A3A3A';
    ctx.fillText('House of Representatives Election · Proportional Ballot', cx, PADDING + 44);

    // Instruction line
    ctx.font = 'bold 10px "Tiro Devanagari Hindi", serif';
    ctx.fillStyle = '#C0392B';
    ctx.fillText('एउटा कोठामित्र मात्र मतसङ्केत (छाप) गर्नुहोस् · Mark only ONE box', cx, PADDING + 56);
}

/**
 * Draw the auspicious swastika stamp mark (शुभ चिन्ह)
 * This is the traditional Hindu/Buddhist right-facing ᯼ symbol.
 */
function drawStampMark(ctx, cx, cy, radius, isValid) {
    ctx.save();
    ctx.translate(cx, cy);

    // Ink bleed circle (smear)
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#1A3A8F ';
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    // Main ink color
    ctx.globalAlpha = isValid ? 0.88 : 0.75;
    ctx.fillStyle = '#1A3A8F';
    ctx.strokeStyle = '#1A3A8F';

    // Draw Hindu/Buddhist auspicious swastika (right-facing, traditional)
    // Rotated 45 degrees as is traditional in South Asian ballots
    // ctx.rotate(Math.PI / 6);

    const arm = radius * 0.52;
    const thick = radius * 0.22;
    const serif = radius * 0.18;

    ctx.lineWidth = thick;
    ctx.lineCap = 'butt';

    // Horizontal arm
    ctx.beginPath();
    ctx.moveTo(-arm, 0);
    ctx.lineTo(arm, 0);
    ctx.stroke();

    // Vertical arm
    ctx.beginPath();
    ctx.moveTo(0, -arm);
    ctx.lineTo(0, arm);
    ctx.stroke();

    // Four serif legs (right-facing swastika / ᯼)
    ctx.lineWidth = thick * 0.8;
    ctx.lineCap = 'square';
    // Top arm → left (Hindu orientation)
    ctx.beginPath(); ctx.moveTo(0, -arm); ctx.lineTo(-serif, -arm); ctx.stroke();
    // Right arm → up
    ctx.beginPath(); ctx.moveTo(arm, 0); ctx.lineTo(arm, -serif); ctx.stroke();
    // Bottom arm → right
    ctx.beginPath(); ctx.moveTo(0, arm); ctx.lineTo(serif, arm); ctx.stroke();
    // Left arm → down
    ctx.beginPath(); ctx.moveTo(-arm, 0); ctx.lineTo(-arm, serif); ctx.stroke();

    ctx.restore();
}

/**
 * Draw subtle paper grain
 */
function drawPaperGrain(ctx, canvas) {
    // Draw faint horizontal lines (ruled paper effect)
    ctx.strokeStyle = 'rgba(0,0,0,0.018)';
    ctx.lineWidth = 1;
    for (let y = 28; y < canvas.height; y += 28) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
}

/**
 * Calculate appropriate stamp radius for current cell size
 */
function getStampRadius(cellW, cellH) {
    const innerW = cellW - 4;
    const innerH = cellH - 4;
    // ~87% of the smaller inner dimension — intentionally tight
    return Math.floor(Math.min(innerW, innerH) * 0.435);
}

/**
 * Shuffle array (Fisher-Yates)
 */
function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/**
 * Pick N random distinct symbols
 */
function pickRandomSymbols(n) {
    return shuffleArray([...SYMBOLS]).slice(0, n);
}
