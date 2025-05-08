/**
 * Timeline Module
 * Handles the core timeline functionality including rendering, interaction, and state management.
 */

// ===== DOM Elements =====
const timeline = document.getElementById("timeline");
const container = document.getElementById("timeline-container");
const hoverMarker = document.getElementById("timeline-hover-marker");
const hoverMarkerStick = document.getElementById("timeline-hover-marker-stick");

// ===== State Management =====
/**
 * Timeline state object
 * @type {Object} timelineState - Current timeline state
 * @property {number} focusYear - Currently focused year
 * @property {number} granularity - Timeline granularity (subticks per year)
 * @property {number} pixelsPerSubtick - Pixels per subtick unit
 * @property {number} offsetPx - Current horizontal offset in pixels
 * @property {Array} items - List of timeline items
 */
const timelineState = {
    focusYear: 0,
    granularity: 22,
    pixelsPerSubtick: 1,
    offsetPx: 0,
    items: []
};

/**
 * Mouse interaction state
 * @type {boolean} isDragging - Whether timeline is being dragged
 * @type {boolean} mouseDown - Whether mouse button is down
 * @type {number} dragStartX - X position where drag started
 * @type {number} initialOffset - Timeline offset when drag started
 * @type {number} tickWidthCssOffset - CSS offset for tick width
 * @type {number} tickOffset - Calculated tick offset
 */
let isDragging = false;
let mouseDown = false;
let dragStartX = null;
let initialOffset = 0;
let tickWidthCssOffset = 10;
let tickOffset = 0;

let lastHoverYear = null;
let lastHoverSubtick = null;

let isMiddleMouseDragging = false;
let middleMouseStartX = 0;
let middleMouseCurrentX = 0;
let middleMouseScrollAnim = null;
let middleMouseStartOffset = 0;

// ===== Public API =====
updateTickOffset();
window.addEventListener('resize', updateTickOffset);
window.jumpToYear = jumpToYear;
window.scrollBy = scrollBy;
window.setInitialSettings = setInitialSettings;

// ===== Core Timeline Functions =====
/**
 * Calculates the year at a given x position
 * @param {number} x - X position in pixels
 * @returns {number} Calculated year
 * 
 * How it works:
 * 1. Gets container dimensions
 * 2. Calculates offset from center
 * 3. Converts pixels to years using granularity
 * 
 * Possible errors:
 * - Invalid x position
 * - Container not found
 */
function calculateYearFromPosition(x) {
    const containerRect = container.getBoundingClientRect();
    const centerX = containerRect.width / 2;
    const year = timelineState.focusYear + ((x - containerRect.left - centerX - timelineState.offsetPx) / (timelineState.pixelsPerSubtick * timelineState.granularity));
    return year;
}

/**
 * Calculates the subtick at a given x position
 * @param {number} x - X position in pixels
 * @returns {number} Calculated subtick (0 to granularity-1)
 * 
 * How it works:
 * 1. Gets container dimensions
 * 2. Calculates year and fractional part
 * 3. Converts to subtick value
 * 
 * Possible errors:
 * - Invalid x position
 * - Container not found
 * - Invalid granularity
 */
function calculateSubtickFromPosition(x) {
    const containerRect = container.getBoundingClientRect();
    const centerX = containerRect.width / 2;
    // Calculate the floating-point year
    const year = timelineState.focusYear + ((x - containerRect.left - centerX - timelineState.offsetPx) / (timelineState.pixelsPerSubtick * timelineState.granularity));
    
    let subtick;
    if (year >= 0) {
        subtick = Math.round((year - Math.floor(year)) * timelineState.granularity);
    } else {
        subtick = Math.round((year - Math.ceil(year)) * timelineState.granularity);
    }
    
    subtick = Math.abs(subtick);
    
    // Clamp subtick to [0, granularity-1]
    if (subtick >= timelineState.granularity) {
        subtick = 0;
    }
    
    return subtick;
}

/**
 * Calculates the x position for a given year
 * @param {number} year - Year to calculate position for
 * @returns {number} X position in pixels
 * 
 * How it works:
 * 1. Gets container dimensions
 * 2. Calculates offset from focus year
 * 3. Converts years to pixels
 * 
 * Possible errors:
 * - Invalid year
 * - Container not found
 */
