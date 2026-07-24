const DEFAULT_CARD_ASPECT_WIDTH = 39;
const DEFAULT_CARD_ASPECT_HEIGHT = 50;

/**
 * Resolves the same stepped auto-fill layout used by Prompt Builder while
 * returning an explicit LoRA card height. The preferred size is a minimum:
 * cards only change dimensions when the number of columns changes or the
 * gallery itself is resized.
 */
export function getResponsiveLoraBrowserCardLayout({
    availableWidth,
    minimumCardWidth,
    gap = 10,
    paddingInline = 24,
    aspectWidth = DEFAULT_CARD_ASPECT_WIDTH,
    aspectHeight = DEFAULT_CARD_ASPECT_HEIGHT,
} = {}) {
    const outerWidth = Number(availableWidth);
    const preferredWidth = Number(minimumCardWidth);
    const resolvedGap = Math.max(0, Number(gap) || 0);
    const resolvedPadding = Math.max(0, Number(paddingInline) || 0);
    const resolvedAspectWidth = Number(aspectWidth);
    const resolvedAspectHeight = Number(aspectHeight);

    if (
        !Number.isFinite(outerWidth)
        || outerWidth <= 0
        || !Number.isFinite(preferredWidth)
        || preferredWidth <= 0
        || !Number.isFinite(resolvedAspectWidth)
        || resolvedAspectWidth <= 0
        || !Number.isFinite(resolvedAspectHeight)
        || resolvedAspectHeight <= 0
    ) {
        return null;
    }

    const contentWidth = Math.max(1, outerWidth - resolvedPadding);
    const minimumWidth = Math.min(contentWidth, preferredWidth);
    const columns = Math.max(
        1,
        Math.floor((contentWidth + resolvedGap) / (minimumWidth + resolvedGap)),
    );
    const cardWidth = Math.max(
        1,
        (contentWidth - resolvedGap * (columns - 1)) / columns,
    );
    const cardHeight = cardWidth * resolvedAspectHeight / resolvedAspectWidth;

    return {
        columns,
        cardWidth: Math.round(cardWidth * 1000) / 1000,
        cardHeight: Math.round(cardHeight * 1000) / 1000,
    };
}
