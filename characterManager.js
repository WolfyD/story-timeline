/**
 * Character Manager Window JavaScript
 * 
 * Handles character management functionality including:
 * - Loading and displaying all characters
 * - Search and filtering
 * - Character editing and deletion
 * - Character selection and relationship display
 * - Drag and drop for character pairing
 * - Statistics display
 * - IPC communication with main process
 */

let timelineId = null;
let allCharacters = [];
let filteredCharacters = [];
let selectedCharacters = []; // Array to store selected character IDs (max 2)
let allRelationships = []; // Store all relationships in the timeline

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
});

// Listen for timeline ID from main process
window.api.receive('timeline-id', (id) => {
    timelineId = id;
    console.log('[characterManager.js] Received timeline ID:', timelineId);
    loadCharacters();
});

// Listen for refresh requests
window.api.receive('refresh-data', () => {
    console.log('[characterManager.js] Received refresh request');
    loadCharacters();
    updateRelationshipDisplay();
});

/**
 * Set up all event listeners
 */
function setupEventListeners() {
    // Search input
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', handleSearch);
    
    console.log('[characterManager.js] Event listeners set up');
}

/**
 * Load all characters for the current timeline
 */
async function loadCharacters() {
    if (!timelineId) {
        console.error('[characterManager.js] No timeline ID available');
        return;
    }
    
    try {
        console.log('[characterManager.js] Loading characters for timeline:', timelineId);
        
        // Get all characters for this timeline
        const result = await window.api.invoke('get-all-characters', timelineId);
        
        if (result.success) {
            allCharacters = result.characters || [];
            filteredCharacters = [...allCharacters];
            
            console.log('[characterManager.js] Loaded characters:', allCharacters);
            
            // Also load all relationships for this timeline
            const relationshipsResult = await window.api.invoke('get-all-character-relationships', timelineId);
            if (relationshipsResult.success) {
                allRelationships = relationshipsResult.relationships || [];
                console.log('[characterManager.js] Loaded relationships:', allRelationships);
            } else {
                console.error('[characterManager.js] Error loading relationships:', relationshipsResult.error);
                allRelationships = [];
            }
            
            // Hide loading, show content
            document.getElementById('loading').style.display = 'none';
            document.getElementById('character-content').style.display = 'block';
            
            // Update display
            updateStatistics();
            displayCharacters();
        } else {
            console.error('[characterManager.js] Error loading characters:', result.error);
            showError('Error loading characters: ' + result.error);
        }
        
    } catch (error) {
        console.error('[characterManager.js] Error loading characters:', error);
        showError('Error loading characters: ' + error.message);
    }
}

/**
 * Update character statistics
 */
function updateStatistics() {
    const totalCharacters = allCharacters.length;
    const livingCharacters = allCharacters.filter(char => !char.death_year).length;
    const deceasedCharacters = allCharacters.filter(char => char.death_year).length;
    
    document.getElementById('total-characters').textContent = totalCharacters;
}

/**
 * Display characters in the grid
 */
function displayCharacters() {
    const grid = document.getElementById('characters-grid');
    const noCharacters = document.getElementById('no-characters');
    
    if (filteredCharacters.length === 0) {
        grid.style.display = 'none';
        noCharacters.style.display = 'block';
        return;
    }
    
    grid.style.display = 'grid';
    noCharacters.style.display = 'none';
    
    grid.innerHTML = '';
    
    filteredCharacters.forEach(character => {
        const card = createCharacterCard(character);
        grid.appendChild(card);
    });
    
    // Update highlighting after displaying characters
    updateCharacterHighlighting();
}

/**
 * Create a character card element
 */
