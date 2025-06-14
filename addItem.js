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
    showImageOptions();
});

function showImageOptions() {
    // Create options modal
    const optionsHTML = `
        <div id="imageOptionsModal" class="image-options-modal">
            <div class="image-options-content">
                <h3>Add Image</h3>
                <div class="image-options">
                    <button class="image-option-btn" onclick="selectNewImage()">
                        <i class="ri-upload-cloud-line"></i>
                        <span>Upload New Image</span>
                        <small>Add a new image file</small>
                    </button>
                    <button class="image-option-btn" onclick="selectExistingImage()">
                        <i class="ri-gallery-line"></i>
                        <span>Choose Existing Image</span>
                        <small>Select from timeline images</small>
                    </button>
                </div>
                <button class="cancel-btn" onclick="closeImageOptions()">Cancel</button>
            </div>
        </div>
    `;
    
    // Remove existing modal if any
    const existingModal = document.getElementById('imageOptionsModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', optionsHTML);
}

function selectNewImage() {
    closeImageOptions();
    
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
                    file_type: file.type,
                    isNew: true // Mark as new image
                };

                // Add to images array
                images.push(tempImageInfo);

                // Create preview
                addImagePreview(tempImageInfo, true);
            } catch (error) {
                console.error('Error saving temporary file:', error);
                console.error('Error preparing image for upload. Please try again.');
            }
        }
    };
    input.click();
}

function selectExistingImage() {
    closeImageOptions();
    
    // Show image library with both single and multi-select support
    imageLibrary.show(
        // Single image selection callback
        (selectedImage) => {
            // Create a reference to the existing image
            const existingImageRef = {
                id: selectedImage.id,
                file_path: selectedImage.file_path,
                file_name: selectedImage.file_name,
                file_size: selectedImage.file_size,
                file_type: selectedImage.file_type,
                width: selectedImage.width,
                height: selectedImage.height,
                title: selectedImage.title,
                description: selectedImage.description,
                isExisting: true // Mark as existing image
            };

            // Add to images array
            images.push(existingImageRef);

            // Create preview
            addImagePreview(existingImageRef, false);
        },
        // Multi-image selection callback
        (selectedImages) => {
            // Handle multiple image selection
            selectedImages.forEach(selectedImage => {
                const existingImageRef = {
                    id: selectedImage.id,
                    file_path: selectedImage.file_path,
                    file_name: selectedImage.file_name,
                    file_size: selectedImage.file_size,
                    file_type: selectedImage.file_type,
                    width: selectedImage.width,
                    height: selectedImage.height,
                    title: selectedImage.title,
                    description: selectedImage.description,
                    isExisting: true // Mark as existing image
                };

                // Add to images array
                images.push(existingImageRef);

                // Create preview
                addImagePreview(existingImageRef, false);
            });
        }
    );
}

function addImagePreview(imageInfo, isNew = false) {
    const container = document.querySelector('.image-upload-container');
    const preview = document.createElement('div');
    preview.className = 'image-preview';
    preview.innerHTML = `
        <img src="file://${imageInfo.file_path || imageInfo.temp_path}" alt="${imageInfo.file_name || 'Image'}">
        <button class="image-description-icon ${imageInfo.description ? 'has-description' : ''}" 
                onclick="toggleImageDescription(this, '${imageInfo.id || Date.now()}')" 
                title="${imageInfo.description ? 'Edit description' : 'Add description'}">
            <i class="ri-information-line"></i>
        </button>
        <div class="image-description-editor">
            <textarea placeholder="Add a description for this image..." 
                      onchange="updateImageDescription('${imageInfo.id || Date.now()}', this.value)">${imageInfo.description || ''}</textarea>
            <div class="image-description-actions">
                <button type="button" class="btn-description-save" onclick="saveImageDescription(this, '${imageInfo.id || Date.now()}')">Save</button>
                <button type="button" class="btn-description-cancel" onclick="cancelImageDescription(this)">Cancel</button>
            </div>
        </div>
        <div class="image-preview-info">
            <span class="image-preview-name">${imageInfo.file_name}</span>
            ${isNew ? '<span class="image-status new">New</span>' : '<span class="image-status existing">Existing</span>'}
        </div>
        <button class="remove-image" onclick="removeImage(this, '${imageInfo.id}')">&times;</button>
    `;
    container.insertBefore(preview, document.getElementById('addImageBtn'));
}

function closeImageOptions() {
    const modal = document.getElementById('imageOptionsModal');
    if (modal) {
        modal.remove();
    }
}

function removeImage(button, imageId) {
    
    const index = images.findIndex(img => img.id === parseInt(imageId));
    
    if (index > -1) {
        images.splice(index, 1);
    } else {
    }
    
    button.parentElement.remove();
}

