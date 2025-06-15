/**
 * Timeline Module
 * Handles the core timeline functionality including rendering, interaction, and state management.
 */

// ===== DOM Elements =====
const timeline = document.getElementById("timeline");
const container = document.getElementById("timeline-container");
const hoverMarker = document.getElementById("timeline-hover-marker");
const hoverMarkerStick = document.getElementById("timeline-hover-marker-stick");
const globalHoverBubble = document.getElementById('global-hover-bubble');
const timelineCanvas = document.getElementById('timeline-canvas');

// ===== TimelineCanvas Class =====
class TimelineCanvas {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.resizeCanvas();
        
        // Debug logging
        console.log('TimelineCanvas initialized:', {
            canvasWidth: this.canvas.width,
            canvasHeight: this.canvas.height,
            containerWidth: container.getBoundingClientRect().width,
            containerHeight: container.getBoundingClientRect().height
        });
        
        // Handle window resize
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        
        // Debug logging
        console.log('Canvas resized:', {
            width: this.canvas.width,
            height: this.canvas.height
        });
    }

    drawTick(x, isFullYear, year = null) {
        const ctx = this.ctx;
        const containerRect = container.getBoundingClientRect();
        const centerY = containerRect.height / 2;
        
        // Draw tick line
        ctx.beginPath();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = isFullYear ? 2 : 1;
        if(isFullYear){
            ctx.moveTo(x, centerY - 20);
            ctx.lineTo(x, centerY + 20);
        }
        else{
            ctx.moveTo(x, centerY - 10);
            ctx.lineTo(x, centerY + 10);
        }
        ctx.stroke();

        // Draw year label for full year ticks
        if (isFullYear && year !== null) {
            // Check if year markers should be shown
            const canvasSettings = window.timelineCanvasSettings;
            if (canvasSettings && canvasSettings.showYearMarkers === false) {
                return; // Don't draw year labels if disabled
            }
            
            // Apply canvas settings if available
            if (canvasSettings) {
                ctx.fillStyle = canvasSettings.textColor || '#4b2e2e';
                ctx.font = `${canvasSettings.fontStyle || 'normal'} ${canvasSettings.fontSize || 12}px ${canvasSettings.fontFamily || 'Arial'}`;
                
                // Apply letter spacing if supported
                if (canvasSettings.letterSpacing) {
                    ctx.letterSpacing = `${canvasSettings.letterSpacing}px`;
                }
            } else {
                ctx.fillStyle = '#4b2e2e';
                ctx.font = '12px Arial';
            }
            
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            
            // Apply text offsets
            const offsetX = canvasSettings ? (canvasSettings.textOffsetX || 0) : 0;
            const offsetY = canvasSettings ? (canvasSettings.textOffsetY || 0) : 0;
            
            ctx.fillText(year.toString(), x + offsetX, centerY + 25 + offsetY);
        }
    }

    drawConnectingLine(x, startY, endY, isHighlighted = false) {

        const ctx = this.ctx;
        ctx.beginPath();
        
        if (isHighlighted) {
            // Add glow effect
            ctx.shadowColor = '#4a90e2'; // Blue glow color
            ctx.shadowBlur = 10;
            ctx.strokeStyle = '#4a90e2'; // Brighter blue for the line
            ctx.lineWidth = 2;
        } else {
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1;
        }
        
        ctx.moveTo(x, startY);
        ctx.lineTo(x, endY);
        ctx.stroke();
        
        // Reset shadow
        ctx.shadowBlur = 0;
    }

    update() {
        const { focusYear, granularity, pixelsPerSubtick, offsetPx } = timelineState;
        const containerRect = container.getBoundingClientRect();
        const centerX = containerRect.width / 2;
        const centerY = containerRect.height / 2;

        // Clear the canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if(timelineState.displayRadius % 2 == 0){
            this.ctx.fillStyle = '#eedd0011';
            this.ctx.fillRect(
                centerX - timelineState.displayRadius,
                -500,
                timelineState.displayRadius * 2,
                1000
            );
        }

        // Calculate the leftmost and rightmost visible years based on current offset and size
        const leftYear = focusYear - ((centerX + offsetPx) / (granularity * pixelsPerSubtick));
        const rightYear = focusYear + ((containerRect.width - centerX - offsetPx) / (granularity * pixelsPerSubtick));

        // Add a buffer of subticks on both sides for edge safety
        const bufferSubticks = granularity * (granularity < 60 ? 10 : 2);
        const startSubtick = Math.floor(leftYear * granularity) - bufferSubticks;
        const endSubtick = Math.ceil(rightYear * granularity) + bufferSubticks;

        // Draw ticks
        for (let i = startSubtick; i <= endSubtick; i++) {
            const year = i / granularity;
            const x = centerX + (year - focusYear) * pixelsPerSubtick * granularity + offsetPx;
            const isFullYear = i % granularity === 0;
            
            // Only draw if the tick is within the canvas bounds
            if (x >= 0 && x <= this.canvas.width) {
                this.drawTick(x, isFullYear, isFullYear ? Math.floor(year) : null);
            }
        }

        // get center year from center of the screen
        const new_centerYear = calculateYearFromPosition(centerX + containerRect.left);

        // Draw connecting lines for visible items
        const visibleItems = getVisibleItems(centerX, new_centerYear);
        visibleItems.forEach(item => {
            if (!item || item.type === 'Age' || item.type === 'Period') return;

            const itemYear = parseFloat(item.year || item.date || 0);
            const itemSubtick = parseInt(item.subtick || 0);
            const itemX = centerX + (itemYear - focusYear) * pixelsPerSubtick * granularity + offsetPx + (itemSubtick / granularity) * pixelsPerSubtick * granularity;


            // Only draw if the line is within the canvas bounds
            if (itemX >= 0 && itemX <= this.canvas.width) {
                // Find the corresponding item box using data-id
                const itemBox = document.querySelector(`.timeline-item-box[data-id="${item.id}"], .timeline-picture-box[data-id="${item.id}"]`);
                if (itemBox) {
                    const boxRect = itemBox.getBoundingClientRect();
                    const containerRect = container.getBoundingClientRect();
                    const isAbove = itemBox.classList.contains('above');
                    const isHighlighted = itemBox.classList.contains('highlighted');
                    
                    // Calculate start and end points for the line
                    const startY = centerY;
                    let endY;
                    
                    if (isAbove) {
                        // For items above the timeline, connect to the bottom of the box
                        endY = boxRect.bottom - containerRect.top;
                    } else {
                        // For items below the timeline, connect to the top of the box
                        endY = boxRect.top - containerRect.top;
                    }
                    
                    this.drawConnectingLine(itemX, startY, endY, isHighlighted);
                }
            }
        });
    }
}

// Initialize TimelineCanvas
const canvas = new TimelineCanvas(timelineCanvas);
window.canvas = canvas; // Make it globally accessible

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
    items: [],
    displayRadius: 10
};

/**
 * Timeline markers state
 * @type {Object} timelineMarkers - Current timeline markers state
 * @property {Object|null} start - Timeline start marker
 * @property {Object|null} end - Timeline end marker
 */
