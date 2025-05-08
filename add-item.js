/**
 * Add Item Module
 * Handles the creation and editing of timeline items.
 */

// ===== DOM Elements =====
const titleInput = document.getElementById('title');
const yearInput = document.getElementById('year');
const subtickInput = document.getElementById('subtick');
const descriptionInput = document.getElementById('description');
const contentInput = document.getElementById('content');
const tagsInput = document.getElementById('tags');
const bookTitleInput = document.getElementById('book_title');
const chapterInput = document.getElementById('chapter');
const pageInput = document.getElementById('page');
const storyInput = document.getElementById('story');
const storyIdInput = document.getElementById('story-id');
const picturesInput = document.getElementById('pictures');
const picturesContainer = document.getElementById('pictures-container');
const saveButton = document.getElementById('save-button');
const cancelButton = document.getElementById('cancel-button');

// ===== State Management =====
/**
 * Current item state
 * @type {Object} currentItem - The item being edited
 * @type {number} year - Year position
 * @type {number} subtick - Subtick position
 * @type {Array} pictures - List of picture objects
 */
let currentItem = null;
let year = 0;
let subtick = 0;
let pictures = [];

// ===== Public API =====
window.setItem = setItem;
window.setPosition = setPosition;

// ===== Core Functions =====
/**
 * Sets the item to edit
 * @param {Object} item - Item to edit
 * 
 * How it works:
 * 1. Updates current item state
 * 2. Populates form fields
 * 3. Loads pictures
 * 
 * Possible errors:
 * - Invalid item
 * - DOM element not found
 * - Picture loading failure
 */
function setItem(item) {
    // ... existing code ...
}

/**
 * Sets the position for a new item
 * @param {number} _year - Year position
 * @param {number} _subtick - Subtick position
 * 
 * How it works:
 * 1. Updates position state
 * 2. Updates form fields
 * 
 * Possible errors:
 * - Invalid year/subtick
 * - DOM element not found
 */
function setPosition(_year, _subtick) {
    // ... existing code ...
}

/**
 * Saves the current item
 * 
 * How it works:
 * 1. Collects form data
 * 2. Validates required fields
 * 3. Sends to main process
 * 4. Closes window
 * 
 * Possible errors:
 * - Invalid form data
 * - IPC communication failure
 * - Window close failure
 */
function saveItem() {
    // ... existing code ...
}

/**
 * Cancels item editing
 * 
 * How it works:
 * - Closes the window
 * 
 * Possible errors:
 * - Window close failure
 */
function cancelEdit() {
    // ... existing code ...
}

/**
 * Handles picture file selection
 * @param {Event} event - File input change event
 * 
 * How it works:
 * 1. Reads selected files
 * 2. Converts to base64
 * 3. Updates pictures state
 * 4. Renders previews
 * 
 * Possible errors:
 * - File read failure
 * - Invalid file type
 * - DOM manipulation failure
 */
function handlePictureSelect(event) {
    // ... existing code ...
}

/**
 * Renders picture previews
 * 
 * How it works:
 * 1. Clears container
 * 2. Creates preview elements
 * 3. Adds remove handlers
 * 
 * Possible errors:
 * - DOM manipulation failure
 * - Invalid picture data
 */
function renderPictures() {
    // ... existing code ...
}

/**
 * Removes a picture
 * @param {number} index - Index of picture to remove
 * 
 * How it works:
 * 1. Removes from pictures array
 * 2. Re-renders previews
 * 
 * Possible errors:
 * - Invalid index
 * - Render failure
 */
function removePicture(index) {
    // ... existing code ...
}

/**
 * Handles story input changes
 * @param {Event} event - Input change event
 * 
 * How it works:
 * 1. Gets current value
 * 2. Searches for matching stories
 * 3. Updates story ID if found
 * 
 * Possible errors:
 * - Invalid event
 * - Story search failure
 */
function handleStoryInput(event) {
    // ... existing code ...
}

// ===== Event Handlers =====
saveButton.addEventListener('click', saveItem);
cancelButton.addEventListener('click', cancelEdit);
picturesInput.addEventListener('change', handlePictureSelect);
storyInput.addEventListener('input', handleStoryInput);

// ===== IPC Event Handlers =====
/**
 * Story search results handler
 * @param {Array} stories - Matching stories
 * 
 * How it works:
 * - Updates story ID if match found
 * 
 * Possible errors:
 * - Invalid stories array
 */
window.api.receive('story-search-results', (stories) => {
    // ... existing code ...
});

// ===== Initialization =====
document.addEventListener('DOMContentLoaded', () => {
    // ... existing code ...
}); 