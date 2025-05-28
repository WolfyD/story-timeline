/**
 * Edit Item Window Module
 * 
 * This module handles the creation and management of the Edit Item window.
 * It provides a form interface for editing existing timeline items and communicates
 * with the main process to save the changes.
 * 
 * Key Features:
 * - Form for editing timeline item details (title, description)
 * - Year and subtick display
 * - Form validation
 * - Communication with main process
 * - Window management
 * 
 * Main Functions:
 * - initializeForm(): Sets up the form and its event listeners
 * - validateForm(): Validates form input before submission
 * - handleSubmit(): Handles form submission and item update
 * - closeWindow(): Closes the edit item window
 * 
 * Form Fields:
 * - Title: Required, cannot be empty
 * - Description: Optional, can be empty
 * 
 * IPC Communication:
 * - Sends 'updateTimelineItem' message to main process with updated item data
 * - Listens for 'item-updated' confirmation from main process
 */

const tags = new Set();
const images = [];
let storySuggestions = [];
let tagSuggestions = [];
let type;
let timeline_id;
let originalData = null;
let modifiedFields = new Set();

// Get the current timeline ID when window loads
window.addEventListener('DOMContentLoaded', async function() {
    timeline_id = await window.api.getCurrentTimelineId();
    window.api.logger.info('Got timeline ID on load:', timeline_id);
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

// Initialize form with URL parameters and itemData
function initializeForm() {
    const urlParams = new URLSearchParams(window.location.search);
    const year = urlParams.get('year');
    const subtick = urlParams.get('subtick');
    const granularity = urlParams.get('granularity');
    const color = urlParams.get('color');
    type = urlParams.get('type');
    const itemId = urlParams.get('itemId');

    // Store granularity globally
    window.granularity = granularity;

    window.api.logger.info('Initializing form with URL parameters:', {
        year,
        subtick,
        granularity,
        color,
        type,
        itemId
    });

    if (!itemId) {
        window.api.logger.error('No item ID provided');
        window.close();
        return;
    }

    // Get item data
    window.api.send('getItem', itemId);
}

// Handle item data response
window.api.receive('itemData', (item) => {
    if (item) {
        originalData = item;
        populateForm(item);
    } else {
        window.api.logger.error('Failed to load item data');
        window.close();
    }
});

function populateForm(item) {
    // Set form values
    document.getElementById('title').value = item.title || '';
    document.getElementById('description').value = item.description || '';
    document.getElementById('content').value = item.content || '';
    document.getElementById('yearInput').value = item.year || '';
    document.getElementById('subtickInput').value = item.subtick !== undefined ? item.subtick : '';
    document.getElementById('endYearInput').value = item.end_year || item.year || '';
    document.getElementById('endSubtickInput').value = item.end_subtick !== undefined ? item.end_subtick : item.subtick || '';
    document.getElementById('bookTitle').value = item.book_title || '';
    document.getElementById('chapter').value = item.chapter || '';
    document.getElementById('page').value = item.page || '';
    document.getElementById('color').value = item.color;
    document.getElementById('showInNotes').checked = item.show_in_notes !== false;
    updateColorPreview(item.color);

    // Clear existing tags and images
    tags.clear();
    images.length = 0;
    document.getElementById('tagContainer').innerHTML = '';
    document.querySelector('.image-upload-container').innerHTML = '<button type="button" id="addImageBtn" class="button">Add Image</button>';

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
        document.getElementById('storyRefsContainer').innerHTML = '';
        item.story_refs.forEach(story => {
            addStoryRefRow(story.title, story.id);
        });
    }

    // Add one empty row if no story refs
    if (!item.story_refs || item.story_refs.length === 0) {
        addStoryRefRow();
    }

    // Add change listeners to track modifications
    addChangeListeners();
}

function addChangeListeners() {
    const form = document.getElementById('editItemForm');
    const inputs = form.querySelectorAll('input, textarea');
    
    inputs.forEach(input => {
        input.addEventListener('change', function() {
            const fieldName = this.id;
            if (this.value !== originalData[fieldName]) {
                modifiedFields.add(fieldName);
                this.classList.add('modified');
            } else {
                modifiedFields.delete(fieldName);
                this.classList.remove('modified');
            }
        });
    });
}

// Call initialization
initializeForm();

// Handle tag input
document.getElementById('tagInput').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        const tag = this.value.trim();
        if (tag && !tags.has(tag)) {
            tags.add(tag);
            if (!tagSuggestions.includes(tag)) {
                tagSuggestions.push(tag);
            }
            updateTagDisplay();
            modifiedFields.add('tags');
        }
        this.value = '';
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

function addTagToUI(tag) {
    const container = document.getElementById('tagContainer');
    const tagElement = document.createElement('div');
    tagElement.className = 'tag';
    tagElement.innerHTML = `
        ${tag}
        <span class="remove-tag" onclick="removeTag('${tag}')">&times;</span>
    `;
    container.appendChild(tagElement);
}

function removeTag(tag) {
    tags.delete(tag);
    updateTagDisplay();
    modifiedFields.add('tags');
}

function updateTagDisplay() {
    const container = document.getElementById('tagContainer');
    container.innerHTML = '';
    tags.forEach(tag => {
        addTagToUI(tag);
    });
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
                const tempPath = await window.api.invoke('save-temp-file', {
                    name: file.name,
                    type: file.type,
                    data: await file.arrayBuffer()
                });

                const imageId = crypto.randomUUID();
                const tempImageInfo = {
                    id: imageId,
                    temp_path: tempPath,
                    file_name: file.name,
                    file_size: file.size,
                    file_type: file.type
                };

                images.push(tempImageInfo);
                addImagePreview(tempImageInfo);
                modifiedFields.add('pictures');
            } catch (error) {
                window.api.logger.error('Error saving temporary file:', error);
                alert('Error preparing image for upload. Please try again.');
            }
        }
    };
    input.click();
});

