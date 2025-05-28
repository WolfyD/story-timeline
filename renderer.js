/**
 * Renderer Process Module
 * 
 * This is the main renderer process file that handles the user interface and timeline visualization.
 * It manages the DOM, user interactions, and communication with the main process.
 * 
 * Key Responsibilities:
 * - Timeline rendering and visualization
 * - User interaction handling (clicks, drags, wheel events)
 * - Timeline item management (add, edit, remove)
 * - Timeline navigation and zooming
 * - Communication with main process via IPC
 * 
 * Main Functions:
 * - renderTimeline(): Renders the entire timeline with all items
 * - renderTimelineItem(item): Renders a single timeline item
 * - renderYear(year): Renders a year marker on the timeline
 * - renderSubtick(year, subtick): Renders a subtick marker
 * - renderGuides(): Renders guide lines for timeline navigation
 * - handleTimelineClick(event): Handles clicks on the timeline
 * - handleTimelineDrag(event): Handles drag operations on the timeline
 * - handleTimelineWheel(event): Handles zoom and scroll operations
 * - addTimelineItem(year, subtick, title, description): Adds a new timeline item
 * - updateTimelineItem(item): Updates an existing timeline item
 * - removeTimelineItem(itemId): Removes a timeline item
 * 
 * Event Listeners:
 * - Timeline click: Handles item selection and navigation
 * - Timeline drag: Handles timeline scrolling
 * - Timeline wheel: Handles zooming and year navigation
 * - Window resize: Handles timeline redrawing
 * - IPC messages: Handles communication with main process
 */

/**
 * Story Timeline Renderer
 * Main renderer module for the Story Timeline application.
 * Handles UI rendering, state management, and IPC communication.
 */

// ===== State Management =====
/**
 * Global state variables
 * @type {Array} items - List of all timeline items
 * @type {boolean} isFullscreen - Current fullscreen state
 * @type {Object} storyIndex - Index of stories for quick lookup
 * @type {Object} loadedSettings - Current application settings
 * @type {Object} loadedData - Current timeline data
 */
let items = [];

// FPS Counter variables
let frameCount = 0;
let lastTime = performance.now();
let fps = 0;
const fpsHistory = [];
const HISTORY_SIZE = 10; // Keep last 10 measurements for smoothing

// Scrolling speed variables
let lastOffsetPx = 0;
let lastYear = 0;
let pixelsPerSecond = 0;
let yearsPerSecond = 0;
let lastScrollUpdate = performance.now();

// FPS Counter function
function updateFPS() {
    const currentTime = performance.now();
    const elapsedTime = currentTime - lastTime;
    
    // Only count frames if enough time has passed (prevents counting frames during long pauses)
    if (elapsedTime > 0) {
        const currentFPS = 1000 / elapsedTime;
        fpsHistory.push(currentFPS);
        
        // Keep only the last HISTORY_SIZE measurements
        if (fpsHistory.length > HISTORY_SIZE) {
            fpsHistory.shift();
        }
        
        // Calculate average FPS from history
        fps = Math.round(fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length);
        
        // Update display
        const fpsDisplay = document.getElementById('fps_display');
        if (fpsDisplay) {
            fpsDisplay.textContent = `FPS: ${fps}`;
            
            // Add color coding based on FPS with colors that contrast well with #f5e6d4 background
            if (fps >= 55) {
                fpsDisplay.style.color = '#2c7a2c'; // Dark green for good performance
            } else if (fps >= 30) {
                fpsDisplay.style.color = '#8a4e4e'; // Dark brown for acceptable performance
            } else {
                fpsDisplay.style.color = '#c0392b'; // Dark red for poor performance
            }
        }
    }
    
    lastTime = currentTime;
    requestAnimationFrame(updateFPS);
}

// Start FPS counter
updateFPS();

let isFullscreen = false;
let storyIndex = {};
let loadedSettings = null;
let loadedData = null;
let isDataReady = false;
let isSettingsReady = false;

// ===== Public API Functions =====
/**
 * Opens the item viewer modal for a specific timeline item
 * @param {string|number} itemId - The ID of the item to view
 * 
 * How it works:
 * 1. Finds the item in the items array
 * 2. Populates the modal with item data
 * 3. Sets up event handlers for modal actions
 * 
 * Possible errors:
 * - Modal element not found
 * - Item not found
 * - DOM element access errors
 */