function calculatePositionFromYear(year) {
    const containerRect = container.getBoundingClientRect();
    const centerX = containerRect.width / 2;
    return centerX + (year - timelineState.focusYear) * timelineState.pixelsPerSubtick * timelineState.granularity + timelineState.offsetPx;
}

/**
 * Updates the tick offset based on CSS
 * 
 * How it works:
 * 1. Creates temporary tick element
 * 2. Measures its dimensions
 * 3. Calculates offset
 * 
 * Possible errors:
 * - CSS measurement failure
 */
function updateTickOffset() {
    // Create a temporary tick element to measure
    const tickSample = document.createElement('div');
    tickSample.className = 'tick';
    tickSample.style.visibility = 'hidden';
    document.body.appendChild(tickSample);
    const tickWidth = tickSample.offsetWidth;
    const borderLeftWidth = parseFloat(getComputedStyle(tickSample).borderLeftWidth) || 0;
    document.body.removeChild(tickSample);
    // If using only border, offset by borderLeftWidth/2; if using width, offset by tickWidth/2
    tickOffset = tickWidth > 0 ? tickWidth / 2 : borderLeftWidth / 2;
}

/**
 * Formats a number line label
 * @param {number} v - Value to format
 * @param {number} granularity - Timeline granularity
 * @returns {string} Formatted label
 * 
 * How it works:
 * 1. Rounds to nearest subtick
 * 2. Separates year and subtick
 * 3. Formats as "year.subtick"
 * 
 * Possible errors:
 * - Invalid value
 * - Invalid granularity
 */
function getNumberLineLabel(v, granularity) {
    // Round to nearest subtick
    const step = 1 / granularity;
    const snapped = Math.round(v / step) * step;

    let year, subtick;
    if (snapped >= 0) {
        year = Math.floor(snapped);
        subtick = Math.round((snapped - year) * granularity);
    } else {
        year = Math.ceil(snapped);
        subtick = Math.round((snapped - year) * granularity);
    }

    subtick = Math.abs(subtick);

    // Clamp subtick to [0, granularity-1]
    if (subtick >= granularity) {
        year += (snapped >= 0 ? 1 : -1);
        subtick = 0;
    }

    return `${year}.${subtick}`;
}

/**
 * Formats a hover label
 * @param {number} v - Value to format
 * @param {number} granularity - Timeline granularity
 * @returns {string} Formatted label
 * 
 * How it works:
 * 1. Rounds to nearest subtick
 * 2. Handles negative years
 * 3. Formats as "year. subtick"
 * 
 * Possible errors:
 * - Invalid value
 * - Invalid granularity
 */
function getHoverLabel(v, granularity) {
    // Round to nearest subtick
    const step = 1 / granularity;
    const snapped = Math.round(v / step) * step;

    let year, subtick;

    if (snapped >= 0) {
        year = Math.floor(snapped);
        subtick = Math.round((snapped - year) * granularity);
    } else {
        year = Math.ceil(snapped);
        subtick = Math.round((snapped - year) * granularity);
    }

    subtick = Math.abs(subtick);

    // Clamp subtick to [0, granularity-1]
    if (subtick >= granularity) {
        year += (snapped >= 0 ? 1 : -1);
        subtick = 0;
    }

    if(year === 0 && snapped < 0){
        return `-${year}. ${subtick}`;
    }

    return `${year}. ${subtick}`;
}

/**
 * Renders the timeline
 * 
 * How it works:
 * 1. Calculates visible range
 * 2. Renders ticks and labels
 * 3. Renders timeline items
 * 4. Handles item positioning
 * 
 * Possible errors:
 * - Invalid timeline state
 * - DOM manipulation failure
 * - Item rendering failure
 */
