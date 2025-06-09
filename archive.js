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
let tags = [];
let filteredItems = [];
let filteredStories = [];
let filteredMedia = [];
let filteredTags = [];
let currentFilter = 'all';
let currentTab = 'items';
let searchQueries = {
    items: '',
    stories: '',
    media: '',
    tags: ''
};
let storyReferences = [];

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

let item_type_reverse = {
    'event':          '1', 
    'period':         '2', 
    'age':            '3', 
    'picture':        '4', 
    'note':           '5', 
    'bookmark':       '6', 
    'character':      '7', 
    'timeline_start': '8', 
    'timeline_end':   '9'
}; 

let item_type_icons = {
    1: 'ri-calendar-event-fill',
    2: 'ri-calendar-2-fill',
    3: 'ri-hourglass-fill',
    4: 'ri-image-fill',
    5: 'ri-sticky-note-fill',
    6: 'ri-bookmark-fill',
    7: 'ri-user-line',
    8: 'ri-quill-pen-ai-fill',
    9: 'ri-book-fill'
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
    // Get all story references
    window.api.send('getAllStoryReferences');
    // Get all media files
    window.api.send('getAllMedia');
    // Get all tags
    window.api.send('getAllTags');
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

    document.getElementById('tags-search').addEventListener('input', (e) => {
        searchQueries.tags = e.target.value.toLowerCase();
        filterTags();
    });
}

/**
 * Sets up tab switching functionality
 */