window.openItemViewer = function(itemId) {
    const modal = document.getElementById('item-viewer-modal');
    if (!modal) {
        console.error('Modal element not found');
        return;
    }

    // Find the item by id
    const item = items.find(i => (i.id || i['story-id']) == itemId);
    if (!item) {
        console.error('Item not found:', itemId);
        return;
    }

    // Helper function to safely set text content
    function setTextContent(elementId, text) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = text === null || text === undefined ? '' : text;
        }
    }

    // Set title
    setTextContent('item-viewer-title', item.title || '(No Title)');

    // Set date
    setTextContent('item-viewer-year', item.year ?? '');
    setTextContent('item-viewer-subtick', item.subtick ?? '');

    // Set description and content
    setTextContent('item-viewer-description', item.description || '');
    setTextContent('item-viewer-content', item.content || '');

    // Set tags
    const tagsContainer = document.getElementById('item-viewer-tags');
    if (tagsContainer) {
        tagsContainer.innerHTML = '';
        if (item.tags && item.tags.length) {
            item.tags.forEach(tag => {
                const tagElement = document.createElement('div');
                tagElement.className = 'tag';
                tagElement.textContent = tag;
                tagsContainer.appendChild(tagElement);
            });
        }
    }

    // Set book info
    setTextContent('item-viewer-book-title', item.book_title || '');
    setTextContent('item-viewer-chapter', item.chapter || '');
    setTextContent('item-viewer-page', item.page || '');

    // Set stories
    const storiesContainer = document.getElementById('item-viewer-stories');
    if (storiesContainer) {
        storiesContainer.innerHTML = '';
        if (item.story_refs && item.story_refs.length) {
            item.story_refs.forEach(story => {
                const storyElement = document.createElement('div');
                storyElement.className = 'story-item';
                // Separate containers for title and id
                const titleSpan = document.createElement('span');
                titleSpan.className = 'story-title';
                titleSpan.textContent = story.title;
                const idSpan = document.createElement('span');
                idSpan.className = 'story-id';
                idSpan.textContent = story.id;
                storyElement.appendChild(titleSpan);
                storyElement.appendChild(idSpan);
                storiesContainer.appendChild(storyElement);
            });
        }
    }

    // Set pictures
    const picturesContainer = document.getElementById('item-viewer-pictures');
    if (picturesContainer) {
        picturesContainer.innerHTML = '';
        if (item.pictures && item.pictures.length) {
            item.pictures.forEach(pic => {
                const pictureElement = document.createElement('div');
                pictureElement.className = 'image-container';
                pictureElement.innerHTML = `
                    <img src="${pic.file_path}" alt="${pic.title || ''}">
                    <div class="image-info">
                        <div class="image-title">${pic.title || 'Untitled'}</div>
                        <div class="image-description">${pic.description || ''}</div>
                    </div>
                `;
                picturesContainer.appendChild(pictureElement);
            });
        } else {
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state';
            emptyState.textContent = 'No images available';
            picturesContainer.appendChild(emptyState);
        }
    }

    // Set up edit button
    const editButton = document.getElementById('item-viewer-edit');
    if (editButton) {
        editButton.onclick = () => {
            modal.classList.remove('active');
            if (item.type === 'Age' || item.type === 'Period') {
                openEditItemWithRangeWindow(item);
            } else {
                openEditItemWindow(item);
            }
        };
    }

    // Set up delete button
    const deleteButton = document.getElementById('item-viewer-delete');
    if (deleteButton) {
        deleteButton.onclick = () => {
            if (confirm('Are you sure you want to delete this item?')) {
                window.api.send('removeItem', item.id || item['story-id']);
                modal.classList.remove('active');
            }
        };
    }

    // Set up close button
    const closeButton = document.getElementById('item-viewer-close');
    if (closeButton) {
        closeButton.onclick = () => {
            modal.classList.remove('active');
        };
    }

    // Close on outside click
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    };

    // Show the modal
    modal.classList.add('active');
};

// ===== Settings Management =====
/**
 * Opens the settings panel
 * 
 * How it works:
 * - Sets the settings container display to 'block'
 * 
 * Possible errors:
 * - Settings container not found
 */
function openSettings() {
    document.querySelector('.settings_container').style.display = 'block';
}

/**
 * Closes the settings panel
 * 
 * How it works:
 * - Sets the settings container display to 'none'
 * 
 * Possible errors:
 * - Settings container not found
 */
function closeSettings() {
    document.querySelector('.settings_container').style.display = 'none';
}

/**
 * Sets up the application settings
 * @param {Object} settings - The settings object to apply
 * 
 * How it works:
 * 1. Updates all settings UI elements
 * 2. Applies CSS customizations
 * 3. Updates global settings state
 * 4. Triggers timeline update
 * 
 * Possible errors:
 * - Invalid settings object
 * - DOM element not found
 * - Invalid CSS property values
 */