function renderTimeline() {
    const { focusYear, granularity, pixelsPerSubtick, offsetPx } = timelineState;
    const containerRect = container.getBoundingClientRect();
    const centerX = containerRect.width / 2;

    // Update the centered year/subyear info
    const centerYear = calculateYearFromPosition(centerX + containerRect.left);
    const centerYearInt = Math.floor(centerYear);
    const centerSubtick = Math.round((centerYear - centerYearInt) * granularity);
    const centerInfo = `${centerYearInt} .${centerSubtick.toString().padStart(2, '0')}`;
    const nowDiv = document.getElementById('timeline-info-now');
    if (nowDiv) nowDiv.textContent = centerInfo;

    // Calculate the leftmost and rightmost visible years based on current offset and size
    const leftYear = focusYear - ((centerX + offsetPx) / (granularity * pixelsPerSubtick));
    const rightYear = focusYear + ((containerRect.width - centerX - offsetPx) / (granularity * pixelsPerSubtick));

    // Add a buffer of subticks on both sides for edge safety
    const bufferSubticks = granularity * (granularity < 60 ? 10 : 2);
    const startSubtick = Math.floor(leftYear * granularity) - bufferSubticks;
    const endSubtick = Math.ceil(rightYear * granularity) + bufferSubticks;

    timeline.innerHTML = "";

    for (let i = startSubtick; i <= endSubtick; i++) {
        const year = i / granularity;
        const x = centerX + (year - focusYear) * pixelsPerSubtick * granularity + offsetPx;
        const isFullYear = i % granularity === 0;
        const el = document.createElement("div");
        el.className = isFullYear ? "tick fullyear" : "tick subtick";
        el.style.left = `${x}px`;
        el.style.position = 'absolute';
        if (isFullYear) {
            const label = document.createElement("div");
            label.className = "tick-fullyear";
            label.innerText = year;
            el.appendChild(label);
        }else{
            const label = document.createElement("div");
            label.className = "tick-subyear";
            label.innerText = getNumberLineLabel(year, granularity);
            el.appendChild(label);
        }
        timeline.appendChild(el);
    }

    // Render items as boxes with lines
    const itemBoxes = [];
    const itemBoxHeight = 28; // px, matches the new design
    const itemBoxMargin = 3; // px, gap between stacked boxes
    const timelineY = containerRect.height / 2; // y position of the timeline (center)
    const abovePlaced = [];
    const belowPlaced = [];

    timelineState.items.forEach((item, idx) => {
        if(!item){ return; }
        // Calculate x position
        const itemYear = parseFloat(item.year || item.date || 0);
        const itemSubtick = parseInt(item.subtick || 0);
        const itemX = centerX + (itemYear - focusYear) * pixelsPerSubtick * granularity + offsetPx + (itemSubtick / granularity) * pixelsPerSubtick * granularity;

        // Alternate above/below
        const isAbove = idx % 2 === 0;
        let y;
        let placedItems = isAbove ? abovePlaced : belowPlaced;
        // Start at furthest position from timeline
        if (isAbove) {
            y = 0; // top of container
        } else {
            y = containerRect.height - itemBoxHeight; // start at bottom of container
        }
        // Cascade down (for above) or up (for below) if overlapping
        let foundOverlap = true;
        while (foundOverlap) {
            foundOverlap = false;
            for (const placed of placedItems) {
                // Check horizontal overlap
                if (Math.abs(placed.x - itemX) < 150) {
                    // Check vertical overlap
                    if (isAbove) {
                        if (y + itemBoxHeight > placed.y && y < placed.y + itemBoxHeight) {
                            y = placed.y + itemBoxHeight + itemBoxMargin;
                            foundOverlap = true;
                        }
                    } else {
                        if (y < placed.y + itemBoxHeight && y + itemBoxHeight > placed.y) {
                            y = placed.y - itemBoxHeight - itemBoxMargin;
                            foundOverlap = true;
                        }
                    }
                }
            }
        }
        placedItems.push({ x: itemX, y });
        if (isAbove) {
            y = y; // already at the correct position
        } else {
            // For below, y is already correct
        }

        // Adjust y so the connector line connects closer to the edge nearest the timeline center
        const verticalOffset = 10; // px
        let boxTop = y;
        if (isAbove) {
            boxTop = y + verticalOffset;
        } else {
            boxTop = y - verticalOffset;
        }

        const boxWidth = 150;
        const isRightOfCenter = itemX >= centerX;
        const leftMargin = 10; // px, for left side
        const rightMargin = 10; // px, for right side
        let boxLeft;
        if (isRightOfCenter) {
            // Box's right edge is at itemX - rightMargin
            boxLeft = itemX - rightMargin;
        } else {
            // Box's left edge is at itemX + leftMargin
            boxLeft = itemX + leftMargin - boxWidth;
        }

        // Create the line (always vertical at itemX)
        const line = document.createElement('div');
        line.className = 'timeline-item-line';
        line.style.position = 'absolute';
        line.style.left = `${itemX}px`;
        // Give the line a unique id for linking
        const lineId = `timeline-line-${idx}`;
        line.setAttribute('data-line-id', lineId);
        line.id = lineId;
        if (isAbove) {
            line.style.top = `${boxTop + itemBoxHeight}px`;
            line.style.height = `${timelineY - (boxTop + itemBoxHeight)}px`;
        } else {
            line.style.top = `${timelineY}px`;
            line.style.height = `${boxTop - timelineY}px`;
        }
        timeline.appendChild(line);

        // Create the box (unchanged from previous step, but with new left position)
        const box = document.createElement('div');
        box.className = 'timeline-item-box' + (isAbove ? ' above' : ' below');
        box.style.position = 'absolute';
        box.style.left = `${boxLeft}px`;
        box.style.top = `${boxTop}px`;
        box.setAttribute('data-id', item.id || item['story-id'] || idx);
        box.setAttribute('data-year', itemYear);
        box.setAttribute('data-subtick', itemSubtick);
        box.setAttribute('data-line-id', lineId);
        // Format: year.subtick - title
        const yearStr = `${itemYear}.${itemSubtick.toString().padStart(2, '0')}`;
        const titleStr = item.title || '(No Title)';
        box.innerHTML = `<span style=\"overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:140px;display:inline-block;\">${yearStr} - ${titleStr}</span>`;
        box.addEventListener('click', function(e) {
            e.stopPropagation();
            window.openItemViewer && window.openItemViewer(box.getAttribute('data-id'));
        });
        // Highlight on hover
        box.addEventListener('mouseenter', function() {
            box.classList.add('highlighted');
            const lineElem = document.getElementById(lineId);
            if (lineElem) lineElem.classList.add('highlighted-line');
        });
        box.addEventListener('mouseleave', function() {
            box.classList.remove('highlighted');
            const lineElem = document.getElementById(lineId);
            if (lineElem) lineElem.classList.remove('highlighted-line');
        });
        timeline.appendChild(box);
        itemBoxes.push(box);
    });
}

