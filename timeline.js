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
let lastMouseX = 0; // Track last mouse position for screen wrapping

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
window.jumpToDate = jumpToDate;
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

    // Find age item under center arrow and display its picture
    const mainContentLeft = document.querySelector('.main-content-left');
    if (mainContentLeft) {
        // Clear existing content
        mainContentLeft.innerHTML = '';
        
        // Find age items that contain the center point
        const centerAgeItems = timelineState.items.filter(item => {
            if (item.type !== 'Age') return false;
            
            const startYear = parseFloat(item.year || item.date || 0);
            const endYear = parseFloat(item.end_year || item.year || 0);
            
            return centerYear >= startYear && centerYear <= endYear;
        });
        
        // If we found an age item with pictures, display the first picture
        if (centerAgeItems.length > 0) {
            const ageItem = centerAgeItems[0]; // Take the first matching age item
            if (ageItem.pictures && ageItem.pictures.length > 0) {
                const img = document.createElement('img');
                img.src = ageItem.pictures[0].picture;
                img.style.maxWidth = '100%';
                img.style.height = 'auto';
                img.style.display = 'block';
                img.style.margin = '0 auto';
                
                // Add title if available
                if (ageItem.title) {
                    const title = document.createElement('h3');
                    title.textContent = ageItem.title;
                    title.style.textAlign = 'center';
                    title.style.marginBottom = '10px';
                    mainContentLeft.appendChild(title);
                }
                
                mainContentLeft.appendChild(img);
                
                // Add description if available
                if (ageItem.description) {
                    const desc = document.createElement('p');
                    desc.textContent = ageItem.description;
                    desc.style.marginTop = '10px';
                    mainContentLeft.appendChild(desc);
                }
            }
        }
    }

    // Calculate the leftmost and rightmost visible years based on current offset and size
    const leftYear = focusYear - ((centerX + offsetPx) / (granularity * pixelsPerSubtick));
    const rightYear = focusYear + ((containerRect.width - centerX - offsetPx) / (granularity * pixelsPerSubtick));

    // Add a buffer of subticks on both sides for edge safety
    const bufferSubticks = granularity * (granularity < 60 ? 10 : 2);
    const startSubtick = Math.floor(leftYear * granularity) - bufferSubticks;
    const endSubtick = Math.ceil(rightYear * granularity) + bufferSubticks;

    // Clear existing timeline elements
    timeline.innerHTML = "";

    // Remove existing age and period items
    const existingAgeItems = container.querySelectorAll('.timeline-age-item');
    existingAgeItems.forEach(item => item.remove());
    
    const existingPeriodItems = container.querySelectorAll('.timeline-period-item');
    existingPeriodItems.forEach(item => item.remove());

    // Render ticks
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

    // Track positions of items for stacking
    const itemPositions = new Map(); // For regular items
    const periodPositions = []; // For period items

    // First pass: render all items to calculate positions
    timelineState.items.forEach((item, idx) => {
        if(!item){ return; }

        if (item.type === 'Age') {
            // Calculate start and end positions
            const startYear = parseFloat(item.year || item.date || 0);
            const startSubtick = parseFloat(item.subtick || 0);
            const endYear = parseFloat(item.end_year || item.year || 0);
            const endSubtick = parseFloat(item.end_subtick || item.subtick || 0);
            
            // Calculate positions relative to the timeline's center
            const containerRect = container.getBoundingClientRect();
            const centerX = containerRect.width / 2;
            const startPosition = centerX + (startYear - focusYear) * pixelsPerSubtick * granularity + offsetPx + (startSubtick / granularity) * pixelsPerSubtick * granularity;
            const endPosition = centerX + (endYear - focusYear) * pixelsPerSubtick * granularity + offsetPx + (endSubtick / granularity) * pixelsPerSubtick * granularity;
            
            // Calculate the actual start and end positions relative to the container
            const actualStartPosition = Math.max(0, startPosition);
            const actualEndPosition = Math.min(containerRect.width, endPosition);
            
            // Only render if there's a visible portion
            if (actualEndPosition > actualStartPosition) {
                // Create the age item element
                const ageItem = document.createElement('div');
                ageItem.className = 'timeline-age-item';
                ageItem.style.left = `${actualStartPosition}px`;
                ageItem.style.width = `${actualEndPosition - actualStartPosition}px`;
                ageItem.style.top = "calc(50% + 1px)"; //`${containerRect.height / 2}px`; // Center vertically on the timeline
                ageItem.setAttribute('data-id', item.id);
                ageItem.setAttribute('data-year', item.year);
                ageItem.setAttribute('data-end-year', item.end_year);
                
                // Set the background color from the database
                if (item.color) {
                    ageItem.style.backgroundColor = item.color;
                }
                
                // Add hover bubble
                const hoverBubble = document.createElement('div');
                hoverBubble.className = 'age-hover-bubble';
                hoverBubble.textContent = item.title;
                ageItem.appendChild(hoverBubble);

                // Add mousemove event listener to update bubble position
                ageItem.addEventListener('mousemove', (e) => {
                    const bubble = ageItem.querySelector('.age-hover-bubble');
                    if (bubble) {
                        // Keep bubble within screen bounds
                        const bubbleWidth = bubble.offsetWidth;
                        const screenWidth = window.innerWidth;
                        let left = e.clientX;
                        
                        // Adjust position if bubble would go off screen
                        if (left + bubbleWidth/2 > screenWidth) {
                            left = screenWidth - bubbleWidth/2;
                        } else if (left - bubbleWidth/2 < 0) {
                            left = bubbleWidth/2;
                        }
                        
                        bubble.style.left = `${left}px`;
                    }
                });
                
                // Add click handler for item viewer
                if (window.openItemViewer) {
                    ageItem.addEventListener('click', () => {
                        window.openItemViewer(item.id);
                    });
                }
                
                container.appendChild(ageItem);
            }
        } else if (item.type === 'Period') {
            // Calculate start and end positions
            const startYear = parseFloat(item.year || item.date || 0);
            const startSubtick = parseFloat(item.subtick || 0);
            const endYear = parseFloat(item.end_year || item.year || 0);
            const endSubtick = parseFloat(item.end_subtick || item.subtick || 0);
            
            // Calculate positions relative to the timeline's center
            const containerRect = container.getBoundingClientRect();
            const centerX = containerRect.width / 2;
            const startPosition = centerX + (startYear - focusYear) * pixelsPerSubtick * granularity + offsetPx + (startSubtick / granularity) * pixelsPerSubtick * granularity;
            const endPosition = centerX + (endYear - focusYear) * pixelsPerSubtick * granularity + offsetPx + (endSubtick / granularity) * pixelsPerSubtick * granularity;
            
            // Calculate the actual start and end positions relative to the container
            const actualStartPosition = Math.max(0, startPosition);
            const actualEndPosition = Math.min(containerRect.width, endPosition);
            
            // Only render if there's a visible portion
            if (actualEndPosition > actualStartPosition) {
                // Find the stack level by checking overlaps with existing periods
                let stackLevel = 0;
                
                // Check for overlaps with existing periods
                for (const existingPeriod of periodPositions) {
                    // If periods overlap and are on the same side of the timeline
                    if (!(actualEndPosition < existingPeriod.start || actualStartPosition > existingPeriod.end) && 
                        existingPeriod.isAbove === (idx % 2 === 0)) {
                        stackLevel = Math.max(stackLevel, existingPeriod.stackLevel + 1);
                    }
                }
                
                // Add this period to the tracking array
                periodPositions.push({
                    start: actualStartPosition,
                    end: actualEndPosition,
                    stackLevel: stackLevel,
                    isAbove: idx % 2 === 0
                });
                
                // Create the period item element
                const periodItem = document.createElement('div');
                periodItem.className = 'timeline-period-item';
                periodItem.style.left = `${actualStartPosition}px`;
                periodItem.style.width = `${actualEndPosition - actualStartPosition}px`;
                
                // Calculate vertical position
                const isAbove = idx % 2 === 0;
                const baseOffset = 10; // Base offset from timeline
                const stackOffset = stackLevel * 10; // 15px gap between stacked periods
                const totalOffset = baseOffset + stackOffset;
                
                periodItem.style.top = `${containerRect.height / 2 + (isAbove ? ((totalOffset * -1) - 4) : totalOffset)}px`;
                
                // Set the color from the database
                if (item.color) {
                    periodItem.style.backgroundColor = item.color;
                }
                
                periodItem.setAttribute('data-id', item.id);
                periodItem.setAttribute('data-year', item.year);
                periodItem.setAttribute('data-end-year', item.end_year);
                
                // Add hover bubble
                const hoverBubble = document.createElement('div');
                hoverBubble.className = 'period-hover-bubble';
                hoverBubble.textContent = item.title;
                periodItem.appendChild(hoverBubble);
                
                // Add click handler for item viewer
                if (window.openItemViewer) {
                    periodItem.addEventListener('click', () => {
                        window.openItemViewer(item.id);
                    });
                }
                
                container.appendChild(periodItem);
            }
        } else {
            // Regular item handling (existing code)
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

            // Create the box
            const box = document.createElement('div');
            box.className = 'timeline-item-box' + (isAbove ? ' above' : ' below');
            box.style.position = 'absolute';
            box.style.left = `${boxLeft}px`;
            box.style.top = `${boxTop}px`;
            box.setAttribute('data-id', item.id || item['story-id'] || idx);
            box.setAttribute('data-year', `${itemYear}.${itemSubtick.toString().padStart(2, '0')}`);
            box.setAttribute('data-line-id', lineId);
            // Only show the title in the box
            const titleStr = item.title || '(No Title)';
            box.innerHTML = `<span style=\"overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:140px;display:inline-block;\">${titleStr}</span>`;
            box.addEventListener('click', function(e) {
                e.stopPropagation();
                window.openItemViewer && window.openItemViewer(box.getAttribute('data-id'));
            });
            // Highlight on hover
            box.addEventListener('mouseenter', function() {
                box.classList.add('highlighted');
                const lineElem = document.getElementById(lineId);
                if (lineElem) lineElem.classList.add('highlighted-line');
                
                // Show hover bubble
                let hoverBubble = document.querySelector('.timeline-hover-bubble');
                if (!hoverBubble) {
                    hoverBubble = document.createElement('div');
                    hoverBubble.className = 'timeline-hover-bubble';
                    document.body.appendChild(hoverBubble);
                }
                
                // Get the year and subtick from the data attributes
                const year = box.getAttribute('data-year');
                hoverBubble.textContent = year;
                
                // Calculate position relative to the viewport
                const boxRect = box.getBoundingClientRect();
                hoverBubble.style.left = `${boxRect.left + boxRect.width/2}px`;
                hoverBubble.style.top = `${boxRect.top - 25}px`;
                hoverBubble.classList.add('visible');
            });
            box.addEventListener('mouseleave', function() {
                box.classList.remove('highlighted');
                const lineElem = document.getElementById(lineId);
                if (lineElem) lineElem.classList.remove('highlighted-line');
                
                // Hide hover bubble
                const hoverBubble = document.querySelector('.timeline-hover-bubble');
                if (hoverBubble) {
                    hoverBubble.classList.remove('visible');
                }
            });
            timeline.appendChild(box);
            itemBoxes.push(box);
        }
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
        const dx = e.clientX - dragStartX;
        // Only set isDragging if movement exceeds threshold
        if (Math.abs(dx) > 3) {
            isDragging = true;
            // Close the item selector if it's open
            closeItemSelector();
        }
        if (isDragging) {
            timelineState.offsetPx = initialOffset + dx;
            renderTimeline();
        }
    }
    updateHoverMarker(e.clientX, e.clientY);
    lastMouseX = e.clientX;
});