const timelineMarkers = {
    start: null,
    end: null
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

// ===== Period Stack Level Map and Alternation Index =====
const periodStackLevels = {};
const periodAltIndices = {};

function computePeriodStackLevels() {
    // Get all periods (not ages)
    const periods = timelineState.items.filter(item => item && item.type === 'Period');
    // Sort by start, then by end (shorter/earlier-ending first)
    periods.sort((a, b) => {
        const aStart = parseFloat(a.year || a.date || 0) + (parseFloat(a.subtick || 0) / timelineState.granularity);
        const bStart = parseFloat(b.year || b.date || 0) + (parseFloat(b.subtick || 0) / timelineState.granularity);
        if (aStart !== bStart) return aStart - bStart;
        const aEnd = parseFloat(a.end_year !== undefined && a.end_year !== null ? a.end_year : (a.year || 0)) + (parseFloat(a.end_subtick !== undefined && a.end_subtick !== null ? a.end_subtick : (a.subtick || 0)) / timelineState.granularity);
        const bEnd = parseFloat(b.end_year !== undefined && b.end_year !== null ? b.end_year : (b.year || 0)) + (parseFloat(b.end_subtick !== undefined && b.end_subtick !== null ? b.end_subtick : (b.subtick || 0)) / timelineState.granularity);
        return aEnd - bEnd;
    });
    // Assign stack levels and alternation indices
    const aboveStacks = [];
    const belowStacks = [];
    let altIndex = 0;
    for (const item of periods) {
        // Assign alternation index
        periodAltIndices[item.id] = altIndex++;
        // Stacking logic
        const start = parseFloat(item.year || item.date || 0) + (parseFloat(item.subtick || 0) / timelineState.granularity);
        const end = parseFloat(item.end_year !== undefined && item.end_year !== null ? item.end_year : (item.year || 0)) + (parseFloat(item.end_subtick !== undefined && item.end_subtick !== null ? item.end_subtick : (item.subtick || 0)) / timelineState.granularity);
        // Alternate above/below based on periodAltIndex
        const isAbove = (periodAltIndices[item.id] % 2 === 0);
        const stacks = isAbove ? aboveStacks : belowStacks;
        let stackLevel = 0;
        while (true) {
            let overlap = false;
            for (const placed of stacks[stackLevel] || []) {
                if (!(end <= placed.start || start >= placed.end)) {
                    overlap = true;
                    break;
                }
            }
            if (!overlap) break;
            stackLevel++;
        }
        if (!stacks[stackLevel]) stacks[stackLevel] = [];
        stacks[stackLevel].push({ start, end, id: item.id });
        periodStackLevels[item.id] = stackLevel;
    }
}

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

    // Clear existing content
    mainContentRight.innerHTML = '';

    // Find age and period items where the center point falls between start and end positions
    const ageItems = timelineState.items.filter(item => {
        if (!item || item.type?.toLowerCase() !== 'age') return false;
        
        // Calculate exact pixel positions for start and end
        const startX = calculatePositionFromYear(item.year) + (item.subtick / timelineState.granularity) * timelineState.pixelsPerSubtick * timelineState.granularity;
        const endX = calculatePositionFromYear(item.end_year !== undefined && item.end_year !== null ? item.end_year : item.year) + ((item.end_subtick !== undefined && item.end_subtick !== null ? item.end_subtick : item.subtick) / timelineState.granularity) * timelineState.pixelsPerSubtick * timelineState.granularity;
        
        // Check if centerX is between start and end positions
        return centerX >= startX && centerX <= endX;
    });

    const periodItems = timelineState.items.filter(item => {
        if (!item || item.type?.toLowerCase() !== 'period') return false;
        
        // Calculate exact pixel positions for start and end
        const startX = calculatePositionFromYear(item.year) + (item.subtick / timelineState.granularity) * timelineState.pixelsPerSubtick * timelineState.granularity;
        const endX = calculatePositionFromYear(item.end_year !== undefined && item.end_year !== null ? item.end_year : item.year) + ((item.end_subtick !== undefined && item.end_subtick !== null ? item.end_subtick : item.subtick) / timelineState.granularity) * timelineState.pixelsPerSubtick * timelineState.granularity;
        
        // Check if centerX is between start and end positions
        return centerX >= startX && centerX <= endX;
    }).sort((a, b) => (a.item_index || 0) - (b.item_index || 0));

    console.log("TIMELINE STATE", timelineState);

    // Find note items within 10px of center
    const noteItems = timelineState.items.filter(item => {
        if (!item || (item.type?.toLowerCase() == 'age' || item.type?.toLowerCase() == 'period')) return false;
        if(!item.show_in_notes) return false;
        const itemYear = parseFloat(item.year || item.date || 0);
        const itemSubtick = parseInt(item.subtick || 0);
        const itemX = centerX + (itemYear - timelineState.focusYear) * timelineState.pixelsPerSubtick * timelineState.granularity + timelineState.offsetPx + (itemSubtick / timelineState.granularity) * timelineState.pixelsPerSubtick * timelineState.granularity;
        return Math.abs(itemX - centerX) <= timelineState.displayRadius;
    }).sort((a, b) => (a.item_index || 0) - (b.item_index || 0));

    // Add all visible ages
    if (ageItems.length > 0) {
        const agesDiv = document.createElement('div');
        agesDiv.className = 'center-ages';

        ageItems.forEach((age, index) => {
            const ageDiv = document.createElement('div');
            ageDiv.className = 'center-age';

            const title = document.createElement(`h${Math.min(index + 1, 6)}`);
            title.textContent = age.title || '(No Title)';
            ageDiv.appendChild(title);

            if (age.description) {
                const description = document.createElement('p');
                description.textContent = age.description;
                ageDiv.appendChild(description);
            }

            agesDiv.appendChild(ageDiv);
        });

        mainContentRight.appendChild(agesDiv);
    }

    // Add all visible periods
    if (periodItems.length > 0) {
        const periodsDiv = document.createElement('div');
        periodsDiv.className = 'center-periods';

        periodItems.forEach(period => {
            const periodDiv = document.createElement('div');
            periodDiv.className = 'center-period';

            const title = document.createElement('h2');
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

    let pictureItems = [];
    let newNoteItems = [];

    if(noteItems.length > 0){
        pictureItems = noteItems.filter(item => item.type?.toLowerCase() === 'picture');
        newNoteItems = noteItems.filter(item => item.type?.toLowerCase() !== 'picture');
    }

    if(pictureItems.length > 0){
        const picturesDiv = document.createElement('div');
        picturesDiv.className = 'center-notes';

        pictureItems.forEach(picture => {
            const pictureDiv = document.createElement('div');
            pictureDiv.className = 'center-note picture-note';

            const contentDiv = document.createElement('div');
            contentDiv.className = 'note-content';

            const title = document.createElement('h2');
            title.textContent = picture.title || '(No Title)';
            contentDiv.appendChild(title);

            pictureDiv.appendChild(contentDiv);

            if (picture.pictures && picture.pictures.length > 0) {
                if (picture.pictures.length === 1) {
                    const img = document.createElement('img');
                    img.className = 'note-image';
                    img.src = `file://${picture.pictures[0].file_path}`;
                    pictureDiv.appendChild(img);
                } else {
                    const imagesContainer = document.createElement('div');
                    imagesContainer.className = 'note-images-container';
                    imagesContainer.style.display = 'flex';
                    imagesContainer.style.flexDirection = 'row';
                    imagesContainer.style.gap = '10px';
                    imagesContainer.style.alignItems = 'center';

                    picture.pictures.forEach(pic => {
                        const img = document.createElement('img');
                        img.className = 'note-image';
                        img.src = `file://${pic.file_path}`;
                        imagesContainer.appendChild(img);
                    });

                    pictureDiv.appendChild(imagesContainer);
                }
            }

            picturesDiv.appendChild(pictureDiv);
        });

        mainContentRight.appendChild(picturesDiv);
    }

    // Add all visible notes
    if (newNoteItems.length > 0) {
        // Sort notes by importance (higher first), then start date, then alphabetical by title
        newNoteItems.sort((a, b) => {
            // First sort by importance (higher importance first)
            const aImportance = a.importance || 5;
            const bImportance = b.importance || 5;
            if (aImportance !== bImportance) {
                return bImportance - aImportance; // Higher importance first
            }
            
            // Then sort by start date (earlier first)
            const aDate = a.year + (a.subtick || 0) / timelineState.granularity;
            const bDate = b.year + (b.subtick || 0) / timelineState.granularity;
            if (aDate !== bDate) {
                return aDate - bDate; // Earlier date first
            }
            
            // Finally sort alphabetically by title
            const aTitle = (a.title || '').toLowerCase();
            const bTitle = (b.title || '').toLowerCase();
            return aTitle.localeCompare(bTitle);
        });

        const notesDiv = document.createElement('div');
        notesDiv.className = 'center-notes';

        newNoteItems.forEach(note => {
            const noteDiv = document.createElement('div');
            noteDiv.className = 'center-note';

            const contentDiv = document.createElement('div');
            contentDiv.className = 'note-content';

            const title = document.createElement('h2');
            title.textContent = note.title || '(No Title)';
            contentDiv.appendChild(title);

            if (note.description) {
                const description = document.createElement('p');
                description.textContent = note.description;
                contentDiv.appendChild(description);
            }

            if (note.tags && note.tags.length > 0) {
                const tagsDiv = document.createElement('div');
                tagsDiv.className = 'note-tags';
                note.tags.forEach(tag => {
                    const tagSpan = document.createElement('span');
                    tagSpan.className = 'note-tag';
                    tagSpan.textContent = tag;
                    tagsDiv.appendChild(tagSpan);
                });
                contentDiv.appendChild(tagsDiv);
            }

            noteDiv.appendChild(contentDiv);

            if (note.pictures && note.pictures.length > 0) {
                const img = document.createElement('img');
                img.className = 'note-image';
                img.src = `file://${note.pictures[0].file_path}`;
                noteDiv.appendChild(img);
            }

            notesDiv.appendChild(noteDiv);
        });

        mainContentRight.appendChild(notesDiv);
    }
}

/**
 * Calculates which items are visible in the current viewport
 * @param {number} centerX - Center X position of the viewport
 * @param {number} centerYear - Center year of the viewport
 * @returns {Array} Array of items that are visible or near the viewport
 */
function getVisibleItems(centerX, centerYear) {
    const { granularity, pixelsPerSubtick, offsetPx } = timelineState;
    const containerRect = container.getBoundingClientRect();
    
    // Calculate the visible year range based on the container width and current offset
    const visibleWidth = containerRect.width;
    const yearsPerPixel = 1 / (granularity * pixelsPerSubtick);
    
    // Calculate the leftmost and rightmost visible years
    const leftYear = centerYear - (centerX * yearsPerPixel);
    const rightYear = centerYear + ((visibleWidth - centerX) * yearsPerPixel);
    
    // Add a buffer zone (25% of the visible range on each side)
    const bufferSize = (rightYear - leftYear) * 0.25;
    const bufferedLeftYear = leftYear - bufferSize;
    const bufferedRightYear = rightYear + bufferSize;
    
    // Filter items that are within the buffered range
    return timelineState.items.filter(item => {
        if (!item) return false;
        
        // Calculate item's start and end positions
        const startYear = parseFloat(item.year || item.date || 0);
        const startSubtick = parseFloat(item.subtick || 0);
        const endYear = parseFloat(item.end_year !== undefined && item.end_year !== null ? item.end_year : (item.year || 0));
        const endSubtick = parseFloat(item.end_subtick !== undefined && item.end_subtick !== null ? item.end_subtick : (item.subtick || 0));
        
        // Calculate exact positions
        const startPosition = startYear + (startSubtick / granularity);
        const endPosition = endYear + (endSubtick / granularity);
        
        // Check if item overlaps with the buffered range
        // An item is visible if:
        // 1. It starts before the right edge of the buffered range AND
        // 2. It ends after the left edge of the buffered range
        return startPosition <= bufferedRightYear && endPosition >= bufferedLeftYear;
    });
}

// Add this function near the top of the file
function sendTimelineUpdate() {
    window.api.send('timeline-updated', {
        focusYear: timelineState.focusYear,
        granularity: timelineState.granularity,
        offsetPx: timelineState.offsetPx,
        pixelsPerSubtick: timelineState.pixelsPerSubtick
    });
}

// Frame timing variables with improved stability
let lastFrameTime = 0;
const targetFrameTime = 1000 / 60; // 60fps
const minFrameTime = 1000 / 30;    // 30fps minimum
let currentQuality = 1.0;          // Start at full quality
let isScrolling = false;           // Track if we're currently scrolling
let scrollTimeout = null;          // For debouncing scroll end

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
    const now = performance.now();
    const timeSinceLastFrame = now - lastFrameTime;
    
    // Only apply quality adjustments when not scrolling
    if (!isScrolling) {
        // Skip if we're rendering too fast
        if (timeSinceLastFrame < minFrameTime) {
            requestAnimationFrame(renderTimeline);
            return;
        }
        
        // Calculate quality based on frame time, but with a minimum threshold
        currentQuality = Math.max(0.5, Math.min(1, timeSinceLastFrame / targetFrameTime));
    } else {
        // During scrolling, maintain a stable quality level
        currentQuality = 0.5;
    }
    
    // Store current frame time
    lastFrameTime = now;

    // Update canvas
    canvas.update();

    const { focusYear, granularity, pixelsPerSubtick, offsetPx } = timelineState;
    const containerRect = container.getBoundingClientRect();
    const centerX = containerRect.width / 2;

    // Calculate the center year
    const centerYear = calculateYearFromPosition(centerX + containerRect.left);
    
    // Get visible items
    const visibleItems = getVisibleItems(centerX, centerYear);
    
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

    // Send timeline update
    sendTimelineUpdate();

    // Find visible ages and periods
    const { ages, periods } = findVisibleAgesAndPeriods(centerX, centerYear);

    // Find the closest note to center
    //const closestNote = findClosestNote(centerX);
    
    // Update the main content based on center position
    updateMainContent(centerX, centerYear);

    // Initialize placement tracking arrays
    const abovePlaced = [];
    const belowPlaced = [];
    const itemBoxes = [];
    const timelineY = containerRect.height / 2;
    const itemBoxHeight = 30;
    const itemBoxMargin = 5;

    // Track rendered items count
    let renderedItemCount = 0;
    
    // Calculate uniform box width once for performance optimization
    let uniformBoxWidth = null;
    function getUniformBoxWidth() {
        if (uniformBoxWidth === null) {
            // Create a temporary box to measure width
            const testBox = document.createElement('div');
            testBox.className = 'timeline-item-box';
            testBox.style.position = 'absolute';
            testBox.style.left = '0px';
            testBox.style.top = '0px';
            testBox.style.visibility = 'hidden';
            
            // Add minimal content to get realistic width
            const testSpan = document.createElement('span');
            testSpan.textContent = 'Test';
            testBox.appendChild(testSpan);
            
            timeline.appendChild(testBox);
            uniformBoxWidth = testBox.offsetWidth;
            timeline.removeChild(testBox);
        }
        return uniformBoxWidth;
    }

    // Find all items that overlap with the current center position
    const overlappingItems = visibleItems.filter(item => {
        const itemStartYear = parseFloat(item.year || item.date || 0);
        const itemEndYear = parseFloat(item.end_year !== undefined && item.end_year !== null ? item.end_year : (item.year || 0));
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
                renderedItemCount++;
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
                renderedItemCount++;
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

    // Track positions of items for stacking
    const itemPositions = new Map(); // For regular items
    const periodPositions = []; // For period items

    // First pass: render all items to calculate positions
    visibleItems.forEach((item, idx) => {
        if (!item) return;
        // Skip rendering the box for Timeline_start and Timeline_end
        if (item.type === 'Timeline_start' || item.type === 'Timeline_end') return;

        if (item.type === 'Age') {
            // Calculate start and end positions
            const startYear = parseFloat(item.year || item.date || 0);
            const startSubtick = parseFloat(item.subtick || 0);
            const endYear = parseFloat(item.end_year !== undefined && item.end_year !== null ? item.end_year : (item.year || 0));
            const endSubtick = parseFloat(item.end_subtick !== undefined && item.end_subtick !== null ? item.end_subtick : (item.subtick || 0));
            
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

                // Add mousemove event listener to update bubble position
                ageItem.addEventListener('mousemove', (e) => {
                    if (globalHoverBubble) {
                        // Get the year and subtick
                        const year = item.year;
                        const subtick = item.subtick || 0;
                        const formattedYear = `${year}.${subtick.toString().padStart(2, '0')}`;
                        
                        // Set the content
                        globalHoverBubble.textContent = `${item.title} (${formattedYear})`;
                        
                        // Position the bubble
                        const bubbleWidth = globalHoverBubble.offsetWidth;
                        const screenWidth = window.innerWidth;
                        let left = e.clientX;
                        
                        // Keep bubble within screen bounds
                        if (left + bubbleWidth/2 > screenWidth) {
                            left = screenWidth - bubbleWidth/2;
                        } else if (left - bubbleWidth/2 < 0) {
                            left = bubbleWidth/2;
                        }
                        
                        globalHoverBubble.style.left = `${left}px`;
                        globalHoverBubble.style.top = `${e.clientY - 40}px`;
                        globalHoverBubble.style.opacity = '1';
                    }
                });
                
                // Add mouseout event to hide bubble
                ageItem.addEventListener('mouseout', () => {
                    if (globalHoverBubble) {
                        globalHoverBubble.style.opacity = '0';
                    }
                });

                // Add mouseover event to show bubble
                ageItem.addEventListener('mouseover', () => {
                    if (globalHoverBubble) {
                        globalHoverBubble.style.opacity = '1';
                    }
                });

                // Add click handler for item viewer
                if (window.openItemViewer) {
                    ageItem.addEventListener('click', () => {
                        // First show the view modal
                        window.openItemViewer(item.id);
                    });
                }
                
                container.appendChild(ageItem);
                renderedItemCount++;
            }
        } else if (item.type === 'Period') {
            const stackLevel = periodStackLevels[item.id] || 0;
            const periodAltIndex = periodAltIndices[item.id] || 0;
            const isAbove = (periodAltIndex % 2 === 0);
            // Calculate start and end positions
            const startYear = parseFloat(item.year || item.date || 0);
            const startSubtick = parseFloat(item.subtick || 0);
            const endYear = parseFloat(item.end_year !== undefined && item.end_year !== null ? item.end_year : (item.year || 0));
            const endSubtick = parseFloat(item.end_subtick !== undefined && item.end_subtick !== null ? item.end_subtick : (item.subtick || 0));
            
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
                // Create the period item element
                const periodItem = document.createElement('div');
                periodItem.className = 'timeline-period-item';
                periodItem.style.left = `${actualStartPosition}px`;
                periodItem.style.width = `${actualEndPosition - actualStartPosition}px`;
                
                // Calculate vertical position
                const baseOffset = 10;
                const stackOffset = stackLevel * 13;
                const totalOffset = baseOffset + stackOffset;
                const yPos = containerRect.height / 2 + (isAbove ? ((totalOffset * -1) - 4) : totalOffset);
                periodItem.style.top = `${yPos}px`;
                
                // Set the color from the database
                if (item.color) {
                    periodItem.style.backgroundColor = item.color;
                }
                
                periodItem.setAttribute('data-id', item.id);
                periodItem.setAttribute('data-year', item.year);
                periodItem.setAttribute('data-end-year', item.end_year);
                periodItem.setAttribute('data-ystack', stackLevel);

                // Add mousemove event listener to update bubble position
                periodItem.addEventListener('mousemove', (e) => {
                    if (globalHoverBubble) {
                        // Get the year and subtick
                        const year = item.year;
                        const subtick = item.subtick || 0;
                        const formattedYear = `${year}.${subtick.toString().padStart(2, '0')}`;
                        
                        // Set the content
                        globalHoverBubble.textContent = `${item.title} (${formattedYear})`;
                        
                        // Position the bubble
                        const bubbleWidth = globalHoverBubble.offsetWidth;
                        const screenWidth = window.innerWidth;
                        let left = e.clientX;
                        
                        // Keep bubble within screen bounds
                        if (left + bubbleWidth/2 > screenWidth) {
                            left = screenWidth - bubbleWidth/2;
                        } else if (left - bubbleWidth/2 < 0) {
                            left = bubbleWidth/2;
                        }
                        
                        globalHoverBubble.style.left = `${left}px`;
                        globalHoverBubble.style.top = `${e.clientY - 25}px`;
                globalHoverBubble.style.opacity = '1';
            }
        });
                
                // Add mouseout event to hide bubble
                periodItem.addEventListener('mouseout', () => {
                    if (globalHoverBubble) {
                globalHoverBubble.style.opacity = '0';
            }
        });

                // Add mouseover event to show bubble
                periodItem.addEventListener('mouseover', () => {
                    if (globalHoverBubble) {
                        globalHoverBubble.style.opacity = '1';
                    }
                });

                // Add click handler for item viewer
                if (window.openItemViewer) {
                    periodItem.addEventListener('click', () => {
                        // First show the view modal
                        window.openItemViewer(item.id);
                    });
                }
                
                container.appendChild(periodItem);
                renderedItemCount++;
            }
        } else {
            // Regular item handling (existing code)
            const itemYear = parseFloat(item.year || item.date || 0);
            const itemSubtick = parseInt(item.subtick || 0);
            const itemX = centerX + (itemYear - focusYear) * pixelsPerSubtick * granularity + offsetPx + (itemSubtick / granularity) * pixelsPerSubtick * granularity;

            if (item.type.toLowerCase() === 'bookmark') {
                // Create the bookmark line
                const bookmarkLine = document.createElement('div');
                bookmarkLine.className = 'timeline-bookmark-line';
                bookmarkLine.style.left = `${itemX}px`;
                timeline.appendChild(bookmarkLine);

                // Create the bookmark dot
                const bookmarkDot = document.createElement('div');
                bookmarkDot.className = 'timeline-bookmark-dot';
                bookmarkDot.style.left = `${itemX}px`;
                bookmarkDot.style.top = `${timelineY}px`;
                timeline.appendChild(bookmarkDot);

                // Set data attributes for identification
                bookmarkLine.setAttribute('data-id', item.id || item['story-id'] || idx);
                bookmarkLine.setAttribute('data-year', `${itemYear}.${itemSubtick.toString().padStart(2, '0')}`);
                bookmarkLine.setAttribute('data-type', item.type);
                bookmarkDot.setAttribute('data-id', item.id || item['story-id'] || idx);
                bookmarkDot.setAttribute('data-year', `${itemYear}.${itemSubtick.toString().padStart(2, '0')}`);
                bookmarkDot.setAttribute('data-type', item.type);

                // Add click handlers
                const clickHandler = (e) => {
                    e.stopPropagation();
                    window.openItemViewer && window.openItemViewer(e.target.getAttribute('data-id'));
                };
                bookmarkLine.addEventListener('click', clickHandler);
                bookmarkDot.addEventListener('click', clickHandler);

                // Add hover handlers
                const hoverHandler = (e) => {
                    // Show hover bubble
                    let hoverBubble = document.querySelector('.timeline-hover-bubble');
                    if (!hoverBubble) {
                        hoverBubble = document.createElement('div');
                        hoverBubble.className = 'timeline-hover-bubble';
                        document.body.appendChild(hoverBubble);
                    }
                    
                    // Get the year and title
                    const year = e.target.getAttribute('data-year');
                    const title = item.title || '(No Title)';
                    hoverBubble.textContent = `${title} (${year})`;
                    
                    // Calculate position relative to the viewport
                    const rect = e.target.getBoundingClientRect();
                    hoverBubble.style.left = `${rect.left + rect.width/2}px`;
                    hoverBubble.style.top = `${rect.top - 25}px`;
                    hoverBubble.classList.add('visible');
                };

                const leaveHandler = () => {
                    // Hide hover bubble
                    const hoverBubble = document.querySelector('.timeline-hover-bubble');
                    if (hoverBubble) {
                        hoverBubble.classList.remove('visible');
                    }
                };

                bookmarkLine.addEventListener('mouseenter', hoverHandler);
                bookmarkLine.addEventListener('mouseleave', leaveHandler);
                bookmarkDot.addEventListener('mouseenter', hoverHandler);
                bookmarkDot.addEventListener('mouseleave', leaveHandler);
                renderedItemCount += 2; // Count both the line and dot
            } else {
                // Use the stable item_index to determine above/below placement
                let isAbove = (item.item_index % 2 === 0);
                let y;
                let placedItems = isAbove ? abovePlaced : belowPlaced;
                if (isAbove) {
                    y = 0;
                } else {
                    y = containerRect.height - itemBoxHeight;
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

                const isRightOfCenter = itemX >= centerX;
                const connectionMargin = 10; // px, consistent distance from timeline line
                let boxLeft;
                if (isRightOfCenter) {
                    // Box's left edge starts at a fixed distance from the timeline line
                    boxLeft = itemX + connectionMargin;
                } else {
                    // Box's right edge ends at a fixed distance from the timeline line
                    // We'll calculate this dynamically based on actual box width after creation
                    boxLeft = itemX - connectionMargin;
                }

                // Create the box
                const box = document.createElement('div');

                if (item.type.toLowerCase() === 'picture' || (item.pictures && item.pictures.length > 0 && item.type.toLowerCase() !== 'note' && item.type.toLowerCase() !== 'event')) {
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

                    let color = item.color;
                    // TODO: HERE IS THE BOX SHADOW CODE
                    if(color && color != 'transparent' && color.toLowerCase() != 'transparent' && color.toLowerCase() != 'none' && color.toLowerCase() != '#000000' && color.toLowerCase() != '#ffffff'){
                        //alert(color);
                        let boxColor = document.createElement('div');
                        boxColor.className = 'timeline-item-box-color';
                        boxColor.style.width = `5px`;
                        boxColor.style.height = `100%`;
                        boxColor.style.backgroundColor = color;
                        boxColor.style.position = 'absolute';
                        boxColor.style.left = `0px`;
                        boxColor.style.top = `0px`;
                        box.appendChild(boxColor);
                    }
                    
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
                    
                    // Use cached uniform box width for performance
                    const actualBoxWidth = getUniformBoxWidth();
                    
                    // Calculate final position with 10% width adjustment towards timeline line
                    const widthAdjustment = actualBoxWidth * 0.1;
                    
                    if (isRightOfCenter) {
                        // Box's left edge starts at fixed distance, then move back 10% towards line
                        boxLeft = itemX + connectionMargin - widthAdjustment;
                    } else {
                        // Box's right edge ends at fixed distance, then move back 10% towards line
                        boxLeft = itemX - connectionMargin - actualBoxWidth + widthAdjustment;
                    }
                    
                    box.style.left = `${boxLeft}px`;
                    box.style.top = `${boxTop}px`;
                }
                box.setAttribute('data-id', item.id || item['story-id'] || idx);
                box.setAttribute('data-year', `${itemYear}.${itemSubtick.toString().padStart(2, '0')}`);
                //box.setAttribute('data-line-id', lineId);
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
                    //const lineElem = document.getElementById(lineId);
                    //if (lineElem) lineElem.classList.add('highlighted-line');
                    
                    if (globalHoverBubble) {
                        // Get the year and subtick from the data attributes
                        const year = box.getAttribute('data-year');
                        const title = item.title || '(No Title)';
                        
                        // Set the content
                        globalHoverBubble.textContent = `${title} (${year})`;
                        
                        // Position the bubble
                        const boxRect = box.getBoundingClientRect();
                        globalHoverBubble.style.left = `${boxRect.left + boxRect.width/2}px`;
                        globalHoverBubble.style.top = `${boxRect.top - 25}px`;
                        globalHoverBubble.style.opacity = '1';
                    }
                    // Update canvas to show highlight
                    canvas.update();
                });
                box.addEventListener('mouseleave', function() {
                    box.classList.remove('highlighted');
                    //const lineElem = document.getElementById(lineId);
                    //if (lineElem) lineElem.classList.remove('highlighted-line');
                    
                    if (globalHoverBubble) {
                        globalHoverBubble.style.opacity = '0';
                    }
                    canvas.update();
                });
                timeline.appendChild(box);
                itemBoxes.push(box);
        renderedItemCount++;
            }
        }
    });

    if(!container || !containerRect){
        return;
    }

    // Step 2: After rendering, log all visible periods and their stack info
    try {
        const visiblePeriods = visibleItems.filter(item => item && item.type === 'Period').map(item => {
            let stackLevel = periodStackLevels ? (periodStackLevels[item.id] || 0) : 0;
            let periodAltIndex = periodAltIndices ? (periodAltIndices[item.id] || 0) : 0;
            let isAbove = (periodAltIndex % 2 === 0);
            let baseOffset = 10;
            let stackOffset = stackLevel * 13;
            let totalOffset = baseOffset + stackOffset;
            let yPos = containerRect.height / 2 + (isAbove ? ((totalOffset * -1) - 4) : totalOffset);
            return {
                id: item.id,
                title: item.title,
                stackLevel,
                periodAltIndex,
                isAbove,
                yPos,
                year: item.year,
                end_year: item.end_year
            };
        });
    } catch (e) {
        console.error('Error in visiblePeriods logging:', e);
    }

    // Update the rendered item counter
    const counterDiv = document.getElementById('visible_item_counter');
    if (counterDiv) {
        counterDiv.textContent = `Rendered Items: ${renderedItemCount}`;
    }

    // Add click handlers for timeline markers
    const startMarker = document.querySelector('.timeline-item-box[data-type="Timeline_start"]');
    const endMarker = document.querySelector('.timeline-item-box[data-type="Timeline_end"]');

    if (startMarker) {
        startMarker.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Clear existing menu items
            clearContextMenuItems();
            
            // Add remove option
            addContextMenuItem({
                type: 'remove_start',
                icon: 'ri-delete-bin-line',
                label: 'Remove timeline start',
                action: () => removeTimelineStart()
            });
            
            // Show context menu
            showContextMenu(e.clientX, e.clientY, startMarker.dataset.year, startMarker.dataset.subtick);
        });
    }

    if (endMarker) {
        endMarker.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Clear existing menu items
            clearContextMenuItems();
            
            // Add remove option
            addContextMenuItem({
                type: 'remove_end',
                icon: 'ri-delete-bin-line',
                label: 'Remove timeline end',
                action: () => removeTimelineEnd()
            });
            
            // Show context menu
            showContextMenu(e.clientX, e.clientY, endMarker.dataset.year, endMarker.dataset.subtick);
        });
    }

    // Remove any existing start marker triangles before adding a new one
    const oldStartMarkers = container.querySelectorAll('.timeline-start-marker-triangle');
    oldStartMarkers.forEach(el => el.remove());

    // Add start marker as a right-pointing triangle if it exists and is visible
    if (timelineMarkers.start) {
        const startYear = timelineMarkers.start.year;
        const startSubtick = timelineMarkers.start.subtick;
        const startValue = startYear + (startSubtick / granularity);
        const startX = centerX + (startValue - focusYear) * pixelsPerSubtick * granularity + offsetPx;
        if (startX >= 0 && startX <= containerRect.width) {
            // Create the triangle
            const triangle = document.createElement('div');
            triangle.className = 'timeline-start-marker-triangle';
            triangle.style.left = `${startX}px`;
            triangle.style.top = `calc(50% - 12px)`;
            triangle.style.pointerEvents = 'all';
            triangle.style.cursor = 'pointer';
            triangle.addEventListener('click', (e) => {
                e.stopPropagation();
                // Clear existing menu items
                clearContextMenuItems();
                // Add remove option
                addContextMenuItem({
                    type: 'remove_start',
                    icon: 'ri-delete-bin-line',
                    label: 'Remove timeline start',
                    action: () => removeTimelineStart()
                });
                // Show context menu
                showContextMenu(e.clientX, e.clientY, startYear, startSubtick);
            });
            container.appendChild(triangle);
        }
    }

    // Remove any existing end marker triangles before adding a new one
    const oldEndMarkers = container.querySelectorAll('.timeline-end-marker-triangle');
    oldEndMarkers.forEach(el => el.remove());

    // Add end marker as a left-pointing triangle if it exists and is visible
    if (timelineMarkers.end) {
        const endYear = timelineMarkers.end.year;
        const endSubtick = timelineMarkers.end.subtick;
        const endValue = endYear + (endSubtick / granularity);
        const endX = centerX + (endValue - focusYear) * pixelsPerSubtick * granularity + offsetPx;
        if (endX >= 0 && endX <= containerRect.width) {
            // Create the triangle
            const triangle = document.createElement('div');
            triangle.className = 'timeline-end-marker-triangle';
            triangle.style.left = `${endX}px`;
            triangle.style.top = `calc(50% - 12px)`;
            triangle.style.pointerEvents = 'all';
            triangle.style.cursor = 'pointer';
            triangle.addEventListener('click', (e) => {
                e.stopPropagation();
                // Clear existing menu items
                clearContextMenuItems();
                // Add remove option
                addContextMenuItem({
                    type: 'remove_end',
                    icon: 'ri-delete-bin-line',
                    label: 'Remove timeline end',
                    action: () => removeTimelineEnd()
                });
                // Show context menu
                showContextMenu(e.clientX, e.clientY, endYear, endSubtick);
            });
            container.appendChild(triangle);
        }
    }

    // Remove any existing boundary overlays
    const oldOverlays = container.querySelectorAll('.timeline-boundary-overlay');
    oldOverlays.forEach(el => el.remove());

    // Add start boundary overlay if start marker exists
    if (timelineMarkers.start) {
        const startYear = timelineMarkers.start.year;
        const startSubtick = timelineMarkers.start.subtick;
        const startValue = startYear + (startSubtick / granularity);
        const startX = centerX + (startValue - focusYear) * pixelsPerSubtick * granularity + offsetPx;
        
        // Create overlay for area before start marker
        const startOverlay = document.createElement('div');
        startOverlay.className = 'timeline-boundary-overlay';
        startOverlay.style.left = '0';
        startOverlay.style.width = `${startX}px`;
        container.appendChild(startOverlay);
    }

    // Add end boundary overlay if end marker exists
    if (timelineMarkers.end) {
        const endYear = timelineMarkers.end.year;
        const endSubtick = timelineMarkers.end.subtick;
        const endValue = endYear + (endSubtick / granularity);
        const endX = centerX + (endValue - focusYear) * pixelsPerSubtick * granularity + offsetPx;
        
        // Create overlay for area after end marker
        const endOverlay = document.createElement('div');
        endOverlay.className = 'timeline-boundary-overlay end';
        endOverlay.style.left = `${endX}px`;
        endOverlay.style.width = `${containerRect.width - endX}px`;
        container.appendChild(endOverlay);
    }
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

