import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Tooltip } from './Tooltip';
import type { TooltipContent } from '../utils/tooltipUtils';

// ─── Test fixtures ────────────────────────────────────────────────────────────

const baseContent: TooltipContent = {
    title: 'Test Card',
    description: [{ text: 'Deal 8 damage.' }],
    energyCost: '2',
    cardType: 'Attack',
    cardRarity: 'Common',
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Tooltip', () => {
    // RTL's automatic cleanup (from setupTests.ts) handles unmounting portals.
    // No manual afterEach needed — removing portal nodes manually before
    // RTL cleanup causes a NotFoundError when React tries to remove them too.

    it('renders nothing when visible is false', () => {
        render(<Tooltip content={baseContent} x={0} y={0} visible={false} />);
        expect(document.body.querySelector('.card-tooltip')).toBeNull();
    });

    it('renders the tooltip title when visible', () => {
        render(<Tooltip content={baseContent} x={100} y={100} visible={true} />);
        expect(screen.getByText('Test Card')).toBeInTheDocument();
    });

    it('renders the description text when visible', () => {
        render(<Tooltip content={baseContent} x={100} y={100} visible={true} />);
        expect(screen.getByText('Deal 8 damage.')).toBeInTheDocument();
    });

    it('renders the energy cost badge', () => {
        render(<Tooltip content={baseContent} x={100} y={100} visible={true} />);
        // energyCost "2" renders inside .card-tooltip__cost span
        const costEl = document.body.querySelector('.card-tooltip__cost');
        expect(costEl).not.toBeNull();
        expect(costEl!.textContent).toBe('2');
    });

    it('renders the card type label', () => {
        render(<Tooltip content={baseContent} x={100} y={100} visible={true} />);
        const typeEl = document.body.querySelector('.card-tooltip__type');
        expect(typeEl).not.toBeNull();
        expect(typeEl!.textContent).toContain('Attack');
    });

    it('renders the Attack type icon ⚔', () => {
        render(<Tooltip content={baseContent} x={100} y={100} visible={true} />);
        expect(document.body.querySelector('.card-tooltip__type')!.textContent).toContain('⚔');
    });

    it('renders the Skill type icon ✦', () => {
        const content: TooltipContent = { ...baseContent, cardType: 'Skill', energyCost: '1' };
        render(<Tooltip content={content} x={100} y={100} visible={true} />);
        expect(document.body.querySelector('.card-tooltip__type')!.textContent).toContain('✦');
    });

    it('renders the Power type icon ∞', () => {
        const content: TooltipContent = { ...baseContent, cardType: 'Power', energyCost: '3' };
        render(<Tooltip content={content} x={100} y={100} visible={true} />);
        expect(document.body.querySelector('.card-tooltip__type')!.textContent).toContain('∞');
    });

    it('does not render cost or type badges when both are absent', () => {
        const content: TooltipContent = { title: 'Relic', description: [{ text: 'Heal 6 HP.' }] };
        render(<Tooltip content={content} x={100} y={100} visible={true} />);
        expect(document.body.querySelector('.card-tooltip__badges')).toBeNull();
    });

    it('renders colored text segments with correct inline style', () => {
        const content: TooltipContent = {
            ...baseContent,
            description: [{ text: 'Vulnerable', color: 'var(--tooltip-gold)' }],
        };
        render(<Tooltip content={content} x={100} y={100} visible={true} />);
        const el = screen.getByText('Vulnerable');
        expect(el).toHaveStyle({ color: 'var(--tooltip-gold)' });
    });

    it('renders energy icon segments as an element with aria-label="energy"', () => {
        const content: TooltipContent = {
            ...baseContent,
            description: [{ text: '⚡', isEnergy: true }],
        };
        render(<Tooltip content={content} x={100} y={100} visible={true} />);
        const el = document.body.querySelector('[aria-label="energy"]');
        expect(el).not.toBeNull();
    });

    it('renders star icon segments with .card-tooltip__star-icon class', () => {
        const content: TooltipContent = {
            ...baseContent,
            description: [{ text: '★', isStar: true }],
        };
        render(<Tooltip content={content} x={100} y={100} visible={true} />);
        const el = document.body.querySelector('.card-tooltip__star-icon');
        expect(el).not.toBeNull();
    });

    it('renders newline segments as <br> elements', () => {
        const content: TooltipContent = {
            ...baseContent,
            description: [{ text: 'Line 1' }, { text: '\n' }, { text: 'Line 2' }],
        };
        render(<Tooltip content={content} x={100} y={100} visible={true} />);
        expect(screen.getByText('Line 1')).toBeInTheDocument();
        expect(screen.getByText('Line 2')).toBeInTheDocument();
        // A <br> should exist inside the description paragraph
        const descEl = document.body.querySelector('.card-tooltip__desc');
        expect(descEl!.querySelector('br')).not.toBeNull();
    });

    it('renders the enchantment title and description when provided', () => {
        const content: TooltipContent = {
            ...baseContent,
            enchantmentTitle: 'Sharp',
            enchantmentDescription: [{ text: 'Increases damage.' }],
        };
        render(<Tooltip content={content} x={100} y={100} visible={true} />);
        expect(screen.getByText(/Sharp/)).toBeInTheDocument();
        expect(screen.getByText('Increases damage.')).toBeInTheDocument();
    });

    it('does not render enchantment block when enchantmentTitle is absent', () => {
        render(<Tooltip content={baseContent} x={100} y={100} visible={true} />);
        expect(document.body.querySelector('.card-tooltip__enchant')).toBeNull();
    });

    it('renders flavor text when provided', () => {
        const content: TooltipContent = {
            ...baseContent,
            flavor: [{ text: 'A legendary flavor.' }],
        };
        render(<Tooltip content={content} x={100} y={100} visible={true} />);
        expect(screen.getByText('A legendary flavor.')).toBeInTheDocument();
    });

    it('does not render flavor divider when flavor is absent', () => {
        render(<Tooltip content={baseContent} x={100} y={100} visible={true} />);
        // Only the main divider; the thin flavor divider should not exist
        const dividers = document.body.querySelectorAll('.card-tooltip__divider--thin');
        expect(dividers.length).toBe(0);
    });

    it('renders via createPortal into document.body', () => {
        render(<Tooltip content={baseContent} x={100} y={100} visible={true} />);
        const tooltip = document.body.querySelector('.card-tooltip');
        expect(tooltip).not.toBeNull();
    });

    it('glues punctuation onto energy icon in a nowrap span', () => {
        const content: TooltipContent = {
            ...baseContent,
            description: [
                { text: '⚡', isEnergy: true },
                { text: '. ', color: undefined },
            ],
        };
        render(<Tooltip content={content} x={100} y={100} visible={true} />);
        // The nowrap span should contain both the energy icon and the punctuation
        const nowrap = document.body.querySelector('span[style*="white-space: nowrap"]');
        expect(nowrap).not.toBeNull();
    });
});
