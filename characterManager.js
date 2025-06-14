/**
 * Character Manager Window JavaScript
 * 
 * Handles character management functionality including:
 * - Loading and displaying all characters
 * - Search and filtering
 * - Character editing and deletion
 * - Statistics display
 * - IPC communication with main process
 */

let timelineId = null;
let allCharacters = [];
let filteredCharacters = [];

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
    document.getElementById('living-characters').textContent = livingCharacters;
    document.getElementById('deceased-characters').textContent = deceasedCharacters;
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
}

/**
 * Create a character card element
 */
function createCharacterCard(character) {
    const card = document.createElement('div');
    card.className = 'character-card';
    
    // Parse aliases
    const aliases = character.aliases ? character.aliases.split(',').filter(a => a.trim()) : [];
    
    // Format dates
    const birthDate = formatCharacterDate(character.birth_year, character.birth_subtick, character.birth_date);
    const deathDate = formatCharacterDate(character.death_year, character.death_subtick, character.death_date);
    
    card.innerHTML = `
        <div class="importance-indicator">${character.importance || 5}</div>
        
        <div class="character-header">
            <h3 class="character-name">${character.name || 'Unnamed Character'}</h3>
            <div class="character-color" style="background-color: ${character.color || '#a67c52'}"></div>
        </div>
        
        <div class="character-info">
            ${character.race ? `<div class="character-race">${character.race}</div>` : ''}
            ${character.description ? `<div class="character-description">${character.description}</div>` : ''}
            
            <div class="character-dates">
                ${birthDate ? `Born: ${birthDate}` : ''}
                ${birthDate && deathDate ? ' • ' : ''}
                ${deathDate ? `Died: ${deathDate}` : ''}
            </div>
            
            ${aliases.length > 0 ? `
                <div class="character-aliases">
                    ${aliases.map(alias => `<span class="alias-tag">${alias.trim()}</span>`).join('')}
                </div>
            ` : ''}
        </div>
        
        <div class="character-actions">
            <button class="btn btn-small btn-edit" onclick="editCharacter('${character.id}')">
                <i class="ri-edit-line"></i> Edit
            </button>
            <button class="btn btn-small btn-delete" onclick="deleteCharacter('${character.id}', '${character.name}')">
                <i class="ri-delete-bin-line"></i> Delete
            </button>
        </div>
    `;
    
    return card;
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
            
            // Reload characters
            await loadCharacters();
        } else {
            showError('Error deleting character: ' + result.error);
        }
        
    } catch (error) {
        console.error('[characterManager.js] Error deleting character:', error);
        showError('Error deleting character: ' + error.message);
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
 * Handle window close events
 */
window.addEventListener('beforeunload', function() {
 