/**
 * Checks if timeline position is before start marker and corrects if needed
 * @returns {boolean} True if position was corrected
 */
function checkAndCorrectStartBoundary() {
    // If no start marker, no correction needed
    if (!timelineMarkers.start) return false;

    const containerRect = container.getBoundingClientRect();
    const centerX = containerRect.width / 2;
    const currentYear = calculateYearFromPosition(centerX + containerRect.left);
    
    // Convert start marker to comparable value
    const startYear = timelineMarkers.start.year;
    const startSubtick = timelineMarkers.start.subtick;
    const startValue = startYear + (startSubtick / timelineState.granularity);
    
    // If current position is before start marker
    if (currentYear < startValue) {
        // Calculate offset needed to center on start marker
        const targetX = centerX + (startValue - timelineState.focusYear) * timelineState.pixelsPerSubtick * timelineState.granularity;
        timelineState.offsetPx = centerX - targetX;
        return true;
    }
    
    return false;
}

/**
 * Checks if timeline position is after end marker and corrects if needed
 * @returns {boolean} True if position was corrected
 */
function checkAndCorrectEndBoundary() {
    // If no end marker, no correction needed
    if (!timelineMarkers.end) return false;

    const containerRect = container.getBoundingClientRect();
    const centerX = containerRect.width / 2;
    const currentYear = calculateYearFromPosition(centerX + containerRect.left);
    
    // Convert end marker to comparable value
    const endYear = timelineMarkers.end.year;
    const endSubtick = timelineMarkers.end.subtick;
    const endValue = endYear + (endSubtick / timelineState.granularity);
    
    // If current position is after end marker
    if (currentYear > endValue) {
        // Calculate offset needed to center on end marker
        const targetX = centerX + (endValue - timelineState.focusYear) * timelineState.pixelsPerSubtick * timelineState.granularity;
        timelineState.offsetPx = centerX - targetX;
        return true;
    }
    
    return false;
}