function settingsSetup(settings) {
    if(!settings) return;
    
    let fontSelect = document.querySelector('#font-select');
    fontSelect.selectedIndex = settings.font;
    
    let fontSizeScale = document.querySelector('#font-size-scale-input');
    fontSizeScale.value = settings.fontSizeScale;
    
    let pixelsPerSubtick = document.querySelector('#pixels-per-subtick');
    pixelsPerSubtick.value = settings.pixelsPerSubtick;

    let customCSS = document.querySelector('#custom-css');
    let customMainCSS = document.querySelector('#custom-main-css');
    let customItemsCSS = document.querySelector('#custom-items-css');
    
    // Set up timeline CSS
    let useTimelineCSS = document.querySelector('#use-timeline-css');
    useTimelineCSS.checked = settings.useTimelineCSS;
    toggleTimelineCSS(settings.useTimelineCSS);
    customCSS.value = settings.customCSS;

    // Set up main CSS
    let useMainCSS = document.querySelector('#use-main-css');
    useMainCSS.checked = settings.useMainCSS;
    toggleMainCSS(settings.useMainCSS);
    customMainCSS.value = settings.customMainCSS;

    // Set up items CSS
    let useItemsCSS = document.querySelector('#use-items-css');
    useItemsCSS.checked = settings.useItemsCSS;
    toggleItemsCSS(settings.useItemsCSS);
    customItemsCSS.value = settings.customItemsCSS;

    let showGuides = document.querySelector('#show-guides');
    showGuides.checked = settings.showGuides;
    toggleGuides(settings.showGuides);

    // Set up custom scaling
    let useCustomScaling = document.querySelector('#use-custom-scaling');
    useCustomScaling.checked = settings.useCustomScaling;
    let customScale = document.querySelector('#custom-scale');
    customScale.value = settings.customScale;

    let displayRadius = document.querySelector('#display-radius');
    displayRadius.value = settings.displayRadius;
    
    // Apply window scaling if enabled
    if (settings.useCustomScaling) {
        window.api.send('set-window-scale', parseFloat(settings.customScale));
    } else {
        window.api.send('set-window-scale', 1.0);
    }

    document.body.style.setProperty('--default-font', fontSelect.value);
    document.body.style.setProperty('--default-font-scale', settings.fontSizeScale);

    loadedSettings = settings;
    checkAllLoaded();
}

function toggleTimelineCSS(use = false) {
    const customCSS = document.querySelector('#custom-css');
    if(use) {
        customCSS.removeAttribute('readonly');
        // Apply the custom CSS
        const styleElement = document.getElementById('custom-timeline-style') || document.createElement('style');
        styleElement.id = 'custom-timeline-style';
        styleElement.textContent = customCSS.value;
        if (!document.getElementById('custom-timeline-style')) {
            document.head.appendChild(styleElement);
        }
    } else {
        customCSS.setAttribute('readonly', 'readonly');
        // Remove the custom CSS
        const styleElement = document.getElementById('custom-timeline-style');
        if (styleElement) {
            styleElement.remove();
        }
    }
}

function toggleMainCSS(use = false) {
    const customMainCSS = document.querySelector('#custom-main-css');
    if(use) {
        customMainCSS.removeAttribute('readonly');
        // Apply the custom CSS
        const styleElement = document.getElementById('custom-main-style') || document.createElement('style');
        styleElement.id = 'custom-main-style';
        styleElement.textContent = customMainCSS.value;
        if (!document.getElementById('custom-main-style')) {
            document.head.appendChild(styleElement);
        }
    } else {
        customMainCSS.setAttribute('readonly', 'readonly');
        // Remove the custom CSS
        const styleElement = document.getElementById('custom-main-style');
        if (styleElement) {
            styleElement.remove();
        }
    }
}

function toggleItemsCSS(use = false) {
    const customItemsCSS = document.querySelector('#custom-items-css');
    if(use) {
        customItemsCSS.removeAttribute('readonly');
        // Apply the custom CSS
        const styleElement = document.getElementById('custom-items-style') || document.createElement('style');
        styleElement.id = 'custom-items-style';
        styleElement.textContent = customItemsCSS.value;
        if (!document.getElementById('custom-items-style')) {
            document.head.appendChild(styleElement);
        }
    } else {
        customItemsCSS.setAttribute('readonly', 'readonly');
        // Remove the custom CSS
        const styleElement = document.getElementById('custom-items-style');
        if (styleElement) {
            styleElement.remove();
        }
    }
}

