/**
 * Archive Window Module
 * 
 * This module handles the creation and management of the Archive window.
 * It provides functionality for viewing and managing archived timeline items,
 * story references, and media files.
 * 
 * Key Features:
 * - Tabbed interface for different content types
 * - Display archived items, stories, and media
 * - Filter items by type
 * - Search functionality for each tab
 * - Item restoration
 * 
 * Main Functions:
 * - initializeArchive(): Sets up the archive window and loads content
 * - setupTabs(): Handles tab switching
 * - filterItems(): Filters items based on selected type
 * - searchContent(): Searches content based on search query
 * - restoreItem(): Restores an archived item to the timeline
 */

let timeline_id;
let items = [];
let stories = [];
let media = [];
let filteredItems = [];
let filteredStories = [];
let filteredMedia = [];
let currentFilter = 'all';
let currentTab = 'items';
let searchQueries = {
    items: '',
    stories: '',
    media: ''
};

let item_types = {
    1: 'Event',
    2: 'Period',
    3: 'Age',
    4: 'Picture',
    5: 'Note',
    6: 'Bookmark',
    7: 'Character',
    8: 'Timeline_start',
    9: 'Timeline_end'
};

// Get the current timeline ID when window loads
window.addEventListener('DOMContentLoaded', async function() {
    timeline_id = await window.api.getCurrentTimelineId();
    console.log('[archive.js] Got timeline ID on load:', timeline_id);
    
    initializeArchive();
    setupEventListeners();
    setupTabs();
});

/**
 * Initializes the archive window
 */
function initializeArchive() {
    // Get all items from the main window
    window.api.send('getAllItems');
    // Get all stories
    window.api.send('getAllStories');
    // Get all media files
    window.api.send('getAllMedia');
}

/**
 * Sets up event listeners for the archive window
 */
function setupEventListeners() {
    // Close button
    document.getElementById('archive-close').addEventListener('click', () => {
        window.close();
    });

    // Filter buttons (only for items tab)
    document.querySelectorAll('.archive-filter').forEach(button => {
        button.addEventListener('click', () => {
            // Update active filter
            document.querySelectorAll('.archive-filter').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Filter items
            currentFilter = button.dataset.type;
            filterItems();
        });
    });

    // Search inputs for each tab
    document.getElementById('items-search').addEventListener('input', (e) => {
        searchQueries.items = e.target.value.toLowerCase();
        filterItems();
    });

    document.getElementById('stories-search').addEventListener('input', (e) => {
        searchQueries.stories = e.target.value.toLowerCase();
        filterStories();
    });

    document.getElementById('media-search').addEventListener('input', (e) => {
        searchQueries.media = e.target.value.toLowerCase();
        filterMedia();
    });
}

/**
 * Sets up tab switching functionality
 */
function setupTabs() {
    document.querySelectorAll('.archive-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            // Update active tab
            document.querySelectorAll('.archive-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Update active content
            currentTab = tab.dataset.tab;
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            document.getElementById(`${currentTab}-tab`).classList.add('active');
        });
    });
}

/**
 * Filters items based on current filter and search query
 */
function filterItems() {
    filteredItems = items.filter(item => {
        // Apply type filter
        if (currentFilter !== 'all' && item.type !== currentFilter) {
            return false;
        }

        // Apply search filter
        if (searchQueries.items) {
            const searchableText = [
                item.title,
                item.description,
                item.content,
                ...(item.tags || [])
            ].join(' ').toLowerCase();
            
            return searchableText.includes(searchQueries.items);
        }

        return true;
    });

    displayItems();
}

/**
 * Filters stories based on search query
 */
function filterStories() {
    filteredStories = stories.filter(story => {
        if (searchQueries.stories) {
            const searchableText = [
                story.title,
                story.description
            ].join(' ').toLowerCase();
            
            return searchableText.includes(searchQueries.stories);
        }
        return true;
    });

    displayStories();
}

/**
 * Filters media files based on search query
 */
function filterMedia() {
    console.log("Filtering media", media);
    filteredMedia = media.filter(file => {
        if (searchQueries.media) {
            const searchableText = [
                file.name,
                file.type,
                file.description || ''
            ].join(' ').toLowerCase();
            
            return searchableText.includes(searchQueries.media);
        }
        return true;
    });

    displayMedia();
}

/**
 * Displays filtered items in the items tab
 */
function displayItems() {
    const content = document.getElementById('items-content');
    content.innerHTML = '';

    if (filteredItems.length === 0) {
        content.innerHTML = '<div class="no-items">No items found</div>';
        return;
    }

    filteredItems.forEach(item => {
        const itemElement = document.createElement('div');

        const imageCount = media.filter(file => file.item_id === item.id && file.type === 'image').length;
        const itemType = item_types[item.item_type] || 'unknown';

        let item_date = `<div class="archive-item-date">${item.year} .${item.subtick}</div>`;
        let item_end_date = '';

        if(item.type_id == 2 || item.type_id == 3) {
            item_end_date = `<div class="archive-item-date">${item.end_year} .${item.end_subtick}</div>`;
        }

        itemElement.className = 'archive-item';
        itemElement.innerHTML = `
        <div class="item-info">
            <div class="archive-item-title">${item.title}</div>
            <div class="item-date-container">
                ${item_date}  ${(item_end_date ? '<span class="item-date-separator">—</span>' + item_end_date : '')} 
            </div>
        </div>
            ${item.description ? `<div class="archive-item-description">${item.description}</div>` : ''}
            ${item.tags && item.tags.length > 0 ? `
                <div class="archive-item-tags">
                    ${item.tags.map(tag => `<span class="archive-item-tag">${tag}</span>`).join('')}
                </div>
            ` : ''}
        `;

        // Add click handler to restore item
        itemElement.addEventListener('click', () => restoreItem(item));

        itemElement.id = item.id;

        content.appendChild(itemElement);
    });
}