/**
 * Updates the hover marker position
 * @param {number} x - Mouse x position
 * @param {number} y - Mouse y position
 * 
 * How it works:
 * 1. Calculates year at position
 * 2. Updates marker position
 * 3. Updates marker label
 * 
 * Possible errors:
 * - Invalid coordinates
 * - DOM element not found
 */
function updateHoverMarker(x, y) {
    const floatYear = calculateYearFromPosition(x);
    const hRule = document.getElementById("h-rule");
    const containerTop = document.getElementById("timeline-container").offsetTop;
    const relativeY = y - containerTop;
    
    // Calculate the snapped position for the stick
    const containerRect = container.getBoundingClientRect();
    const centerX = containerRect.width / 2;
    const snappedYear = Math.round(floatYear * timelineState.granularity) / timelineState.granularity;
    const snappedX = centerX + (snappedYear - timelineState.focusYear) * timelineState.pixelsPerSubtick * timelineState.granularity + timelineState.offsetPx;

    // Store the snapped year and subtick for use on click
    lastHoverYear = Math.floor(snappedYear);
    lastHoverSubtick = Math.round((snappedYear - lastHoverYear) * timelineState.granularity);

    // Update the hover year/subyear info
    const hoverInfo = `${lastHoverYear} .${lastHoverSubtick.toString().padStart(2, '0')}`;
    const hoverDiv = document.getElementById('timeline-info-hover');
    if (hoverDiv) hoverDiv.textContent = hoverInfo;

    hoverMarker.style.left = `${x}px`;
    hoverMarkerStick.style.left = `${snappedX}px`;
    if(relativeY < hRule.offsetTop){
        hoverMarkerStick.classList.add('marker_stick_above');
        hoverMarkerStick.classList.remove('marker_stick_below');

        hoverMarker.classList.add('marker_above');
        hoverMarker.classList.remove('marker_below');
    }else{
        hoverMarkerStick.classList.add('marker_stick_below');
        hoverMarkerStick.classList.remove('marker_stick_above');

        hoverMarker.classList.add('marker_below');
        hoverMarker.classList.remove('marker_above');
    }

    if(x < containerRect.width/2){
        hoverMarker.classList.add('marker_left');
        hoverMarker.classList.remove('marker_right');
    }else{
        hoverMarker.classList.add('marker_right');
        hoverMarker.classList.remove('marker_left');
    }

    hoverMarker.innerText = getHoverLabel(floatYear, timelineState.granularity);
    hoverMarker.style.display = 'block';
    hoverMarkerStick.style.display = 'block';
}

