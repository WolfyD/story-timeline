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
 * Updates the main content area based on items at the center position
 * @param {number} centerX - X position of the center
 * @param {number} centerYear - Year at the center position
 */
function updateMainContent(centerX, centerYear) {
    const mainContentRight = document.querySelector('.main-content-right');
    if (!mainContentRight) return;

    // Find items that overlap with the center position
    const centerItems = timelineState.items.filter(item => {
        if (!item) return false;
        const itemYear = parseFloat(item.year || item.date || 0);
        const itemEndYear = parseFloat(item.end_year || item.year || 0);
        return centerYear >= itemYear && centerYear <= itemEndYear;
    });

    // Clear existing content
    mainContentRight.innerHTML = '';

    // Check for a note within 10px of center
    const closestNote = findClosestNote(centerX);
    
    if (closestNote) {
        // Find age and period items
        const ageItems = centerItems.filter(item => item.type && item.type.toLowerCase() === 'age');
        const periodItems = centerItems.filter(item => item.type && item.type.toLowerCase() === 'period')
            .sort((a, b) => (a.item_index || 0) - (b.item_index || 0));

        if (ageItems.length > 0) {
            const age = ageItems[0];
            const ageDiv = document.createElement('div');
            ageDiv.className = 'center-age';

            const title = document.createElement('h1');
            title.textContent = age.title || '(No Title)';
            ageDiv.appendChild(title);

            if (age.description) {
                const description = document.createElement('p');
                description.textContent = age.description;
                ageDiv.appendChild(description);
            }

            mainContentRight.appendChild(ageDiv);
        }

        // Add the note content
        const noteDiv = document.createElement('div');
        noteDiv.className = 'center-note';
        
        // Add separator if there was an h1
        if (mainContentRight.querySelector('h1')) {
            const hr = document.createElement('hr');
            noteDiv.appendChild(hr);
        }

        // Add title
        if (closestNote.title) {
            const title = document.createElement('h2');
            title.textContent = closestNote.title.split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ');
            noteDiv.appendChild(title);
        }

        // Add description in italic
        if (closestNote.description) {
            const description = document.createElement('p');
            description.className = 'note-description';
            description.textContent = closestNote.description;
            noteDiv.appendChild(description);
        }

        // Add content
        if (closestNote.content) {
            const content = document.createElement('p');
            content.className = 'note-content';
            content.textContent = closestNote.content;
            noteDiv.appendChild(content);
        }

        // Add first image if exists
        if (closestNote.pictures && closestNote.pictures.length > 0) {
            const img = document.createElement('img');
            img.className = 'note-image';
            img.src = 'file://' + closestNote.pictures[0].file_path.replace(/\\/g, '/');
            img.alt = closestNote.title || 'Note Image';
            noteDiv.appendChild(img);
        }

        // Add tags if they exist
        if (closestNote.tags && closestNote.tags.length > 0) {
            const tagsDiv = document.createElement('div');
            tagsDiv.className = 'note-tags';
            closestNote.tags.forEach(tag => {
                const tagSpan = document.createElement('span');
                tagSpan.className = 'note-tag';
                tagSpan.textContent = tag;
                tagsDiv.appendChild(tagSpan);
            });
            noteDiv.appendChild(tagsDiv);
        }

        mainContentRight.appendChild(noteDiv);
    } else {
        // Find age and period items
        const ageItems = centerItems.filter(item => item.type && item.type.toLowerCase() === 'age');
        const periodItems = centerItems.filter(item => item.type && item.type.toLowerCase() === 'period')
            .sort((a, b) => (a.item_index || 0) - (b.item_index || 0));

        if (ageItems.length > 0) {
            const age = ageItems[0];
            const ageDiv = document.createElement('div');
            ageDiv.className = 'center-age';

            const title = document.createElement('h1');
            title.textContent = age.title || '(No Title)';
            ageDiv.appendChild(title);

            if (age.description) {
                const description = document.createElement('p');
                description.textContent = age.description;
                ageDiv.appendChild(description);
            }

            mainContentRight.appendChild(ageDiv);

            // Add periods if they exist
            if (periodItems.length > 0) {
                const periodsDiv = document.createElement('div');
                periodsDiv.className = 'center-periods';

                periodItems.forEach((period, index) => {
                    const periodDiv = document.createElement('div');
                    periodDiv.className = 'center-period';

                    const title = document.createElement(`h${Math.min(index + 2, 6)}`);
                    title.textContent = period.title || '(No Title)';
                    periodDiv.appendChild(title);

                    if (period.description) {
                        const description = document.createElement('p');
                        description.textContent = period.description;
                        periodDiv.appendChild(description);
                    }

                    periodsDiv.appendChild(periodDiv);
                });

                mainContentRight.appendChild(periodsDiv);
            }
        }
    }
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

    // Calculate the center year
    const centerYear = calculateYearFromPosition(centerX + containerRect.left);
    
    // Update the centered year/subyear info with full precision
    const centerYearInt = Math.floor(centerYear);
    const centerSubtick = Math.round((centerYear - centerYearInt) * granularity);
    const centerInfo = `${centerYearInt}.${centerSubtick.toString().padStart(2, '0')}`;
    
    // Try both possible element IDs
    const nowDiv = document.getElementById('timeline-info-now') || document.getElementById('now');
    if (nowDiv) {
        nowDiv.textContent = centerInfo;
    } else {
        console.warn('[Debug] Could not find center position display element');
    }

    // Find visible ages and periods
    const { ages, periods } = findVisibleAgesAndPeriods(centerX, centerYear);

    // Find the closest note to center
    const closestNote = findClosestNote(centerX);
    
    // Update the main content based on center position
    updateMainContent(centerX, centerYear);

    // Initialize placement tracking arrays
    const abovePlaced = [];
    const belowPlaced = [];
    const itemBoxes = [];
    const timelineY = containerRect.height / 2;
    const itemBoxHeight = 30;
    const itemBoxMargin = 5;

    // Find all items that overlap with the current center position
    const overlappingItems = timelineState.items.filter(item => {
        const itemStartYear = parseFloat(item.year || item.date || 0);
        const itemEndYear = parseFloat(item.end_year || item.year || 0);
        return centerYear >= itemStartYear && centerYear <= itemEndYear;
    });

    // Sort items by priority: Age items first, then by item_index
    overlappingItems.sort((a, b) => {
        if (a.type === 'Age' && b.type !== 'Age') return -1;
        if (a.type !== 'Age' && b.type === 'Age') return 1;
        return (a.item_index || 0) - (b.item_index || 0);
    });

    // Get the image container
    const imageContainer = document.getElementById('image-container');
    if (!imageContainer) return;

    // Clear existing images
    imageContainer.innerHTML = '';

    // Display images for visible ages
    ages.forEach(age => {
        if (age.pictures && age.pictures.length > 0) {
            const picture = age.pictures[0];
            if (picture.file_path) {
                const img = document.createElement('img');
                img.className = 'cascading-image age-image';
                img.setAttribute('data-item-id', age.id);
                const fileUrl = 'file://' + picture.file_path.replace(/\\/g, '/');
                img.src = fileUrl;
                img.alt = age.title || 'Age Image';
                imageContainer.appendChild(img);
            }
        }
    });

    // Display images for visible periods
    periods.forEach((period, index) => {
        if (period.pictures && period.pictures.length > 0) {
            const picture = period.pictures[0];
            if (picture.file_path) {
                const img = document.createElement('img');
                img.className = 'cascading-image';
                if (index === 0) {
                    img.className += ' main';
                } else if (index <= 2) {
                    img.className += ' secondary';
                    img.className += index % 2 === 0 ? ' even' : ' odd';
                } else if (index <= 4) {
                    img.className += ' tertiary';
                    img.className += index % 2 === 0 ? ' even' : ' odd';
                } else if (index <= 6) {
                    img.className += ' quaternary';
                    img.className += index % 2 === 0 ? ' even' : ' odd';
                } else if (index <= 8) {
                    img.className += ' quinary';
                    img.className += index % 2 === 0 ? ' even' : ' odd';
                }
                img.setAttribute('data-item-id', period.id);
                // Set z-index based on item_index
                img.style.zIndex = period.item_index || 0;
                const fileUrl = 'file://' + picture.file_path.replace(/\\/g, '/');
                img.src = fileUrl;
                img.alt = period.title || 'Period Image';
                imageContainer.appendChild(img);
            }
        }
    });

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
                ageItem.style.top = "calc(50% + 1px)"; // Center vertically on the timeline
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
                        // Get the device pixel ratio and scale
                        const scale = window.devicePixelRatio;
                        
                        // Calculate scaled position (multiply by scale to offset the scaling)
                        const scaledX = e.clientX * scale;
                        
                        // Keep bubble within screen bounds
                        const bubbleWidth = bubble.offsetWidth;
                        const screenWidth = window.innerWidth * scale;
                        let left = scaledX;
                        
                        // Adjust position if bubble would go off screen
                        if (left + bubbleWidth/2 > screenWidth) {
                            left = screenWidth - bubbleWidth/2;
                        } else if (left - bubbleWidth/2 < 0) {
                            left = bubbleWidth/2;
                        }
                        
                        bubble.style.left = `${left}px`;
                        bubble.style.transform = 'none';
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
                const stackOffset = stackLevel * 13; // Increased from 10px to 13px for more gap between stacked periods
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

                // Add mousemove event listener to update bubble position
                periodItem.addEventListener('mousemove', (e) => {
                    const bubble = periodItem.querySelector('.period-hover-bubble');
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
                        bubble.style.transform = 'none';
                    }
                });
                
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
                if (item.type === 'picture') {
                    line.style.top = `${timelineY - 70}px`; // Start 70px above timeline
                    line.style.height = '70px';
                    boxTop = timelineY - 70 - 100; // Position box above the stem
                } else {
                    line.style.top = `${boxTop + itemBoxHeight}px`;
                    line.style.height = `${timelineY - (boxTop + itemBoxHeight)}px`;
                }
            } else {
                if (item.type === 'picture') {
                    line.style.top = `${timelineY}px`;
                    line.style.height = '70px';
                    boxTop = timelineY + 70; // Position box below the stem
                } else {
                    line.style.top = `${timelineY}px`;
                    line.style.height = `${boxTop - timelineY}px`;
                }
            }
            timeline.appendChild(line);

            // Create the box
            const box = document.createElement('div');
            
            if (item.type === 'picture' || (item.pictures && item.pictures.length > 0 && item.type !== 'note' && item.type !== 'Note')) {
                box.className = 'timeline-picture-box' + (isAbove ? ' above' : ' below');
                const img = document.createElement('img');
                img.src = 'file://' + item.pictures[0].file_path.replace(/\\/g, '/');
                img.alt = item.title || 'Timeline Image';
                box.appendChild(img);
                box.style.position = 'absolute';
                box.style.left = `${itemX - 50}px`; // Center the box on the line
                box.style.top = isAbove ? `${timelineY - 170}px` : `${timelineY + 70}px`; // Position above/below the stem
            } else {
                box.className = 'timeline-item-box' + (isAbove ? ' above' : ' below');
                
                if (item.type && item.type.toLowerCase() === 'note') {
                    // Add the calligraphic letter SVG
                    const noteIcon = document.createElement('div');
                    noteIcon.className = 'note-icon';
                    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                    svg.setAttribute('viewBox', '0 0 260.481 370');
                    svg.setAttribute('width', '20');
                    svg.setAttribute('height', '20');
                    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
                    
                    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    path.setAttribute('d', 'M25.457 355.248c11.465-9.44 30.713-7.155 47.235-7.155q32.876 0 59.176 24.783l49.567-49.566-8.093-9.104-18.208 17.702q-29.841-17.702-63.728-17.702l19.725-55.636h109.755l20.737 69.798q9.61 33.887 29.84 44.508l50.073-49.566-8.092-9.104-18.209 18.208q-10.115-4.047-14.667-12.139-1.012-2.023-3.035-6.575-1.517-4.552-3.54-11.633l-66.258-220.52q-9.104-30.347-15.173-38.945l4.552-14.668-11.127-4.552-4.552 10.621q-15.68-11.127-33.382-11.127-26.3 0-47.037 18.714-7.08 5.564-15.174 15.68-7.586 10.115-17.196 24.277l9.61 6.575q21.243-30.852 48.049-30.853 22.76 0 37.933 21.749l-19.725 51.59q-9.61-.506-14.668-.506-5.058-.506-6.07-.506-38.438 0-38.438 44.003 0 13.656 6.069 29.335l11.127-5.058q-2.529-7.587-2.529-11.633 0-23.266 20.231-23.266 6.576 0 11.633 5.058l-53.612 146.17q-34.393 4.047-57.153 26.807zm183.29-135.117h-82.948l45.52-124.928Z');
                    path.setAttribute('style', 'fill:#4b2e2e;stroke:#4b2e2e;stroke-width:1.25561;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1');
                    
                    svg.appendChild(path);
                    noteIcon.appendChild(svg);
                    box.appendChild(noteIcon);
                    
                    // Add the title
                    const titleStr = item.title || '(No Title)';
                    const titleSpan = document.createElement('span');
                    titleSpan.className = 'note-title';
                    titleSpan.textContent = titleStr;
                    box.appendChild(titleSpan);
                } else {
                    // For non-note items, just add the title
                    const titleStr = item.title || '(No Title)';
                    const titleSpan = document.createElement('span');
                    titleSpan.textContent = titleStr;
                    box.appendChild(titleSpan);
                }
                
                box.style.position = 'absolute';
                box.style.left = `${boxLeft}px`;
                box.style.top = `${boxTop}px`;
            }
            box.setAttribute('data-id', item.id || item['story-id'] || idx);
            box.setAttribute('data-year', `${itemYear}.${itemSubtick.toString().padStart(2, '0')}`);
            box.setAttribute('data-line-id', lineId);
            box.setAttribute('data-type', item.type); // Add type for debugging

            // Add click handler
            box.addEventListener('click', function(e) {
                e.stopPropagation();
                if (item.type === 'picture') {
                    // Open add item window for picture type
                    window.api.send('open-add-item-window', itemYear, itemSubtick, timelineState.granularity);
                } else {
                    // Open item viewer for other types
                    window.openItemViewer && window.openItemViewer(box.getAttribute('data-id'));
                }
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
    let newItem = openAddItemWindow(year, subtick, granularity);
    //let newItem = window.webContents.send('open-add-item-window', year, subtick);
    return newItem;
}
function openAddItemWindow(year, subtick, granularity){
    year = Math.floor(year);
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

    // Close the item selector
    closeItemSelector();

    // Open the appropriate add item window based on type
    if (type === 'event' || type === 'bookmark' || type === 'picture' || type === 'note') {
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
    // Don't show selector if clicking on an existing item
    if (e.target.closest('.timeline-item-box, .timeline-age-item, .timeline-period-item')) {
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
    // Only handle clicks that are outside both the timeline and selector
    if (!e.target.closest('#timeline-container') && !e.target.closest('#item-selector')) {
        closeItemSelector();
    }
});

// Add window resize handler
window.addEventListener('resize', () => {
    renderTimeline();
});

// Add this near the top of the file, with other event listeners
container.addEventListener('mouseover', (e) => {
    const item = e.target.closest('.timeline-item-box, .timeline-age-item, .timeline-period-item');
    if (!item) return;
    
    const itemId = item.getAttribute('data-id');
    if (!itemId) return;

    const images = document.querySelectorAll(`.cascading-image[data-item-id="${itemId}"]`);
    images.forEach(img => {
        img.style.zIndex = '100'; // Higher z-index on hover
        img.style.transition = 'all 0.3s ease';
    });
});

container.addEventListener('mouseout', (e) => {
    const item = e.target.closest('.timeline-item-box, .timeline-age-item, .timeline-period-item');
    if (!item) return;
    
    const itemId = item.getAttribute('data-id');
    if (!itemId) return;

    const images = document.querySelectorAll(`.cascading-image[data-item-id="${itemId}"]`);
    images.forEach(img => {
        // Reset z-index based on item type
        if (img.classList.contains('age-image')) {
            img.style.zIndex = '1'; // Reset to lowest z-index for age images
        } else {
            img.style.zIndex = ''; // Reset to default for other images
        }
        img.style.transform = '';
    });
});

function findClosestNote(centerX) {
    // Get all note items
    const noteItems = timelineState.items.filter(item => 
        item && item.type && item.type.toLowerCase() === 'note'
    );

    if (noteItems.length === 0) {
        return null;
    }

    // Find the closest note
    let closestNote = null;
    let closestDistance = Infinity;

    noteItems.forEach(note => {
        const noteX = calculatePositionFromYear(parseFloat(note.year || note.date || 0) + (parseInt(note.subtick || 0) / timelineState.granularity));
        const distance = Math.abs(centerX - noteX);
        
        if (distance < closestDistance) {
            closestDistance = distance;
            closestNote = note;
        }
    });

    // Only return the note if it's within 10px
    if (closestDistance <= 10) {
        return closestNote;
    } else {
        return null;
    }
}

function findClosestItem(centerX) {
    // Get all items except ages and periods
    const regularItems = timelineState.items.filter(item => 
        item && item.type && 
        item.type.toLowerCase() !== 'age' && 
        item.type.toLowerCase() !== 'period'
    );

    if (regularItems.length === 0) {
        return null;
    }

    // Find the closest item
    let closestItem = null;
    let closestDistance = Infinity;

    regularItems.forEach(item => {
        const itemX = calculatePositionFromYear(parseFloat(item.year || item.date || 0) + (parseInt(item.subtick || 0) / timelineState.granularity));
        const distance = Math.abs(centerX - itemX);
        
        if (distance < closestDistance) {
            closestDistance = distance;
            closestItem = item;
        }
    });

    // Only return the item if it's within 10px and has pictures
    if (closestDistance <= 10 && closestItem.pictures && closestItem.pictures.length > 0) {
        return closestItem;
    }
    return null;
}

function findVisibleAgesAndPeriods(centerX, centerYear) {
    // Get all items that could be visible
    const visibleItems = timelineState.items.filter(item => {
        if (!item || !item.type) return false;
        
        // Only look at ages and periods
        const type = item.type.toLowerCase();
        if (type !== 'age' && type !== 'period') return false;

        // Calculate start and end positions
        const startYear = parseFloat(item.year || item.date || 0);
        const startSubtick = parseInt(item.subtick || 0);
        const endYear = parseFloat(item.end_year || item.year || 0);
        const endSubtick = parseInt(item.end_subtick || item.subtick || 0);
        
        // Calculate exact positions
        const startPosition = startYear + (startSubtick / timelineState.granularity);
        const endPosition = endYear + (endSubtick / timelineState.granularity);
        
        const isVisible = centerYear >= startPosition && centerYear <= endPosition;
        
        return isVisible;
    });

    // Separate ages and periods
    const ages = visibleItems.filter(item => item.type.toLowerCase() === 'age');
    const periods = visibleItems.filter(item => item.type.toLowerCase() === 'period')
        .sort((a, b) => (a.item_index || 0) - (b.item_index || 0));

    return { ages, periods };
}