function middleMouseScrollStep() {
    if (!isMiddleMouseDragging) return;

    // Set quality control state
    isScrolling = true;
    currentQuality = 0.5; // Set stable quality during navigation
    
    // Clear any existing timeout
    if (scrollTimeout) {
        clearTimeout(scrollTimeout);
    }
    
    // Set timeout to detect when navigation ends
    scrollTimeout = setTimeout(() => {
        isScrolling = false;
        currentQuality = 1.0; // Reset to full quality
    }, 150); // 150ms debounce

    const dx = middleMouseCurrentX - middleMouseStartX;
    // Speed factor: px per second, scaled down for smoothness
    const speed = dx * -5; // adjust 0.5 for desired sensitivity
    timelineState.offsetPx = timelineState.offsetPx + speed / 60; // 60fps
    
    // Check and correct position if needed
    if (checkAndCorrectStartBoundary() || checkAndCorrectEndBoundary()) {
        // If position was corrected, stop the animation
        isMiddleMouseDragging = false;
        container.style.cursor = '';
        if (middleMouseScrollAnim) {
            cancelAnimationFrame(middleMouseScrollAnim);
            middleMouseScrollAnim = null;
        }
    }
    
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
            // Check and correct position if needed
            if (checkAndCorrectStartBoundary() || checkAndCorrectEndBoundary()) {
                // If position was corrected, stop dragging
                isDragging = false;
                mouseDown = false;
                dragStartX = null;
            }
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
    
    // Check and correct position if needed
    checkAndCorrectStartBoundary();
    checkAndCorrectEndBoundary();
    
    renderTimeline();
});