function createCharacterCard(character) {
    const card = document.createElement('div');
    card.className = 'character-card';
    card.dataset.characterId = character.id;
    
    // Check if this character is selected
    const isSelected = selectedCharacters.includes(character.id);
    if (isSelected) {
        card.classList.add('selected');
    }
    
    // Get character image
    const imagePath = character.images && character.images.length > 0 
        ? character.images[0].file_path 
        : '../img/noimg.png';
    
    // Parse aliases for additional info
    const aliases = character.aliases ? character.aliases.split(',').filter(a => a.trim()) : [];
    const race = character.race || '';
    
    // Get connection count for this character
    const connectionCount = getCharacterConnectionCount(character.id);
    
    card.innerHTML = `
        <div class="card-header" data-character-id="${character.id}" draggable="true">
            <div class="character-name">${character.name || 'Unnamed Character'}</div>
            <input type="checkbox" class="character-checkbox" data-character-id="${character.id}" ${isSelected ? 'checked' : ''}>
        </div>
        
        <div class="card-body" onclick="selectCharacter('${character.id}')">
            <div class="character-image">
                <img src="${imagePath}" alt="${character.name}" onerror="this.src='../img/noimg.png'">
            </div>
            
            <div class="character-info">
                ${race ? `<div class="character-race">${race}</div>` : ''}
                ${aliases.length > 0 ? `<div class="character-aliases">${aliases.slice(0, 2).join(', ')}</div>` : ''}
                ${character.description ? `<div class="character-description">${character.description}</div>` : ''}
                <div class="character-importance">★ ${character.importance || 5}</div>
            </div>
        </div>
        
        <div class="card-actions">
            <button class="action-btn edit-btn" onclick="editCharacter('${character.id}')" title="Edit Character">
                <i class="ri-edit-line"></i>
            </button>
            <button class="action-btn delete-btn" onclick="deleteCharacter('${character.id}', '${character.name}')" title="Delete Character">
                <i class="ri-delete-bin-line"></i>
            </button>
        </div>
        
        ${connectionCount > 0 ? `<div class="connection-count" title="${connectionCount} relationship${connectionCount !== 1 ? 's' : ''}">${connectionCount}</div>` : ''}
    `;
    
    // Add drag event listeners only to the header
    const cardHeader = card.querySelector('.card-header');
    cardHeader.addEventListener('dragstart', handleDragStart);
    cardHeader.addEventListener('dragend', handleDragEnd);
    
    // Add drop event listeners to the entire card
    card.addEventListener('dragover', handleDragOver);
    card.addEventListener('drop', handleDrop);
    card.addEventListener('dragenter', handleDragEnter);
    card.addEventListener('dragleave', handleDragLeave);
    
    return card;
}

/**
 * Handle character selection
 */
function selectCharacter(characterId) {
    const character = allCharacters.find(char => char.id === characterId);
    if (!character) return;
    
    const isCurrentlySelected = selectedCharacters.includes(characterId);
    
    if (isCurrentlySelected) {
        // Deselect character
        selectedCharacters = selectedCharacters.filter(id => id !== characterId);
    } else {
        // Select character
        if (selectedCharacters.length >= 2) {
            // Replace selection if already 2 selected
            selectedCharacters = [characterId];
        } else {
            selectedCharacters.push(characterId);
        }
    }
    
    updateCharacterSelection();
    updateCharacterHighlighting();
    updateRelationshipDisplay();
}

/**
 * Update visual selection state of characters
 */
function updateCharacterSelection() {
    // Update all character cards
    document.querySelectorAll('.character-card').forEach(card => {
        const characterId = card.dataset.characterId;
        const checkbox = card.querySelector('.character-checkbox');
        const isSelected = selectedCharacters.includes(characterId);
        
        if (isSelected) {
            card.classList.add('selected');
            checkbox.checked = true;
        } else {
            card.classList.remove('selected');
            checkbox.checked = false;
        }
    });
}

/**
 * Update the relationship display area
 */
async function updateRelationshipDisplay() {
    const relationshipDisplay = document.getElementById('relationship-display');
    const characterContainer = document.getElementById('character-manager-container');
    
    if (selectedCharacters.length !== 2) {
        relationshipDisplay.classList.add('hidden');
        characterContainer.classList.add('full-height');
        return;
    }
    
    relationshipDisplay.classList.remove('hidden');
    characterContainer.classList.remove('full-height');
    characterContainer.classList.add('short-height');

    
    // Update selected character names
    const char1 = allCharacters.find(c => c.id === selectedCharacters[0]);
    const char2 = allCharacters.find(c => c.id === selectedCharacters[1]);
    
    document.getElementById('selected-char-1').textContent = char1?.name || 'Unknown';
    document.getElementById('selected-char-2').textContent = char2?.name || 'Unknown';
    
    // Load and display relationships
    await loadRelationships();
}