/**
 * Displays filtered stories in the stories tab
 */
function displayStories() {
    const content = document.getElementById('stories-content');
    content.innerHTML = '';

    if (filteredStories.length === 0) {
        content.innerHTML = '<div class="no-items">No stories found</div>';
        return;
    }

    filteredStories.forEach(story => {
        const storyElement = document.createElement('div');
        storyElement.className = 'archive-item';
        storyElement.innerHTML = `
            <div class="archive-item-title">${story.title}</div>
            ${story.description ? `<div class="archive-item-description">${story.description}</div>` : ''}
        `;

        content.appendChild(storyElement);
    });
}

/**
 * Displays filtered media files in the media tab
 */
function displayMedia() {
    const content = document.getElementById('media-content');
    content.innerHTML = '';

    if (filteredMedia.length === 0) {
        content.innerHTML = '<div class="no-items">No media files found</div>';
        return;
    }

    filteredMedia.forEach(file => {
        const fileElement = document.createElement('div');
        fileElement.className = 'archive-item media-item';
        let item_name = items.find(item => item.id === file.item_id)?.title || " - ";
        fileElement.innerHTML = `
            <div class="media-item-info">
                <div class="archive-item-title">${file.title}</div>
                <div class="archive-item-date">Item ID: ${file.item_id ? "<a onclick='jumptoitem(\"" + file.item_id + "\")' href='#" + file.item_id + "'>" + item_name + "</a>"  + "<span style='font-size: 12px; margin-left: 10px; color: #888;'>(" + file.item_id + ")</span>" : " - "}</div>
            </div>
            <div class="media-item-description">${file.description || 'No description'}</div>
            <div class="preview-image">
                <img width="100" height="100" src="${file.file_path}" alt="${file.file_name}">
            </div>
        `;

        content.appendChild(fileElement);
    });
}

function jumptoitem(item_id) {
    // switch to items tab
    currentTab = 'items';
    document.querySelectorAll('.archive-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('items-tab').classList.add('active');

    // Make sure that items from previous tabs are hidden
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById('items-tab').classList.add('active');

    // scroll to item
    window.setTimeout(() => {
        document.getElementById(item_id).scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center', offsetTop: 100 });
    }, 100);

    // highlight the item briefly with a border
    highlightItem(item_id);
}

function highlightItem(item_id) {
    const el = document.getElementById(item_id);
    if (el) {
        el.classList.add('highlighted-item');
        setTimeout(() => {
            el.classList.remove('highlighted-item');
        }, 1000);
    }
}

/**
 * Restores an archived item to the timeline
 * @param {Object} item - The item to restore
 */
function restoreItem(item) {
    // TODO: Implement item restoration
    console.log('Restoring item:', item);
}

// Listen for items from main process
window.api.receive('items', (receivedItems) => {
    items = receivedItems;
    filterItems();
});

// Listen for stories from main process
window.api.receive('stories', (receivedStories) => {
    stories = receivedStories;
    filterStories();
});

// Listen for media files from main process
window.api.receive('media', (receivedMedia) => {
    media = receivedMedia;
    filterMedia();
});

function openArchiveModal(type, data) {
    const modal = document.getElementById('archive-modal');
    const content = document.getElementById('modal-content');
    content.innerHTML = '';
    let form;
    if (type === 'item') {
        form = renderItemForm(data);
    } else if (type === 'story') {
        form = renderStoryForm(data);
    } else if (type === 'picture') {
        form = renderPictureForm(data);
    }
    content.appendChild(form);
    modal.classList.remove('hidden');
}

document.getElementById('modal-close').onclick = () => {
    document.getElementById('archive-modal').classList.add('hidden');
};

function renderItemForm(item) {
    const form = document.createElement('form');
    for (const key in item) {
        const label = document.createElement('label');
        label.textContent = key;
        const input = document.createElement('input');
        input.type = 'text';
        input.name = key;
        input.value = item[key];
        form.appendChild(label);
        form.appendChild(input);
        form.appendChild(document.createElement('br'));
    }
    return form;
}

function renderStoryForm(story) {
    const form = document.createElement('form');
    for (const key in story) {
        const label = document.createElement('label');
        label.textContent = key;
        const input = document.createElement('input');
        input.type = 'text';
        input.name = key;
        input.value = story[key];
        form.appendChild(label);
        form.appendChild(input);
        form.appendChild(document.createElement('br'));
    }
    return form;
}

function renderPictureForm(picture) {
    const form = document.createElement('form');
    for (const key in picture) {
        const label = document.createElement('label');
        label.textContent = key;
        const input = document.createElement('input');
        input.type = 'text';
        input.name = key;
        input.value = picture[key];
        form.appendChild(label);
        form.appendChild(input);
        form.appendChild(document.createElement('br'));
    }
    return form;
} 