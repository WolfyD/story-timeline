/**
 * Add Character Window JavaScript
 * 
 * Handles character creation form functionality including:
 * - Form validation and submission
 * - Alias management
 * - Image handling
 * - IPC communication with main process
 */

let timelineId = null;
let aliases = [];
let images = [];

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeForm();
    setupEventListeners();
});

// Listen for timeline ID from main process
window.api.receive('timeline-id', (id) => {
    timelineId = id;
    console.log('[addCharacter.js] Received timeline ID:', timelineId);
});

/**
 * Initialize the form with default values and setup
 */
function initializeForm() {
    // Set default importance value display
    updateImportanceDisplay();
    
    // Generate random color
    document.getElementById('color').value = generateRandomColor();
    
    console.log('[addCharacter.js] Form initialized');
}

/**
 * Set up all event listeners
 */
function setupEventListeners() {
    // Form submission
    document.getElementById('character-form').addEventListener('submit', handleFormSubmit);
    
    // Importance slider
    document.getElementById('importance').addEventListener('input', updateImportanceDisplay);
    
    // Aliases input
    const aliasesInput = document.getElementById('aliases-input');
    aliasesInput.addEventListener('keypress', handleAliasInput);
    
    // Add image button
    document.getElementById('addImageBtn').addEventListener('click', showImageOptions);
    
    console.log('[addCharacter.js] Event listeners set up');
}

/**
 * Update the importance value display
 */
function updateImportanceDisplay() {
    const slider = document.getElementById('importance');
    const display = document.getElementById('importance-value');
    display.textContent = slider.value;
}

/**
 * Handle alias input (add on Enter key)
 */
function handleAliasInput(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        const input = event.target;
        const alias = input.value.trim();
        
        if (alias && !aliases.includes(alias)) {
            aliases.push(alias);
            input.value = '';
            updateAliasesDisplay();
        }
    }
}

/**
 * Update the aliases display
 */
function updateAliasesDisplay() {
    const container = document.getElementById('aliases-container');
    container.innerHTML = '';
    
    aliases.forEach((alias, index) => {
        const tag = document.createElement('div');
        tag.className = 'alias-tag';
        tag.innerHTML = `
            ${alias}
            <span class="alias-remove" onclick="removeAlias(${index})">&times;</span>
        `;
        container.appendChild(tag);
    });
}

/**
 * Remove an alias
 */
function removeAlias(index) {
    aliases.splice(index, 1);
    updateAliasesDisplay();
}

// ===== IMAGE HANDLING FUNCTIONS =====

/**
 * Show image options modal
 */
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

/**
 * Select new image file
 */
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
                alert('Error preparing image for upload. Please try again.');
            }
        }
    };
    input.click();
}

/**
 * Select existing image from library
 */
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

/**
 * Add image preview to the container
 */
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

/**
 * Close image options modal
 */
function closeImageOptions() {
    const modal = document.getElementById('imageOptionsModal');
    if (modal) {
        modal.remove();
    }
}

/**
 * Remove image from preview and array
 */
function removeImage(button, imageId) {
    const index = images.findIndex(img => img.id === imageId);
    
    if (index > -1) {
        images.splice(index, 1);
    }
    
    button.parentElement.remove();
}

/**
 * Toggle image description editor
 */
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

/**
 * Update image description in memory
 */
function updateImageDescription(imageId, description) {
    const imageIndex = images.findIndex(img => (img.id || img.temp_id) == imageId);
    if (imageIndex > -1) {
        images[imageIndex].description = description;
    }
}

/**
 * Save image description
 */
function saveImageDescription(button, imageId) {
    const preview = button.closest('.image-preview');
    const editor = preview.querySelector('.image-description-editor');
    const textarea = editor.querySelector('textarea');
    const descriptionIcon = preview.querySelector('.image-description-icon');
    
    // Update the description
    updateImageDescription(imageId, textarea.value);
    
    // Update icon state
    if (textarea.value.trim()) {
        descriptionIcon.classList.add('has-description');
        descriptionIcon.title = 'Edit description';
    } else {
        descriptionIcon.classList.remove('has-description');
        descriptionIcon.title = 'Add description';
    }
    
    // Hide editor
    editor.classList.remove('visible');
}

/**
 * Cancel image description editing
 */
function cancelImageDescription(button) {
    const editor = button.closest('.image-description-editor');
    editor.classList.remove('visible');
}

/**
 * Handle form submission
 */
