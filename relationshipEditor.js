/**
 * Relationship Editor Window Module
 * 
 * This module handles the creation and editing of relationships between characters.
 * It provides functionality for:
 * - Creating new relationships
 * - Editing existing relationships
 * - Auto-detecting bidirectional relationships
 * - Custom relationship types
 * - Duplicate relationship checking
 * - Character color integration
 */

let relationshipData = null;
let character1Data = null;
let character2Data = null;
let isEditMode = false;
let existingRelationships = [];

// Define which relationship types are bidirectional by nature
const BIDIRECTIONAL_TYPES = [
    'sibling', 'spouse', 'partner', 'ex-spouse', 'ex-partner', 'cousin',
    'step-sibling', 'half-sibling', 'adoptive-sibling', 'foster-sibling',
    'best-friend', 'friend', 'ally', 'enemy', 'rival', 'acquaintance', 
    'colleague', 'neighbor', 'familiar', 'bonded', 'clan-member', 'pack-member'
];

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeRelationshipEditor();
    setupEventListeners();
});

/**
 * Initialize the relationship editor with data from main process
 */
async function initializeRelationshipEditor() {
    try {
        // Get relationship data from main process
        relationshipData = await window.api.invoke('get-relationship-editor-data');
        
        if (!relationshipData) {
            console.error('[relationshipEditor.js] No relationship data received');
            return;
        }

        console.log('[relationshipEditor.js] Received relationship data:', relationshipData);

        // Extract character data
        character1Data = relationshipData.character1;
        character2Data = relationshipData.character2;
        isEditMode = relationshipData.isEdit || false;

        // Get existing relationships for duplicate checking
        await loadExistingRelationships();

        // Setup the UI
        setupCharacterDisplay();
        
        if (isEditMode && relationshipData.relationship) {
            populateFormForEdit(relationshipData.relationship);
        }

    } catch (error) {
        console.error('[relationshipEditor.js] Error initializing relationship editor:', error);
    }
}

/**
 * Load existing relationships between the two characters for duplicate checking
 */
async function loadExistingRelationships() {
    try {
        const result = await window.api.invoke('get-character-relationships-between', {
            character1Id: character1Data.id,
            character2Id: character2Data.id,
            timelineId: relationshipData.timelineId
        });

        existingRelationships = result.relationships || [];
        console.log('[relationshipEditor.js] Loaded existing relationships:', existingRelationships);

    } catch (error) {
        console.error('[relationshipEditor.js] Error loading existing relationships:', error);
        existingRelationships = [];
    }
}

/**
 * Setup character display in the header
 */
function setupCharacterDisplay() {
    const character1Name = document.getElementById('character1-name');
    const character2Name = document.getElementById('character2-name');
    const relationshipArrow = document.getElementById('relationship-arrow');

    // Set character names
    character1Name.textContent = character1Data.name || 'Character 1';
    character2Name.textContent = character2Data.name || 'Character 2';

    // Apply character 1's color as accent color (with fallback to deep forest green)
    const character1Color = character1Data.color || '#2d5016'; // deep forest green fallback
    
    // Apply the color to various elements
    document.documentElement.style.setProperty('--character-accent-color', character1Color);
    
    // Update character name styling with the color
    character1Name.style.borderColor = character1Color;
    character1Name.style.backgroundColor = character1Color + '20'; // 20% opacity
}

/**
 * Setup event listeners for the form
 */
function setupEventListeners() {
    // Close button
    document.getElementById('relationship-close').addEventListener('click', closeWindow);

    // Cancel button
    document.getElementById('cancel-button').addEventListener('click', closeWindow);

    // Form submission
    document.getElementById('relationship-form').addEventListener('submit', handleFormSubmit);

    // Relationship type change
    document.getElementById('relationship-type').addEventListener('change', handleRelationshipTypeChange);

    // Bidirectional checkbox change
    document.getElementById('bidirectional').addEventListener('change', handleBidirectionalChange);

    // Strength slider
    const strengthSlider = document.getElementById('relationship-strength');
    const strengthValue = document.getElementById('strength-value');
    
    strengthSlider.addEventListener('input', function() {
        strengthValue.textContent = this.value;
    });

    // Custom relationship type input
    document.getElementById('custom-relationship-type').addEventListener('input', validateCustomType);
}

