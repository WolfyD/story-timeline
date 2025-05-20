describe('Timeline Core Functions', () => {
    beforeEach(() => {
        // Set up DOM elements needed for timeline
        document.body.innerHTML = `
            <div id="timeline-container">
                <div id="timeline"></div>
                <div id="timeline-hover-marker"></div>
                <div id="timeline-hover-marker-stick"></div>
                <div id="global-hover-bubble"></div>
            </div>
        `;

        // Initialize timeline state
        window.setInitialSettings({
            focusYear: 0,
            granularity: 22,
            items: [],
            pixelsPerSubtick: 1
        });

        // Set up event listeners
        const container = document.getElementById('timeline-container');
        container.addEventListener('contextmenu', window.handleContextMenu);
    });

    afterEach(() => {
        // Clean up
        document.body.innerHTML = '';
    });

    test('calculateYearFromPosition returns correct year', () => {
        const containerRect = document.getElementById('timeline-container').getBoundingClientRect();
        const centerX = containerRect.width / 2;
        
        // Test center position
        expect(calculateYearFromPosition(centerX)).toBe(0);
        
        // Test positions to the right
        expect(calculateYearFromPosition(centerX + 22)).toBe(1);
        expect(calculateYearFromPosition(centerX + 44)).toBe(2);
        
        // Test positions to the left
        expect(calculateYearFromPosition(centerX - 22)).toBe(-1);
        expect(calculateYearFromPosition(centerX - 44)).toBe(-2);
    });

    test('calculateSubtickFromPosition returns correct subtick', () => {
        const containerRect = document.getElementById('timeline-container').getBoundingClientRect();
        const centerX = containerRect.width / 2;
        
        // Test center position
        expect(calculateSubtickFromPosition(centerX)).toBe(0);
        
        // Test positions with different subtick values
        expect(calculateSubtickFromPosition(centerX + 1)).toBe(1);
        expect(calculateSubtickFromPosition(centerX + 11)).toBe(11);
    });

    test('Timeline markers prevent adding items outside boundaries', () => {
        // Add start and end markers
        const startMarker = {
            type: 'Timeline_start',
            year: 0,
            subtick: 0
        };
        const endMarker = {
            type: 'Timeline_end',
            year: 10,
            subtick: 0
        };
        
        window.setInitialSettings({
            focusYear: 0,
            granularity: 22,
            items: [startMarker, endMarker],
            pixelsPerSubtick: 1
        });

        const containerRect = document.getElementById('timeline-container').getBoundingClientRect();
        const centerX = containerRect.width / 2;

        // Test position before start marker
        const beforeStartX = centerX - 22; // -1 year
        const beforeStartEvent = new MouseEvent('contextmenu', {
            clientX: beforeStartX,
            clientY: 0,
            bubbles: true
        });
        document.getElementById('timeline-container').dispatchEvent(beforeStartEvent);
        expect(document.getElementById('timeline-context-menu')).toBeNull();

        // Test position after end marker
        const afterEndX = centerX + (11 * 22); // 11 years
        const afterEndEvent = new MouseEvent('contextmenu', {
            clientX: afterEndX,
            clientY: 0,
            bubbles: true
        });
        document.getElementById('timeline-container').dispatchEvent(afterEndEvent);
        expect(document.getElementById('timeline-context-menu')).toBeNull();

        // Test position within boundaries
        const withinX = centerX + (5 * 22); // 5 years
        const withinEvent = new MouseEvent('contextmenu', {
            clientX: withinX,
            clientY: 0,
            bubbles: true
        });
        document.getElementById('timeline-container').dispatchEvent(withinEvent);
        expect(document.getElementById('timeline-context-menu')).not.toBeNull();
    });

    test('Timeline markers prevent scrolling outside boundaries', () => {
        // Add start and end markers
        const startMarker = {
            type: 'Timeline_start',
            year: 0,
            subtick: 0
        };
        const endMarker = {
            type: 'Timeline_end',
            year: 10,
            subtick: 0
        };
        
        window.setInitialSettings({
            focusYear: 0,
            granularity: 22,
            items: [startMarker, endMarker],
            pixelsPerSubtick: 1
        });

        // Try to scroll before start marker
        window.jumpToYear(-1);
        expect(timelineState.focusYear).toBe(0);

        // Try to scroll after end marker
        window.jumpToYear(11);
        expect(timelineState.focusYear).toBe(0);
    });
}); 