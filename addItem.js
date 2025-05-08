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
document.getElementById('story').addEventListener('input', function(e) {
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
        document.getElementById('storySuggestions').style.display = 'none';
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

// Handle form submission
document.getElementById('addItemForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const formData = {
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
        story: document.getElementById('story').value,
        'story-id': document.getElementById('storyId').value,
        year: new URLSearchParams(window.location.search).get('year'),
        subtick: new URLSearchParams(window.location.search).get('subtick')
    };

    // Send data through IPC
    window.api.send('addTimelineItem', formData);
    
    // Notify that we're closing
    window.api.send('add-item-window-closing');
    
    // Close the window
    window.close();
});

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
    document.getElementById('story').value = randomText(2);
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