/**
 * Load relationships between selected characters
 */
async function loadRelationships() {
    if (selectedCharacters.length !== 2) return;
    
    try {
        const result = await window.api.invoke('get-character-relationships-between', {
            character1Id: selectedCharacters[0],
            character2Id: selectedCharacters[1],
            timelineId: timelineId
        });
        
        if (result.success) {
            displayRelationships(result.relationships || []);
        } else {
            console.error('[characterManager.js] Error loading relationships:', result.error);
            displayRelationships([]);
        }
        
    } catch (error) {
        console.error('[characterManager.js] Error loading relationships:', error);
        displayRelationships([]);
    }
}

/**
 * Display relationships in the list
 */
function displayRelationships(relationships) {
    const relationshipsList = document.getElementById('relationships-list');
    const noRelationships = document.getElementById('no-relationships');
    
    if (relationships.length === 0) {
        relationshipsList.style.display = 'none';
        noRelationships.style.display = 'block';
        return;
    }
    
    relationshipsList.style.display = 'block';
    noRelationships.style.display = 'none';
    
    relationshipsList.innerHTML = '';
    
    relationships.forEach(relationship => {
        const relationshipItem = createRelationshipItem(relationship);
        relationshipsList.appendChild(relationshipItem);
    });
}

/**
 * Create a relationship item element
 */
function createRelationshipItem(relationship) {
    const item = document.createElement('div');
    item.className = 'relationship-item';
    
    // Get character names (note: using correct field names with underscores)
    const char1 = allCharacters.find(c => c.id === relationship.character_1_id);
    const char2 = allCharacters.find(c => c.id === relationship.character_2_id);
    
    // Display characters in selection order, but arrow shows semantic relationship direction
    let firstChar, secondChar, arrow;
    
    // Always display in selection order
    const firstSelectedId = selectedCharacters[0];
    const secondSelectedId = selectedCharacters[1];
    firstChar = allCharacters.find(c => c.id === firstSelectedId);
    secondChar = allCharacters.find(c => c.id === secondSelectedId);
    
    if (relationship.is_bidirectional) {
        // Bidirectional relationships always use double arrow
        arrow = '↔';
    } else {
        // For unidirectional relationships, determine arrow direction based on actual relationship
        // character_1_id is the source, character_2_id is the target in the database
        
        if (relationship.character_1_id === firstSelectedId) {
            // First selected is the source, so arrow goes forward: First → Second
            arrow = '→';
        } else {
            // First selected is the target, so arrow goes backward: First ← Second
            arrow = '←';
        }
    }
    
    // Handle relationship type display (custom types take precedence)
    let relationshipType = relationship.custom_relationship_type || relationship.relationship_type;
    if (relationshipType) {
        relationshipType = relationshipType.replace(/[-_]/g, ' ');
    } else {
        relationshipType = 'Unknown';
    }
    
    item.innerHTML = `
        <div class="relationship-info">
            <div class="relationship-characters">
                <span>${firstChar?.name || 'Unknown'}</span>
                <span class="relationship-arrow ${relationship.is_bidirectional ? 'bidirectional' : ''}">${arrow}</span>
                <span>${secondChar?.name || 'Unknown'}</span>
            </div>
            <div class="relationship-type">${relationshipType}</div>
            <div class="relationship-strength">Strength: ${relationship.relationship_strength || 50}/100</div>
            ${relationship.notes ? `<div class="relationship-notes">${relationship.notes}</div>` : ''}
        </div>
        <div class="relationship-actions">
            <button class="relationship-btn edit" onclick="editRelationship(${relationship.id})" title="Edit Relationship">
                <i class="ri-edit-line"></i>
            </button>
            <button class="relationship-btn delete" onclick="deleteRelationship(${relationship.id})" title="Delete Relationship">
                <i class="ri-delete-bin-line"></i>
            </button>
        </div>
    `;
    
    return item;
}