function middleMouseScrollStep() {
    if (!isMiddleMouseDragging) return;
    const dx = middleMouseCurrentX - middleMouseStartX;
    // Speed factor: px per second, scaled down for smoothness
    const speed = dx * -5; // adjust 0.5 for desired sensitivity
    timelineState.offsetPx = timelineState.offsetPx + speed / 60; // 60fps
    renderTimeline();
    middleMouseScrollAnim = requestAnimationFrame(middleMouseScrollStep);
}

container.addEventListener("mousemove", (e) => {
    if (isMiddleMouseDragging) {
        middleMouseCurrentX = e.clientX;
        // Don't update offset here, let animation handle it
        return;
    }
    if (mouseDown) {
        isDragging = true;
        const dx = e.clientX - dragStartX;
        timelineState.offsetPx = initialOffset + dx;
        renderTimeline();
    }
    updateHoverMarker(e.clientX, e.clientY);
});

container.addEventListener("mousedown", (e) => {
    if (e.button === 0) {
        mouseDown = true;
        dragStartX = e.clientX;
        initialOffset = timelineState.offsetPx;
    }
    // Middle mouse drag start
    if (e.button === 1) {
        isMiddleMouseDragging = true;
        middleMouseStartX = e.clientX;
        middleMouseCurrentX = e.clientX;
        middleMouseStartOffset = timelineState.offsetPx;
        container.style.cursor = 'grabbing';
        middleMouseScrollAnim = requestAnimationFrame(middleMouseScrollStep);
        e.preventDefault();
    }
});

container.addEventListener("mouseup", (e) => {
    if (isMiddleMouseDragging && e.button === 1) {
        isMiddleMouseDragging = false;
        container.style.cursor = '';
        if (middleMouseScrollAnim) {
            cancelAnimationFrame(middleMouseScrollAnim);
            middleMouseScrollAnim = null;
        }
        return;
    }
    if (e.button === 0) {
        mouseDown = false;
        // Check if we clicked on an item box
        if (e.target.closest('.timeline-item-box')) {
            return; // Don't open add item window if clicking on an item
        }
        if (Math.abs(e.clientX - dragStartX) < 5) {
            // Use the last hover marker year/subtick instead of recalculating
            let year = lastHoverYear;
            let subtick = lastHoverSubtick;
            console.log('[timeline.js:566] adding item at year:', year, 'and subtick:', subtick, 'with granularity:', timelineState.granularity);   
            let newItem = addItem(year, subtick, timelineState.granularity);
            timelineState.items.push(newItem);
            renderTimeline();
        }
        dragStartX = null;
    }
});

container.addEventListener("mouseleave", () => {
    if (isMiddleMouseDragging) {
        isMiddleMouseDragging = false;
        container.style.cursor = '';
        if (middleMouseScrollAnim) {
            cancelAnimationFrame(middleMouseScrollAnim);
            middleMouseScrollAnim = null;
        }
    }
    hoverMarker.style.display = 'none';
    hoverMarkerStick.style.display = 'none';
});

container.addEventListener("wheel", (event) => {
    
    if(!isPositionWholeYear()){
        const nearestYear = getNearestYearFromPosition(null, event.deltaY > 0 ? -1 : 1);
        jumpToYear(nearestYear);
    } else {

        if(event.deltaY > 0){
            timelineState.offsetPx += timelineState.pixelsPerSubtick * timelineState.granularity;
        } else {
            timelineState.offsetPx -= timelineState.pixelsPerSubtick * timelineState.granularity;
        }
    }
    
    renderTimeline();
});

/**
 * Jumps to a specific year
 * @param {number} year - Year to jump to
 * 
 * How it works:
 * 1. Updates focus year
 * 2. Resets offset
 * 3. Re-renders timeline
 * 
 * Possible errors:
 * - Invalid year
 * - Render failure
 */
function jumpToYear(year) {
    timelineState.focusYear = year;
    timelineState.offsetPx = 0;
    renderTimeline();
}