/**
 * Toggles the visibility of timeline guides
 * @param {boolean} show - Whether to show or hide guides
 * 
 * How it works:
 * - Updates the display property of the guides element
 * 
 * Possible errors:
 * - Guides element not found
 */
function toggleGuides(show) {
    console.log("Toggling guides:", show);
    const guides = document.getElementById('guides');
    if (guides) {
        guides.style.display = show ? 'flex' : 'none';
        console.log("Guides visibility set to:", guides.style.display);
    } else {
        console.warn("Guides element not found");
    }
}

// ===== Data Management =====
/**
 * Sets up the timeline data
 * @param {Object} data - The timeline data to apply
 * 
 * How it works:
 * 1. Updates all data UI elements
 * 2. Rebuilds story index
 * 3. Updates timeline state
 * 4. Triggers timeline render
 * 
 * Possible errors:
 * - Invalid data object
 * - DOM element not found
 * - Invalid timeline state
 */
function dataSetup(data) {
    if(!data) return;

    
    let title = document.querySelector('#title');
    title.value = data.title || "";
    let author = document.querySelector('#author');
    author.value = data.author || "";
    let description = document.querySelector('#description');
    description.value = data.description || "";
    let start = document.querySelector('#start');
    start.value = data.start || 0;
    let granularity = document.querySelector('#granularity');
    granularity.value = data.granularity || 4;

    let main_title = document.querySelector('#main_title');
    main_title.textContent = data.title || "";
    let main_subtitle = document.querySelector('#main_subtitle');
    main_subtitle.textContent = data.author || "";

    items = data.items;
    
    // Build story index from existing items
    storyIndex = {};
    items.forEach(item => {
        if (item.story && item['story-id']) {
            storyIndex[item['story-id']] = {
                title: item.story,
                id: item['story-id']
            };
            storyIndex[item.story.toLowerCase()] = {
                title: item.story,
                id: item['story-id']
            };
        }
    });
    
    console.log("Story index built:", storyIndex);

    loadedData = data;

    // Update timeline state if it exists
    if (timelineState) {
        timelineState.focusYear = parseInt(data.start) || 0;
        timelineState.granularity = parseInt(data.granularity) || 4;
        timelineState.offsetPx = 0;
        // Force a re-render of the timeline with the new data
        renderTimeline(timelineState.focusYear, timelineState.granularity, window.innerWidth);
    }

    checkAllLoaded();
}

/**
 * Loads timeline data into UI elements
 * @param {Object} data - The timeline data to load
 * 
 * How it works:
 * - Updates title, author, and description fields
 * 
 * Possible errors:
 * - Invalid data object
 * - DOM element not found
 */
function loadData(data) {
    if(!data) return;
    
    let title = document.querySelector('#title');
    title.value = data.title || "";
    let main_subtitle = document.querySelector('#main_subtitle');
    
    main_subtitle.textContent = data.author ? `by ${data.author}` : "by Unknown Author";
    let description = document.querySelector('#description');
    description.value = data.description || "";
}

// ===== Timeline Management =====
/**
 * Initializes timeline settings
 * @param {number} focusYear - The year to focus on
 * @param {number} granularity - The timeline granularity
 * @param {number} pixelsPerSubtick - Pixels per subtick unit
 * 
 * How it works:
 * - Calls setInitialSettings with provided parameters
 * 
 * Possible errors:
 * - Invalid parameters
 * - Timeline state not initialized
 */
function callSetInitialSettings(focusYear, granularity, pixelsPerSubtick, displayRadius) {
    console.log("callSetInitialSettings", focusYear, granularity, pixelsPerSubtick, displayRadius);
    setInitialSettings({ 
        focusYear: focusYear, 
        granularity: granularity, 
        items: items, 
        pixelsPerSubtick: pixelsPerSubtick,
        displayRadius: displayRadius
    });
}

/**
 * Checks if all required data is loaded
 * 
 * How it works:
 * - Verifies settings and data are loaded
 * - Initializes timeline if ready
 * 
 * Possible errors:
 * - Missing required data
 * - Timeline initialization failure
 */
function checkAllLoaded() {
    if (loadedSettings && loadedData) {
        console.log("Both settings and data are loaded");
        isSettingsReady = true;
        isDataReady = true;
        
        // Initialize the timeline
        callSetInitialSettings(
            loadedData.start || 0,
            loadedData.granularity || 4,
            loadedSettings.pixelsPerSubtick || 20,
            loadedSettings.displayRadius || 10
        );

        // If both data and settings are ready, tell main process we're ready to display
        if (isDataReady && isSettingsReady) {
            window.api.send('renderer-ready');
        }
    }
}