/**
 * Format character date for display
 */
function formatCharacterDate(year, subtick, dateText) {
    if (!year && !dateText) return null;
    
    let formatted = '';
    if (year) {
        formatted += year;
        if (subtick) {
            formatted += `.${subtick}`;
        }
    }
    
    if (dateText) {
        if (formatted) {
            formatted += ` (${dateText})`;
        } else {
            formatted = dateText;
        }
    }
    
    return formatted;
}

/**
 * Handle search input
 */
function handleSearch(event) {
    const query = event.target.value.toLowerCase().trim();
    
    if (!query) {
        filteredCharacters = [...allCharacters];
    } else {
        filteredCharacters = allCharacters.filter(character => {
            const searchableText = [
                character.name,
                character.nicknames,
                character.aliases,
                character.race,
                character.description,
                character.notes
            ].filter(text => text).join(' ').toLowerCase();
            
            return searchableText.includes(query);
        });
    }
    
    displayCharacters();
}

/**
 * Open add character window
 */
function openAddCharacterWindow() {
    if (timelineId) {
        window.api.send('open-add-character-window', timelineId);
    } else {
        showError('Timeline ID not available');
    }
}

/**
 * Edit a character
 */
async function editCharacter(characterId) {
    try {
        // Get the character data
        const result = await window.api.invoke('get-character', characterId);
        
        if (result.success && result.character) {
            // Open edit window with character data
            window.api.send('open-edit-character-window', result.character);
        } else {
            showError('Error loading character data: ' + (result.error || 'Character not found'));
        }
        
    } catch (error) {
        console.error('[characterManager.js] Error editing character:', error);
        showError('Error editing character: ' + error.message);
    }
}

/**
 * Delete a character
 */
async function deleteCharacter(characterId, characterName) {
    const confirmDelete = confirm(
        `Are you sure you want to delete the character "${characterName}"?\n\n` +
        'This action cannot be undone and will also remove any references to this character in timeline items.'
    );
    
    if (!confirmDelete) {
        return;
    }
    
    try {
        const result = await window.api.invoke('delete-character', characterId);
        
        if (result.success) {
            showSuccess(`Character "${characterName}" deleted successfully!`);
            
            // Remove from selected characters if selected
            selectedCharacters = selectedCharacters.filter(id => id !== characterId);
            
            // Reload characters
            await loadCharacters();
            updateRelationshipDisplay();
        } else {
            showError('Error deleting character: ' + result.error);
        }
        
    } catch (error) {
        console.error('[characterManager.js] Error deleting character:', error);
        showError('Error deleting character: ' + error.message);
    }
}

/**
 * Open relationship editor window
 */
function openRelationshipEditor() {
    if (selectedCharacters.length !== 2) {
        showError('Please select exactly two characters to create a relationship.');
        return;
    }
    
    // Get the character objects
    const character1 = allCharacters.find(c => c.id === selectedCharacters[0]);
    const character2 = allCharacters.find(c => c.id === selectedCharacters[1]);
    
    if (!character1 || !character2) {
        showError('Error: Could not find selected characters.');
        return;
    }
    
    const relationshipData = {
        character1: character1,
        character2: character2,
        timelineId: timelineId,
        isEdit: false
    };
    
    window.api.send('open-relationship-editor-window', relationshipData);
}

/**
 * Edit a relationship
 */
async function editRelationship(relationshipId) {
    try {
        const result = await window.api.invoke('get-character-relationship', relationshipId);
        
        if (result.success && result.relationship) {
            const relationship = result.relationship;
            
            // Get the character objects
            const character1 = allCharacters.find(c => c.id === relationship.character_1_id);
            const character2 = allCharacters.find(c => c.id === relationship.character_2_id);
            
            if (!character1 || !character2) {
                showError('Error: Could not find characters for this relationship.');
                return;
            }
            
            const relationshipData = {
                character1: character1,
                character2: character2,
                timelineId: timelineId,
                isEdit: true,
                relationship: relationship
            };
            
            window.api.send('open-relationship-editor-window', relationshipData);
        } else {
            showError('Error loading relationship data: ' + (result.error || 'Relationship not found'));
        }
        
    } catch (error) {
        console.error('[characterManager.js] Error editing relationship:', error);
        showError('Error editing relationship: ' + error.message);
    }
}

