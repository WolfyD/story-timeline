const DEV_VERSION = false;
const ITEM_INSERTER_VISIBLE = false;

// Get DOM elements
const splashTimelinesList = document.getElementById('splash_timelines_list');
const splashCreateTimelineButton = document.getElementById('splash_create_timeline_button');

// Add event listeners
splashCreateTimelineButton.addEventListener('click', createNewTimeline);

// Load timelines when the page loads
window.addEventListener('DOMContentLoaded', async () => {
    loadTimelines();
    
    // Get timeline information for display
    try {
        const info = await window.api.invoke('get-timeline-info');
        if (info.success) {
            const timelineInfo = document.getElementById('timeline-info');
            if (timelineInfo) {
                timelineInfo.innerHTML = `
                    <h3>Timeline Information</h3>
                    <p><strong>Title:</strong> ${info.data.title}</p>
                    <p><strong>Author:</strong> ${info.data.author}</p>
                    <p><strong>Description:</strong> ${info.data.description}</p>
                    <p><strong>Start Year:</strong> ${info.data.start_year}</p>
                    <p><strong>Granularity:</strong> ${info.data.granularity}</p>
                `;
            }
        } else {
            console.error('Error getting timeline information: ' + info.error);
        }
    } catch (error) {
        console.error('Error getting timeline information:', error);
    }
    
    // Show debug item generator if enabled
    if (DEV_VERSION && ITEM_INSERTER_VISIBLE) {
        const debugGenerator = document.getElementById('debug_item_generator');
        if (debugGenerator) {
            debugGenerator.style.display = 'block';
            console.log('Debug item generator UI shown');

            const generateButton = document.getElementById('debug_generate_items');
            const itemCountInput = document.getElementById('debug_item_count');

            generateButton.addEventListener('click', async () => {
                const count = parseInt(itemCountInput.value);
                if (isNaN(count) || count < 1) {
                    console.error('Please enter a valid number of items to generate');
                    return;
                }

                // Show loading message
                const loadingMessage = document.createElement('div');
                loadingMessage.textContent = 'Generating test items...';
                loadingMessage.style.cssText = 'margin: 10px 0; padding: 10px; background: #e3f2fd; border-radius: 4px;';
                document.getElementById('timeline-management').appendChild(loadingMessage);

                try {
                    const result = await window.api.invoke('generate-test-items', count);
                    
                    if (result.success) {
                        console.log(`Successfully generated ${result.count} test items!`);
                        loadingMessage.textContent = `Successfully generated ${result.count} test items!`;
                        loadingMessage.style.background = '#e8f5e8';
                    } else {
                        console.error('Error generating test items: ' + result.error);
                        loadingMessage.textContent = 'Error generating test items: ' + result.error;
                        loadingMessage.style.background = '#ffebee';
                    }
                } catch (error) {
                    console.error('Error generating test items: ' + error.message);
                    loadingMessage.textContent = 'Error generating test items: ' + error.message;
                    loadingMessage.style.background = '#ffebee';
                }
            });
        } else {
            console.error('Debug item generator UI element not found');
        }
    }
});

// Function to create a new timeline
function createNewTimeline() {
    window.api.send('new-timeline');
}

// Function to load timelines
function loadTimelines() {
    window.api.send('get-all-timelines');
}

// Function to open a timeline
function openTimeline(timelineId) {
    window.api.send('open-timeline', timelineId);
}

// Track the timeline being deleted
let pendingDeleteTimelineId = null;

// Function to delete a timeline
function deleteTimeline(timelineId) {
    // First get the timeline info to show in the warning
    window.api.send('get-timeline-info', timelineId);
    pendingDeleteTimelineId = timelineId;
}

// Listen for timeline info response
window.api.receive('timeline-info', (info) => {
    if (!pendingDeleteTimelineId) return;

    if (info.error) {
        console.error('Error getting timeline info:', info.error);
        pendingDeleteTimelineId = null;
        return;
    }

    const message = `Are you sure you want to delete the timeline "${info.title}"?\n\n` +
        `This will also delete:\n` +
        `- ${info.item_count} timeline items\n` +
        `- All associated images\n` +
        `- All associated tags and story references\n\n` +
        `This action cannot be undone.`;
        
    if (confirm(message)) {
        window.api.send('delete-timeline', pendingDeleteTimelineId);
    }
    pendingDeleteTimelineId = null;
});

// Listen for timeline deletion confirmation
window.api.receive('timeline-deleted', (timelineId) => {
    loadTimelines(); // Refresh the list
});

// Function to open timeline images directory
function openTimelineImages(timelineId) {
    window.api.send('open-timeline-images', timelineId);
}

// Function to render timeline items
function renderTimelines(timelines) {
    splashTimelinesList.innerHTML = '';
    
    if (timelines.length === 0) {
        splashTimelinesList.innerHTML = `
            <div class="splash_empty_state">
                <p>No timelines yet. Create your first timeline to get started!</p>
            </div>
        `;
        return;
    }

    timelines.forEach(timeline => {
        const timelineElement = document.createElement('div');
        timelineElement.className = 'splash_timeline_item';
        timelineElement.innerHTML = `
            <div class="splash_timeline_info">
                <h3 class="splash_timeline_title">${timeline.title}</h3>
                <p class="splash_timeline_author">${timeline.author || 'Unknown Author'}</p>
                <p class="splash_timeline_years">${timeline.year_range}</p>
            </div>
            <div class="splash_timeline_actions">
                <button class="splash_timeline_action_button" onclick="openTimelineImages('${timeline.id}')" title="Open Images Folder">
                    📁
                </button>
                <button class="splash_timeline_action_button" onclick="deleteTimeline('${timeline.id}')" title="Delete Timeline">
                    🗑️
                </button>
            </div>
        `;
        timelineElement.addEventListener('click', (e) => {
            // Don't trigger if clicking on action buttons
            if (!e.target.closest('.splash_timeline_action_button')) {
                openTimeline(timeline.id);
            }
        });
        splashTimelinesList.appendChild(timelineElement);
    });
}

// Listen for timeline list updates
window.api.receive('timelines-list', (timelines) => {
    renderTimelines(timelines);
}); 