/**
 * Refreshes all timeline items
 * 
 * How it works:
 * - Requests updated items from main process
 * 
 * Possible errors:
 * - IPC communication failure
 */
function refreshAllItems() {
    console.log("Requesting all items...");
    window.api.send('getAllItems');
}

// ===== Event Handlers =====
/**
 * Settings save button click handler
 * 
 * How it works:
 * 1. Collects current settings
 * 2. Updates timeline state
 * 3. Saves settings to main process
 * 4. Closes settings panel
 * 
 * Possible errors:
 * - Invalid settings values
 * - Timeline update failure
 * - IPC communication failure
 */
document.querySelector('#btn_SaveSettings')?.addEventListener('click', () => {
    console.log("save settings button clicked");
    const settings = {
        font: document.querySelector('#font-select').selectedIndex,
        fontSizeScale: document.querySelector('#font-size-scale-input').value,
        isFullscreen: isFullscreen,
        customCSS: document.querySelector('#custom-css').value,
        customMainCSS: document.querySelector('#custom-main-css').value,
        customItemsCSS: document.querySelector('#custom-items-css').value,
        useTimelineCSS: document.querySelector('#use-timeline-css').checked,
        useMainCSS: document.querySelector('#use-main-css').checked,
        useItemsCSS: document.querySelector('#use-items-css').checked,
        pixelsPerSubtick: document.querySelector('#pixels-per-subtick').value,
        showGuides: document.querySelector('#show-guides').checked,
        useCustomScaling: document.querySelector('#use-custom-scaling').checked,
        customScale: document.querySelector('#custom-scale').value,
        displayRadius: parseInt(document.querySelector('#display-radius').value)
    };

    const data = {
        title: document.querySelector('#title').value,
        author: document.querySelector('#author').value,
        description: document.querySelector('#description').value,
        start: document.querySelector('#start').value,
        granularity: document.querySelector('#granularity').value,
        items: items
    }

    // Apply settings immediately
    settingsSetup(settings);

    // Update the timeline immediately with new settings
    if (timelineState) {
        const newStartYear = parseInt(data.start);
        timelineState.focusYear = newStartYear;
        timelineState.granularity = parseInt(data.granularity);
        timelineState.pixelsPerSubtick = parseInt(settings.pixelsPerSubtick);
        timelineState.offsetPx = 0; // Reset offset when changing start year

        if(document.querySelector('#title').value !== '') {
            loadedData.title = data.title;
            document.querySelector('#main_title').textContent = loadedData.title;
        }

        if(document.querySelector('#author').value !== '') {
            loadedData.author = data.author;
            document.querySelector('#main_subtitle').textContent = "by " + loadedData.author;
        }

        if(document.querySelector('#description').value !== '') {
            loadedData.description = data.description;
        }
        
        // Update loaded data to maintain state
        loadedData = {
            ...loadedData,
            title: data.title,
            author: data.author,
            description: data.description,
            start: newStartYear,
            granularity: parseInt(data.granularity)
        };
        
        // Only update the timeline once with all changes
        callSetInitialSettings(newStartYear, parseInt(data.granularity), parseInt(settings.pixelsPerSubtick), parseInt(settings.displayRadius));
    }

    // Send settings to main process
    window.api.send('save-settings', settings, data);
    closeSettings();
});

/**
 * Guides visibility toggle handler
 * @param {Event} e - The change event
 * 
 * How it works:
 * - Updates guides visibility based on checkbox state
 * 
 * Possible errors:
 * - Invalid event
 * - Guides element not found
 */
document.querySelector('#show-guides')?.addEventListener('change', function(e) {
    console.log("Guides checkbox changed:", e.target.checked);
    toggleGuides(e.target.checked);
});

// ===== IPC Event Handlers =====
/**
 * Window resize handler
 * @param {Array} size - New window size [width, height]
 * @param {boolean} _isFullscreen - New fullscreen state
 * 
 * How it works:
 * 1. Updates fullscreen state
 * 2. Updates size display
 * 3. Re-renders timeline if needed
 * 
 * Possible errors:
 * - Invalid size values
 * - Timeline render failure
 */
window.api.receive('window-resized', (size, _isFullscreen) => {
    isFullscreen = _isFullscreen;
    if(isFullscreen) {
        document.getElementById("size_guide").textContent = `Maximized`;
    } else {
        document.getElementById("size_guide").textContent = `${size[0]} x ${size[1]}`;
    }

    if(loadedData?.start && loadedData?.granularity) {
        renderTimeline(parseInt(loadedData.start), parseInt(loadedData.granularity), size[0]);
    }
});

