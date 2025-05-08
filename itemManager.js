class ItemManager {
    constructor() {
        this.items = [];
        this.storyIndex = new Map(); // Map of story titles to IDs
        this.tagIndex = new Map();   // Map of tags to item IDs
        this.dateIndex = new Map();  // Map of dates to item IDs
    }

    // Initialize with existing items
    initialize(items) {
        this.items = items;
        this.rebuildIndexes();
    }

    // Rebuild all indexes
    rebuildIndexes() {
        this.storyIndex.clear();
        this.tagIndex.clear();
        this.dateIndex.clear();

        this.items.forEach(item => {
            // Index by story
            if (item.story && item['story-id']) {
                this.storyIndex.set(item.story.toLowerCase(), {
                    title: item.story,
                    id: item['story-id']
                });
            }

            // Index by tags
            if (item.tags) {
                item.tags.forEach(tag => {
                    if (!this.tagIndex.has(tag)) {
                        this.tagIndex.set(tag, new Set());
                    }
                    this.tagIndex.get(tag).add(item['story-id']);
                });
            }

            // Index by date
            if (item.date) {
                if (!this.dateIndex.has(item.date)) {
                    this.dateIndex.set(item.date, new Set());
                }
                this.dateIndex.get(item.date).add(item['story-id']);
            }
        });
    }

    // Add a new item
    addItem(item) {
        this.items.push(item);
        
        // Update indexes
        if (item.story && item['story-id']) {
            this.storyIndex.set(item.story.toLowerCase(), {
                title: item.story,
                id: item['story-id']
            });
        }

        if (item.tags) {
            item.tags.forEach(tag => {
                if (!this.tagIndex.has(tag)) {
                    this.tagIndex.set(tag, new Set());
                }
                this.tagIndex.get(tag).add(item['story-id']);
            });
        }

        if (item.date) {
            if (!this.dateIndex.has(item.date)) {
                this.dateIndex.set(item.date, new Set());
            }
            this.dateIndex.get(item.date).add(item['story-id']);
        }

        return item;
    }

    // Remove an item
    removeItem(storyId) {
        const index = this.items.findIndex(item => item['story-id'] === storyId);
        if (index !== -1) {
            const item = this.items[index];
            this.items.splice(index, 1);
            this.rebuildIndexes(); // Rebuild indexes to ensure consistency
            return true;
        }
        return false;
    }

    // Search items by various criteria
    searchItems(criteria = {}) {
        let results = [...this.items];

        // Filter by story
        if (criteria.story) {
            const storyId = this.storyIndex.get(criteria.story.toLowerCase())?.id;
            if (storyId) {
                results = results.filter(item => item['story-id'] === storyId);
            }
        }

        // Filter by tags
        if (criteria.tags && criteria.tags.length > 0) {
            const tagIds = new Set();
            criteria.tags.forEach(tag => {
                const ids = this.tagIndex.get(tag);
                if (ids) {
                    ids.forEach(id => tagIds.add(id));
                }
            });
            results = results.filter(item => tagIds.has(item['story-id']));
        }

        // Filter by date range
        if (criteria.startDate || criteria.endDate) {
            results = results.filter(item => {
                if (!item.date) return false;
                if (criteria.startDate && item.date < criteria.startDate) return false;
                if (criteria.endDate && item.date > criteria.endDate) return false;
                return true;
            });
        }

        // Filter by text search in title, description, or content
        if (criteria.text) {
            const searchText = criteria.text.toLowerCase();
            results = results.filter(item => 
                (item.title && item.title.toLowerCase().includes(searchText)) ||
                (item.description && item.description.toLowerCase().includes(searchText)) ||
                (item.content && item.content.toLowerCase().includes(searchText))
            );
        }

        return results;
    }

    // Get all stories
    getAllStories() {
        return Array.from(this.storyIndex.values());
    }

    // Get all tags
    getAllTags() {
        return Array.from(this.tagIndex.keys());
    }

    // Get items by story ID
    getItemsByStoryId(storyId) {
        return this.items.filter(item => item['story-id'] === storyId);
    }

    // Get items by tag
    getItemsByTag(tag) {
        const storyIds = this.tagIndex.get(tag);
        if (!storyIds) return [];
        return this.items.filter(item => storyIds.has(item['story-id']));
    }

    // Get items by date
    getItemsByDate(date) {
        const storyIds = this.dateIndex.get(date);
        if (!storyIds) return [];
        return this.items.filter(item => storyIds.has(item['story-id']));
    }

    // Get all items
    getAllItems() {
        return [...this.items];
    }
}

// Create and export a singleton instance
const itemManager = new ItemManager();
module.exports = itemManager; 