function setupTabs() {
    document.querySelectorAll('.archive-tab:not(.separator)').forEach(tab => {
        tab.addEventListener('click', () => {
            // Update active tab
            document.querySelectorAll('.archive-tab:not(.separator)').forEach(t => t.classList.remove('active'));
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
    let filter_id = item_type_reverse[currentFilter.toLowerCase()];

    let pre_filtered_items = items.filter(item => currentFilter == 'all' || item.type_id == filter_id);

    filteredItems = pre_filtered_items.filter(item => {
        
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

function filterTags() {
    filteredTags = tags.filter(tag => {
        return tag.name.toLowerCase().includes(searchQueries.tags);
    });

    displayTags();
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
            <div class="archive-item-buttons">
                <button class="archive-item-button edit" title="Edit item">
                    <i class="ri-quill-pen-line"></i>
                </button>
                <button class="archive-item-button delete" title="Delete item">
                    <i class="ri-delete-bin-line"></i>
                </button>
            </div>
            <div class="item-info">
                 <div class="archive-item-title-container"><div class="archive-item-title">${item.title}</div> <div class="archive-item-type" title="${item_types[item.type_id]}"><i class="${item_type_icons[item.type_id]}"></i></div></div>
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
        itemElement.addEventListener('click', (e) => {
            // Only trigger restore if the click wasn't on a button
            if (!e.target.closest('.archive-item-button')) {
                restoreItem(item);
            }
        });

        // Add click handlers for edit and delete buttons
        const editButton = itemElement.querySelector('.edit');
        const deleteButton = itemElement.querySelector('.delete');

        editButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent item click event
            window.api.send('open-edit-item-with-range-window', item);
        });

        deleteButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent item click event
            if (confirm('Are you sure you want to delete this item?')) {
                window.api.send('removeItem', item.id);
                // Listen for the deletion confirmation
                window.api.receive('itemRemoved', (response) => {
                    initializeArchive();
                });
                
                // make call to re-render the timeline not the items
                window.api.send('refresh-timeline');

            }
        });

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
        let story_id = story.id;

        let items_referenced = storyReferences.filter(ref => ref.story_id == story_id);

        let items_referenced_list = items_referenced.map(ref => {
            const item = items.find(i => i.id === ref.item_id);
            return item ? `
                <div class="referenced-item">
                    <div class="referenced-item-title"><a onclick='jumptoitem("${item.id}")' href='#${item.id}'>${item.title}</a> <span style='font-size: 12px; margin-left: 10px; color: #888;'>("${item.id}")</span></div>
                    <div class="referenced-item-date">${item.year}.${item.subtick}</div>
                </div>
            ` : '';
        }).join('');

        const storyElement = document.createElement('div');
        storyElement.className = 'archive-item archive-story';
        storyElement.innerHTML = `
            <div class="archive-story-buttons">
                <button class="archive-story-button delete" title="Delete story">
                    <i class="ri-delete-bin-line"></i>
                </button>
            </div>
            <div class="story-header">
                <div class="story-title-container">
                    <div class="archive-item-title">${story.title}</div>
                    ${items_referenced.length > 0 ? `
                        <button ${items_referenced_list !== '' ? '' : 'disabled'} class="story-toggle-button" title="Show referenced items">
                            <i class="ri-arrow-right-s-line"></i>
                        </button>
                    ` : ''}
                </div>
                ${story.description ? `<div class="archive-item-description">${story.description}</div>` : ''}
            </div>
            ${items_referenced.length > 0 ? `
                <div class="story-referenced-items" style="display: none;">
                    <div class="referenced-items-header">Referenced in:</div>
                    <div class="referenced-items-list">
                        ${items_referenced_list}
                    </div>
                </div>
            ` : ''}
        `;

        // Add click handler for the toggle button
        const toggleButton = storyElement.querySelector('.story-toggle-button');
        if (toggleButton) {
            toggleButton.addEventListener('click', (e) => {
                if(toggleButton.disabled) {
                    return;
                }
                e.stopPropagation();
                const itemsContainer = storyElement.querySelector('.story-referenced-items');
                const icon = toggleButton.querySelector('i');
                
                if (itemsContainer.style.display === 'none') {
                    itemsContainer.style.display = 'block';
                    icon.className = 'ri-arrow-down-s-line';
                    toggleButton.title = 'Hide referenced items';
                } else {
                    itemsContainer.style.display = 'none';
                    icon.className = 'ri-arrow-right-s-line';
                    toggleButton.title = 'Show referenced items';
                }
            });
        }

        // Add click handler for the delete button
        const deleteButton = storyElement.querySelector('.delete');
        deleteButton.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Are you sure you want to delete this story?')) {
                console.log('deleting story', story.id);
                window.api.invoke('removeStory', story.id);
                initializeArchive();
            }
        });

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
        let linked_item_ids = file.linked_items.split(',');
        let dropdown_elements = [];

        // Add a dropdown list of items that use this media file. Not a count, but a list of items.
        linked_item_ids.forEach(item_id => {
            let item = items.find(i => i.id == item_id);
            console.log(item);
            if (item) {
                dropdown_elements.push(`
                    <div class="media-item-usage-item">
                        <a class="media-item-usage-item-title" onclick='jumptoitem("${item.id}")' href='#${item.id}'>${item.title}</a> <span style='font-size: 12px; margin-left: 10px; color: #888;'>("${item.id}")</span>
                        <div class="media-item-usage-item-date">${item.year}.${item.subtick} ${( (item.end_year != item.year || item.end_subtick != item.subtick) ? `- ${item.end_year}.${item.end_subtick}` : '' )}</div>
                    </div>
                `);
            }
        });
        

        fileElement.innerHTML = `
            <div class="media-item-container">
                <div class="media-header">
                    <div class="media-title-container">
                        <div class="archive-item-title">${file.title}</div>
                        ${dropdown_elements.length > 0 ? `
                            <button class="media-toggle-button" title="Show items using this media">
                                <i class="ri-arrow-right-s-line"></i>
                            </button>
                        ` : ''}
                    </div>
                    <div class="archive-item-date">Item ID: ${file.item_id ? "<a onclick='jumptoitem(\"" + file.item_id + "\")' href='#" + file.item_id + "'>" + item_name + "</a>"  + "<span style='font-size: 12px; margin-left: 10px; color: #888;'>(" + file.item_id + ")</span>" : " - "}</div>
                </div>
                <div class="media-item-description">Used in ${file.usage_count} items</div>
                <div class="media-item-buttons" style="z-index: 1000;">
                    <button class="media-item-button delete" title="Delete item">
                        <i class="ri-delete-bin-line"></i>
                    </button>
                </div>
                <div class="preview-image">
                    <img width="100" height="100" src="${file.file_path}" alt="${file.file_name}">
                </div>
            </div>
            <div class="media-item-usage-dropdown-container">
                ${dropdown_elements.length > 0 ? `
                    <div class="media-item-usage-dropdown" style="display: none;">
                        <div class="media-usage-header">Used in:</div>
                        <div class="media-usage-list">
                            ${dropdown_elements.join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;

        // Add click handler for the toggle button
        const toggleButton = fileElement.querySelector('.media-toggle-button');
        if (toggleButton) {
            toggleButton.addEventListener('click', (e) => {
                e.stopPropagation();
                const itemsContainer = fileElement.querySelector('.media-item-usage-dropdown');
                const icon = toggleButton.querySelector('i');
                
                if (itemsContainer.style.display === 'none') {
                    itemsContainer.style.display = 'block';
                    icon.className = 'ri-arrow-down-s-line';
                    toggleButton.title = 'Hide items using this media';
                } else {
                    itemsContainer.style.display = 'none';
                    icon.className = 'ri-arrow-right-s-line';
                    toggleButton.title = 'Show items using this media';
                }
            });
        }

        // Add click handler for the delete button
        const deleteButton = fileElement.querySelector('.delete');
        deleteButton.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Are you sure you want to delete this media file?')) {
                deleteMedia(file.id);
                // Listen for the deletion confirmation
                window.api.receive('mediaRemoved', (response) => {
                    initializeArchive();
                });
                
                // make call to re-render the timeline not the items
                window.api.send('refresh-timeline');

                initializeArchive();
            }
        });

        content.appendChild(fileElement);
    });
}

