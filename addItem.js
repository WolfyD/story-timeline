/**
 * Add Item Window Module
 * 
 * This module handles the creation and management of the Add Item window.
 * It provides a form interface for adding new timeline items and communicates
 * with the main process to save the new items.
 * 
 * Key Features:
 * - Form for entering timeline item details (title, description)
 * - Year and subtick display
 * - Form validation
 * - Communication with main process
 * - Window management
 * 
 * Main Functions:
 * - initializeForm(): Sets up the form and its event listeners
 * - validateForm(): Validates form input before submission
 * - handleSubmit(): Handles form submission and item creation
 * - closeWindow(): Closes the add item window
 * 
 * Form Fields:
 * - Title: Required, cannot be empty
 * - Description: Optional, can be empty
 * 
 * IPC Communication:
 * - Sends 'addTimelineItem' message to main process with new item data
 * - Listens for 'item-added' confirmation from main process
 */

const tags = new Set();
const images = [];
let storySuggestions = [];
let tagSuggestions = []; // Add tag suggestions array
let type; // Declare type in global scope
let timeline_id; // Add timeline_id to global scope

// Get the current timeline ID when window loads
window.addEventListener('DOMContentLoaded', async function() {
    timeline_id = await window.api.getCurrentTimelineId();
    console.log('[addItem.js] Got timeline ID on load:', timeline_id);
});

// Get story suggestions from main window
window.api.send('getStorySuggestions');
// Get tag suggestions from main window
window.api.send('getTagSuggestions');

// Handle story suggestions response
window.api.receive('storySuggestions', (suggestions) => {
    storySuggestions = suggestions;
});

// Handle tag suggestions response
window.api.receive('tagSuggestions', (suggestions) => {
    tagSuggestions = suggestions;
});

// Handle story input for autocomplete
document.getElementById('story')?.addEventListener('input', function(e) {
    const query = e.target.value.toLowerCase();
    const suggestions = storySuggestions.filter(s => 
        s.title.toLowerCase().includes(query)
    );
    
    const dropdown = document.getElementById('storySuggestions');
    dropdown.innerHTML = '';
    
    if (suggestions.length > 0 && query.length > 0) {
        suggestions.forEach(suggestion => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            div.textContent = suggestion.title;
            div.onclick = () => {
                document.getElementById('story').value = suggestion.title;
                document.getElementById('storyId').value = suggestion.id;
                dropdown.style.display = 'none';
            };
            dropdown.appendChild(div);
        });
        dropdown.style.display = 'block';
    } else {
        dropdown.style.display = 'none';
    }
});

// Close suggestions when clicking outside
document.addEventListener('click', function(e) {
    if (!e.target.closest('.autocomplete-container')) {
        const dropdown = document.getElementById('storySuggestions');
        if (dropdown) {
            dropdown.style.display = 'none';
        }
    }
});

// Handle tag input
document.getElementById('tagInput').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        const tag = this.value.trim();
        if (tag && !tags.has(tag)) {
            tags.add(tag);
            // Add the new tag to suggestions if it's not already there
            if (!tagSuggestions.includes(tag)) {
                tagSuggestions.push(tag);
            }
            updateTagDisplay();
        }
        this.value = '';
        // Hide suggestions when Enter is pressed
        const dropdown = document.getElementById('tagSuggestions');
        if (dropdown) {
            dropdown.style.display = 'none';
        }
    }
});

// Add input event listener for tag suggestions
document.getElementById('tagInput').addEventListener('input', function() {
    const value = this.value.toLowerCase();
    const matches = tagSuggestions.filter(tag => 
        tag.toLowerCase().includes(value) && !tags.has(tag)
    );

    // Get or create the suggestions container
    let suggestionsContainer = document.getElementById('tagSuggestionsContainer');
    if (!suggestionsContainer) {
        suggestionsContainer = document.createElement('div');
        suggestionsContainer.id = 'tagSuggestionsContainer';
        suggestionsContainer.className = 'suggestions-container';
        // Insert after the tag input
        this.parentElement.appendChild(suggestionsContainer);
    }

    // Get or create the dropdown
    let dropdown = document.getElementById('tagSuggestions');
    if (!dropdown) {
        dropdown = document.createElement('div');
        dropdown.id = 'tagSuggestions';
        dropdown.className = 'suggestions-dropdown';
        suggestionsContainer.appendChild(dropdown);
    }

    if (matches.length > 0 && value.length > 0) {
        dropdown.innerHTML = '';
        matches.forEach(match => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            div.textContent = match;
            div.onclick = () => {
                this.value = match;
                const event = new KeyboardEvent('keydown', { key: 'Enter' });
                this.dispatchEvent(event);
            };
            dropdown.appendChild(div);
        });
        dropdown.style.display = 'block';
    } else {
        dropdown.style.display = 'none';
    }
});