/**
 * Jumps to a specific year
 * @param {number} year - Year to jump to
 * 
 * How it works:
 * 1. Set quality control state
 * 2. Clear any existing timeout
 * 3. Set timeout to detect when navigation ends
 * 4. Check if there's a start marker and if target is before it
 * 5. Updates focus year
 * 6. Resets offset
 * 7. Re-renders timeline
 * 
 * Possible errors:
 * - Invalid year
 * - Render failure
 */
function jumpToYear(year) {
    // Set quality control state
    isScrolling = true;
    currentQuality = 0.1; // Start with very low quality for initial jump
    
    // Clear any existing timeout
    if (scrollTimeout) {
        clearTimeout(scrollTimeout);
    }

    scrollTimeout = setTimeout(() => {
        currentQuality = 1; // Reset to full quality
    }, 500);

    // Check if there's a start marker and if target is before it
    if (timelineMarkers.start) {
        const startYear = timelineMarkers.start.year;
        const startSubtick = timelineMarkers.start.subtick;
        
        // Convert to comparable values (year.subtick format)
        const targetValue = year;
        const startValue = startYear + (startSubtick / timelineState.granularity);
        
        // If target is before start marker, reroute to start marker
        if (targetValue < startValue) {
            year = startYear;
        }
    }

    // Check if there's an end marker and if target is after it
    if (timelineMarkers.end) {
        const endYear = timelineMarkers.end.year;
        const endSubtick = timelineMarkers.end.subtick;
        
        // Convert to comparable values (year.subtick format)
        const targetValue = year;
        const endValue = endYear + (endSubtick / timelineState.granularity);
        
        // If target is after end marker, reroute to end marker
        if (targetValue > endValue) {
            year = endYear;
        }
    }
    
    // Update state
    timelineState.focusYear = year;
    timelineState.offsetPx = 0;

    // Progressive rendering sequence
    let qualitySteps = [0.2, 0.4, 0.6, 0.8, 1.0];
    let currentStep = 0;

    function renderStep() {
        if (currentStep < qualitySteps.length) {
            currentQuality = qualitySteps[currentStep];
            renderTimeline();
            currentStep++;
            requestAnimationFrame(renderStep);
        }
    }

    // Start progressive rendering
    requestAnimationFrame(renderStep);
}