function displayTags() {
    const content = document.getElementById('tags-content');
    content.innerHTML = '';

    console.log(filteredTags);

    filteredTags.forEach(tag => {
        const tagElement = document.createElement('div');
        tagElement.className = 'archive-item archive-tag';

        let item_ids = tag.item_ids.split(',');
        let dropdown_elements = [];
        item_ids.forEach(id => {
            let item = items.find(i => i.id == id);
            if (item) {
                dropdown_elements.push(`
                    <div class="tag-item-usage-item">
                        <a class="tag-item-usage-item-title" onclick='jumptoitem("${item.id}")' href='#${item.id}'>${item.title}</a> <span style='font-size: 12px; margin-left: 10px; color: #888;'>("${item.id}")</span>
                        <div class="tag-item-usage-item-date">${item.year}.${item.subtick} ${( (item.end_year != item.year || item.end_subtick != item.subtick) ? `- ${item.end_year}.${item.end_subtick}` : '' )}</div>
                    </div>
                `);
            }
        });
        let item_ids_list = dropdown_elements.join('');

        tagElement.innerHTML = `<div class="archive-item-title">${tag.name} (${tag.item_count})
        <button class="tag-toggle-button" title="Show items using this tag">
            <i class="ri-arrow-right-s-line"></i>
        </button>
        
        <div class="archive-tag-buttons"><button class="archive-tag-button" id="delete-tag-${tag.id}" onclick='deleteTag("${tag.id}")'><i class="ri-delete-bin-line"></i></button></div></div> 
        <div class="tag-item-usage-dropdown-container">
            ${item_ids_list.length > 0 ? `
                <div class="tag-item-usage-dropdown" style="display: none;">
                    <div class="tag-item-usage-header">Used in:</div>
                    <div class="media-usage-list">
                        ${dropdown_elements.join('')}
                    </div>
                </div>
            ` : ''}
        </div>`;

        // Add click handler for the toggle button
        const toggleButton = tagElement.querySelector('.tag-toggle-button');
        if (toggleButton) {
            toggleButton.addEventListener('click', (e) => {
                e.stopPropagation();
                const itemsContainer = tagElement.querySelector('.tag-item-usage-dropdown');
                const icon = toggleButton.querySelector('i');

                if (itemsContainer.style.display === 'none') {
                    itemsContainer.style.display = 'block';
                    icon.className = 'ri-arrow-down-s-line';
                    toggleButton.title = 'Hide items using this tag';
                } else {
                    itemsContainer.style.display = 'none';
                    icon.className = 'ri-arrow-right-s-line';
                    toggleButton.title = 'Show items using this tag';
                }
            });
        }

        content.appendChild(tagElement);
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

function deleteTag(tag_id) {

    if (confirm('Are you sure you want to delete this tag?')) {
        window.api.invoke('removeTag', tag_id);
        initializeArchive();
        filterTags();
    }

}

function deleteMedia(media_id) {
    if (confirm('Are you sure you want to delete this media file?')) {
        window.api.invoke('removeMedia', media_id);
        // Listen for the deletion confirmation
        window.api.receive('mediaRemoved', (response) => {
            initializeArchive();
        });
        
        // make call to re-render the timeline not the items
        window.api.send('refresh-timeline');
    }
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
    // when clicking an item, close the window and jump to the item start year
    window.api.send('jumpToYear', item);
    window.close();
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

// Listen for story references from main process
window.api.receive('storyReferences', (receivedStoryReferences) => {
    storyReferences = receivedStoryReferences;
    filterStories();
});

// Listen for media files from main process
window.api.receive('media', (receivedMedia) => {
    media = receivedMedia;
    filterMedia();
});

// Listen for tags from main process
window.api.receive('tags', (receivedTags) => {
    tags = receivedTags;
    filterTags();
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