/**
 * Handle relationship type selection change
 */
function handleRelationshipTypeChange() {
    const relationshipType = document.getElementById('relationship-type').value;
    const customInput = document.getElementById('custom-relationship-type');
    const bidirectionalCheckbox = document.getElementById('bidirectional');

    // Show/hide custom input
    if (relationshipType === 'custom' || relationshipType === 'other') {
        customInput.style.display = 'block';
        customInput.classList.add('show');
        customInput.required = true;
        customInput.focus();
    } else {
        customInput.style.display = 'none';
        customInput.classList.remove('show');
        customInput.required = false;
        customInput.value = '';
    }

    // Auto-check/uncheck bidirectional based on relationship type
    if (BIDIRECTIONAL_TYPES.includes(relationshipType)) {
        bidirectionalCheckbox.checked = true;
        handleBidirectionalChange();
    } else if (relationshipType && relationshipType !== 'custom' && relationshipType !== 'other') {
        // Only auto-uncheck for known non-bidirectional types, not for custom/other
        bidirectionalCheckbox.checked = false;
        handleBidirectionalChange();
    }

    // Clear any existing warnings when type changes
    hideWarningMessage();
}

/**
 * Handle bidirectional checkbox change
 */
function handleBidirectionalChange() {
    const bidirectional = document.getElementById('bidirectional').checked;
    const relationshipArrow = document.getElementById('relationship-arrow');

    if (bidirectional) {
        relationshipArrow.textContent = '↔';
        relationshipArrow.classList.add('bidirectional');
    } else {
        relationshipArrow.textContent = '→';
        relationshipArrow.classList.remove('bidirectional');
    }
}

/**
 * Validate custom relationship type input
 */
function validateCustomType() {
    const customInput = document.getElementById('custom-relationship-type');
    const value = customInput.value.trim();

    // Basic validation - no empty strings, reasonable length
    if (value.length > 50) {
        customInput.setCustomValidity('Custom relationship type must be 50 characters or less');
    } else if (value.length > 0 && value.length < 2) {
        customInput.setCustomValidity('Custom relationship type must be at least 2 characters');
    } else {
        customInput.setCustomValidity('');
    }
}

/**
 * Populate form for editing existing relationship
 */
function populateFormForEdit(relationship) {
    document.getElementById('relationship-type').value = relationship.relationship_type || '';
    document.getElementById('custom-relationship-type').value = relationship.custom_relationship_type || '';
    document.getElementById('bidirectional').checked = relationship.is_bidirectional || false;
    document.getElementById('relationship-degree').value = relationship.relationship_degree || '';
    document.getElementById('relationship-modifier').value = relationship.relationship_modifier || '';
    document.getElementById('relationship-strength').value = relationship.relationship_strength || 50;
    document.getElementById('strength-value').textContent = relationship.relationship_strength || 50;
    document.getElementById('relationship-notes').value = relationship.notes || '';

    // Trigger change events to update UI
    handleRelationshipTypeChange();
    handleBidirectionalChange();

    // Update save button text
    document.getElementById('save-button').textContent = 'Update Relationship';
}

/**
 * Handle form submission
 */
async function handleFormSubmit(event) {
    event.preventDefault();

    const saveButton = document.getElementById('save-button');
    saveButton.disabled = true;
    saveButton.textContent = 'Saving...';

    try {
        // Collect form data
        const formData = collectFormData();

        // Validate form data
        if (!validateFormData(formData)) {
            return;
        }

        // Check for duplicates (only for new relationships)
        if (!isEditMode) {
            const duplicateCheck = await checkForDuplicates(formData);
            if (duplicateCheck.hasDuplicate && !duplicateCheck.userConfirmed) {
                return;
            }
        }

        // Save the relationship
        const result = await saveRelationship(formData);

        if (result.success) {
            // Notify character manager to refresh
            await window.api.invoke('refresh-character-manager');
            
            // Close the window
            closeWindow();
        } else {
            throw new Error(result.error || 'Failed to save relationship');
        }

    } catch (error) {
        console.error('[relationshipEditor.js] Error saving relationship:', error);
        alert('Error saving relationship: ' + error.message);
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = isEditMode ? 'Update Relationship' : 'Save Relationship';
    }
}

