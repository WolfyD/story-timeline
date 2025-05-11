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
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                addImagePreview(e.target.result);
            }
            reader.readAsDataURL(file);
        }
    };
    input.click();
});

function addImagePreview(dataUrl) {
    const container = document.querySelector('.image-upload-container');
    const preview = document.createElement('div');
    preview.className = 'image-preview';
    preview.innerHTML = `
        <img src="${dataUrl}">
        <button class="remove-image" onclick="removeImage(this, '${dataUrl}')">&times;</button>
    `;
    container.insertBefore(preview, document.getElementById('addImageBtn'));
    images.push(dataUrl);
}

function removeImage(button, dataUrl) {
    button.parentElement.remove();
    const index = images.indexOf(dataUrl);
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
        pictures: images.map((dataUrl, index) => ({
            picture: dataUrl,
            title: `Image ${index + 1}`,
            description: ''
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