/**
 * Window move handler
 * @param {Array} position - New window position [x, y]
 * @param {number} scaleFactor - Display scale factor
 * 
 * How it works:
 * - Updates position and scale displays
 * 
 * Possible errors:
 * - Invalid position values
 * - DOM element not found
 */
window.api.receive('window-moved', (position, scaleFactor) => {
    document.getElementById("position_guide").textContent = `${position[0]} : ${position[1]}`;
    document.getElementById("scale_guide").textContent = `${scaleFactor.toFixed(2)}`;
});

/**
 * Settings load handler
 * @param {Object} settings - New settings to apply
 * 
 * How it works:
 * - Calls settingsSetup with new settings
 * 
 * Possible errors:
 * - Invalid settings object
 * - Settings setup failure
 */
window.api.receive('call-load-settings', async (settings) => {
    if (!settings) return;
    
    // Load settings
    console.log("Loaded settings:", settings);
    if (settings) {
        document.querySelector('#font-select').selectedIndex = settings.font;
        document.querySelector('#font-size-scale-input').value = settings.fontSizeScale;
        document.querySelector('#custom-css').value = settings.customCSS || '';
        document.querySelector('#custom-main-css').value = settings.customMainCSS || '';
        document.querySelector('#custom-items-css').value = settings.customItemsCSS || '';
        document.querySelector('#use-timeline-css').checked = settings.useTimelineCSS;
        document.querySelector('#use-main-css').checked = settings.useMainCSS;
        document.querySelector('#use-items-css').checked = settings.useItemsCSS;
        document.querySelector('#pixels-per-subtick').value = settings.pixelsPerSubtick;
        document.querySelector('#show-guides').checked = settings.showGuides;
        document.querySelector('#use-custom-scaling').checked = settings.useCustomScaling;
        document.querySelector('#custom-scale').value = settings.customScale;
        document.querySelector('#display-radius').value = settings.displayRadius || 10;
    }

    // Only update settings if they've actually changed
    if (JSON.stringify(settings) !== JSON.stringify(loadedSettings)) {
        settingsSetup(settings);
        isSettingsReady = true;
        checkAllLoaded();
    }
});

/**
 * Data load handler
 * @param {Object} data - New timeline data to apply
 * 
 * How it works:
 * - Calls dataSetup and loadData with new data
 * 
 * Possible errors:
 * - Invalid data object
 * - Data setup failure
 */
window.api.receive('call-load-data', (data) => {
    if (!data) return;
    
    // Only update data if it's actually changed
    if (JSON.stringify(data) !== JSON.stringify(loadedData)) {
        dataSetup(data);
        loadData(data);
        isDataReady = true;
        checkAllLoaded();
    }
});

/**
 * Items update handler
 * @param {Array} allItems - Updated list of timeline items
 * 
 * How it works:
 * 1. Updates items array
 * 2. Updates timeline state
 * 3. Re-renders timeline
 * 
 * Possible errors:
 * - Invalid items array
 * - Timeline render failure
 */
window.api.receive('items', (allItems) => {
    console.log("Received all items:", allItems);
    items = allItems;
    if (timelineState) {
        timelineState.items = items;
        renderTimeline();
    }
});

/**
 * New item handler
 * @param {Object} data - New timeline item data
 * 
 * How it works:
 * - Triggers items refresh
 * 
 * Possible errors:
 * - Invalid item data
 * - Refresh failure
 */
window.api.receive('add-timeline-item', (data) => {
    console.log("Received new timeline item:", data);
    refreshAllItems();
});

/**
 * Item removed handler
 * @param {Object} result - Result of item removal
 * 
 * How it works:
 * - Triggers items refresh
 * 
 * Possible errors:
 * - Invalid result
 * - Refresh failure
 */
window.api.receive('itemRemoved', (result) => {
    if (result.success) {
        refreshAllItems();
    }
});

// ===== Initialization =====
/**
 * DOM ready handler
 * 
 * How it works:
 * - Triggers initial items load
 * 
 * Possible errors:
 * - Items load failure
 */
document.addEventListener('DOMContentLoaded', () => {
    refreshAllItems();
});

/**
 * Opens the add item window
 * @param {number} year - The year to add the item at
 * @param {number} subtick - The subtick to add the item at
 * 
 * How it works:
 * - Sends IPC message to open add item window
 * 
 * Possible errors:
 * - Invalid year/subtick values
 * - IPC communication failure
 */