/**
 * Delete a relationship
 */
async function deleteRelationship(relationshipId) {
    const confirmDelete = confirm('Are you sure you want to delete this relationship?');
    
    if (!confirmDelete) {
        return;
    }
    
    try {
        const result = await window.api.invoke('delete-character-relationship', relationshipId);
        
        if (result.success) {
            showSuccess('Relationship deleted successfully!');
            await loadRelationships(); // Refresh the relationships display
        } else {
            showError('Error deleting relationship: ' + result.error);
        }
        
    } catch (error) {
        console.error('[characterManager.js] Error deleting relationship:', error);
        showError('Error deleting relationship: ' + error.message);
    }
}

/**
 * Show success message
 */
function showSuccess(message) {
    // Simple alert for now - could be enhanced with toast notifications
    alert(message);
}

/**
 * Show error message
 */
function showError(message) {
    // Simple alert for now - could be enhanced with toast notifications
    alert('Error: ' + message);
}

/**
 * Handle drag start
 */
function handleDragStart(e) {
    // Get character ID from the header element
    const characterId = e.target.dataset.characterId || e.target.closest('.card-header').dataset.characterId;
    e.dataTransfer.setData('text/plain', characterId);
    
    // Add dragging class to the parent card
    const card = e.target.closest('.character-card');
    if (card) {
        card.classList.add('dragging');
    }
}

/**
 * Handle drag end
 */
function handleDragEnd(e) {
    // Remove dragging class from the parent card
    const card = e.target.closest('.character-card');
    if (card) {
        card.classList.remove('dragging');
    }
    
    // Remove drag-over class from all cards
    document.querySelectorAll('.character-card').forEach(card => {
        card.classList.remove('drag-over', 'drag-target');
    });
}

/**
 * Handle drag over
 */
function handleDragOver(e) {
    e.preventDefault();
}

/**
 * Handle drag enter
 */
function handleDragEnter(e) {
    e.preventDefault();
    if (e.target.closest('.character-card') && !e.target.closest('.character-card').classList.contains('dragging')) {
        e.target.closest('.character-card').classList.add('drag-over');
    }
}

/**
 * Handle drag leave
 */
function handleDragLeave(e) {
    if (!e.target.closest('.character-card').contains(e.relatedTarget)) {
        e.target.closest('.character-card').classList.remove('drag-over');
    }
}

/**
 * Handle drop
 */
function handleDrop(e) {
    e.preventDefault();
    
    const draggedCharacterId = e.dataTransfer.getData('text/plain');
    const targetCard = e.target.closest('.character-card');
    const targetCharacterId = targetCard?.dataset.characterId;
    
    if (draggedCharacterId && targetCharacterId && draggedCharacterId !== targetCharacterId) {
        // Select both characters
        selectedCharacters = [draggedCharacterId, targetCharacterId];
        updateCharacterSelection();
        updateRelationshipDisplay();
    }
    
    // Clean up drag styles
    document.querySelectorAll('.character-card').forEach(card => {
        card.classList.remove('drag-over', 'drag-target');
    });
}

/**
 * Generate test data - 50 characters with random relationships
 */