function updateTagDisplay() {
    const container = document.getElementById('tagContainer');
    container.innerHTML = '';
    tags.forEach(tag => {
        const tagElement = document.createElement('div');
        tagElement.className = 'tag';
        tagElement.innerHTML = `
            ${tag}
            <span class="remove-tag" onclick="removeTag('${tag}')">&times;</span>
        `;
        container.appendChild(tagElement);
    });
}

function removeTag(tag) {
    tags.delete(tag);
    updateTagDisplay();
}

// Handle image uploads
document.getElementById('addImageBtn').addEventListener('click', function() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async function(e) {
        const file = e.target.files[0];
        if (file) {
            try {
                // Create a temporary file path
                const tempPath = await window.api.invoke('save-temp-file', {
                    name: file.name,
                    type: file.type,
                    data: await file.arrayBuffer()
                });

                // Generate a unique ID for this image
                const imageId = crypto.randomUUID();

                // Store temporary file info
                const tempImageInfo = {
                    id: imageId,
                    temp_path: tempPath,
                    file_name: file.name,
                    file_size: file.size,
                    file_type: file.type
                };

                // Add to images array
                images.push(tempImageInfo);

                // Create preview
                const container = document.querySelector('.image-upload-container');
                const preview = document.createElement('div');
                preview.className = 'image-preview';
                preview.innerHTML = `
                    <img src="file://${tempPath}">
                    <button class="remove-image" onclick="removeImage(this, '${imageId}')">&times;</button>
                `;
                container.insertBefore(preview, document.getElementById('addImageBtn'));
            } catch (error) {
                console.error('Error saving temporary file:', error);
                alert('Error preparing image for upload. Please try again.');
            }
        }
    };
    input.click();
});

function removeImage(button, imageId) {
    console.log('[addItem.js] Removing image with ID:', imageId);
    console.log('[addItem.js] Images before removal:', [...images]);
    
    const index = images.findIndex(img => img.id === imageId);
    console.log('[addItem.js] Found index to remove:', index);
    
    if (index > -1) {
        images.splice(index, 1);
        console.log('[addItem.js] Images after removal:', [...images]);
    } else {
        console.log('[addItem.js] No matching image found to remove');
    }
    
    button.parentElement.remove();
}

// --- Story References Logic ---
let storyRefs = [];

