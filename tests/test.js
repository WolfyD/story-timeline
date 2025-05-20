const path = require('path');
const dbManager = require('../dbManager');

async function runTests() {
    try {
        console.log('Starting database tests...');

        // Test 1: Check if we can get all timelines
        console.log('\nTest 1: Getting all timelines');
        const timelines = dbManager.getAllTimelines();
        console.log('Timelines:', timelines);

        // Test 2: Create a new timeline
        console.log('\nTest 2: Creating a new timeline');
        const timestamp = Date.now();
        const newTimeline = {
            title: `Test Timeline ${timestamp}`,
            author: 'Test Author',
            description: 'A test timeline',
            start_year: 0,
            granularity: 4
        };
        const timelineId = dbManager.addTimeline(newTimeline);
        console.log('Created timeline with ID:', timelineId);

        // Test 3: Add an item to the timeline
        console.log('\nTest 3: Adding an item');
        const newItem = {
            title: 'Test Event',
            description: 'A test event',
            year: 1000,
            subtick: 2,
            type: 'Event'
        };
        const itemResult = dbManager.addItem(newItem);
        console.log('Added item:', itemResult);

        // Test 4: Get the item we just added
        console.log('\nTest 4: Getting the item');
        const item = dbManager.getItem(itemResult.id);
        console.log('Retrieved item:', item);

        // Test 5: Update the item
        console.log('\nTest 5: Updating the item');
        const updatedItem = {
            ...item,
            title: 'Updated Test Event',
            description: 'An updated test event'
        };
        const updateResult = dbManager.updateItem(itemResult.id, updatedItem);
        console.log('Updated item:', updateResult);

        // Test 6: Get all items for the timeline
        console.log('\nTest 6: Getting all items');
        const allItems = dbManager.getItemsByTimeline(timelineId);
        console.log('All items:', allItems);

        console.log('\nAll tests completed successfully!');
    } catch (error) {
        console.error('Test failed:', error);
    }
}

runTests(); 