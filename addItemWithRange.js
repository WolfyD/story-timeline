const tags = new Set();
const images = [];
let storySuggestions = [];
let tagSuggestions = []; // Add tag suggestions array
let type; // Declare type in global scope
let timeline_id; // Add timeline_id to global scope

// Get the current timeline ID when window loads
window.addEventListener('DOMContentLoaded', async function() {
    timeline_id = await window.api.getCurrentTimelineId();
    console.log('[addItemWithRange.js] Got timeline ID on load:', timeline_id);
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
    type = urlParams.get('type'); // Assign to global type variable

    // Store granularity globally
    window.granularity = granularity;

    console.log('[addItemWithRange.js] Initializing form with URL parameters:', {
        year,
        subtick,
        granularity,
        color,
        type
    });

    // Validate type parameter
    if (!type || !['age', 'period'].includes(type.toLowerCase())) {
        console.error('Invalid or missing type parameter. Must be either "age" or "period".');
        window.close();
        return;
    }

    // Update type label display
    updateTypeLabel();

    // Set initial values from URL parameters
    if (year !== null && subtick !== null) {
        document.getElementById('yearInput').value = year;
        document.getElementById('subtickInput').value = subtick;
        document.getElementById('endYearInput').value = year;
        document.getElementById('endSubtickInput').value = subtick;
    }
    if (color !== null) {
        document.getElementById('colorInput').value = color;
    }

    // Get itemData from the main process
    window.api.receive('item-data', (itemData) => {
        console.log('[addItemWithRange.js] Received itemData:', itemData);
        
        if (itemData) {
            console.log('[addItemWithRange.js] Filling form with itemData:', {
                year: itemData.year || year,
                subtick: itemData.subtick || subtick,
                end_year: itemData.end_year || year,
                end_subtick: itemData.end_subtick || subtick,
                title: itemData.title,
                description: itemData.description,
                content: itemData.content,
                color: itemData.color || color,
                book_title: itemData.book_title,
                chapter: itemData.chapter,
                page: itemData.page,
                tags: itemData.tags,
                story_refs: itemData.story_refs,
                pictures: itemData.pictures
            });

            // Fill in all form fields with the item data
            document.getElementById('yearInput').value = itemData.year || year;
            document.getElementById('subtickInput').value = itemData.subtick || subtick;
            document.getElementById('endYearInput').value = itemData.end_year || year;
            document.getElementById('endSubtickInput').value = itemData.end_subtick || subtick;
            document.getElementById('titleInput').value = itemData.title || '';
            document.getElementById('descriptionInput').value = itemData.description || '';
            document.getElementById('contentInput').value = itemData.content || '';
            document.getElementById('colorInput').value = itemData.color || color;
            document.getElementById('bookTitleInput').value = itemData.book_title || '';
            document.getElementById('chapterInput').value = itemData.chapter || '';
            document.getElementById('pageInput').value = itemData.page || '';
            document.getElementById('showInNotesInput').checked = itemData.show_in_notes !== false;
            
            // Set the form's item ID
            document.getElementById('addItemForm').dataset.itemId = itemData.id;

            // Add tags
            if (itemData.tags && itemData.tags.length) {
                tags.clear(); // Clear existing tags
                itemData.tags.forEach(tag => tags.add(tag));
                updateTagDisplay();
            }

            // Add story references
            if (itemData.story_refs && itemData.story_refs.length) {
                const storyRefsContainer = document.getElementById('storyRefsContainer');
                storyRefsContainer.innerHTML = ''; // Clear existing refs
                itemData.story_refs.forEach(story => {
                    addStoryRefRow(story.title, story.id);
                });
            }

            // Add images
            if (itemData.pictures && itemData.pictures.length) {
                itemData.pictures.forEach(pic => {
                    const imageInfo = {
                        file_path: pic.file_path,
                        title: pic.title || '',
                        description: pic.description || ''
                    };
                    addImagePreview(imageInfo);
                    images.push(imageInfo);
                });
            }
        } else {
            console.log('[addItemWithRange.js] No itemData received, using URL parameters');
            // If no itemData, use URL parameters
            if (year !== null && subtick !== null) {
                document.getElementById('yearInput').value = year;
                document.getElementById('subtickInput').value = subtick;
                document.getElementById('endYearInput').value = year;
                document.getElementById('endSubtickInput').value = subtick;
            }
            if (color !== null) {
                document.getElementById('colorInput').value = color;
            }
        }
    });

    // Request the item data from the main process
    console.log('[addItemWithRange.js] Requesting item data from main process');
    window.api.send('get-item-data');
}

// Call initialization
initializeForm();

// Handle tag input
document.getElementById('tagInput').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        const tag = this.value.trim();
        if (tag && !tags.has(tag)) {
            tags.add(tag); // Store only the tag text
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

// Close suggestions when clicking outside
document.addEventListener('click', function(e) {
    if (!e.target.closest('.form-line')) {
        const dropdown = document.getElementById('tagSuggestions');
        if (dropdown) {
            dropdown.style.display = 'none';
        }
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

// Image handling
let uploadedImages = [];
let imageCounter = 0;

function createImagePreview(file, imageId) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = document.createElement('img');
        img.src = e.target.result;
        img.className = 'preview-image';
        img.id = `preview-${imageId}`;
        
        const container = document.createElement('div');
        container.className = 'image-preview-container';
        container.id = `container-${imageId}`;
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-image-btn';
        removeBtn.textContent = '×';
        removeBtn.onclick = () => removeImage(imageId);
        
        container.appendChild(img);
        container.appendChild(removeBtn);
        
        const imageContainer = document.getElementById('imageContainer');
        if (!imageContainer) {
            const newContainer = document.createElement('div');
            newContainer.id = 'imageContainer';
            newContainer.className = 'image-container';
            document.querySelector('.image-upload-container').appendChild(newContainer);
        }
        document.getElementById('imageContainer').appendChild(container);
    };
    reader.readAsDataURL(file);
}

function removeImage(imageId) {
    const container = document.getElementById(`container-${imageId}`);
    if (container) {
        container.remove();
    }
    uploadedImages = uploadedImages.filter(img => img.id !== imageId);
}

function handleImageUpload(event) {
    const files = event.target.files;
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('image/')) {
            const imageId = `img-${imageCounter++}`;
            uploadedImages.push({
                id: imageId,
                file: file,
                title: file.name,
                description: ''
            });
            createImagePreview(file, imageId);
        }
    }
    // Reset the input value to allow selecting the same file again
    event.target.value = '';
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
    console.log('[addItemWithRange.js] Removing image with ID:', imageId);
    console.log('[addItemWithRange.js] Images before removal:', [...images]);
    
    const index = images.findIndex(img => img.id === imageId);
    console.log('[addItemWithRange.js] Found index to remove:', index);
    
    if (index > -1) {
        images.splice(index, 1);
        console.log('[addItemWithRange.js] Images after removal:', [...images]);
    } else {
        console.log('[addItemWithRange.js] No matching image found to remove');
    }
    
    button.parentElement.remove();
}

// Story References Logic
let storyRefs = [];

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

    titleInput.addEventListener('input', function() {
        const value = this.value.toLowerCase();
        const matches = storySuggestions.filter(s => 
            s.title.toLowerCase().includes(value)
        );

        if (matches.length > 0) {
            dropdown.innerHTML = '';
            matches.forEach(match => {
                const div = document.createElement('div');
                div.className = 'suggestion-item';
                div.textContent = match.title;
                div.onclick = function() {
                    titleInput.value = match.title;
                    idInput.value = match.id;
                    dropdown.style.display = 'none';
                };
                dropdown.appendChild(div);
            });
            dropdown.style.display = 'block';
        } else {
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

// Handle form submission for new items
document.getElementById('addItemForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Ensure we have a valid timeline ID
    if (!timeline_id) {
        console.error('[addItemWithRange.js] No timeline ID available');
        alert('Error: No active timeline found. Please try again.');
        return;
    }
    
    // Process all images before submitting
    const processedImages = [];
    for (const image of images) {
        try {
            // Only process images that have a temp_path (newly added images)
            if (image.temp_path) {
                const result = await window.api.invoke('save-new-image', {
                    file_path: image.temp_path,
                    file_name: image.file_name,
                    file_size: image.file_size,
                    file_type: image.file_type
                });

                if (!result || typeof result !== 'object') {
                    throw new Error('Invalid response from image processing');
                }

                // Create processed image object with all required fields
                const processedImage = {
                    id: result.id || null,
                    file_path: result.file_path || '',
                    file_name: result.file_name || image.file_name,
                    file_size: result.file_size || image.file_size,
                    file_type: result.file_type || image.file_type,
                    width: result.width || 0,
                    height: result.height || 0,
                    created_at: result.created_at || new Date().toISOString()
                };

                processedImages.push(processedImage);
            } else {
                // For existing images, just add them to processedImages
                processedImages.push(image);
            }
        } catch (error) {
            console.error('Error processing image:', error);
            alert('Error processing image: ' + error.message);
            return;
        }
    }
    
    // Get form data with null checks
    const formData = {
        id: 'ITEM-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
        title: document.getElementById('titleInput')?.value || '',
        description: document.getElementById('descriptionInput')?.value || '',
        content: document.getElementById('contentInput')?.value || '',
        tags: Array.from(tags),
        pictures: processedImages,
        book_title: document.getElementById('bookTitleInput')?.value || '',
        chapter: document.getElementById('chapterInput')?.value || '',
        page: document.getElementById('pageInput')?.value || '',
        year: parseInt(document.getElementById('yearInput')?.value || '0'),
        subtick: parseInt(document.getElementById('subtickInput')?.value || '0'),
        original_subtick: parseInt(document.getElementById('subtickInput')?.value || '0'),
        end_year: parseInt(document.getElementById('endYearInput')?.value || '0'),
        end_subtick: parseInt(document.getElementById('endSubtickInput')?.value || '0'),
        original_end_subtick: parseInt(document.getElementById('endSubtickInput')?.value || '0'),
        story_refs: collectStoryRefs(),
        story: '',
        'story-id': '',
        type: type.charAt(0).toUpperCase() + type.slice(1),
        color: document.getElementById('colorInput')?.value,
        timeline_id: timeline_id,
        creation_granularity: parseInt(window.granularity || '4'),
        item_index: 0, // This will be set by the database manager
        show_in_notes: document.getElementById('showInNotesInput').checked
    };

    // If this is a period, ensure end year/subtick are set
    if (type.toLowerCase() === 'period') {
        if (!formData.end_year) {
            formData.end_year = formData.year;
        }
        if (!formData.end_subtick) {
            formData.end_subtick = formData.subtick;
        }
    }

    // Check if end date is before start date and swap if needed
    const startValue = formData.year + (formData.subtick / formData.creation_granularity);
    const endValue = formData.end_year + (formData.end_subtick / formData.creation_granularity);
    
    if (endValue < startValue) {
        console.log('[addItemWithRange.js] End date is before start date, swapping values');
        // Swap years and subticks
        [formData.year, formData.end_year] = [formData.end_year, formData.year];
        [formData.subtick, formData.end_subtick] = [formData.end_subtick, formData.subtick];
        [formData.original_subtick, formData.original_end_subtick] = [formData.original_end_subtick, formData.original_subtick];
    }

    // Check if start and end dates are the same, convert to Event if they are
    if ((type.toLowerCase() === 'age' || type.toLowerCase() === 'period') && 
        formData.year === formData.end_year && 
        formData.subtick === formData.end_subtick) {
        formData.type = 'Event';
        console.log('[addItemWithRange.js] Converting to Event due to same start/end dates');
    }

    console.log('[addItemWithRange.js] Submitting form data:', formData);

    // Send the form data
    window.api.send('addTimelineItem', formData);
    
    // If this is a period, trigger stack recalculation
    if (type.toLowerCase() === 'period') {
        window.api.send('recalculate-period-stacks');
    }
    
    window.close();
});

// Test fill button
document.getElementById('testFillBtn').addEventListener('click', function() {
    document.getElementById('titleInput').value = 'Test Item with Range';
    document.getElementById('descriptionInput').value = 'This is a test item with a date range';
    document.getElementById('contentInput').value = 'Test content for an item with a date range';
    document.getElementById('bookTitleInput').value = 'Test Book';
    document.getElementById('chapterInput').value = 'Test Chapter';
    document.getElementById('pageInput').value = '42';
    document.getElementById('colorInput').value = '#37F2AE';

    // Add a sample tag
    tags.add('test-tag');
    updateTagDisplay();

    // Add a sample image
    const sampleImage = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2NjYyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIiBmaWxsPSIjNjY2Ij5TYW1wbGUgSW1hZ2U8L3RleHQ+PC9zdmc+';
    addImagePreview(sampleImage);
});

window.api.receive('itemData', (item) => {
    if (item) {
        // Set the item ID on the form
        document.getElementById('addItemForm').dataset.itemId = item.id;

        // Set form values
        document.getElementById('titleInput').value = item.title || '';
        document.getElementById('descriptionInput').value = item.description || '';
        document.getElementById('contentInput').value = item.content || '';
        document.getElementById('yearInput').value = item.year || '';
        document.getElementById('subtickInput').value = item.subtick || '';
        document.getElementById('endYearInput').value = item.end_year || item.year || '';
        document.getElementById('endSubtickInput').value = item.end_subtick || item.subtick || '';
        document.getElementById('bookTitleInput').value = item.book_title || '';
        document.getElementById('chapterInput').value = item.chapter || '';
        document.getElementById('pageInput').value = item.page || '';
        document.getElementById('showInNotesInput').checked = item.show_in_notes !== false;
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

        // Add story references
        if (item.story_refs && item.story_refs.length) {
            const storyRefsContainer = document.getElementById('storyRefsContainer');
            storyRefsContainer.innerHTML = ''; // Clear existing refs
            item.story_refs.forEach(story => {
                addStoryRefRow(story.story_title, story.story_id);
            });
        }

        // Add existing images
        if (item.pictures) {
            item.pictures.forEach(pic => {
                addImagePreview(pic);
                images.push(pic);
            });
        }

        // Update form submission handler for editing
        document.getElementById('addItemForm').onsubmit = function(e) {
            e.preventDefault();
            const formData = {
                id: item.id, // Keep the same ID
                title: document.getElementById('titleInput').value,
                description: document.getElementById('descriptionInput').value,
                content: document.getElementById('contentInput').value,
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
                book_title: document.getElementById('bookTitleInput').value,
                chapter: document.getElementById('chapterInput').value,
                page: document.getElementById('pageInput').value,
                year: document.getElementById('yearInput').value,
                subtick: document.getElementById('subtickInput').value,
                end_year: document.getElementById('endYearInput').value,
                end_subtick: document.getElementById('endSubtickInput').value,
                story_refs: collectStoryRefs(),
                story: '',
                'story-id': '',
                show_in_notes: document.getElementById('showInNotesInput').checked
            };

            if (formData.story_refs.length > 0) {
                formData.story = formData.story_refs[0].story_title;
                formData['story-id'] = formData.story_refs[0].story_id;
            }

            // Send update request
            window.api.send('updateTimelineItem', formData);
            window.close();
        };
    }
});

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
document.getElementById('colorInput').addEventListener('input', (e) => {
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
        document.getElementById('colorInput').value = value;
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
        value = document.getElementById('colorInput').value;
        e.target.value = value.toUpperCase();
    }
});

// Initialize color preview
updateColorPreview(document.getElementById('colorInput').value); 