function openAddItemWindow(year, subtick, granularity){
    console.log('[renderer.js:677] opening add item window at year:', year, 'and subtick:', subtick, 'with granularity:', granularity);
    year = Math.floor(year);

    window.api.send('open-add-item-window', year, subtick, granularity);
}

/**
 * Handles font change
 * @param {string} font - New font family
 * 
 * How it works:
 * - Updates preview text font family
 * 
 * Possible errors:
 * - Invalid font
 * - Preview element not found
 */
function handleFontChange(font) {
    console.log("font changed to:", font);
    document.querySelector(".preview-text").style.fontFamily = font;
}

/**
 * Handles font size change
 * @param {number} size - New font size scale
 * 
 * How it works:
 * - Updates preview text font size
 * 
 * Possible errors:
 * - Invalid size
 * - Preview element not found
 */
function handleFontSizeChange(size) {
    console.log("font size changed to:", size);
    document.querySelector(".preview-text").style.fontSize = 16 * size + "px";
}

/**
 * Searches stories by query
 * @param {string} query - Search query
 * @returns {Array} Matching stories
 * 
 * How it works:
 * 1. Converts query to lowercase
 * 2. Searches story index
 * 3. Returns unique matches
 * 
 * Possible errors:
 * - Invalid query
 * - Story index corruption
 */
function searchStories(query) {
    query = query.toLowerCase();
    const results = [];
    
    // Search through the index
    Object.entries(storyIndex).forEach(([key, value]) => {
        if (key.includes(query) || value.title.toLowerCase().includes(query)) {
            // Only add if not already in results
            if (!results.some(r => r.id === value.id)) {
                results.push(value);
            }
        }
    });
    
    return results;
}

// ===== Data Export/Import =====
/**
 * Exports timeline data to a JSON file
 * 
 * How it works:
 * 1. Collects all items and story references
 * 2. Sends to main process for file save
 * 
 * Possible errors:
 * - File save failure
 * - IPC communication failure
 */
async function exportTimelineData() {
    // Collect all items and their story references
    const exportData = {
        items: items,
        storyReferences: Object.entries(storyIndex).reduce((acc, [key, value]) => {
            if (key === value.id) { // Only include the ID-based entries
                acc[value.id] = {
                    title: value.title,
                    id: value.id
                };
            }
            return acc;
        }, {})
    };
    
    try {
        await window.api.invoke('export-timeline-data', exportData);
    } catch (error) {
        alert(`Error exporting timeline data: ${error}`);
    }
}

/**
 * Imports timeline data from a JSON file
 * 
 * How it works:
 * 1. Triggers file selection
 * 2. Sends selected file to main process
 * 
 * Possible errors:
 * - File read failure
 * - Invalid JSON
 * - IPC communication failure
 */
async function importTimelineData() {
    try {
        await window.api.invoke('import-timeline-data');
    } catch (error) {
        alert(`Error importing timeline data: ${error}`);
    }
}

// Add IPC handlers for export/import
window.api.receive('export-timeline-data-success', (filePath) => {
    // Just show a success message without affecting settings
});

window.api.receive('export-timeline-data-error', (error) => {
    alert(`Error exporting timeline data: ${error}`);
});

window.api.receive('import-timeline-data-confirm', ({ itemCount, filePath, data }) => {
    if (confirm(`Importing ${itemCount} items to your timeline. Continue?`)) {
        console.log("Sending confirm-import-timeline-data with data:", data);
        window.api.send('confirm-import-timeline-data', { filePath, data });
    }
});

window.api.receive('import-timeline-data-success', (importedData) => {
    // Update story index with new references
    Object.entries(importedData.storyReferences).forEach(([id, story]) => {
        storyIndex[id] = story;
        storyIndex[story.title.toLowerCase()] = story;
    });
    
    // Refresh items to show imported data
    refreshAllItems();
    alert('Timeline data imported successfully');
});

window.api.receive('import-timeline-data-error', (error) => {
    alert(`Error importing timeline data: ${error}`);
});

window.api.receive('app-version', (version) => {
    document.getElementById('version-display').textContent = `v${version}`;
});

// Add event listeners for CSS changes
document.querySelector('#custom-css')?.addEventListener('input', function() {
    if (document.querySelector('#use-timeline-css').checked) {
        const styleElement = document.getElementById('custom-timeline-style');
        if (styleElement) {
            styleElement.textContent = this.value;
        }
    }
});

document.querySelector('#custom-main-css')?.addEventListener('input', function() {
    if (document.querySelector('#use-main-css').checked) {
        const styleElement = document.getElementById('custom-main-style');
        if (styleElement) {
            styleElement.textContent = this.value;
        }
    }
});