async function generateTestData() {
    const confirmed = confirm(
        'This will generate 50 test characters with random relationships.\n\n' +
        'Are you sure you want to proceed? This action cannot be undone.'
    );
    
    if (!confirmed) return;
    
    try {
        showSuccess('Generating test data... This may take a moment.');
        
        // Simple name lists for variety
        const firstNames = [
            'Alex', 'Blake', 'Casey', 'Drew', 'Emery', 'Finley', 'Gray', 'Harper', 'Indigo', 'Jordan',
            'Kai', 'Lane', 'Morgan', 'Nova', 'Oakley', 'Parker', 'Quinn', 'River', 'Sage', 'Taylor',
            'Uma', 'Vale', 'Wren', 'Xen', 'Yara', 'Zara', 'Ash', 'Bay', 'Cedar', 'Dawn',
            'Echo', 'Fox', 'Glen', 'Haven', 'Iris', 'Jade', 'Knox', 'Luna', 'Mars', 'North',
            'Ocean', 'Pine', 'Quest', 'Rain', 'Storm', 'True', 'Unity', 'Vex', 'Wild', 'Zen'
        ];
        
        const lastNames = [
            'Smith', 'Johnson', 'Brown', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor', 'Anderson', 'Thomas',
            'Jackson', 'White', 'Harris', 'Martin', 'Thompson', 'Garcia', 'Martinez', 'Robinson', 'Clark', 'Rodriguez',
            'Lewis', 'Lee', 'Walker', 'Hall', 'Allen', 'Young', 'Hernandez', 'King', 'Wright', 'Lopez',
            'Hill', 'Scott', 'Green', 'Adams', 'Baker', 'Gonzalez', 'Nelson', 'Carter', 'Mitchell', 'Perez',
            'Roberts', 'Turner', 'Phillips', 'Campbell', 'Parker', 'Evans', 'Edwards', 'Collins', 'Stewart', 'Sanchez'
        ];
        
        const races = ['Human', 'Elf', 'Dwarf', 'Halfling', 'Orc', 'Gnome', 'Tiefling', 'Dragonborn', 'Half-Elf', 'Half-Orc'];
        
        // Use only valid relationship types from the database
        const familyRelationships = [
            'parent', 'child', 'sibling', 'spouse', 'cousin', 'aunt', 'uncle', 'grandparent', 'grandchild',
            'step-parent', 'step-child', 'step-sibling', 'half-sibling', 'parent-in-law', 'child-in-law', 'sibling-in-law'
        ];
        
        const nonFamilyRelationships = [
            'friend', 'best-friend', 'acquaintance', 'colleague', 'mentor', 'apprentice', 'rival', 'enemy',
            'ally', 'neighbor'
        ];
        
        const colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
            '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#F4D03F', '#AED6F1'
        ];
        
        // Generate 50 characters
        const characters = [];
        for (let i = 0; i < 50; i++) {
            const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
            const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
            const name = `${firstName} ${lastName}`;
            
            const character = {
                name: name,
                race: races[Math.floor(Math.random() * races.length)],
                description: `A ${races[Math.floor(Math.random() * races.length)].toLowerCase()} character generated for testing.`,
                importance: Math.floor(Math.random() * 10) + 1,
                color: colors[Math.floor(Math.random() * colors.length)],
                timeline_id: timelineId,
                birth_year: Math.floor(Math.random() * 100) + 1900,
                birth_subtick: Math.floor(Math.random() * 12) + 1,
                notes: 'Generated test character'
            };
            
            // Add character to database
            const result = await window.api.invoke('add-character', character);
            if (result.success) {
                characters.push({ ...character, id: result.character.id });
                console.log(`Created character: ${character.name} with ID: ${result.character.id}`);
            } else {
                console.error(`Failed to create character: ${character.name}`, result.error);
            }
        }
        
        console.log(`Generated ${characters.length} characters`);
        
        // Generate random relationships
        let relationshipsCreated = 0;
        const maxRelationships = Math.floor(characters.length * 10); // About 125 relationships for 50 characters
        
        for (let i = 0; i < maxRelationships; i++) {
            // Pick two random characters
            const char1Index = Math.floor(Math.random() * characters.length);
            let char2Index = Math.floor(Math.random() * characters.length);
            
            // Make sure they're different characters
            while (char2Index === char1Index) {
                char2Index = Math.floor(Math.random() * characters.length);
            }
            
            const char1 = characters[char1Index];
            const char2 = characters[char2Index];
            
            // Verify character IDs exist
            if (!char1.id || !char2.id) {
                console.error('Character missing ID:', { char1: char1.id, char2: char2.id });
                continue;
            }
            
            // Determine relationship type based on probability
            const rand = Math.random();
            let relationshipType, isBidirectional;
            
            if (rand < 0.05) { // 2% chance of family relationship
                relationshipType = familyRelationships[Math.floor(Math.random() * familyRelationships.length)];
                // Some family relationships are bidirectional
                isBidirectional = ['sibling', 'spouse', 'cousin'].includes(relationshipType);
            } else if (rand < 0.2) { // 8% chance of non-family relationship (10% - 2% = 8%)
                relationshipType = nonFamilyRelationships[Math.floor(Math.random() * nonFamilyRelationships.length)];
                // Some non-family relationships are bidirectional
                isBidirectional = ['friend', 'best-friend', 'colleague', 'ally', 'neighbor'].includes(relationshipType);
            } else {
                continue; // Skip this iteration - no relationship
            }
            
            // Check if relationship already exists between these characters
            const existingCheck = await window.api.invoke('get-character-relationships-between', {
                character1Id: char1.id,
                character2Id: char2.id,
                timelineId: timelineId
            });
            
            if (existingCheck.success && existingCheck.relationships.length > 0) {
                continue; // Skip if relationship already exists
            }
            
            // Create the relationship
            const relationship = {
                character_1_id: char1.id,
                character_2_id: char2.id,
                relationship_type: relationshipType,
                custom_relationship_type: null,
                relationship_strength: Math.floor(Math.random() * 100) + 1,
                is_bidirectional: isBidirectional,
                timeline_id: timelineId,
                notes: 'Generated test relationship'
            };
            
            console.log(`Creating relationship: ${char1.name} (${char1.id}) -> ${char2.name} (${char2.id}) [${relationshipType}]`);
            
            const relationshipResult = await window.api.invoke('create-character-relationship', relationship);
            if (relationshipResult.success) {
                relationshipsCreated++;
            } else {
                console.error('Failed to create relationship:', relationshipResult.error, relationship);
            }
        }
        
        console.log(`Generated ${relationshipsCreated} relationships`);
        
        // Refresh the character list
        await loadCharacters();
        updateRelationshipDisplay();
        
        showSuccess(`Successfully generated ${characters.length} characters and ${relationshipsCreated} relationships!`);
        
    } catch (error) {
        console.error('[characterManager.js] Error generating test data:', error);
        showError('Error generating test data: ' + error.message);
    }
}

