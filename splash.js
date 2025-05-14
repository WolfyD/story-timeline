// Get DOM elements
const splashTimelinesList = document.getElementById('splash_timelines_list');
const splashCreateTimelineButton = document.getElementById('splash_create_timeline_button');

// Add event listeners
splashCreateTimelineButton.addEventListener('click', createNewTimeline);

// Load timelines when the page loads
window.addEventListener('DOMContentLoaded', () => {
    loadTimelines();
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
        alert('Error getting timeline information: ' + info.error);
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
                <p class="splash_timeline_years">Start Year: ${timeline.start_year}</p>
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