document.querySelector('#custom-items-css')?.addEventListener('input', function() {
    if (document.querySelector('#use-items-css').checked) {
        const styleElement = document.getElementById('custom-items-style');
        if (styleElement) {
            styleElement.textContent = this.value;
        }
    }
});

// Function to reset a CSS textarea to its template content
async function resetToTemplate(textareaId) {
    const textarea = document.getElementById(textareaId);
    if (!textarea) return;

    let templateFile;
    switch (textareaId) {
        case 'custom-css':
            templateFile = 'customCSSTemplate.txt';
            break;
        case 'custom-main-css':
            templateFile = 'customMainCSSTemplate.txt';
            break;
        case 'custom-items-css':
            templateFile = 'customItemsCSSTemplate.txt';
            break;
        default:
            return;
    }

    try {
        const templateContent = await window.api.readFile(templateFile);
        textarea.value = templateContent;
        
        // If the CSS is enabled, update the style element
        const checkbox = document.getElementById(`use-${textareaId.replace('custom-', '')}`);
        if (checkbox && checkbox.checked) {
            const styleId = `${textareaId.replace('custom-', 'custom-')}-style`;
            let styleElement = document.getElementById(styleId);
            if (styleElement) {
                styleElement.textContent = templateContent;
            }
        }
    } catch (error) {
        console.error('Error loading template:', error);
    }
}

/**
 * Toggles custom window scaling
 * @param {boolean} enabled - Whether custom scaling is enabled
 */
function toggleCustomScaling(enabled) {
    const customScale = document.querySelector('#custom-scale');
    if (enabled) {
        window.api.send('set-window-scale', parseFloat(customScale.value));
    } else {
        window.api.send('set-window-scale', 1.0);
    }
}

/**
 * Updates the custom scale factor
 * @param {number} value - The new scale factor
 */
function updateCustomScale(value) {
    const useCustomScaling = document.querySelector('#use-custom-scaling');
    if (useCustomScaling.checked) {
        window.api.send('set-window-scale', parseFloat(value));
    }
}

// Handle timeline data
window.api.receive('timeline-data', (data) => {
    
    // Update timeline state
    if (timelineState) {
        timelineState.focusYear = data.start_year;
        timelineState.granularity = data.granularity;
        timelineState.offsetPx = 0; // Reset offset when data changes
    }
    
    // Update UI elements with timeline data
    const title = document.querySelector('#title');
    if (title) title.value = data.title || "";
    
    const author = document.querySelector('#author');
    if (author) author.value = data.author || "";
    
    const description = document.querySelector('#description');
    if (description) description.value = data.description || "";
    
    const start = document.querySelector('#start');
    if (start) start.value = data.start_year || 0;
    
    const granularity = document.querySelector('#granularity');
    if (granularity) granularity.value = data.granularity || 4;
    
    // Update main title and subtitle
    const mainTitle = document.querySelector('#main_title');
    if (mainTitle) {
        mainTitle.textContent = data.title || "";
        mainTitle.style.display = data.title ? 'block' : 'none';
    }
    
    const mainSubtitle = document.querySelector('#main_subtitle');
    if (mainSubtitle) {
        mainSubtitle.textContent = data.author ? `by ${data.author}` : "";
        mainSubtitle.style.display = data.author ? 'block' : 'none';
    }
    
    // Update loaded data
    loadedData = {
        ...loadedData,
        title: data.title,
        author: data.author,
        description: data.description,
        start: data.start_year,
        granularity: data.granularity
    };

    // Force a re-render of the timeline with the new data
    if (timelineState) {
        renderTimeline(timelineState.focusYear, timelineState.granularity, window.innerWidth);
    }
});

// Handle items data
window.api.receive('items', (newItems) => {
    console.log('Received items:', newItems);
    timelineState.items = newItems;
    renderTimeline();
});

// Add handler for data-ready message
window.api.receive('data-ready', () => {
    isDataReady = true;
    checkAllLoaded();
});

// Add handler for jumpToYear message
window.api.receive('jumpToYear', (item) => {
    let year = item.year;
    let subtick = item.subtick;
    if (typeof year === 'number') {
        window.jumpToDate(year, subtick);
    }
});


// Event listeners
document.addEventListener('keydown', (e) => {
    // Toggle terminal with Ctrl + 0
    if (e.ctrlKey && e.key === '0') {
        e.preventDefault();
        // TODO: Implement terminal
    }
});


function openEditItemWithRangeWindow(item) {
    window.api.send('open-edit-item-with-range-window', item);
}

function openEditItemWindow(item) {
    window.api.send('open-edit-item-window', item);
}
