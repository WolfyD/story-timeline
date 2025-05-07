const timeline = document.getElementById("timeline");
const container = document.getElementById("timeline-container");
const hoverMarker = document.getElementById("timeline-hover-marker");
const hoverMarkerStick = document.getElementById("timeline-hover-marker-stick");

const timelineState = {
    focusYear: 0,
    granularity: 22,
    pixelsPerSubtick: 1,
    offsetPx: 0,
    items: []
};

let isDragging = false;
let mouseDown = false;
let dragStartX = null;
let initialOffset = 0;
let tickWidthCssOffset = 10;
let tickOffset = 0;

function calculateYearFromPosition(x) {
    const containerRect = container.getBoundingClientRect();
    const centerX = containerRect.width / 2;
    const year = timelineState.focusYear + ((x - containerRect.left - centerX - timelineState.offsetPx) / (timelineState.pixelsPerSubtick * timelineState.granularity));
    return year;
}

function calculateSubtickFromPosition(x) {
    const containerRect = container.getBoundingClientRect();
    const centerX = containerRect.width / 2;
    // Calculate the floating-point year
    const year = timelineState.focusYear + ((x - containerRect.left - centerX - timelineState.offsetPx) / (timelineState.pixelsPerSubtick * timelineState.granularity));
    // Get the subtick index within the year (0-based)
    let subtick = Math.floor((year - Math.floor(year)) * timelineState.granularity);
    // Handle edge case where subtick would be granularity (i.e., exactly at next year)
    if (subtick === timelineState.granularity) subtick = 0;
    return subtick;
}

function calculatePositionFromYear(year) {
    const containerRect = container.getBoundingClientRect();
    const centerX = containerRect.width / 2;
    return centerX + (year - timelineState.focusYear) * timelineState.pixelsPerSubtick * timelineState.granularity + timelineState.offsetPx;
}

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

updateTickOffset();
window.addEventListener('resize', updateTickOffset);

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

function getHoverLabel(v, granularity) {
    // Round to nearest subtick
    const step = 1 / granularity;
    const snapped = Math.round(v / step) * step;

    let year, subtick;

    console.log("Before", snapped, v, granularity);

    if (snapped >= 0) {
        year = Math.floor(snapped);
        subtick = Math.round((snapped - year) * granularity);
    } else {
        year = Math.ceil(snapped);
        subtick = Math.round((snapped - year) * granularity);
    }

    console.log("After", snapped, year, subtick);


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

function renderTimeline() {
    const { focusYear, granularity, pixelsPerSubtick, offsetPx } = timelineState;
    const containerRect = container.getBoundingClientRect();
    const centerX = containerRect.width / 2;

    // Calculate the leftmost and rightmost visible years based on current offset and size
    const leftYear = focusYear - ((centerX + offsetPx) / (granularity * pixelsPerSubtick));
    const rightYear = focusYear + ((containerRect.width - centerX - offsetPx) / (granularity * pixelsPerSubtick));

    // Add a buffer of subticks on both sides for edge safety
    const bufferSubticks = granularity * 10;
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

    // Render items
    timelineState.items.forEach(item => {
        const itemX = centerX + (item.date - focusYear) * pixelsPerSubtick * granularity + offsetPx;
        const el = document.createElement("div");
        el.className = "marker";
        el.style.left = `${itemX}px`;
        el.style.position = 'absolute';
        timeline.appendChild(el);
    });
}

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
}

container.addEventListener("mousemove", (e) => {
    if (mouseDown) {
        isDragging = true;
        const dx = e.clientX - dragStartX;
        timelineState.offsetPx = initialOffset + dx;
        renderTimeline();
    }
    updateHoverMarker(e.clientX, e.clientY);
});

container.addEventListener("mousedown", (e) => {
    mouseDown = true;
    dragStartX = e.clientX;
    initialOffset = timelineState.offsetPx;
});

container.addEventListener("mouseup", (e) => {
    mouseDown = false;
    if (Math.abs(e.clientX - dragStartX) < 5) {
        const year = calculateYearFromPosition(e.clientX);
        timelineState.items.push({
            date: year,
            x: e.clientX
        });
        console.log("Added item at", year.toFixed(2));
        renderTimeline();
    }
    dragStartX = null;
});

container.addEventListener("mouseleave", () => {
    hoverMarker.style.display = 'none';
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

function jumpToYear(year) {
    timelineState.focusYear = year;
    timelineState.offsetPx = 0;
    renderTimeline();
}

function scrollBy(years) {
    timelineState.offsetPx -= years * timelineState.granularity * timelineState.pixelsPerSubtick;
    renderTimeline();
}

function setInitialSettings({ focusYear, granularity, items, pixelsPerSubtick = 10 }) {
    timelineState.focusYear = focusYear;
    timelineState.granularity = granularity;
    timelineState.items = items;
    timelineState.pixelsPerSubtick = pixelsPerSubtick;
    timelineState.offsetPx = 0;
    renderTimeline();
}

window.jumpToYear = jumpToYear;
window.scrollBy = scrollBy;
window.setInitialSettings = setInitialSettings;

renderTimeline();

document.addEventListener("DOMContentLoaded", () => {
    window.setTimeout(() => {
        jumpToYear(timelineState.focusYear);
    }, 200);
});

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