function addImagePreview(imageInfo) {
    const container = document.querySelector('.image-upload-container');
    const preview = document.createElement('div');
    preview.className = 'image-preview';
    preview.innerHTML = `
        <img src="file://${imageInfo.file_path || imageInfo.temp_path}" alt="${imageInfo.file_name || 'Image'}">
        <button class="remove-image" onclick="removeImage(this, '${imageInfo.id}')">&times;</button>
    `;
    container.insertBefore(preview, document.getElementById('addImageBtn'));
}

function removeImage(button, imageId) {
    window.api.logger.info('Removing image with ID:', imageId);
    const index = images.findIndex(img => img.id === imageId);
    
    if (index > -1) {
        images.splice(index, 1);
        modifiedFields.add('pictures');
    }
    
    button.parentElement.remove();
}

// Handle form submission
document.getElementById('editItemForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Process all images before submitting
    const processedImages = [];
    for (const imageInfo of images) {
        console.log('Processing image:', imageInfo);
        try {
            if (imageInfo.temp_path) {
                const result = await window.api.invoke('save-new-image', {
                    file_path: imageInfo.temp_path,
                    file_name: imageInfo.file_name,
                    file_size: imageInfo.file_size,
                    file_type: imageInfo.file_type
                });

                if (!result || typeof result !== 'object') {
                    throw new Error('Invalid response from image processing');
                }

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
                processedImages.push(imageInfo);
            }
        } catch (error) {
            window.api.logger.error('Error processing image:', error);
            alert('Error processing image: ' + error.message);
            return;
        }
    }
    
    const formData = {
        id: item.id,
        title: document.getElementById('title').value,
        description: document.getElementById('description').value,
        content: document.getElementById('content').value,
        tags: Array.from(tags),
        pictures: processedImages.map((imageInfo, index) => ({
            id: imageInfo.id,
            file_path: imageInfo.file_path,
            file_name: imageInfo.file_name,
            file_size: imageInfo.file_size,
            file_type: imageInfo.file_type,
            width: imageInfo.width,
            height: imageInfo.height,
            title: imageInfo.title || `Image ${index + 1}`,
            description: imageInfo.description || '',
            created_at: imageInfo.created_at || new Date().toISOString()
        })),
        book_title: document.getElementById('bookTitle').value,
        chapter: document.getElementById('chapter').value,
        page: document.getElementById('page').value,
        year: document.getElementById('yearInput').value,
        subtick: document.getElementById('subtickInput').value,
        end_year: document.getElementById('endYearInput').value,
        end_subtick: document.getElementById('endSubtickInput').value,
        story_refs: collectStoryRefs(),
        story: '',
        'story-id': '',
        show_in_notes: document.getElementById('showInNotes').checked,
        color: document.getElementById('color').value || null,
        timeline_id: originalData.timeline_id
    };

    window.api.logger.info('Form data being submitted:', formData);

    try {
        window.api.send('updateTimelineItem', formData);
        window.close();
    } catch (error) {
        window.api.logger.error('Error submitting form:', error);
        alert('An error occurred. Please try again.');
    }
});

// Handle cancel button
document.getElementById('cancelBtn').addEventListener('click', function() {
    if (modifiedFields.size > 0) {
        if (confirm('You have unsaved changes. Are you sure you want to cancel?')) {
            window.close();
        }
    } else {
        window.close();
    }
});

function createStoryRefRow(storyTitle = '', storyId = '') {
    const row = document.createElement('div');
    row.className = 'story-ref-row';

    const titleContainer = document.createElement('div');
    titleContainer.className = 'story-ref-title-container';

    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.placeholder = 'Story Title';
    titleInput.className = 'input-text story-ref-title';
    titleInput.value = storyTitle;

    const dropdown = document.createElement('div');
    dropdown.className = 'story-suggestions';

    titleInput.addEventListener('input', function(e) {
        const query = e.target.value.toLowerCase();
        const selectedTitles = Array.from(document.querySelectorAll('.story-ref-title'))
            .filter(input => input !== titleInput)
            .map(input => input.value.trim().toLowerCase())
            .filter(Boolean);
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
                    modifiedFields.add('story_refs');
                };
                dropdown.appendChild(div);
            });
            dropdown.style.display = 'block';
        } else {
            dropdown.style.display = 'none';
        }
    });

    document.addEventListener('click', function(e) {
        if (!titleContainer.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });

    titleContainer.appendChild(titleInput);
    titleContainer.appendChild(dropdown);

    const idInput = document.createElement('input');
    idInput.type = 'text';
    idInput.placeholder = 'Story ID';
    idInput.className = 'input-text story-ref-id';
    idInput.value = storyId;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.textContent = '✕';
    removeBtn.className = 'button-debug';
    removeBtn.onclick = function() {
        row.remove();
        modifiedFields.add('story_refs');
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
    modifiedFields.add('story_refs');
});

function collectStoryRefs() {
    const refs = [];
    document.querySelectorAll('.story-ref-row').forEach(row => {
        const title = row.querySelector('.story-ref-title').value.trim();
        let id = row.querySelector('.story-ref-id').value.trim();
        if (title) {
            if (!id) {
                id = generateStoryId(title);
                row.querySelector('.story-ref-id').value = id;
            }
            refs.push({ story_title: title, story_id: id });
        }
    });
    return refs;
}

function generateStoryId(title) {
    return 'STORY-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
}

function updateColorPreview(color) {
    // Implementation of updateColorPreview function
} 