/**
 * Handle window close events
 */
window.addEventListener('beforeunload', function() {
    // Cleanup if needed
});

/**
 * Get all characters connected to a specific character
 * @param {string} characterId - The character ID to find connections for
 * @returns {Array} Array of connected character IDs
 */
function getConnectedCharacters(characterId) {
    const connectedIds = new Set();
    
    allRelationships.forEach(relationship => {
        if (relationship.character_1_id === characterId) {
            connectedIds.add(relationship.character_2_id);
        } else if (relationship.character_2_id === characterId) {
            connectedIds.add(relationship.character_1_id);
        }
    });
    
    return Array.from(connectedIds);
}

/**
 * Get the number of relationships for a character
 * @param {string} characterId - The character ID
 * @returns {number} Number of relationships
 */
function getCharacterConnectionCount(characterId) {
    return getConnectedCharacters(characterId).length;
}

/**
 * Update visual highlighting for character connections
 */
function updateCharacterHighlighting() {
    // Remove all previous highlighting
    document.querySelectorAll('.character-card').forEach(card => {
        card.classList.remove('connected', 'faintly-highlighted');
    });
    
    // If exactly one character is selected, highlight connected characters
    if (selectedCharacters.length === 1) {
        const selectedId = selectedCharacters[0];
        const connectedIds = getConnectedCharacters(selectedId);
        
        connectedIds.forEach(connectedId => {
            const connectedCard = document.querySelector(`[data-character-id="${connectedId}"]`);
            if (connectedCard) {
                connectedCard.classList.add('faintly-highlighted');
            }
        });
    }
}