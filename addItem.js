const tags = new Set();
const images = [];
let storySuggestions = [];

// Get story suggestions from main window
window.api.send('getStorySuggestions');

// Handle story suggestions response
window.api.receive('storySuggestions', (suggestions) => {
    storySuggestions = suggestions;
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
        <button class="remove-image" onclick="this.parentElement.remove()">&times;</button>
    `;
    container.insertBefore(preview, document.getElementById('addImageBtn'));
    images.push(dataUrl);
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
            // Fill in the form with item data
            document.getElementById('title').value = item.title || '';
            document.getElementById('description').value = item.description || '';
            document.getElementById('content').value = item.content || '';
            document.getElementById('bookTitle').value = item.book_title || '';
            document.getElementById('chapter').value = item.chapter || '';
            document.getElementById('page').value = item.page || '';
            document.getElementById('yearInput').value = item.year || '';
            document.getElementById('subtickInput').value = item.subtick || '';

            // Set tags
            if (item.tags) {
                item.tags.forEach(tag => {
                    tags.add(tag);
                });
                updateTagDisplay();
            }

            // Set images
            if (item.pictures) {
                item.pictures.forEach(pic => {
                    addImagePreview(pic.picture);
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
                    id: editItemId, // Keep the same ID
                    title: document.getElementById('title').value,
                    description: document.getElementById('description').value,
                    content: document.getElementById('content').value,
                    tags: Array.from(tags),
                    pictures: images.map((dataUrl, index) => ({
                        picture: dataUrl,
                        title: `Image ${index + 1}`,
                        description: ''
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
        // Get form data
        const formData = {
            title: document.getElementById('title').value,
            description: document.getElementById('description').value,
            content: document.getElementById('content').value,
            tags: Array.from(document.querySelectorAll('.tag-item')).map(tag => tag.textContent),
            images: images.map((dataUrl, index) => ({
                picture: dataUrl,
                title: `Image ${index + 1}`,
                description: ''
            })),
            bookTitle: document.getElementById('bookTitle').value,
            chapter: document.getElementById('chapter').value,
            page: document.getElementById('page').value,
            year: document.getElementById('yearInput').value,
            subtick: document.getElementById('subtickInput').value,
            story_refs: collectStoryRefs(),
            story: '',
            'story-id': ''
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
    addImagePreview(sampleImage);
}); 

window.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const year = urlParams.get('year');
    const subtick = urlParams.get('subtick');
    let granularity = urlParams.get('granularity');
    
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
    // Update header display
    document.getElementById('header-year-value').textContent = `${year}`;
    document.getElementById('header-subtick-value').textContent = `${subtick}`;
});