function createStoryRefRow(storyTitle = '', storyId = '') {
    const row = document.createElement('div');
    row.className = 'story-ref-row';

    // Title input container
    const titleContainer = document.createElement('div');
    titleContainer.className = 'story-ref-title-container';

    // Title input
    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.placeholder = 'Story Title';
    titleInput.className = 'input-text story-ref-title';
    titleInput.value = storyTitle;

    // Suggestions dropdown
    const dropdown = document.createElement('div');
    dropdown.className = 'story-suggestions';

    // Add input event listener for autocomplete
    titleInput.addEventListener('input', function(e) {
        const query = e.target.value.toLowerCase();
        // Collect all selected story IDs (except this row)
        const selectedTitles = Array.from(document.querySelectorAll('.story-ref-title'))
            .filter(input => input !== titleInput)
            .map(input => input.value.trim().toLowerCase())
            .filter(Boolean);
        // Filter suggestions to exclude already selected titles
        const suggestions = storySuggestions.filter(s => 
            s.title.toLowerCase().includes(query) &&
            !selectedTitles.includes(s.title.toLowerCase())
        );
        dropdown.innerHTML = '';
        if (suggestions.length > 0 && query.length > 0) {
            suggestions.forEach(suggestion => {
                const div = document.createElement('div');
                div.className = 'suggestion-item';
                div.textContent = suggestion.title;
                div.onclick = () => {
                    titleInput.value = suggestion.title;
                    idInput.value = suggestion.id;
                    titleInput.readOnly = true;
                    idInput.readOnly = true;
                    dropdown.style.display = 'none';
                };
                dropdown.appendChild(div);
            });
            dropdown.style.display = 'block';
        } else {
            dropdown.style.display = 'none';
        }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (!titleContainer.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });

    titleContainer.appendChild(titleInput);
    titleContainer.appendChild(dropdown);

    // ID input
    const idInput = document.createElement('input');
    idInput.type = 'text';
    idInput.placeholder = 'Story ID';
    idInput.className = 'input-text story-ref-id';
    idInput.value = storyId;

    // Remove button
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.textContent = '✕';
    removeBtn.className = 'button-debug';
    removeBtn.onclick = function() {
        row.remove();
    };

    row.appendChild(titleContainer);
    row.appendChild(idInput);
    row.appendChild(removeBtn);
    return row;
}

function addStoryRefRow(storyTitle = '', storyId = '') {
    const container = document.getElementById('storyRefsContainer');
    container.appendChild(createStoryRefRow(storyTitle, storyId));
}

document.getElementById('addStoryRefBtn').addEventListener('click', function() {
    addStoryRefRow();
});

// Add one row by default
addStoryRefRow();

function generateStoryId(title) {
    // Simple: STORY-<timestamp>-<random>
    return 'STORY-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
}

function collectStoryRefs() {
    const refs = [];
    document.querySelectorAll('.story-ref-row').forEach(row => {
        const title = row.querySelector('.story-ref-title').value.trim();
        let id = row.querySelector('.story-ref-id').value.trim();
        if (title) {
            if (!id) {
                id = generateStoryId(title);
                row.querySelector('.story-ref-id').value = id; // update UI
            }
            refs.push({ story_title: title, story_id: id });
        }
    });
    return refs;
}

// Check if we're in edit mode
const urlParams = new URLSearchParams(window.location.search);
const isEditMode = urlParams.get('edit') === 'true';
const editItemId = urlParams.get('itemId');

if (isEditMode && editItemId) {
    // Get the item data
    window.api.send('getItem', editItemId);
    window.api.receive('itemData', (item) => {
        if (item) {
            // Set the item ID on the form
            document.getElementById('addItemForm').dataset.itemId = item.id;

            // Set form values
            document.getElementById('title').value = item.title || '';
            document.getElementById('description').value = item.description || '';
            document.getElementById('content').value = item.content || '';
            document.getElementById('yearInput').value = item.year || '';
            document.getElementById('subtickInput').value = item.subtick !== undefined ? item.subtick : '';
            document.getElementById('bookTitle').value = item.book_title || '';
            document.getElementById('chapter').value = item.chapter || '';
            document.getElementById('page').value = item.page || '';
            if (item.color) {
                document.getElementById('colorInput').value = item.color;
            }

            // Clear existing tags and images
            tags.clear();
            images.length = 0;
            document.getElementById('tagsContainer').innerHTML = '';
            document.getElementById('imagesContainer').innerHTML = '';

            // Add existing tags
            if (item.tags) {
                item.tags.forEach(tag => {
                    tags.add(tag);
                    addTagToUI(tag);
                });
            }

            // Add existing images
            if (item.pictures) {
                item.pictures.forEach(pic => {
                    addImagePreview(pic);
                    images.push(pic);
                });
            }

            // Set story references
            if (item.story_refs) {
                // Clear default row
                document.getElementById('storyRefsContainer').innerHTML = '';
                // Add rows for each story reference
                item.story_refs.forEach(story => {
                    addStoryRefRow(story.title, story.id);
                });
            }

            // Update form submission handler for editing
            document.getElementById('addItemForm').onsubmit = function(e) {
                e.preventDefault();
                const formData = {
                    id: item.id, // Keep the same ID
                    title: document.getElementById('title').value,
                    description: document.getElementById('description').value,
                    content: document.getElementById('content').value,
                    tags: Array.from(tags),
                    pictures: images.map((imageInfo, index) => ({
                        id: imageInfo.id,
                        file_path: imageInfo.file_path,
                        file_name: imageInfo.file_name,
                        file_size: imageInfo.file_size,
                        file_type: imageInfo.file_type,
                        width: imageInfo.width,
                        height: imageInfo.height,
                        title: imageInfo.title || `Image ${index + 1}`,
                        description: imageInfo.description || ''
                    })),
                    book_title: document.getElementById('bookTitle').value,
                    chapter: document.getElementById('chapter').value,
                    page: document.getElementById('page').value,
                    year: document.getElementById('yearInput').value,
                    subtick: document.getElementById('subtickInput').value,
                    story_refs: collectStoryRefs()
                };
                // Send update request
                window.api.send('updateTimelineItem', formData);
                window.close();
            };
        }
    });
} else {
    // Handle form submission for new items
    document.getElementById('addItemForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Use the stored timeline ID
        console.log('[addItem.js] Using stored timeline ID:', timeline_id);
        
        // Process all images before submitting
        const processedImages = [];
        for (const imageInfo of images) {
            try {
                // Only process images that have a temp_path (newly added images)
                if (imageInfo.temp_path) {
                    const result = await window.api.invoke('save-new-image', {
                        file_path: imageInfo.temp_path,
                        file_name: imageInfo.file_name,
                        file_size: imageInfo.file_size,
                        file_type: imageInfo.file_type
                    });

                    // Check if result is valid
                    if (!result || typeof result !== 'object') {
                        throw new Error('Invalid response from image processing');
                    }

                    // Ensure all required fields are present
                    const processedImage = {
                        id: result.id || `IMG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        file_path: result.file_path || imageInfo.temp_path,
                        file_name: result.file_name || imageInfo.file_name,
                        file_size: result.file_size || imageInfo.file_size,
                        file_type: result.file_type || imageInfo.file_type,
                        width: result.width || 0,
                        height: result.height || 0,
                        title: result.title || imageInfo.file_name,
                        description: result.description || '',
                        created_at: result.created_at || new Date().toISOString()
                    };

                    processedImages.push(processedImage);
                } else {
                    // For existing images, just add them to processedImages
                    processedImages.push(imageInfo);
                }
            } catch (error) {
                console.error('Error processing image:', error);
                alert('Error processing image: ' + error.message);
                return; // Stop form submission if image processing fails
            }
        }
        
        // Get form data with null checks
        const formData = {
            id: 'ITEM-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
            title: document.getElementById('title')?.value || '',
            description: document.getElementById('description')?.value || '',
            content: document.getElementById('content')?.value || '',
            tags: Array.from(tags),
            pictures: processedImages,
            book_title: document.getElementById('bookTitle')?.value || '',
            chapter: document.getElementById('chapter')?.value || '',
            page: document.getElementById('page')?.value || '',
            year: parseInt(document.getElementById('yearInput')?.value || '0'),
            subtick: parseInt(document.getElementById('subtickInput')?.value || '0'),
            story_refs: collectStoryRefs(),
            story: '',
            'story-id': '',
            type: (urlParams.get('type') || 'event').charAt(0).toUpperCase() + (urlParams.get('type') || 'event').slice(1),
            color: document.getElementById('colorInput')?.value || null,
            timeline_id: timeline_id
        };

        console.log('[addItem.js] Form data being submitted:', formData);

        try {
            if (formData.story_refs.length > 0) {
                formData.story = formData.story_refs[0].story_title;
                formData['story-id'] = formData.story_refs[0].story_id;
            }
            // Send data through IPC
            window.api.send('addTimelineItem', formData);
            window.api.send('add-item-window-closing');
            window.close();
        } catch (error) {
            console.error('Error submitting form:', error);
            alert('An error occurred. Please try again.');
        }
    });
}

// Debug function to fill all fields with random data
document.getElementById('testFillBtn').addEventListener('click', function() {

    console.log("TEST FILLING");

    // Helper function to generate random text
    function randomText(length = 10) {
        const words = ['lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit', 'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore', 'magna', 'aliqua'];
        let result = '';
        for (let i = 0; i < length; i++) {
            result += words[Math.floor(Math.random() * words.length)] + ' ';
        }
        return result.trim();
    }

    // Helper function to generate random number
    function randomNumber(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // Fill text inputs
    document.getElementById('title').value = randomText(3);
    document.getElementById('bookTitle').value = randomText(2);
    document.getElementById('chapter').value = randomNumber(1, 20).toString();
    document.getElementById('page').value = randomNumber(1, 500).toString();
    //document.getElementById('storyId').value = `STORY-${randomNumber(1000, 9999)}`;

    // Fill textareas
    document.getElementById('description').value = randomText(10);
    document.getElementById('content').value = randomText(20);

    // Add some random tags
    const tagInput = document.getElementById('tagInput');
    const testTags = ['test', 'debug', 'sample', 'random', 'demo'];
    testTags.forEach(tag => {
        tagInput.value = tag;
        const event = new KeyboardEvent('keydown', { key: 'Enter' });
        tagInput.dispatchEvent(event);
    });

    // Add a sample image
    const sampleImage = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2NjYyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIiBmaWxsPSIjNjY2Ij5TYW1wbGUgSW1hZ2U8L3RleHQ+PC9zdmc+';
    addImagePreview({
        file_name: 'sample.svg',
        file_size: 1024,
        file_type: 'image/svg+xml',
        file_path: 'sample.svg',
        width: 200,
        height: 200
    });
}); 

window.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const year = urlParams.get('year');
    const subtick = urlParams.get('subtick');
    let granularity = urlParams.get('granularity');
    type = urlParams.get('type'); // Get type from URL parameters
    
    console.log('[addItem.js] Initializing form with URL parameters:', {
        year,
        subtick,
        granularity,
        type
    });

    // Validate type parameter
    if (!type || !['event', 'bookmark', 'picture', 'note'].includes(type.toLowerCase())) {
        console.error('Invalid or missing type parameter. Must be one of: event, bookmark, picture, note');
        window.close();
        return;
    }

    // Update type label display
    updateTypeLabel();

    if (!granularity || isNaN(parseInt(granularity))) {
        granularity = 4;
    } else {
        granularity = Math.max(0, parseInt(granularity - 1));
    }
    // Only auto-populate if not in edit mode
    if (!isEditMode) {
        if (year !== null) document.getElementById('yearInput').value = year;
        if (subtick !== null) document.getElementById('subtickInput').value = subtick;
    }
    // Set subtick max
    document.getElementById('subtickInput').setAttribute('max', granularity);

});

function initializeForm() {
    const urlParams = new URLSearchParams(window.location.search);
    const year = urlParams.get('year');
    const subtick = urlParams.get('subtick');
    const granularity = urlParams.get('granularity');
    type = urlParams.get('type'); // Get type from URL parameters
    const timeline_id = urlParams.get('timeline_id');

    console.log('[addItem.js] Initializing form with URL parameters:', {
        year,
        subtick,
        granularity,
        type,
        timeline_id
    });

    // Validate type parameter
    if (!type || !['event', 'bookmark', 'picture', 'note'].includes(type.toLowerCase())) {
        console.error('Invalid or missing type parameter. Must be one of: event, bookmark, picture, note');
        window.close();
        return;
    }

    // Update type label display
    updateTypeLabel();

    // Set year and subtick values
    if (year !== null) document.getElementById('yearInput').value = year;
    if (subtick !== null) document.getElementById('subtickInput').value = subtick;
    console.log('[addItem.js] subtick:', subtick);

    // Set subtick max based on granularity
    if (granularity) {
        const maxSubtick = Math.max(0, parseInt(granularity) - 1);
        document.getElementById('subtickInput').setAttribute('max', maxSubtick);
    }

    // ... rest of the initialization code ...
}

function updateTypeLabel() {
    const label = document.getElementById('typeLabel');
    if (type) {
        label.textContent = type.charAt(0).toUpperCase() + type.slice(1);
    }
}