/**
 * Collect form data
 */
function collectFormData() {
    const relationshipType = document.getElementById('relationship-type').value;
    const customType = document.getElementById('custom-relationship-type').value.trim();

    return {
        character_1_id: character1Data.id,
        character_2_id: character2Data.id,
        relationship_type: relationshipType,
        custom_relationship_type: (relationshipType === 'custom' || relationshipType === 'other') ? customType : null,
        relationship_degree: document.getElementById('relationship-degree').value || null,
        relationship_modifier: document.getElementById('relationship-modifier').value || null,
        relationship_strength: parseInt(document.getElementById('relationship-strength').value) || 50,
        is_bidirectional: document.getElementById('bidirectional').checked,
        notes: document.getElementById('relationship-notes').value.trim() || null,
        timeline_id: relationshipData.timelineId
    };
}

/**
 * Validate form data
 */
function validateFormData(formData) {
    // Check required fields
    if (!formData.relationship_type) {
        alert('Please select a relationship type.');
        document.getElementById('relationship-type').focus();
        return false;
    }

    // Check custom type if needed
    if ((formData.relationship_type === 'custom' || formData.relationship_type === 'other') && !formData.custom_relationship_type) {
        alert('Please enter a custom relationship type.');
        document.getElementById('custom-relationship-type').focus();
        return false;
    }

    return true;
}

/**
 * Check for duplicate relationships
 */
async function checkForDuplicates(formData) {
    const duplicates = existingRelationships.filter(rel => {
        // Check if same relationship type exists in same direction
        const sameType = rel.relationship_type === formData.relationship_type;
        const sameCustomType = rel.custom_relationship_type === formData.custom_relationship_type;
        const sameDirection = (rel.character_1_id === formData.character_1_id && rel.character_2_id === formData.character_2_id);
        
        return sameType && sameCustomType && sameDirection;
    });

    if (duplicates.length > 0) {
        const relationshipTypeDisplay = formData.custom_relationship_type || formData.relationship_type.replace('-', ' ');
        
        const confirmed = confirm(
            `A "${relationshipTypeDisplay}" relationship already exists between ${character1Data.name} and ${character2Data.name} in this direction.\n\n` +
            'Do you want to create another relationship of the same type?'
        );

        return {
            hasDuplicate: true,
            userConfirmed: confirmed
        };
    }

    return {
        hasDuplicate: false,
        userConfirmed: true
    };
}

/**
 * Save the relationship
 */
async function saveRelationship(formData) {
    try {
        if (isEditMode) {
            // Update existing relationship
            return await window.api.invoke('update-character-relationship', {
                id: relationshipData.relationship.id,
                relationship: formData
            });
        } else {
            // Create new relationship
            return await window.api.invoke('create-character-relationship', formData);
        }
    } catch (error) {
        console.error('[relationshipEditor.js] Error in saveRelationship:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Show warning message
 */
function showWarningMessage(message) {
    let warningDiv = document.querySelector('.warning-message');
    
    if (!warningDiv) {
        warningDiv = document.createElement('div');
        warningDiv.className = 'warning-message';
        document.querySelector('.form-section').insertBefore(warningDiv, document.querySelector('.form-section').firstChild);
    }
    
    warningDiv.innerHTML = `<strong>Warning:</strong> ${message}`;
    warningDiv.classList.add('show');
}

/**
 * Hide warning message
 */
function hideWarningMessage() {
    const warningDiv = document.querySelector('.warning-message');
    if (warningDiv) {
        warningDiv.classList.remove('show');
    }
}

/**
 * Close the window
 */
function closeWindow() {
    window.close();
}

// Listen for character updates to refresh the character manager
window.api.receive('character-created', () => {
    console.log('[relationshipEditor.js] Character created, refreshing character manager');
    window.api.invoke('refresh-character-manager');
});

window.api.receive('character-updated', () => {
    console.log('[relationshipEditor.js] Character updated, refreshing character manager');
    window.api.invoke('refresh-character-manager');
}); 