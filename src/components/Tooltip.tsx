/**
 * Tooltip.tsx
 *
 * A portal-based, STS2-themed tooltip component. Renders at document.body
 * level so it is never clipped by parent overflow:hidden containers.
 *
 * Props:
 *   content  – Resolved TooltipContent from tooltipUtils
 *   x, y     – Cursor position in viewport coordinates
 *   visible  – Whether to show the tooltip
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TooltipContent, TooltipDescription } from '../utils/tooltipUtils';

// ── Rarity colour map ─────────────────────────────────────────────────────────

const RARITY_COLORS: Record<string, string> = {
  Basic:    '#8e8e8e',
  Common:   '#8e8e8e',
  Uncommon: '#5dc6e8',
  Rare:     '#e8bd5d',
  Special:  '#e87d5d',
  Token:    '#6e7a6e',
};

const CARD_TYPE_ICONS: Record<string, string> = {
  Attack: '⚔',
  Skill:  '✦',
  Power:  '∞',
  Status: '☠',
  Curse:  '☠',
};

// ── Segment renderer ──────────────────────────────────────────────────────────

function renderSegments(segments: TooltipDescription): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let i = 0;
  while (i < segments.length) {
    const seg = segments[i];
    if (seg.text === '\n') {
      nodes.push(<br key={i} />);
      i++;
      continue;
    }
    if (seg.isEnergy) {
      // Glue immediately-following punctuation into a nowrap span so the period
      // (or comma, etc.) never gets orphaned alone on the next line.
      const next = segments[i + 1];
      if (next && !next.isEnergy && !next.isStar && next.text !== '\n' && /^[.,;:!?)]/.test(next.text ?? '')) {
        const punct = next.color ? <span style={{ color: next.color }}>{next.text}</span> : next.text;
        nodes.push(<span key={i} style={{ whiteSpace: 'nowrap' }}><span className="card-tooltip__energy-icon" aria-label="energy" />{punct}</span>);
        i += 2;
        continue;
      }
      nodes.push(<span key={i} className="card-tooltip__energy-icon" aria-label="energy" />);
      i++;
      continue;
    }
    if (seg.isStar) {
      const next = segments[i + 1];
      if (next && !next.isEnergy && !next.isStar && next.text !== '\n' && /^[.,;:!?)]/.test(next.text ?? '')) {
        const punct = next.color ? <span style={{ color: next.color }}>{next.text}</span> : next.text;
        nodes.push(<span key={i} style={{ whiteSpace: 'nowrap' }}><span className="card-tooltip__star-icon">★</span>{punct}</span>);
        i += 2;
        continue;
      }
      nodes.push(<span key={i} className="card-tooltip__star-icon">★</span>);
      i++;
      continue;
    }
    if (seg.color) {
      nodes.push(<span key={i} style={{ color: seg.color }}>{seg.text}</span>);
    } else {
      nodes.push(<span key={i}>{seg.text}</span>);
    }
    i++;
  }
  return nodes;
}

// ── Main component ────────────────────────────────────────────────────────────

interface TooltipProps {
  content: TooltipContent;
  x: number;
  y: number;
  visible: boolean;
}

const OFFSET_X = 16;
const OFFSET_Y = 12;
const TOOLTIP_WIDTH = 280;

export function Tooltip({ content, x, y, visible }: TooltipProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x + OFFSET_X, top: y + OFFSET_Y });

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const h = el.offsetHeight;
    const w = el.offsetWidth || TOOLTIP_WIDTH;

    let left = x + OFFSET_X;
    let top = y + OFFSET_Y;

    // Flip horizontally if would overflow right edge
    if (left + w > window.innerWidth - 8) {
      left = x - w - OFFSET_X;
    }
    // Flip vertically if would overflow bottom edge
    if (top + h > window.innerHeight - 8) {
      top = y - h - OFFSET_Y;
    }
    // Clamp to screen edges
    left = Math.max(8, left);
    top  = Math.max(8, top);

    setPos({ left, top });
  }, [x, y, content]);

  if (!visible) return null;

  const rarityColor = content.cardRarity ? RARITY_COLORS[content.cardRarity] : undefined;
  const typeIcon = content.cardType ? CARD_TYPE_ICONS[content.cardType] : null;

  const tooltip = (
    <div
      ref={ref}
      className="card-tooltip"
      style={{
        position: 'fixed',
        left: pos.left,
        top: pos.top,
        width: TOOLTIP_WIDTH,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      {/* Header: title + type/cost badge */}
      <div className="card-tooltip__header">
        <span className="card-tooltip__title" style={rarityColor ? { color: rarityColor } : undefined}>
          {content.title}
        </span>

        {(content.cardType || content.energyCost != null) && (
          <div className="card-tooltip__badges">
            {content.energyCost != null && (
              <span className="card-tooltip__cost">{content.energyCost}</span>
            )}
            {content.cardType && (
              <span className="card-tooltip__type">
                {typeIcon && <span style={{ marginRight: 4 }}>{typeIcon}</span>}
                {content.cardType}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="card-tooltip__divider" />

      {/* Description */}
      {content.description.length > 0 && (
        <p className="card-tooltip__desc">
          {renderSegments(content.description)}
        </p>
      )}

      {/* Enchantment block */}
      {content.enchantmentTitle && (
        <div className="card-tooltip__enchant">
          <span className="card-tooltip__enchant-title">
            ✦ {content.enchantmentTitle}
          </span>
          {content.enchantmentDescription && content.enchantmentDescription.length > 0 && (
            <p className="card-tooltip__enchant-desc">
              {renderSegments(content.enchantmentDescription)}
            </p>
          )}
        </div>
      )}

      {/* Flavor text */}
      {content.flavor && content.flavor.length > 0 && (
        <>
          <div className="card-tooltip__divider card-tooltip__divider--thin" />
          <p className="card-tooltip__flavor">
            {renderSegments(content.flavor)}
          </p>
        </>
      )}
    </div>
  );

  return createPortal(tooltip, document.body);
}