/**
 * Scrolls the timeline by years
 * @param {number} years - Number of years to scroll
 * 
 * How it works:
 * 1. Set quality control state
 * 2. Clear any existing timeout
 * 3. Set timeout to detect when navigation ends
 * 4. Updates offset
 * 5. Re-renders timeline
 * 
 * Possible errors:
 * - Invalid years value
 * - Render failure
 */
function scrollBy(years) {
    // Set quality control state
    isScrolling = true;
    currentQuality = 0.5; // Set stable quality during navigation
    
    // Clear any existing timeout
    if (scrollTimeout) {
        clearTimeout(scrollTimeout);
    }
    
    // Set timeout to detect when navigation ends
    scrollTimeout = setTimeout(() => {
        isScrolling = false;
        currentQuality = 1.0; // Reset to full quality
    }, 150); // 150ms debounce

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
function setInitialSettings({ focusYear, granularity, items, pixelsPerSubtick = 10, displayRadius = 10 }) {
    // Assign stable indices to regular items
    let regularItemIndex = 0;
    items.forEach(item => {
        if (item && item.type && item.type.toLowerCase() !== 'age' && item.type.toLowerCase() !== 'period') {
            item.item_index = regularItemIndex++;
        }
    });

    timelineState.focusYear = focusYear;
    timelineState.granularity = granularity;
    timelineState.items = items;
    timelineState.pixelsPerSubtick = pixelsPerSubtick;
    timelineState.offsetPx = 0;
    timelineState.displayRadius = displayRadius;
    // Step 1: Check for timeline markers when timeline loads
    checkTimelineMarkers();
    
    renderTimeline();
    computePeriodStackLevels();
}

/**
 * Checks for timeline markers in the items array
 * Step 1: Check all items for type 8 (Timeline_start) or type 9 (Timeline_end)
 * Step 2: Store their years and subticks in the timelineMarkers state
 */
function checkTimelineMarkers() {
    // Reset markers
    timelineMarkers.start = null;
    timelineMarkers.end = null;

    // Check each item
    timelineState.items.forEach(item => {
        if (!item) return;

        // Check for type 8 (Timeline_start)
        if (item.type === 'Timeline_start') {
            timelineMarkers.start = {
                year: item.year,
                subtick: item.subtick
            };
        }
        // Check for type 9 (Timeline_end)
        else if (item.type === 'Timeline_end') {
            timelineMarkers.end = {
                year: item.year,
                subtick: item.subtick
            };
        }
    });
}

/**
 * Updates the timeline markers state based on current items
 */
function updateTimelineMarkers() {
    const itemId = item.getAttribute('data-id');
    if (!itemId) return;

    const images = document.querySelectorAll(`.cascading-image[data-item-id="${itemId}"]`);
    images.forEach(img => {
        img.style.zIndex = '100'; // Higher z-index on hover
        img.style.transition = 'all 0.3s ease';
    });
}

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
/*
function findClosestNote(centerX) {
    // Get all note items
    const noteItems = timelineState.items.filter(item => 
        //item && item.type && item.type.toLowerCase() === 'note'
        item && item.show_in_notes == 1
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

    if(!noteRadius){
        var noteRadius = 10;
    }

    // Only return the note if it's within 10px
    if (closestDistance <= noteRadius) {
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
*/
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
        const endYear = parseFloat(item.end_year !== undefined && item.end_year !== null ? item.end_year : (item.year || 0));
        const endSubtick = parseInt(item.end_subtick !== undefined && item.end_subtick !== null ? item.end_subtick : (item.subtick || 0));
        
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

// Add this function near the other utility functions
function openEditAgeOrPeriod(item) {
    const year = parseFloat(item.year || item.date || 0);
    const subtick = parseInt(item.subtick || 0);
    const endYear = parseFloat(item.end_year !== undefined && item.end_year !== null ? item.end_year : (item.year || 0));
    const endSubtick = parseInt(item.end_subtick !== undefined && item.end_subtick !== null ? item.end_subtick : (item.subtick || 0));
    
    const itemData = {
        id: item.id,
        type: item.type,
        year: year,
        subtick: subtick,
        end_year: endYear,
        end_subtick: endSubtick,
        title: item.title,
        description: item.description,
        content: item.content,
        pictures: item.pictures,
        tags: item.tags,
        book_title: item.book_title,
        chapter: item.chapter,
        page: item.page,
        color: item.color,
        story_references: item.story_references
    };
    
    window.api.send('open-add-item-with-range-window', year, subtick, timelineState.granularity, item.type, itemData);
}

// Add this to the window object so it can be called from the view modal
window.openEditAgeOrPeriod = openEditAgeOrPeriod;

// Context Menu Implementation
let contextMenu = null;
let contextMenuItems = [];

function createContextMenu() {
    // Remove existing context menu if it exists
    if (contextMenu) {
        contextMenu.remove();
    }
    
    // Create new context menu
    contextMenu = document.createElement('div');
    contextMenu.id = 'timeline-context-menu';
    contextMenu.className = 'context-menu';
    contextMenu.style.display = 'none';
    
    // Add menu items from the contextMenuItems array
    contextMenuItems.forEach(item => {
        const button = document.createElement('button');
        button.className = 'context-menu-item';
        if (item.disabled) button.classList.add('disabled');
        if (item.separator) {
            button.classList.add('separator');
            contextMenu.appendChild(button);
            return;
        }
        button.innerHTML = `<i class="fas ${item.icon}"></i> ${item.label}`;
        button.dataset.type = item.type;
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            // Close the context menu for any button click
            hideContextMenu();
            if (!item.disabled && item.action) {
                item.action(contextMenu.dataset.year, contextMenu.dataset.subtick);
            }
        });
        contextMenu.appendChild(button);
    });
    
    // Add to document body
    document.body.appendChild(contextMenu);
}

