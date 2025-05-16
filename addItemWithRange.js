const tags = new Set();
const images = [];
let storySuggestions = [];
let type; // Declare type in global scope

// Get story suggestions from main window
window.api.send('getStorySuggestions');

// Handle story suggestions response
window.api.receive('storySuggestions', (suggestions) => {
    storySuggestions = suggestions;
});

// Initialize form with URL parameters and itemData
function initializeForm() {
    const urlParams = new URLSearchParams(window.location.search);
    const year = urlParams.get('year');
    const subtick = urlParams.get('subtick');
    const granularity = urlParams.get('granularity');
    const color = urlParams.get('color');
    type = urlParams.get('type'); // Assign to global type variable

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
            updateTagDisplay();
        }
        this.value = '';
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

// Add image button click handler
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

                // Get the item ID from the form
                const itemId = document.getElementById('addItemForm').dataset.itemId || null;

                // Send file to main process to save it and get metadata
                window.api.send('save-new-image', {
                    file_path: tempPath,
                    file_name: file.name,
                    file_size: file.size,
                    file_type: file.type,
                    item_id: itemId
                });
            } catch (error) {
                console.error('Error saving temporary file:', error);
                alert('Error preparing image for upload. Please try again.');
            }
        }
    };
    input.click();
});

// Handle response from main process with saved image info
window.api.receive('new-image-saved', (imageInfo) => {
    if (imageInfo.error) {
        alert('Error saving image: ' + imageInfo.error);
        return;
    }
    addImagePreview(imageInfo);
    images.push(imageInfo);
});

function addImagePreview(imageInfo) {
    const container = document.querySelector('.image-upload-container');
    const preview = document.createElement('div');
    preview.className = 'image-preview';
    preview.innerHTML = `
        <img src="file://${imageInfo.file_path}">
        <button class="remove-image" onclick="removeImage(this, '${imageInfo.file_path}')">&times;</button>
    `;
    container.insertBefore(preview, document.getElementById('addImageBtn'));
}

function removeImage(button, filePath) {
    button.parentElement.remove();
    const index = images.findIndex(img => img.file_path === filePath);
    if (index > -1) {
        images.splice(index, 1);
    }
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

function collectStoryRefs() {
    const rows = document.querySelectorAll('.story-ref-row');
    return Array.from(rows).map(row => {
        const titleInput = row.querySelector('.story-ref-title');
        const idInput = row.querySelector('.story-ref-id');
        return {
            story_title: titleInput.value,
            story_id: idInput.value
        };
    }).filter(ref => ref.story_title && ref.story_id);
}

// Update the form submission to include images
document.getElementById('addItemForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = {
        title: document.getElementById('titleInput').value,
        description: document.getElementById('descriptionInput').value,
        content: document.getElementById('contentInput').value,
        year: parseInt(document.getElementById('yearInput').value),
        subtick: parseInt(document.getElementById('subtickInput').value),
        end_year: parseInt(document.getElementById('endYearInput').value),
        end_subtick: parseInt(document.getElementById('endSubtickInput').value),
        book_title: document.getElementById('bookTitleInput').value,
        chapter: document.getElementById('chapterInput').value,
        page: document.getElementById('pageInput').value,
        color: document.getElementById('colorInput').value,
        type: type.charAt(0).toUpperCase() + type.slice(1),
        tags: Array.from(tags),
        story_refs: Array.from(document.querySelectorAll('.story-ref-row')).map(row => ({
            story_id: row.querySelector('.story-ref-id').value,
            story_title: row.querySelector('.story-ref-title').value
        })),
        pictures: images.map((imageInfo, index) => ({
            file_path: imageInfo.file_path,
            file_name: imageInfo.file_name,
            file_size: imageInfo.file_size,
            file_type: imageInfo.file_type,
            width: imageInfo.width,
            height: imageInfo.height,
            title: imageInfo.title || `Image ${index + 1}`,
            description: imageInfo.description || ''
        }))
    };

    // If we have an item ID, this is an edit
    const itemId = document.getElementById('addItemForm').dataset.itemId;
    if (itemId) {
        formData.id = itemId;
        try {
            // Send update through IPC
            window.api.send('updateTimelineItem', formData);
            window.api.send('add-item-window-closing');
            window.close();
        } catch (error) {
            console.error('Error updating item:', error);
        }
    } else {
        try {
            // Set up the response handler first
            window.api.receive('item-created', (response) => {
                if (response && response.id) {
                    // Update pictures with the new item ID if we have images
                    if (images.length > 0) {
                        // Get all picture IDs
                        const pictureIds = images.map(img => img.id);
                        // Update pictures with the new item ID
                        window.api.send('update-pictures-item-id', {
                            pictureIds: pictureIds,
                            itemId: response.id
                        });
                    }
                    // Notify main window that we're closing
                    window.api.send('add-item-window-closing');
                    // Close this window
                    window.close();
                } else {
                    console.error('Failed to create item: No ID received');
                    alert('Failed to create item. Please try again.');
                }
            });

            // Then send the new item through IPC
            window.api.send('addTimelineItem', formData);
        } catch (error) {
            console.error('Error adding item:', error);
            alert('Error creating item. Please try again.');
        }
    }
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
                story_refs: collectStoryRefs()
            };
            // Send update request
            window.api.send('updateTimelineItem', formData);
            window.close();
        };
    }
}); 