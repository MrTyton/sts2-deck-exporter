export async function generateDeckImage(cards, meta) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Sort all cards by count descending, then by id
    let renderCards = [...cards];
    renderCards.sort((a, b) => {
        if (a.count !== b.count) return b.count - a.count; // count descending
        return a.id.localeCompare(b.id); // alphabetical fallback
    });

    const canvasWidth = 1080;
    const padding = 60;
    const gap = 24;

    const hasRelics = meta && meta.relics && meta.relics.length > 0;
    let relicsHeight = 0;
    const relicSize = 72;
    const relicGap = 16;

    let baseHeaderHeight = 220;

    if (hasRelics) {
        const availableWidth = canvasWidth - (padding * 2);
        const relicsPerRow = Math.floor((availableWidth + relicGap) / (relicSize + relicGap));
        const relicRows = Math.ceil(meta.relics.length / relicsPerRow);
        relicsHeight = 80 + (relicRows * (relicSize + relicGap)); // 80px for "RELICS" heading and spacing
    }

    const headerHeight = baseHeaderHeight + relicsHeight;
    const availableWidth = canvasWidth - (padding * 2);

    const numCards = renderCards.length;
    const targetHeight = 1920;

    let bestCols = 5;
    let bestDiff = Infinity;
    let bestCalculatedHeight = 0;
    let bestCardSize = 0;
    let bestRows = 0;

    if (numCards === 0) {
        bestCols = 1;
        bestCardSize = availableWidth;
        bestRows = 1;
        bestCalculatedHeight = availableWidth;
    } else {
        // Test column counts to find the one that yields a height closest to 9:16 (1920px)
        const actualMinCols = numCards < 3 ? numCards : 3;
        const maxCols = Math.min(7, numCards); // Don't use more than 7 columns to keep text readable

        for (let c = actualMinCols; c <= maxCols; c++) {
            const size = Math.floor((availableWidth - (c - 1) * gap) / c);
            const r = Math.ceil(numCards / c);
            const gridH = r * size + (r - 1) * gap;

            // Expected total height if we use this column count
            const expectedTotalHeight = headerHeight + gridH + (padding * 2);
            const diff = Math.abs(expectedTotalHeight - targetHeight);

            if (diff < bestDiff) {
                bestDiff = diff;
                bestCols = c;
                bestCardSize = size;
                bestRows = r;
                bestCalculatedHeight = gridH;
            }
        }
    }

    const columns = bestCols;
    const cardSize = bestCardSize;
    const rows = bestRows;
    const gridContentWidth = columns * cardSize + (columns - 1) * gap;
    const calculatedHeight = Math.max(bestCalculatedHeight, cardSize);

    // Dynamic height based on content, but optimized to naturally hit targetHeight
    let canvasHeight = headerHeight + calculatedHeight + (padding * 2);

    // Keep a reasonable minimum height if the deck is extremely small
    const minCanvasHeight = 1080; // 1:1 image layout floor
    canvasHeight = Math.max(canvasHeight, minCanvasHeight);

    // Center the grid within the available space
    const startX = padding + Math.floor((availableWidth - gridContentWidth) / 2);
    const startY = padding + headerHeight + (canvasHeight > (headerHeight + calculatedHeight + (padding * 2)) ? Math.floor((canvasHeight - (headerHeight + calculatedHeight + (padding * 2))) / 2) : 0);

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Fill background
    ctx.fillStyle = '#0d0f12';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw header
    ctx.fillStyle = '#d6b251'; // accent color
    ctx.font = 'bold 72px sans-serif';
    const title = meta?.characterName || 'Your Run Deck';
    ctx.fillText(title, padding, padding + 60);

    ctx.fillStyle = '#90929c'; // text-secondary
    ctx.font = '32px sans-serif';
    const totalCards = cards.reduce((acc, c) => acc + c.count, 0);
    ctx.fillText(`${totalCards} cards total`, padding, padding + 120);

    if (meta) {
        ctx.fillStyle = '#ebecf0'; // text-primary
        ctx.font = 'bold 36px sans-serif';
        const runInfo = `A${meta.ascension} • ${meta.outcome}  |  Floor ${meta.floor}`;
        ctx.fillText(runInfo, padding, padding + 170);
    }

    // Draw relics if present
    if (hasRelics) {
        ctx.fillStyle = '#90929c';
        ctx.font = 'bold 28px sans-serif';
        ctx.fillText('RELICS', padding, padding + 240);

        let relicX = padding;
        let relicY = padding + 270;
        const availableWidth = canvasWidth - (padding * 2);

        for (const relic of meta.relics) {
            if (relicX + relicSize > padding + availableWidth) {
                relicX = padding;
                relicY += relicSize + relicGap;
            }
            try {
                const img = await loadImage(`/assets/relics/${relic}.webp`);
                if (img) {
                    ctx.drawImage(img, relicX, relicY, relicSize, relicSize);
                }
            } catch (e) { }
            relicX += relicSize + relicGap;
        }
    }

    // Load function
    function loadImage(src) {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = src;
        });
    }

    // Draw renderCards
    let cardPromises = renderCards.map((card, index) => {
        return loadImage(`/assets/portraits/${card.id}.webp`).then(img => ({ card, img, index }));
    });

    const cardResults = await Promise.all(cardPromises);

    cardResults.forEach(({ card, img, index }) => {
        const col = index % columns;
        const row = Math.floor(index / columns);

        const x = startX + col * (cardSize + gap);
        const y = startY + row * (cardSize + gap);

        if (img) {
            ctx.drawImage(img, x, y, cardSize, cardSize);
        } else {
            ctx.fillStyle = '#191c24';
            ctx.fillRect(x, y, cardSize, cardSize);
            ctx.fillStyle = '#90929c';
            ctx.font = '24px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Image Missing', x + cardSize / 2, y + cardSize / 2);
            ctx.textAlign = 'left';
        }

        // Draw border
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, cardSize, cardSize);

        // Draw overlay gradient at bottom
        const gradientHeight = 140;
        const gradient = ctx.createLinearGradient(0, y + cardSize - gradientHeight, 0, y + cardSize);
        gradient.addColorStop(0, 'transparent');
        gradient.addColorStop(1, 'rgba(0,0,0,0.9)');
        ctx.fillStyle = gradient;
        ctx.fillRect(x, y + cardSize - gradientHeight, cardSize, gradientHeight);

        // Draw text: Card Name + Upgrades
        ctx.fillStyle = '#ffffff';
        ctx.font = '600 24px sans-serif';

        const name = card.id.replace(/_/g, ' ');
        const nameCapitalized = name.charAt(0).toUpperCase() + name.slice(1);
        const upg = card.upgraded ? (card.upgrades > 1 ? `+${card.upgrades}` : '+') : '';
        const cardTitle = `${nameCapitalized} ${upg}`.trim();

        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 2;

        const maxWidth = cardSize - 32;
        const words = cardTitle.split(' ');
        let line = '';
        let lines = [];

        for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = ctx.measureText(testLine);
            const testWidth = metrics.width;
            if (testWidth > maxWidth && n > 0) {
                lines.push(line.trim());
                line = words[n] + ' ';
            } else {
                line = testLine;
            }
        }
        lines.push(line.trim());

        let textBaseY = y + cardSize - 30;
        if (card.enchantment) {
            textBaseY -= 20; // Shift up if there's enchantment
        }

        const lineHeight = 28;
        const startTextY = textBaseY - (lines.length - 1) * lineHeight;

        for (let n = 0; n < lines.length; n++) {
            ctx.fillText(lines[n], x + 16, startTextY + n * lineHeight);
        }

        if (card.enchantment) {
            ctx.fillStyle = '#d6b251'; // accent color
            ctx.font = '700 16px sans-serif';
            ctx.fillText(card.enchantment.toUpperCase(), x + 16, y + cardSize - 10);
        }

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        if (card.count > 1) {
            const badgeW = 60;
            const badgeH = 32;
            const badgeX = x + cardSize - badgeW - 12;
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

    return canvas;
}