// Function to add items to the context menu
function addContextMenuItem(item) {
    contextMenuItems.push(item);
    // Recreate the context menu with the new items
    createContextMenu();
}

// Function to clear all context menu items
function clearContextMenuItems() {
    contextMenuItems = [];
    createContextMenu();
}

// Initialize default context menu items
function initializeDefaultContextMenu() {
    // Add timeline start/end items
    addContextMenuItem({ 
        type: 'start', 
        icon: 'ri-quill-pen-ai-fill', 
        label: 'Set timeline start', 
        action: (year, subtick) => {
            // Only allow if no start marker exists
            if (timelineMarkers.start === null) {
                setTimelineStart();
            }
        }
    });

    addContextMenuItem({ 
        type: 'end', 
        icon: 'ri-book-fill', 
        label: 'Set timeline end', 
        action: (year, subtick) => {
            // Only allow if no end marker exists
            if (timelineMarkers.end === null) {
                setTimelineEnd();
            }
        }
    });
}

// Add this to ensure context menu is properly initialized
document.addEventListener('DOMContentLoaded', () => {
    initializeDefaultContextMenu();
});

function showContextMenu(x, y, year, subtick) {
    if (!contextMenu) {
        createContextMenu();
    }
    
    // Close item selector if it's open
    closeItemSelector();
    
    // Get viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Show menu temporarily to get dimensions
    contextMenu.style.display = 'block';
    const menuWidth = contextMenu.offsetWidth;
    const menuHeight = contextMenu.offsetHeight;
    
    // Calculate position to ensure menu stays within viewport
    let left = x;
    let top = y;
    
    // Adjust horizontal position if menu would go off right edge
    if (left + menuWidth > viewportWidth) {
        left = viewportWidth - menuWidth - 5;
    }
    
    // Adjust vertical position if menu would go off bottom edge
    if (top + menuHeight > viewportHeight) {
        top = viewportHeight - menuHeight - 5;
    }
    
    // Ensure menu doesn't go off left or top edges
    left = Math.max(5, left);
    top = Math.max(5, top);
    
    // Position the context menu
    contextMenu.style.left = `${left}px`;
    contextMenu.style.top = `${top}px`;
    
    // Store the position for later use
    contextMenu.dataset.year = year;
    contextMenu.dataset.subtick = subtick;

    // Step 3: Check for existing markers and update menu items
    const menuItems = contextMenu.querySelectorAll('.context-menu-item');
    menuItems.forEach(item => {
        const type = item.dataset.type;
        if (type === 'start') {
            // Disable if start marker exists
            item.classList.toggle('disabled', timelineMarkers.start !== null);
        } else if (type === 'end') {
            // Disable if end marker exists
            item.classList.toggle('disabled', timelineMarkers.end !== null);
        }
    });
}

function hideContextMenu() {
    if (contextMenu) {
        contextMenu.style.display = 'none';
    }
}

function handleContextMenuClick(type) {
    const year = parseInt(contextMenu.dataset.year);
    const subtick = parseInt(contextMenu.dataset.subtick);
    
    hideContextMenu();
    
    // Open the appropriate add item window based on type
    if (type === 'event' || type === 'bookmark' || type === 'picture' || type === 'note') {
        window.api.send('open-add-item-window', year, subtick, timelineState.granularity, type);
    } else {
        const randomColor = generatePastelColor();
        window.api.send('open-add-item-with-range-window', year, subtick, timelineState.granularity, type, randomColor);
    }
}

// Add context menu event listener to the timeline container
container.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    
    // If context menu is already open, close it and return
    if (contextMenu && contextMenu.style.display === 'block') {
        hideContextMenu();
        return;
    }
    
    // Don't show context menu if clicking on an existing item
    if (e.target.closest('.timeline-item-box, .timeline-age-item, .timeline-period-item')) {
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

    // Check if position is within timeline boundaries
    const position = year + (subtick / timelineState.granularity);
    
    if (timelineMarkers.start) {
        const startValue = timelineMarkers.start.year + (timelineMarkers.start.subtick / timelineState.granularity);
        if (position < startValue) {
            return; // Don't show menu if before start marker
        }
    }
    
    if (timelineMarkers.end) {
        const endValue = timelineMarkers.end.year + (timelineMarkers.end.subtick / timelineState.granularity);
        if (position > endValue) {
            return; // Don't show menu if after end marker
        }
    }
    
    showContextMenu(e.clientX, e.clientY, year, subtick);
});

// Close context menu when clicking outside
document.addEventListener('click', function(e) {
    if (!e.target.closest('#timeline-context-menu')) {
        hideContextMenu();
    }
});

// Function to set timeline start marker
function setTimelineStart() {
    // Get year and subtick from the context menu's dataset
    const year = parseInt(contextMenu.dataset.year);
    const subtick = parseInt(contextMenu.dataset.subtick);

    // Check if there's an end marker and validate position
    if (timelineMarkers.end) {
        const endYear = timelineMarkers.end.year;
        const endSubtick = timelineMarkers.end.subtick;
        
        // Convert to comparable values (year.subtick format)
        const startValue = year + (subtick / timelineState.granularity);
        const endValue = endYear + (endSubtick / timelineState.granularity);
        
        // Start must be before end
        if (startValue >= endValue) {
            // Calculate the latest valid position (one year before end)
            const validYear = endYear - 1;
            const validSubtick = 0;
            
            if (window.showError) {
                window.showError(`Timeline start must be before the end marker. The latest valid position is ${validYear}.${validSubtick}`);
            } else {
                console.error(`Timeline start must be before the end marker. The latest valid position is ${validYear}.${validSubtick}`);
            }
            return;
        }
    }

    // Create a new item for the timeline start
    const item = {
        title: 'Timeline Start',
        description: 'The beginning of this timeline',
        type: 'Timeline_start',
        year: year,
        subtick: subtick,
        color: '#4CAF50' // Green color to distinguish it
    };

    // Update the timelineMarkers state immediately
    timelineMarkers.start = {
        year: year,
        subtick: subtick
    };

    // Send the item to the main process
    window.api.send('addTimelineItem', item);
    
    // Refresh timeline to update markers
    refreshTimeline();
}