// Image description functions
function toggleImageDescription(button, imageId) {
    event.preventDefault();
    const preview = button.closest('.image-preview');
    const editor = preview.querySelector('.image-description-editor');
    const isVisible = editor.classList.contains('visible');
    
    if (isVisible) {
        editor.classList.remove('visible');
    } else {
        // Close any other open editors
        document.querySelectorAll('.image-description-editor.visible').forEach(e => {
            e.classList.remove('visible');
        });
        editor.classList.add('visible');
        const textarea = editor.querySelector('textarea');
        textarea.focus();
    }
}

function updateImageDescription(imageId, description) {
    const imageIndex = images.findIndex(img => (img.id || img.temp_id) == imageId);
    if (imageIndex > -1) {
        images[imageIndex].description = description;
    }
}

function saveImageDescription(button, imageId) {
    const preview = button.closest('.image-preview');
    const editor = preview.querySelector('.image-description-editor');
    const textarea = editor.querySelector('textarea');
    const description = textarea.value.trim();
    const icon = preview.querySelector('.image-description-icon');
    
    // Update the image object
    updateImageDescription(imageId, description);
    
    // Update icon appearance
    if (description) {
        icon.classList.add('has-description');
        icon.title = 'Edit description';
    } else {
        icon.classList.remove('has-description');
        icon.title = 'Add description';
    }
    
    // Hide editor
    editor.classList.remove('visible');
}

function cancelImageDescription(button) {
    const preview = button.closest('.image-preview');
    const editor = preview.querySelector('.image-description-editor');
    const textarea = editor.querySelector('textarea');
    
    // Reset textarea to the original value
    const imageId = button.onclick.toString().match(/'([^']+)'/)[1];
    const imageData = images.find(img => (img.id || img.temp_id) == imageId);
    textarea.value = imageData ? (imageData.description || '') : '';
    
    // Hide editor
    editor.classList.remove('visible');
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
                document.getElementById('color').value = item.color;
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
        
        // Process all images before submitting
        const processedImages = [];
        for (const imageInfo of images) {
            try {
                // Only process images that have a temp_path (newly added images)
                if (imageInfo.isNew && imageInfo.temp_path) {
                    const result = await window.api.invoke('save-new-image', {
                        file_path: imageInfo.temp_path,
                        file_name: imageInfo.file_name,
                        file_size: imageInfo.file_size,
                        file_type: imageInfo.file_type,
                        description: imageInfo.description || ''
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
                } else if (imageInfo.isExisting) {
                    // For existing images, we need to create a reference in the database
                    // This will link the existing image to the new item
                    const existingImageRef = {
                        id: imageInfo.id,
                        file_path: imageInfo.file_path,
                        file_name: imageInfo.file_name,
                        file_size: imageInfo.file_size,
                        file_type: imageInfo.file_type,
                        width: imageInfo.width,
                        height: imageInfo.height,
                        title: imageInfo.title,
                        description: imageInfo.description,
                        isReference: true // Mark as reference to existing image
                    };
                    
                    processedImages.push(existingImageRef);
                } else {
                    // For existing images in edit mode, just add them to processedImages
                    processedImages.push(imageInfo);
                }
            } catch (error) {
                console.error('Error processing image: ' + error.message);
                console.error('Error preparing image for upload. Please try again.');
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
            color: document.getElementById('color')?.value,
            timeline_id: timeline_id,
            show_in_notes: document.getElementById('showInNotes').checked
        };

        // Get importance value
        const importanceInput = document.getElementById('importance');
        if (importanceInput) {
            formData.importance = parseInt(importanceInput.value) || 5;
        }

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
            console.error('An error occurred. Please try again.');
        }
    });
}

// Debug function to fill all fields with random data
document.getElementById('testFillBtn').addEventListener('click', function() {

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

// Add color preview functionality
function updateColorPreview(color) {
    document.getElementById('colorPreview').style.backgroundColor = color;
    document.getElementById('colorHex').value = color.toUpperCase();
}

// Handle color picker changes
document.getElementById('color').addEventListener('input', (e) => {
    updateColorPreview(e.target.value);
});

// Handle hex input changes
document.getElementById('colorHex').addEventListener('input', (e) => {
    let value = e.target.value;
    // Ensure the value starts with #
    if (!value.startsWith('#')) {
        value = '#' + value;
    }
    // Validate hex color format
    if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
        document.getElementById('color').value = value;
        updateColorPreview(value);
    }
});

// Handle hex input blur (when user leaves the field)
document.getElementById('colorHex').addEventListener('blur', (e) => {
    let value = e.target.value;
    // Ensure the value starts with #
    if (!value.startsWith('#')) {
        value = '#' + value;
    }
    // If the value is not a valid hex color, reset it to the color picker's value
    if (!/^#[0-9A-Fa-f]{6}$/.test(value)) {
        value = document.getElementById('color').value;
        e.target.value = value.toUpperCase();
    }
});

// Initialize color preview
updateColorPreview(document.getElementById('color').value);