/**
 * Scrolls the timeline by years
 * @param {number} years - Number of years to scroll
 * 
 * How it works:
 * 1. Updates offset
 * 2. Re-renders timeline
 * 
 * Possible errors:
 * - Invalid years value
 * - Render failure
 */
function scrollBy(years) {
    timelineState.offsetPx -= years * timelineState.granularity * timelineState.pixelsPerSubtick;
    renderTimeline();
}

/**
 * Sets initial timeline settings
 * @param {Object} settings - Settings object
 * @param {number} settings.focusYear - Year to focus on
 * @param {number} settings.granularity - Timeline granularity
 * @param {Array} settings.items - Timeline items
 * @param {number} settings.pixelsPerSubtick - Pixels per subtick
 * 
 * How it works:
 * 1. Updates timeline state
 * 2. Resets offset
 * 3. Re-renders timeline
 * 
 * Possible errors:
 * - Invalid settings
 * - Render failure
 */
function setInitialSettings({ focusYear, granularity, items, pixelsPerSubtick = 10 }) {
    timelineState.focusYear = focusYear;
    timelineState.granularity = granularity;
    timelineState.items = items;
    timelineState.pixelsPerSubtick = pixelsPerSubtick;
    timelineState.offsetPx = 0;
    renderTimeline();
}

/**
 * Gets the nearest year from a position
 * @param {number|null} x - X position (null for center)
 * @param {number} direction - Direction to round (-1, 0, 1)
 * @returns {number} Nearest year
 * 
 * How it works:
 * 1. Calculates year at position
 * 2. Rounds based on direction
 * 
 * Possible errors:
 * - Invalid position
 * - Invalid direction
 */
function getNearestYearFromPosition(x = null, direction = 0) {
    const containerRect = container.getBoundingClientRect();
    const centerX = containerRect.width / 2;
    
    if (x === null) {
        x = centerX;
    }
    
    const year = calculateYearFromPosition(x);
    
    if (direction > 0) {
        return Math.ceil(year);
    } else if (direction < 0) {
        return Math.floor(year);
    } else {
        return Math.round(year);
    }
}

/**
 * Checks if position is at a whole year
 * @param {number|null} x - X position (null for center)
 * @param {number} tolerance - Tolerance in pixels
 * @returns {boolean} Whether position is at whole year
 * 
 * How it works:
 * 1. Calculates year at position
 * 2. Checks distance to nearest year
 * 
 * Possible errors:
 * - Invalid position
 * - Invalid tolerance
 */
function isPositionWholeYear(x = null, tolerance = 2) {
    const containerRect = container.getBoundingClientRect();
    const centerX = containerRect.width / 2;
    
    if (x === null) {
        x = centerX;
    }
    
    // Calculate the year at the given position
    const year = calculateYearFromPosition(x);
    
    // Get the position of the nearest whole year
    const nearestYear = Math.round(year);
    const yearPosition = calculatePositionFromYear(nearestYear);
    
    // Check if we're within tolerance of the whole year position
    return Math.abs(x - yearPosition) <= tolerance;
}

/**
 * Adds a new timeline item
 * @param {number} year - Year to add item at
 * @param {number} subtick - Subtick to add item at
 * @returns {Object} New item
 * 
 * How it works:
 * 1. Opens add item window
 * 2. Returns new item
 * 
 * Possible errors:
 * - Invalid year/subtick
 * - Window creation failure
 */
function addItem(year, subtick, granularity) {
    console.log('[timeline.js:748] adding item at year:', year, 'and subtick:', subtick, 'with granularity:', granularity);
    let newItem = openAddItemWindow(year, subtick, granularity);
    //let newItem = window.webContents.send('open-add-item-window', year, subtick);
    return newItem;
}
function openAddItemWindow(year, subtick, granularity){
    year = Math.floor(year);
    console.log('[timeline.js:755] opening add item window at year:', year, 'and subtick:', subtick, 'with granularity:', granularity);
    // Pass granularity as a third argument
    window.api.send('open-add-item-window', year, subtick, granularity);
}

// ===== Initialization =====
document.addEventListener("DOMContentLoaded", () => {
    window.setTimeout(() => {
        jumpToYear(timelineState.focusYear);
    }, 200);
});

renderTimeline();