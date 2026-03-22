import type { RunData } from '../types';
import { formatCardName, getCardPortraitId } from './cardUtils';
import { formatEncounterName } from './encounterDict';

const imageCache = new Map<string, HTMLImageElement | null>();

function loadImage(src: string): Promise<HTMLImageElement | null> {
    if (imageCache.has(src)) {
        return Promise.resolve(imageCache.get(src) || null);
    }
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            imageCache.set(src, img);
            resolve(img);
        };
        img.onerror = () => {
            imageCache.set(src, null);
            resolve(null);
        };
        img.src = src;
    });
}

export async function generateDeckImage(run: RunData): Promise<HTMLCanvasElement> {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

    const playersToRender = run.players || [{
        characterName: run.meta?.characterName || 'Your Run Deck',
        cards: run.cards || [],
        relics: run.meta?.relics || []
    }];

    // Pre-sort cards for all players
    playersToRender.forEach(p => {
        p.cards = [...(p.cards || [])].sort((a, b) => {
            if (a.count !== b.count) return b.count - a.count;
            return a.id.localeCompare(b.id);
        });
    });

    const canvasWidth = 1080;
    const padding = 60;
    const gap = 24;
    const availableWidth = canvasWidth - (padding * 2);

    const relicSize = 72;
    const relicGap = 16;
    const relicsPerRow = Math.floor((availableWidth + relicGap) / (relicSize + relicGap));

    // Calculate top header height
    let currentY = padding;

    // Title wrapping logic
    const title = run.meta?.characterName || 'Your Run Deck';
    ctx.font = 'bold 72px sans-serif';
    const titleLines: string[] = [];
    const titleMaxWidth = availableWidth;

    if (ctx.measureText(title).width > titleMaxWidth && title.includes(' & ')) {
        const characters = title.split(' & ');
        characters.forEach((char, idx) => {
            if (idx < characters.length - 1) {
                titleLines.push(char + ' &');
            } else {
                titleLines.push(char);
            }
        });
    } else {
        titleLines.push(title);
    }

    const titleLineHeight = 80;
    const titleHeight = titleLines.length * titleLineHeight;
    currentY += titleHeight;

    if (run.meta) {
        currentY += 60; // run info badges (Ascension, Floor, Outcome…)
        if (run.meta.killedBy) {
            currentY += 48; // killed-by row
        }
        if (run.meta.bossEncounters && run.meta.bossEncounters.length > 0) {
            currentY += 44; // bosses row (with icons)
        }
    }
    currentY += 40; // spacing before players

    // Calculate layouts per player
    interface PlayerLayout {
        player: NonNullable<RunData['players']>[0];
        numCards: number;
        columns: number;
        cardSize: number;
        rows: number;
        relicsHeight: number;
        gridHeight: number;
        startY: number;
        totalHeight: number;
    }

    const layouts: PlayerLayout[] = [];

    for (let i = 0; i < playersToRender.length; i++) {
        const player = playersToRender[i];
        const numCards = player.cards.length;

        // If it's a single player, try to fill closer to 1920 height
        let bestCols = 5;
        if (playersToRender.length === 1 && numCards > 0) {
            let bestDiff = Infinity;
            const actualMinCols = numCards < 3 ? numCards : 3;
            const maxCols = Math.min(7, numCards);
            for (let c = actualMinCols; c <= maxCols; c++) {
                const size = Math.floor((availableWidth - (c - 1) * gap) / c);
                const r = Math.ceil(numCards / c);
                const gridH = r * size + (r - 1) * gap;
                const expectedTotalHeight = currentY + gridH + (padding * 2);
                const diff = Math.abs(expectedTotalHeight - 1920);
                if (diff < bestDiff) {
                    bestDiff = diff;
                    bestCols = c;
                }
            }
        } else {
            // Multiplayer: just use 5 columns (or less if <5 cards)
            bestCols = Math.min(5, Math.max(3, numCards));
        }

        if (bestCols === 0) bestCols = 1;
        const cardSize = Math.floor((availableWidth - (bestCols - 1) * gap) / bestCols);
        const rows = Math.ceil(numCards / bestCols);
        const gridHeight = numCards === 0 ? 0 : (rows * cardSize + (rows - 1) * gap);

        const hasRelics = player.relics && player.relics.length > 0;
        let relicsHeight = 0;
        if (hasRelics) {
            const relicRows = Math.ceil(player.relics!.length / relicsPerRow);
            relicsHeight = 80 + (relicRows * (relicSize + relicGap));
        }

        let playerHeaderHeight = 0;
        if (playersToRender.length > 1) {
            playerHeaderHeight = 80; // 'Character Name - X cards'
        } else {
            playerHeaderHeight = 60; // just 'X cards'
        }

        const totalH = playerHeaderHeight + relicsHeight + gridHeight + (i < playersToRender.length - 1 ? 80 : 0);

        layouts.push({
            player,
            numCards,
            columns: bestCols,
            cardSize,
            rows,
            relicsHeight,
            gridHeight,
            startY: currentY,
            totalHeight: totalH
        });

        currentY += totalH;
    }

    // currentY is now the bottom of the last player. Add padding.
    let canvasHeight = currentY + padding;
    if (playersToRender.length === 1) {
        canvasHeight = Math.max(canvasHeight, 1080);
    }

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Fill background
    ctx.fillStyle = '#0d0f12';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw top header
    let drawY = padding;
    ctx.fillStyle = '#d6b251';
    ctx.font = 'bold 72px sans-serif';

    titleLines.forEach((line) => {
        ctx.fillText(line, padding, drawY + 60);
        drawY += titleLineHeight;
    });

    if (run.meta) {
        const badges = [
            `A${run.meta.ascension} • ${run.meta.outcome}`,
            `Floor ${run.meta.floor}`
        ];
        if (run.meta.time) {
            badges.push(`Time: ${run.meta.time}`);
        }
        if (run.meta.buildId) {
            badges.push(`Patch ${run.meta.buildId}`);
        }
        if (run.meta.gameMode) {
            badges.push(run.meta.gameMode.charAt(0).toUpperCase() + run.meta.gameMode.slice(1));
        }
        // killedBy is drawn separately below the badges row

        ctx.font = '28px sans-serif';
        const badgePaddingX = 20;
        const badgePaddingY = 10;
        const badgeGap = 16;
        let badgeX = padding;

        badges.forEach(text => {
            // Calculate width and bold parts
            const parts = text.split(/(\d+|A\d+|Time:\s|Floor\s)/);
            let textWidth = 0;
            parts.forEach(part => {
                if (part.match(/^(\d+|A\d+)$/)) {
                    ctx.font = 'bold 28px sans-serif';
                } else {
                    ctx.font = '28px sans-serif';
                }
                textWidth += ctx.measureText(part).width;
            });

            const badgeWidth = textWidth + (badgePaddingX * 2);
            const badgeHeight = 28 + (badgePaddingY * 2);

            // Draw badge background
            ctx.fillStyle = 'rgba(255,255,255,0.05)';
            ctx.beginPath();
            ctx.roundRect(badgeX, drawY, badgeWidth, badgeHeight, 8);
            ctx.fill();

            // Draw badge border
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Draw text with bold parts
            let currentTextX = badgeX + badgePaddingX;
            parts.forEach(part => {
                if (part.match(/^(\d+|A\d+)$/)) {
                    ctx.font = 'bold 28px sans-serif';
                } else {
                    ctx.font = '28px sans-serif';
                }
                ctx.fillStyle = '#ebecf0';
                ctx.fillText(part, currentTextX, drawY + badgePaddingY + 22);
                currentTextX += ctx.measureText(part).width;
            });

            badgeX += badgeWidth + badgeGap;
        });

        drawY += 60;

        // Killed-by row: red badge on its own line
        if (run.meta.killedBy) {
            ctx.font = '28px sans-serif';
            const textWidth = ctx.measureText('Killed by ').width + (() => {
                ctx.font = 'bold 28px sans-serif';
                const w = ctx.measureText(formatEncounterName(run.meta.killedBy)).width;
                ctx.font = '28px sans-serif';
                return w;
            })();
            const badgePaddingX = 20;
            const badgePaddingY = 8;
            const badgeWidth = textWidth + badgePaddingX * 2;
            const badgeHeight = 28 + badgePaddingY * 2;

            ctx.fillStyle = 'rgba(224,82,82,0.12)';
            ctx.beginPath();
            ctx.roundRect(padding, drawY, badgeWidth, badgeHeight, 8);
            ctx.fill();
            ctx.strokeStyle = 'rgba(224,82,82,0.35)';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Draw "Killed by " in muted red, then the name in bold red
            let kx = padding + badgePaddingX;
            const ky = drawY + badgePaddingY + 22;
            ctx.fillStyle = '#e05252';
            ctx.font = '28px sans-serif';
            ctx.fillText('Killed by ', kx, ky);
            kx += ctx.measureText('Killed by ').width;
            ctx.font = 'bold 28px sans-serif';
            ctx.fillText(formatEncounterName(run.meta.killedBy), kx, ky);

            drawY += 48;
        }

        // Bosses row (if the run recorded boss encounters)
        if (run.meta.bossEncounters && run.meta.bossEncounters.length > 0) {
            const bossIconSize = 32;
            const bossIconGap = 8;
            const bossIcons = await Promise.all(
                run.meta.bossEncounters.map(id =>
                    loadImage(`${import.meta.env.BASE_URL}assets/bosses/${id}.webp`)
                )
            );

            ctx.font = '600 22px sans-serif';
            ctx.fillStyle = '#90929c';
            ctx.fillText('BOSSES', padding, drawY + 26);

            const labelWidth = ctx.measureText('BOSSES').width + 16;
            let bossX = padding + labelWidth;
            run.meta.bossEncounters.forEach((bossId, idx) => {
                const isKiller = bossId === run.meta?.killedBy;
                const name = formatEncounterName(bossId);
                ctx.font = '600 22px sans-serif';
                const nameWidth = ctx.measureText(name).width;

                if (idx > 0) {
                    ctx.fillStyle = 'rgba(255,255,255,0.3)';
                    ctx.fillText(' → ', bossX, drawY + 26);
                    bossX += ctx.measureText(' → ').width;
                }

                const icon = bossIcons[idx];
                if (icon) {
                    const iconY = drawY + (44 - bossIconSize) / 2;
                    ctx.drawImage(icon, bossX, iconY, bossIconSize, bossIconSize);
                    bossX += bossIconSize + bossIconGap;
                }

                ctx.fillStyle = isKiller ? '#e05252' : '#ebecf0';
                ctx.fillText(name, bossX, drawY + 26);
                bossX += nameWidth;
            });
            drawY += 44;
        }
    }

    // Add gap before players
    drawY += 40;

    for (let i = 0; i < layouts.length; i++) {
        const layout = layouts[i];
        const p = layout.player;
        const pCardsTotal = p.cards.reduce((acc, c) => acc + c.count, 0);

        // Player Header
        if (playersToRender.length > 1) {
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 40px sans-serif';
            ctx.fillText(p.characterName, padding, drawY + 40);

            const textWidth = ctx.measureText(p.characterName).width;

            ctx.fillStyle = '#90929c';
            ctx.font = '28px sans-serif';
            ctx.fillText(`— ${pCardsTotal} cards`, padding + textWidth + 20, drawY + 38);
            drawY += 60;

            // Draw separator
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(padding, drawY);
            ctx.lineTo(canvasWidth - padding, drawY);
            ctx.stroke();
            drawY += 20;

        } else {
            ctx.fillStyle = '#90929c';
            ctx.font = '32px sans-serif';
            ctx.fillText(`${pCardsTotal} cards`, padding, drawY + 30);
            drawY += 60;
        }

        // Relics
        if (p.relics && p.relics.length > 0) {
            ctx.fillStyle = '#90929c';
            ctx.font = 'bold 28px sans-serif';
            ctx.fillText('RELICS', padding, drawY + 30);
            drawY += 50;

            let relicX = padding;
            for (const relic of p.relics) {
                if (relicX + relicSize > padding + availableWidth) {
                    relicX = padding;
                    drawY += relicSize + relicGap;
                }
                try {
                    const img = await loadImage(`${import.meta.env.BASE_URL}assets/relics/${relic}.webp`);
                    if (img) {
                        ctx.drawImage(img, relicX, drawY, relicSize, relicSize);
                    }
                } catch (e) { }
                relicX += relicSize + relicGap;
            }
            drawY += relicSize + relicGap + 20; // extra padding after relics
        }

        // Cards Grid
        const gridContentWidth = layout.columns * layout.cardSize + (layout.columns - 1) * gap;
        const gridStartX = padding + Math.floor((availableWidth - gridContentWidth) / 2);

        let cardPromises = p.cards.map((card, index) => {
            return loadImage(`${import.meta.env.BASE_URL}assets/portraits/${getCardPortraitId(card)}.webp`).then(img => ({ card, img, index }));
        });
        const cardResults = await Promise.all(cardPromises);

        cardResults.forEach(({ card, img, index }) => {
            const col = index % layout.columns;
            const row = Math.floor(index / layout.columns);

            const x = gridStartX + col * (layout.cardSize + gap);
            const y = drawY + row * (layout.cardSize + gap);

            if (img) {
                ctx.drawImage(img, x, y, layout.cardSize, layout.cardSize);
            } else {
                ctx.fillStyle = '#191c24';
                ctx.fillRect(x, y, layout.cardSize, layout.cardSize);
                ctx.fillStyle = '#90929c';
                ctx.font = '24px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('Image Missing', x + layout.cardSize / 2, y + layout.cardSize / 2);
                ctx.textAlign = 'left';
            }

            // Draw border
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, layout.cardSize, layout.cardSize);

            // Overlay gradient
            const gradientHeight = Math.min(140, layout.cardSize * 0.5);
            const gradient = ctx.createLinearGradient(0, y + layout.cardSize - gradientHeight, 0, y + layout.cardSize);
            gradient.addColorStop(0, 'transparent');
            gradient.addColorStop(1, 'rgba(0,0,0,0.9)');
            ctx.fillStyle = gradient;
            ctx.fillRect(x, y + layout.cardSize - gradientHeight, layout.cardSize, gradientHeight);

            // Text
            ctx.fillStyle = '#ffffff';
            ctx.font = '600 24px sans-serif';

            const name = formatCardName(card.id);
            const nameCapitalized = name.charAt(0).toUpperCase() + name.slice(1);
            const upg = card.upgraded ? (card.upgrades > 1 ? `+${card.upgrades}` : '+') : '';
            const cardTitle = `${nameCapitalized} ${upg}`.trim();

            ctx.shadowColor = 'rgba(0,0,0,0.8)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetY = 2;

            const maxWidth = layout.cardSize - 32;
            const words = cardTitle.split(' ');
            let line = '';
            let lines: string[] = [];

            for (let n = 0; n < words.length; n++) {
                const testLine = line + words[n] + ' ';
                const metrics = ctx.measureText(testLine);
                if (metrics.width > maxWidth && n > 0) {
                    lines.push(line.trim());
                    line = words[n] + ' ';
                } else {
                    line = testLine;
                }
            }
            lines.push(line.trim());

            let textBaseY = y + layout.cardSize - 30;
            if (card.enchantment) {
                textBaseY -= 20;
            }

            const lineHeight = 28;
            const startTextY = textBaseY - (lines.length - 1) * lineHeight;

            for (let n = 0; n < lines.length; n++) {
                ctx.fillText(lines[n], x + 16, startTextY + n * lineHeight);
            }

            if (card.enchantment) {
                ctx.fillStyle = '#d6b251';
                ctx.font = '700 16px sans-serif';
                ctx.fillText(card.enchantment.toUpperCase(), x + 16, y + layout.cardSize - 10);
            }

            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetY = 0;

            if (card.count > 1) {
                const badgeW = 60;
                const badgeH = 32;
                const badgeX = x + layout.cardSize - badgeW - 12;
                const badgeY = y + 12;

                ctx.fillStyle = 'rgba(0,0,0,0.8)';
                ctx.beginPath();
                ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 16);
                ctx.fill();

                ctx.strokeStyle = 'rgba(214, 178, 81, 0.5)';
                ctx.lineWidth = 1;
                ctx.stroke();

                ctx.fillStyle = '#d6b251';
                ctx.font = 'bold 18px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(`x${card.count}`, badgeX + badgeW / 2, badgeY + 22);
                ctx.textAlign = 'left';
            }
        });

        drawY += layout.gridHeight + (i < layouts.length - 1 ? 80 : 0);
    }

    ctx.fillStyle = '#90929c';
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('mrtyton.github.io/sts2-deck-exporter', canvas.width - padding, canvas.height - 24);
    ctx.textAlign = 'left';

    return canvas;
}