// Function to remove timeline start marker
function removeTimelineStart() {
    // Find the start marker in the items array
    const startMarker = timelineState.items.find(item => item.type === 'Timeline_start');
    if (startMarker) {
        // Send delete request to main process using the correct channel
        window.api.send('removeItem', startMarker.id);
        // Update state immediately
        timelineMarkers.start = null;
        // Refresh timeline
        refreshTimeline();
        // Reinitialize the default context menu
        clearContextMenuItems();
        initializeDefaultContextMenu();
    }
}

// Function to remove timeline end marker
function removeTimelineEnd() {
    // Find the end marker in the items array
    const endMarker = timelineState.items.find(item => item.type === 'Timeline_end');
    if (endMarker) {
        // Send delete request to main process using the correct channel
        window.api.send('removeItem', endMarker.id);
        // Update state immediately
        timelineMarkers.end = null;
        // Refresh timeline
        refreshTimeline();
        // Reinitialize the default context menu
        clearContextMenuItems();
        initializeDefaultContextMenu();
    }
}

// Add these functions to the window object
window.removeTimelineStart = removeTimelineStart;
window.removeTimelineEnd = removeTimelineEnd;

// Function to set timeline end marker
function setTimelineEnd() {
    // Get year and subtick from the context menu's dataset
    const year = parseInt(contextMenu.dataset.year);
    const subtick = parseInt(contextMenu.dataset.subtick);

    // Check if there's a start marker and validate position
    if (timelineMarkers.start) {
        const startYear = timelineMarkers.start.year;
        const startSubtick = timelineMarkers.start.subtick;
        
        // Convert to comparable values (year.subtick format)
        const startValue = startYear + (startSubtick / timelineState.granularity);
        const endValue = year + (subtick / timelineState.granularity);
        
        // End must be after start
        if (endValue <= startValue) {
            // Calculate the earliest valid position (one year after start)
            const validYear = startYear + 1;
            const validSubtick = 0;
            
            if (window.showError) {
                window.showError(`Timeline end must be after the start marker. The earliest valid position is ${validYear}.${validSubtick}`);
            } else {
                console.error(`Timeline end must be after the start marker. The earliest valid position is ${validYear}.${validSubtick}`);
            }
            return;
        }
    }

    // Create a new item for the timeline end
    const item = {
        title: 'Timeline End',
        description: 'The end of this timeline',
        type: 'Timeline_end',
        year: year,
        subtick: subtick,
        color: '#FF5252' // Red color to distinguish it
    };

    // Update the timelineMarkers state immediately
    timelineMarkers.end = {
        year: year,
        subtick: subtick
    };

    // Send the item to the main process
    window.api.send('addTimelineItem', item);
    
    // Refresh timeline to update markers
    refreshTimeline();
}

// Function to refresh timeline items
function refreshTimeline() {
    // Send request to get all items
    window.api.send('get-all-items');
}

// Add listener for the response
window.api.receive('all-items', (items) => {
    timelineState.items = items;
    checkTimelineMarkers(); // Check markers after items are refreshed
    renderTimeline();
});

/**
 * Jumps to a specific date (year and subtick)
 * 
 * How it works:
 * 1. Gets the target year and subtick from input
 * 2. Checks if target is before start marker
 * 3. Updates focus year
 * 4. Calculates offset to center the target date
 * 5. Re-renders timeline
 * 
 * Possible errors:
 * - Invalid input
 * - Render failure
 */
function jumpToDate(i_year = null, i_subtick = null) {
    const floatYear = i_year + (i_subtick / timelineState.granularity);
    let value = 0;
    if(!i_year) {
        const input = document.getElementById('jump-to-date');
        value = parseFloat(input.value);
    } else {
        value = floatYear;
    }
    
    let year = Math.floor(value);
    let subtick = Math.round((value - year) * timelineState.granularity);
    
    // Check if there's a start marker and if target is before it
    if (timelineMarkers.start) {
        const startYear = timelineMarkers.start.year;
        const startSubtick = timelineMarkers.start.subtick;
        
        // Convert to comparable values (year.subtick format)
        const targetValue = year + (subtick / timelineState.granularity);
        const startValue = startYear + (startSubtick / timelineState.granularity);
        
        // If target is before start marker, reroute to start marker
        if (targetValue < startValue) {
            year = startYear;
            subtick = startSubtick;
            // Update input value to show the actual position
            input = document.getElementById('jump-to-date');
            if(!input) return;
            input.value = `${year}.${subtick.toString().padStart(2, '0')}`;
        }
    }

    // Check if there's an end marker and if target is after it
    if (timelineMarkers.end) {
        const endYear = timelineMarkers.end.year;
        const endSubtick = timelineMarkers.end.subtick;
        
        // Convert to comparable values (year.subtick format)
        const targetValue = year + (subtick / timelineState.granularity);
        const endValue = endYear + (endSubtick / timelineState.granularity);
        
        // If target is after end marker, reroute to end marker
        if (targetValue > endValue) {
            year = endYear;
            subtick = endSubtick;
            // Update input value to show the actual position
            input.value = `${year}.${subtick.toString().padStart(2, '0')}`;
        }
    }
    
    // Update focus year
    timelineState.focusYear = year;
    
    // Calculate offset to center the target date
    const containerRect = container.getBoundingClientRect();
    const centerX = containerRect.width / 2;
    const targetX = centerX + (year + subtick / timelineState.granularity - timelineState.focusYear) * timelineState.pixelsPerSubtick * timelineState.granularity;
    timelineState.offsetPx = centerX - targetX;
    
    renderTimeline();
}

/**
 * Gets the nearest year from a position
 * @param {number|null} x - X position (null for center)
 * @param {number} direction - Direction to round (-1, 0, 1)
 * @returns {number} Nearest year
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

// Add these functions to the window object so they can be called from HTML
window.jumpToDate = jumpToDate;
window.jumpToYear = jumpToYear;
window.scrollBy = scrollBy;
window.setInitialSettings = setInitialSettings;
window.openEditAgeOrPeriod = openEditAgeOrPeriod;
window.setTimelineStart = setTimelineStart;
window.setTimelineEnd = setTimelineEnd;

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

// Add click handler for the timeline
container.addEventListener('click', function(e) {
    // Hide context menu if it's open
    hideContextMenu();
    
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

    // Check if position is within timeline boundaries
    const position = year + (subtick / timelineState.granularity);
    
    if (timelineMarkers.start) {
        const startValue = timelineMarkers.start.year + (timelineMarkers.start.subtick / timelineState.granularity);
        if (position < startValue) {
            return; // Don't show selector if before start marker
        }
    }
    
    if (timelineMarkers.end) {
        const endValue = timelineMarkers.end.year + (timelineMarkers.end.subtick / timelineState.granularity);
        if (position > endValue) {
            return; // Don't show selector if after end marker
        }
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
        hideContextMenu();
    }
});

/**
 * Adds a new timeline item
 * @param {number} year - Year to add item at
 * @param {number} subtick - Subtick to add item at
 * @returns {Object} New item
 */
function addItem(year, subtick, granularity) {
    let newItem = openAddItemWindow(year, subtick, granularity);
    return newItem;
}

/**
 * Opens the add item window
 * @param {number} year - Year to add item at
 * @param {number} subtick - Subtick to add item at
 * @param {number} granularity - Timeline granularity
 */
function openAddItemWindow(year, subtick, granularity) {
    year = Math.floor(year);
    // Pass granularity as a third argument
    window.api.send('open-add-item-window', year, subtick, granularity);
}

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

// ===== Initialization =====
document.addEventListener("DOMContentLoaded", () => {
    window.setTimeout(() => {
        jumpToYear(timelineState.focusYear);
    }, 200);
});

// Initial render
renderTimeline();

// Add handler for period stack recalculation
window.api.receive('recalculate-period-stacks', () => {
    computePeriodStackLevels();
    renderTimeline();
});

// Add scroll event handler to track scrolling state
container.addEventListener('wheel', () => {
    isScrolling = true;
    currentQuality = 0.2; // Set stable quality during scroll
    
    // Clear any existing timeout
    if (scrollTimeout) {
        clearTimeout(scrollTimeout);
    }
    
    // Set timeout to detect when scrolling ends
    scrollTimeout = setTimeout(() => {
        isScrolling = false;
        currentQuality = 1.0; // Reset to full quality
    }, 150); // 150ms debounce
});

/**
 * Checks if any timeline items are currently hovered and updates the global hover bubble visibility
 */
function checkHoveredItems() {
    const hoveredItems = document.querySelectorAll('.timeline-item-box:hover, .timeline-age-item:hover, .timeline-period-item:hover');
    if (globalHoverBubble) {
        if (hoveredItems.length === 0) {
            globalHoverBubble.style.opacity = '0';
        }
    }
}

// Set up periodic check for hovered items
setInterval(checkHoveredItems, 500);

