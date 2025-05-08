let items = [];
let isFullscreen = false;
let loaded_data = {};
let storyIndex = {}; // Object to store story titles and IDs for quick lookup

function openSettings() {
    document.querySelector('.settings_container').style.display = 'block';

}

function closeSettings() {
    document.querySelector('.settings_container').style.display = 'none';
}

function settingsSetup(settings) {
    if(!settings){ return; }
    let fontSelect = document.querySelector('#font-select');
    fontSelect.selectedIndex = settings.font;
    let fontSizeScale = document.querySelector('#font-size-scale-input');
    fontSizeScale.value = settings.fontSizeScale;
    
    let pixelsPerSubtick = document.querySelector('#pixels-per-subtick');
    pixelsPerSubtick.value = settings.pixelsPerSubtick;

    let customCSS = document.querySelector('#custom-css');
    let useCustomCSS = document.querySelector('#use-custom-css');
    useCustomCSS.checked = settings.useCustomCSS;
    toggleCustomCSS(settings.useCustomCSS);

    customCSS.value = settings.customCSS;

    document.body.style.setProperty('--default-font', fontSelect.value);
    document.body.style.setProperty('--default-font-scale', settings.fontSizeScale);

}

function dataSetup(data) {
    if(!data){ return; }
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
            // Store both by story ID and title for flexible lookup
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

    loaded_data = data;
}

function loadData(data){
    if(!data){ return; }
    let title = document.querySelector('#title');
    title.value = data.title || "";
    let main_subtitle = document.querySelector('#main_subtitle');
    main_subtitle.textContent = "by " + data.author || "";
    let description = document.querySelector('#description');
    description.value = data.description || "";
}

document.querySelector('#btn_SaveSettings')?.addEventListener('click', () => {
    console.log("save settings button clicked");
    const settings = {
        font: document.querySelector('#font-select').selectedIndex,
        fontSizeScale: document.querySelector('#font-size-scale-input').value,
        isFullscreen: isFullscreen,
        customCSS: document.querySelector('#custom-css').value,
        useCustomCSS: document.querySelector('#use-custom-css').checked,
        pixelsPerSubtick: document.querySelector('#pixels-per-subtick').value
    };

    const data = {
        title: document.querySelector('#title').value,
        author: document.querySelector('#author').value,
        description: document.querySelector('#description').value,
        start: document.querySelector('#start').value,
        granularity: document.querySelector('#granularity').value,
        items: items
    }
    window.api.send('save-settings', settings, data);
    closeSettings();
    
    window.api.send('load-settings', settings);
});

window.api.receive('window-resized', (size, _isFullscreen) => {
    isFullscreen = _isFullscreen;
    if(isFullscreen){
        document.getElementById("size_guide").textContent = `Maximized`;
    } else {
        document.getElementById("size_guide").textContent = `${size[0]} x ${size[1]}`;
    }

    if(loaded_data.start && loaded_data.granularity){
        renderTimeline(parseInt(loaded_data.start), parseInt(loaded_data.granularity), size[0]);
    }
});

window.api.receive('window-moved', (position, scaleFactor) => {
    document.getElementById("position_guide").textContent = `${position[0]} : ${position[1]}`;
    document.getElementById("scale_guide").textContent = `${scaleFactor.toFixed(2)}`;
});

window.api.receive('call-load-settings', (settings) => {
    settingsSetup(settings);
});

window.api.receive('call-load-data', (data) => {
    dataSetup(data);
    loadData(data);
});

function openAddItemWindow(year, subtick){
    year = Math.floor(year);

    window.api.send('open-add-item-window', year, subtick);
}

window.api.receive('items', (allItems) => {
    console.log("Received all items:", allItems);
    items = allItems; // Update the local items array
    // If you need to update the UI or timeline, do it here
    if (timelineState) {
        timelineState.items = items;
        renderTimeline();
    }
});

window.api.receive('add-timeline-item', (data) => {
    console.log("Received new timeline item:", data);
    // Request updated items list
    refreshAllItems();
});

function handleFontChange(font) {
    console.log("font changed to:", font);
    document.querySelector(".preview-text").style.fontFamily = font;
}

function handleFontSizeChange(size) {
    console.log("font size changed to:", size);
    document.querySelector(".preview-text").style.fontSize = 16 * size + "px";
}

function callSetInitialSettings(){
    setInitialSettings({ focusYear: 0, granularity: 4, items: [], pixelsPerSubtick: 20 });
}

function toggleCustomCSS(use = false){
    const customCSS = document.querySelector('#custom-css');
    if(use){
        customCSS.removeAttribute('readonly');
    } else {
        customCSS.setAttribute('readonly', 'readonly');
    }
}

// Listen for new timeline items
window.api.receive('addTimelineItem', (data) => {
    console.log("Received new timeline item:", data);
    // Add the new item to the timeline
    if (data && data.year && data.subtick) {
        const newItem = {
            ...data,
            date: parseFloat(data.year) + (parseFloat(data.subtick) / timelineState.granularity)
        };
        timelineState.items.push(newItem);
        renderTimeline();
    }
});

// Helper function to search stories
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

// Add a function to explicitly request all items
function refreshAllItems() {
    console.log("Requesting all items...");
    window.api.send('getAllItems');
}

// Call this when the page loads
document.addEventListener('DOMContentLoaded', () => {
    refreshAllItems();
});
