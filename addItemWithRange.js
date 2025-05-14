const tags = new Set();
const images = [];
let storySuggestions = [];

// Get story suggestions from main window
window.api.send('getStorySuggestions');

// Handle story suggestions response
window.api.receive('storySuggestions', (suggestions) => {
    storySuggestions = suggestions;
});

// Initialize form with URL parameters
const urlParams = new URLSearchParams(window.location.search);
const year = urlParams.get('year');
const subtick = urlParams.get('subtick');
const granularity = urlParams.get('granularity');
const color = urlParams.get('color');

if (year !== null && subtick !== null) {
    document.getElementById('yearInput').value = year;
    document.getElementById('subtickInput').value = subtick;
    document.getElementById('endYearInput').value = year;
    document.getElementById('endSubtickInput').value = subtick;
}

if (color !== null) {
    document.getElementById('colorInput').value = color;
}

// Handle tag input
document.getElementById('tagInput').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        const tag = this.value.trim();
        if (tag && !tags.has(tag)) {
            tags.add(tag);
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

// Handle form submission
document.getElementById('addItemForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Get form data
    const formData = {
        id: 'ITEM-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
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
        bookTitle: document.getElementById('bookTitle').value,
        chapter: document.getElementById('chapter').value,
        page: document.getElementById('page').value,
        year: parseInt(document.getElementById('yearInput').value),
        subtick: parseInt(document.getElementById('subtickInput').value),
        end_year: parseInt(document.getElementById('endYearInput').value),
        end_subtick: parseInt(document.getElementById('endSubtickInput').value),
        story_refs: collectStoryRefs(),
        story: '',
        'story-id': '',
        type: (urlParams.get('type') || 'period').charAt(0).toUpperCase() + (urlParams.get('type') || 'period').slice(1),
        color: document.getElementById('colorInput').value || null
    };

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

// Test fill button
document.getElementById('testFillBtn').addEventListener('click', function() {
    document.getElementById('title').value = 'Test Item with Range';
    document.getElementById('description').value = 'This is a test item with a date range';
    document.getElementById('content').value = 'Test content for an item with a date range';
    document.getElementById('bookTitle').value = 'Test Book';
    document.getElementById('chapter').value = 'Test Chapter';
    document.getElementById('page').value = '42';
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
        document.getElementById('title').value = item.title || '';
        document.getElementById('description').value = item.description || '';
        document.getElementById('content').value = item.content || '';
        document.getElementById('yearInput').value = item.year || '';
        document.getElementById('subtickInput').value = item.subtick || '';
        document.getElementById('endYearInput').value = item.end_year || item.year || '';
        document.getElementById('endSubtickInput').value = item.end_subtick || item.subtick || '';
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