container.addEventListener("mousedown", (e) => {
    if (e.button === 0) {
        mouseDown = true;
        dragStartX = e.clientX;
        initialOffset = timelineState.offsetPx;
        // Only set pointer capture if it's a pointer event
        if (e instanceof PointerEvent) {
            container.setPointerCapture(e.pointerId);
        }
    }
    // Middle mouse drag start
    if (e.button === 1) {
        isMiddleMouseDragging = true;
        middleMouseStartX = e.clientX;
        middleMouseCurrentX = e.clientX;
        middleMouseStartOffset = timelineState.offsetPx;
        container.style.cursor = 'grabbing';
        middleMouseScrollAnim = requestAnimationFrame(middleMouseScrollStep);
        // Only set pointer capture if it's a pointer event
        if (e instanceof PointerEvent) {
            container.setPointerCapture(e.pointerId);
        }
        e.preventDefault();
    }
});

// Add pointermove event listener for handling screen wrapping
container.addEventListener("pointermove", (e) => {
    if (!mouseDown && !isMiddleMouseDragging) return;

    const screenWidth = window.innerWidth;
    const currentX = e.clientX;

    // Handle screen wrapping for left button drag
    if (mouseDown && e.button === 0) {
        if (currentX <= 0) {
            // Wrap to right side
            const newX = screenWidth - 1;
            dragStartX = newX;
            initialOffset = timelineState.offsetPx;
            e.target.setPointerCapture(e.pointerId);
        } else if (currentX >= screenWidth) {
            // Wrap to left side
            const newX = 1;
            dragStartX = newX;
            initialOffset = timelineState.offsetPx;
            e.target.setPointerCapture(e.pointerId);
        }
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
        // Only release pointer capture if it's a pointer event
        if (e instanceof PointerEvent) {
            container.releasePointerCapture(e.pointerId);
        }
        return;
    }
    if (e.button === 0) {
        mouseDown = false;
        // Check if we clicked on an item box
        if (e.target.closest('.timeline-item-box')) {
            return; // Don't open add item window if clicking on an item
        }
        dragStartX = null;
        // Only release pointer capture if it's a pointer event
        if (e instanceof PointerEvent) {
            container.releasePointerCapture(e.pointerId);
        }
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
    // check if control key is pressed
    // if(event.ctrlKey){
    //     // zoom in or out
    //     const currentScale = parseFloat(timeline.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || 1);
    //     const newScale = event.deltaY > 0 
    //         ? Math.max(0.1, currentScale - 0.1)  // zoom out
    //         : Math.min(10, currentScale + 0.1);  // zoom in
        
    //     timeline.style.transform = `scale(${newScale})`;
    //     console.log('[timeline.js:600] Control key pressed, new scale:', newScale);
    //     return;
    // }

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

/**
 * Generates a random pastel color
 * @returns {string} Hex color code
 */
function generatePastelColor() {
    // Generate random RGB values between 128 and 255 for pastel effect
    const r = Math.floor(Math.random() * 128) + 128;
    const g = Math.floor(Math.random() * 128) + 128;
    const b = Math.floor(Math.random() * 128) + 128;
    
    // Convert to hex
    return '#' + [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

/**
 * Jumps to a specific date (year and subtick)
 * 
 * How it works:
 * 1. Gets the target year and subtick from input
 * 2. Updates focus year
 * 3. Calculates offset to center the target date
 * 4. Re-renders timeline
 * 
 * Possible errors:
 * - Invalid input
 * - Render failure
 */
function jumpToDate() {
    const input = document.getElementById('jump-to-date');
    const value = parseFloat(input.value);
    
    if (isNaN(value)) return;
    
    const year = Math.floor(value);
    const subtick = Math.round((value - year) * timelineState.granularity);
    
    // Update focus year
    timelineState.focusYear = year;
    
    // Calculate offset to center the target date
    const containerRect = container.getBoundingClientRect();
    const centerX = containerRect.width / 2;
    const targetX = centerX + (year + subtick / timelineState.granularity - timelineState.focusYear) * timelineState.pixelsPerSubtick * timelineState.granularity;
    timelineState.offsetPx = centerX - targetX;
    
    renderTimeline();
}

function closeItemSelector() {
    console.log('[timeline.js] closing item selector');
    const selector = document.getElementById('item-selector');
    if (!selector) return;
    
    // Remove the click handler
    selector.removeEventListener('click', handleSelectorClick);
    selector.classList.remove('visible');
    selector.style.display = 'none';
}

function handleSelectorClick(e) {
    const button = e.target.closest('.item-selector-button');
    if (!button) return;

    const type = button.dataset.type;
    const year = parseInt(this.dataset.year);
    const subtick = parseInt(this.dataset.subtick);

    console.log('[timeline.js] button clicked:', button, 'type:', type, 'year:', year, 'subtick:', subtick);

    // Close the item selector
    closeItemSelector();

    // Open the appropriate add item window based on type
    if (type === 'event' || type === 'bookmark') {
        window.api.send('open-add-item-window', year, subtick, timelineState.granularity, type);
    } else {
        const randomColor = generatePastelColor();
        window.api.send('open-add-item-with-range-window', year, subtick, timelineState.granularity, type, randomColor);
    }
}

// ===== Initialization =====
document.addEventListener("DOMContentLoaded", () => {
    window.setTimeout(() => {
        jumpToYear(timelineState.focusYear);
    }, 200);
});

renderTimeline();
// Add click handler for the timeline
container.addEventListener('click', function(e) {
    
    e.bubbles = false;
    e.stopPropagation();
    console.log('[timeline.js:899] timeline container clicked');
    // Don't show selector if clicking on an existing item
    if (e.target.closest('.timeline-item-box')) {
        return;
    }

    // Don't show selector if we were dragging
    if (isDragging) {
        isDragging = false;
        return;
    }

    const selector = document.getElementById('item-selector');
    if (!selector) return;

    // If selector is already visible, close it
    if (selector.style.display === 'flex') {
        closeItemSelector();
        return;
    }

    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    
    // Calculate year and subtick using the same logic as the hover marker
    const floatYear = calculateYearFromPosition(x);
    const step = 1 / timelineState.granularity;
    const snapped = Math.round(floatYear / step) * step;

    let year, subtick;
    if (snapped >= 0) {
        year = Math.floor(snapped);
        subtick = Math.round((snapped - year) * timelineState.granularity);
    } else {
        year = Math.ceil(snapped);
        subtick = Math.round((snapped - year) * timelineState.granularity);
    }

    subtick = Math.abs(subtick);

    // Clamp subtick to [0, granularity-1]
    if (subtick >= timelineState.granularity) {
        year += (snapped >= 0 ? 1 : -1);
        subtick = 0;
    }

    // Position the selector
    selector.style.left = `${e.clientX}px`;
    selector.style.top = `${e.clientY}px`;
    selector.style.display = 'flex';
    
    // Add click handler before showing
    selector.addEventListener('click', handleSelectorClick);
    selector.classList.add('visible');

    // Store the position for later use
    selector.dataset.year = year;
    selector.dataset.subtick = subtick;
});

// Close selector when clicking outside
document.addEventListener('click', function(e) {
    e.bubbles = false;
    e.stopPropagation();
    console.log('[timeline.js:935] clicking outside');
    // if the target is the timeline container, return
    if (e.target.closest('#timeline')) {
        return;
    }

    if (!e.target.closest('#item-selector') && !e.target.closest('#timeline')) {
        closeItemSelector();
    }
});