async function handleFormSubmit(event) {
    event.preventDefault();
    
    if (!timelineId) {
        alert('Error: Timeline ID not available. Please try again.');
        return;
    }
    
    try {
        // Collect form data
        const formData = collectFormData();
        
        // Validate required fields
        if (!validateFormData(formData)) {
            return;
        }
        
        // Show loading state
        const submitButton = document.querySelector('.btn-primary');
        const originalText = submitButton.textContent;
        submitButton.textContent = 'Creating Character...';
        submitButton.disabled = true;
        
        // Submit character data
        const result = await window.api.invoke('add-character', formData);
        
        if (result.success) {
            console.log('[addCharacter.js] Character created successfully:', result.character);
            
            // Show success message
            alert('Character created successfully!');
            
            // Close window
            window.close();
        } else {
            console.error('[addCharacter.js] Error creating character:', result.error);
            alert('Error creating character: ' + result.error);
        }
        
    } catch (error) {
        console.error('[addCharacter.js] Error submitting form:', error);
        alert('Error creating character: ' + error.message);
    } finally {
        // Reset button state
        const submitButton = document.querySelector('.btn-primary');
        submitButton.textContent = 'Create Character';
        submitButton.disabled = false;
    }
}

/**
 * Collect all form data
 */
function collectFormData() {
    const form = document.getElementById('character-form');
    const formData = new FormData(form);
    
    // Convert FormData to object
    const data = {};
    for (let [key, value] of formData.entries()) {
        data[key] = value;
    }
    
    // Add timeline ID
    data.timeline_id = timelineId;
    
    // Add aliases array
    data.aliases = aliases.join(',');
    
    // Add images array
    data.images = images;
    
    // Convert numeric fields
    if (data.birth_year) data.birth_year = parseInt(data.birth_year);
    if (data.birth_subtick) data.birth_subtick = parseInt(data.birth_subtick);
    if (data.death_year) data.death_year = parseInt(data.death_year);
    if (data.death_subtick) data.death_subtick = parseInt(data.death_subtick);
    data.importance = parseInt(data.importance);
    
    // Handle empty values
    Object.keys(data).forEach(key => {
        if (data[key] === '') {
            data[key] = null;
        }
    });
    
    console.log('[addCharacter.js] Collected form data:', data);
    return data;
}

/**
 * Validate form data
 */
function validateFormData(data) {
    // Check required fields
    if (!data.name || data.name.trim() === '') {
        alert('Please enter a character name.');
        document.getElementById('name').focus();
        return false;
    }
    
    // Validate year ranges if provided
    if (data.birth_year && (data.birth_year < -99999999 || data.birth_year > 99999999)) {
        alert('Birth year must be between -99,999,999 and 99,999,999.');
        document.getElementById('birth_year').focus();
        return false;
    }
    
    if (data.death_year && (data.death_year < -99999999 || data.death_year > 99999999)) {
        alert('Death year must be between -99,999,999 and 99,999,999.');
        document.getElementById('death_year').focus();
        return false;
    }
    
    // Validate subtick ranges
    if (data.birth_subtick && (data.birth_subtick < 0 || data.birth_subtick > 30)) {
        alert('Birth subtick must be between 0 and 30.');
        document.getElementById('birth_subtick').focus();
        return false;
    }
    
    if (data.death_subtick && (data.death_subtick < 0 || data.death_subtick > 30)) {
        alert('Death subtick must be between 0 and 30.');
        document.getElementById('death_subtick').focus();
        return false;
    }
    
    // Validate death after birth
    if (data.birth_year && data.death_year) {
        const birthTime = data.birth_year + (data.birth_subtick || 0) / 100;
        const deathTime = data.death_year + (data.death_subtick || 0) / 100;
        
        if (deathTime <= birthTime) {
            alert('Death date must be after birth date.');
            document.getElementById('death_year').focus();
            return false;
        }
    }
    
    return true;
}

/**
 * Generate a random color for the character
 */
function generateRandomColor() {
    const colors = [
        '#a67c52', '#8B4513', '#CD853F', '#D2691E', '#B8860B',
        '#556B2F', '#6B8E23', '#808000', '#2F4F4F', '#483D8B',
        '#8B008B', '#9932CC', '#8B0000', '#DC143C', '#B22222'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Handle window close events
 */
window.addEventListener('beforeunload', function() {
    console.log('[addCharacter.js] Window closing');
}); 