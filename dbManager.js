const path = require('path');
const { app } = require('electron');
const { v4: uuidv4 } = require('uuid');

class DatabaseManager {
    constructor() {
        // Get the user data path from Electron
        const userDataPath = app.getPath('userData');
        const dbPath = path.join(userDataPath, 'timeline.db');

        console.log(dbPath);
        
        this.db = require('better-sqlite3')(dbPath);
        this.initializeTables();
        this.initializeDefaultData();
    }

    initializeTables() {
        // Universe/Project data table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS universe_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                author TEXT,
                description TEXT,
                start_year INTEGER DEFAULT 0,
                granularity INTEGER DEFAULT 4,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Settings table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY,
                font TEXT DEFAULT 'Arial',
                font_size_scale REAL DEFAULT 1.0,
                pixels_per_subtick INTEGER DEFAULT 20,
                custom_css TEXT,
                custom_main_css TEXT,
                custom_items_css TEXT,
                use_timeline_css INTEGER DEFAULT 0,
                use_main_css INTEGER DEFAULT 0,
                use_items_css INTEGER DEFAULT 0,
                is_fullscreen INTEGER DEFAULT 0,
                show_guides INTEGER DEFAULT 1,
                window_size_x INTEGER DEFAULT 800,
                window_size_y INTEGER DEFAULT 600,
                window_position_x INTEGER DEFAULT 100,
                window_position_y INTEGER DEFAULT 100,
                use_custom_scaling INTEGER DEFAULT 0,
                custom_scale REAL DEFAULT 1.0,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Stories table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS stories (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Items table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS items (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                content TEXT,
                story_id TEXT,
                year INTEGER,
                subtick INTEGER,
                original_subtick INTEGER,
                book_title TEXT,
                chapter TEXT,
                page TEXT,
                creation_granularity INTEGER DEFAULT 4,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (story_id) REFERENCES stories(id)
            )
        `);

        // Tags table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS tags (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Item-Tags junction table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS item_tags (
                item_id TEXT,
                tag_id INTEGER,
                FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
                FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
                PRIMARY KEY (item_id, tag_id)
            )
        `);

        // Pictures table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS pictures (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_id TEXT,
                picture TEXT,
                title TEXT,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
            )
        `);

        // Notes table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                year INTEGER,
                subtick INTEGER,
                content TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Item-Story References table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS item_story_refs (
                item_id TEXT,
                story_id TEXT,
                FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
                FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE,
                PRIMARY KEY (item_id, story_id)
            )
        `);

        // // Create triggers for updated_at
        // this.db.exec(`
        //     CREATE TRIGGER IF NOT EXISTS update_universe_data_timestamp 
        //     AFTER UPDATE ON universe_data
        //     BEGIN
        //         UPDATE universe_data SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        //     END;

        //     CREATE TRIGGER IF NOT EXISTS update_settings_timestamp 
        //     AFTER UPDATE ON settings
        //     BEGIN
        //         UPDATE settings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        //     END;

        //     CREATE TRIGGER IF NOT EXISTS update_stories_timestamp 
        //     AFTER UPDATE ON stories
        //     BEGIN
        //         UPDATE stories SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        //     END;

        //     CREATE TRIGGER IF NOT EXISTS update_items_timestamp 
        //     AFTER UPDATE ON items
        //     BEGIN
        //         UPDATE items SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        //     END;

        //     CREATE TRIGGER IF NOT EXISTS update_notes_timestamp 
        //     AFTER UPDATE ON notes
        //     BEGIN
        //         UPDATE notes SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        //     END;
        // `);
    }

    initializeDefaultData() {
        // Initialize default settings if none exist
        const stmt = this.db.prepare('SELECT COUNT(*) as count FROM settings');
        const result = stmt.get();
        
        if (result.count === 0) {
            // Load template files
            const fs = require('fs');
            const path = require('path');
            const customCSSTemplate = fs.readFileSync(path.join(__dirname, 'customCSSTemplate.txt'), 'utf8');
            const customMainCSSTemplate = fs.readFileSync(path.join(__dirname, 'customMainCSSTemplate.txt'), 'utf8');
            const customItemsCSSTemplate = fs.readFileSync(path.join(__dirname, 'customItemsCSSTemplate.txt'), 'utf8');

            const defaultSettings = {
                id: 1,
                font: 'Arial',
                font_size_scale: 1.0,
                pixels_per_subtick: 20,
                custom_css: customCSSTemplate,
                custom_main_css: customMainCSSTemplate,
                custom_items_css: customItemsCSSTemplate,
                use_timeline_css: 0,
                use_main_css: 0,
                use_items_css: 0,
                is_fullscreen: 0,
                show_guides: 1,
                window_size_x: 800,
                window_size_y: 600,
                window_position_x: 100,
                window_position_y: 100,
                use_custom_scaling: 0,
                custom_scale: 1.0
            };

            const insertStmt = this.db.prepare(`
                INSERT INTO settings (
                    id, font, font_size_scale, pixels_per_subtick, custom_css,
                    custom_main_css, custom_items_css, use_timeline_css, use_main_css, use_items_css,
                    is_fullscreen, show_guides, window_size_x, window_size_y, window_position_x, window_position_y,
                    use_custom_scaling, custom_scale
                ) VALUES (
                    @id, @font, @font_size_scale, @pixels_per_subtick, @custom_css,
                    @custom_main_css, @custom_items_css, @use_timeline_css, @use_main_css, @use_items_css,
                    @is_fullscreen, @show_guides, @window_size_x, @window_size_y, @window_position_x, @window_position_y,
                    @use_custom_scaling, @custom_scale
                )
            `);
            insertStmt.run(defaultSettings);
        }

        // Check if we have universe data
        const universeData = this.getUniverseData();
        if (!universeData) {
            const defaultUniverseData = {
                title: 'New Timeline',
                author: '',
                description: '',
                start_year: 0,
                granularity: 4
            };
            this.updateUniverseData(defaultUniverseData);
        }
    }

    // Helper function to convert subtick between granularities
    convertSubtickBetweenGranularities(originalSubtick, originalGranularity, newGranularity) {
        // Calculate the ratio of the subtick within its original granularity
        const ratio = originalSubtick / originalGranularity;
        // Apply that ratio to the new granularity
        return Math.round(ratio * newGranularity);
    }

    // Update all items' subticks when granularity changes
    updateItemsForGranularityChange(newGranularity) {
        // Get all items that have original_subtick set
        const stmt = this.db.prepare(`
            SELECT id, original_subtick, creation_granularity
            FROM items
            WHERE original_subtick IS NOT NULL
        `);
        const items = stmt.all();

        // Update each item's subtick
        const updateStmt = this.db.prepare(`
            UPDATE items
            SET subtick = @new_subtick
            WHERE id = @id
        `);

        for (const item of items) {
            const newSubtick = this.convertSubtickBetweenGranularities(
                item.original_subtick,
                item.creation_granularity,
                newGranularity
            );
            updateStmt.run({
                id: item.id,
                new_subtick: newSubtick
            });
        }
    }

    // Universe data operations
    getUniverseData() {
        const stmt = this.db.prepare('SELECT * FROM universe_data ORDER BY id DESC LIMIT 1');
        const data = stmt.get();
        
        if (!data) {
            return null;
        }

        // Convert database field names to frontend field names
        return {
            title: data.title,
            author: data.author,
            description: data.description,
            start: data.start_year,
            granularity: data.granularity
        };
    }

    updateUniverseData(data) {
        // Get current universe data to check if granularity is changing
        const currentData = this.getUniverseData();
        const granularityChanged = currentData && currentData.granularity !== data.granularity;

        // Convert frontend field names to database field names
        const dbData = {
            title: data.title,
            author: data.author,
            description: data.description,
            start_year: data.start || data.start_year,
            granularity: data.granularity
        };

        const stmt = this.db.prepare(`
            INSERT INTO universe_data (title, author, description, start_year, granularity)
            VALUES (@title, @author, @description, @start_year, @granularity)
        `);
        const result = stmt.run(dbData);

        // If granularity changed, update all items' subticks
        if (granularityChanged) {
            this.updateItemsForGranularityChange(data.granularity);
        }

        return result;
    }

    // Settings operations
    getSettings() {
        const stmt = this.db.prepare('SELECT * FROM settings WHERE id = 1');
        const settings = stmt.get();
        
        if (!settings) return null;

        // Convert database snake_case to camelCase for frontend
        return {
            font: settings.font,
            fontSizeScale: settings.font_size_scale,
            pixelsPerSubtick: settings.pixels_per_subtick,
            customCSS: settings.custom_css,
            customMainCSS: settings.custom_main_css,
            customItemsCSS: settings.custom_items_css,
            useTimelineCSS: settings.use_timeline_css === 1,
            useMainCSS: settings.use_main_css === 1,
            useItemsCSS: settings.use_items_css === 1,
            isFullscreen: settings.is_fullscreen === 1,
            showGuides: settings.show_guides === 1,
            size: {
                x: settings.window_size_x,
                y: settings.window_size_y
            },
            position: {
                x: settings.window_position_x,
                y: settings.window_position_y
            },
            useCustomScaling: settings.use_custom_scaling === 1,
            customScale: settings.custom_scale
        };
    }

    updateSettings(settings) {
        // Convert frontend camelCase to database snake_case
        const dbSettings = {
            font: settings.font || 'Arial',
            font_size_scale: parseFloat(settings.fontSizeScale || 1.0),
            pixels_per_subtick: parseInt(settings.pixelsPerSubtick || 20),
            custom_css: settings.customCSS || '',
            custom_main_css: settings.customMainCSS || '',
            custom_items_css: settings.customItemsCSS || '',
            use_timeline_css: settings.useTimelineCSS ? 1 : 0,
            use_main_css: settings.useMainCSS ? 1 : 0,
            use_items_css: settings.useItemsCSS ? 1 : 0,
            is_fullscreen: settings.isFullscreen ? 1 : 0,
            show_guides: settings.showGuides ? 1 : 0,
            window_size_x: parseInt((settings.size && settings.size.x) || 800),
            window_size_y: parseInt((settings.size && settings.size.y) || 600),
            window_position_x: parseInt((settings.position && settings.position.x) || 100),
            window_position_y: parseInt((settings.position && settings.position.y) || 100),
            use_custom_scaling: settings.useCustomScaling ? 1 : 0,
            custom_scale: parseFloat(settings.customScale || 1.0)
        };

        console.log("\r\n\r\n\r\n\r\n\r\n\r\n\r\n\r\n\r\n\r\n\r\n\r\n\r\n\r\n\r\n\r\n\r\n\r\n\r\n\r\n\r\n\r\n\r\n\r\n\r\n\r\n\r\n\r\nXXXXX---SETTINGS---XXXXX",settings,"\r\n|------|\r\n",dbSettings);

        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO settings (
                id, font, font_size_scale, pixels_per_subtick, custom_css, 
                custom_main_css, custom_items_css, use_timeline_css, use_main_css, use_items_css,
                is_fullscreen, show_guides, window_size_x, window_size_y, window_position_x, window_position_y,
                use_custom_scaling, custom_scale
            )
            VALUES (
                1, @font, @font_size_scale, @pixels_per_subtick, @custom_css,
                @custom_main_css, @custom_items_css, @use_timeline_css, @use_main_css, @use_items_css,
                @is_fullscreen, @show_guides, @window_size_x, @window_size_y, @window_position_x, @window_position_y,
                @use_custom_scaling, @custom_scale
            )
        `);

        stmt.run(dbSettings);
    }

    // Helper: get or create a story by title and id
    getOrCreateStory(storyTitle, storyId) {
        if (!storyTitle || !storyId) return null;
        let story = this.getStory(storyId);
        if (!story) {
            this.addStory({ id: storyId, title: storyTitle, description: '' });
            story = this.getStory(storyId);
        }
        return story;
    }

    // Story operations
    addStory(story) {
        const stmt = this.db.prepare(`
            INSERT OR IGNORE INTO stories (id, title, description)
            VALUES (@id, @title, @description)
        `);
        return stmt.run(story);
    }

    getStory(id) {
        const stmt = this.db.prepare('SELECT * FROM stories WHERE id = ?');
        return stmt.get(id);
    }

    getAllStories() {
        const stmt = this.db.prepare('SELECT * FROM stories ORDER BY title');
        return stmt.all();
    }

    // Item operations
    addStoryReferencesToItem(itemId, storyRefs) {
        if (!Array.isArray(storyRefs)) return;
        const addRef = this.db.prepare('INSERT OR IGNORE INTO item_story_refs (item_id, story_id) VALUES (?, ?)');
        for (const ref of storyRefs) {
            if (ref && ref.story_id && ref.story_title) {
                this.getOrCreateStory(ref.story_title, ref.story_id);
                addRef.run(itemId, ref.story_id);
            }
        }
    }

    getItemStoryReferences(itemId) {
        const stmt = this.db.prepare(`
            SELECT s.id, s.title, s.description
            FROM item_story_refs r
            JOIN stories s ON r.story_id = s.id
            WHERE r.item_id = ?
        `);
        return stmt.all(itemId);
    }

    addItem(item) {
        // Ensure item has an ID
        if (!item.id) {
            throw new Error('Item must have an ID');
        }

        // Handle story relationship
        let storyId = null;
        if (item['story-id']) {
            // Ensure story exists and get its ID
            const story = this.getOrCreateStory(item.story || '', item['story-id']);
            if (story) {
                storyId = story.id;
            }
        }

        const stmt = this.db.prepare(`
            INSERT INTO items (
                id, title, description, content, story_id, 
                year, subtick, original_subtick, book_title, chapter, page,
                creation_granularity
            ) VALUES (
                @id, @title, @description, @content, @story_id,
                @year, @subtick, @original_subtick, @book_title, @chapter, @page,
                @creation_granularity
            )
        `);

        // Get current granularity from universe data
        const universeData = this.getUniverseData();
        const currentGranularity = universeData ? universeData.granularity : 4;

        const result = stmt.run({
            id: item.id,
            title: item.title,
            description: item.description,
            content: item.content,
            story_id: storyId,
            year: item.year,
            subtick: item.subtick,
            original_subtick: item.subtick, // Set original_subtick to the same value as subtick
            book_title: item.book_title,
            chapter: item.chapter,
            page: item.page,
            creation_granularity: currentGranularity
        });

        // Add tags if present
        if (item.tags && item.tags.length > 0) {
            this.addTagsToItem(item.id, item.tags);
        }

        // Add pictures if present
        if (item.pictures && item.pictures.length > 0) {
            this.addPicturesToItem(item.id, item.pictures);
        }

        // Add story references if present
        if (item.story_refs && item.story_refs.length > 0) {
            this.addStoryReferencesToItem(item.id, item.story_refs);
        }

        return result;
    }

    getItem(id) {
        const stmt = this.db.prepare(`
            SELECT i.*, 
                   GROUP_CONCAT(DISTINCT t.name) as tags,
                   GROUP_CONCAT(DISTINCT s.id || ':' || s.title) as story_refs
            FROM items i
            LEFT JOIN item_tags it ON i.id = it.item_id
            LEFT JOIN tags t ON it.tag_id = t.id
            LEFT JOIN item_story_refs isr ON i.id = isr.item_id
            LEFT JOIN stories s ON isr.story_id = s.id
            WHERE i.id = ?
            GROUP BY i.id
        `);
        
        const item = stmt.get(id);
        if (!item) return null;

        // Get pictures
        const pictures = this.getItemPictures(id);

        // Convert database fields to frontend fields
        return {
            id: item.id,
            title: item.title,
            description: item.description,
            content: item.content,
            'story-id': item.story_id,
            year: item.year,
            subtick: item.subtick,
            original_subtick: item.original_subtick,
            creation_granularity: item.creation_granularity,
            book_title: item.book_title,
            chapter: item.chapter,
            page: item.page,
            tags: item.tags ? item.tags.split(',') : [],
            story_refs: item.story_refs ? item.story_refs.split(',').map(ref => {
                const [id, title] = ref.split(':');
                return { id, title };
            }) : [],
            pictures: pictures
        };
    }

    getAllItems() {
        const stmt = this.db.prepare(`
            SELECT i.*, s.title as story_title, s.id as story_id, s.description as story_description
            FROM items i 
            LEFT JOIN stories s ON i.story_id = s.id 
            ORDER BY i.year, i.subtick
        `);
        const items = stmt.all();
        return items.map(item => ({
            ...item,
            tags: this.getItemTags(item.id),
            pictures: this.getItemPictures(item.id),
            story_refs: this.getItemStoryReferences(item.id)
        }));
    }

    updateItem(id, item) {
        // First get the existing item to preserve creation_granularity and check if subtick changed
        const existingItem = this.getItem(id);
        if (!existingItem) return null;

        // Check if subtick has changed
        const subtickChanged = item.subtick !== existingItem.subtick;

        const stmt = this.db.prepare(`
            UPDATE items SET
                title = @title,
                description = @description,
                content = @content,
                story_id = @story_id,
                year = @year,
                subtick = @subtick,
                original_subtick = CASE 
                    WHEN @subtick_changed = 1 THEN @subtick 
                    ELSE original_subtick 
                END,
                book_title = @book_title,
                chapter = @chapter,
                page = @page
            WHERE id = @id
        `);

        const result = stmt.run({
            id: id,
            title: item.title,
            description: item.description,
            content: item.content,
            story_id: item['story-id'],
            year: item.year,
            subtick: item.subtick,
            subtick_changed: subtickChanged ? 1 : 0,
            book_title: item.book_title,
            chapter: item.chapter,
            page: item.page
        });

        // Update tags if present
        if (item.tags) {
            this.updateItemTags(id, item.tags);
        }

        // Update pictures if present
        if (item.pictures) {
            this.updateItemPictures(id, item.pictures);
        }

        // Update story references if present
        if (item.story_refs) {
            // First remove all existing references
            const deleteStmt = this.db.prepare('DELETE FROM item_story_refs WHERE item_id = ?');
            deleteStmt.run(id);
            // Then add the new ones
            this.addStoryReferencesToItem(id, item.story_refs);
        }

        return this.getItem(id);
    }

    deleteItem(id) {
        // Delete related records first
        this.db.prepare('DELETE FROM item_tags WHERE item_id = ?').run(id);
        this.db.prepare('DELETE FROM pictures WHERE item_id = ?').run(id);
        
        // Delete the item
        const stmt = this.db.prepare('DELETE FROM items WHERE id = ?');
        return stmt.run(id);
    }

    // Tag operations
    addTagsToItem(itemId, tags) {
        const addTag = this.db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
        const getTagId = this.db.prepare('SELECT id FROM tags WHERE name = ?');
        const addItemTag = this.db.prepare('INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?, ?)');

        for (const tag of tags) {
            addTag.run(tag);
            const tagId = getTagId.get(tag).id;
            addItemTag.run(itemId, tagId);
        }
    }

    getItemTags(itemId) {
        const stmt = this.db.prepare(`
            SELECT t.name 
            FROM tags t
            JOIN item_tags it ON t.id = it.tag_id
            WHERE it.item_id = ?
        `);
        return stmt.all(itemId).map(row => row.name);
    }

    // Picture operations
    addPicturesToItem(itemId, pictures) {
        const stmt = this.db.prepare(`
            INSERT INTO pictures (item_id, picture, title, description)
            VALUES (@item_id, @picture, @title, @description)
        `);

        for (const pic of pictures) {
            stmt.run({
                item_id: itemId,
                picture: pic.picture,
                title: pic.title,
                description: pic.description
            });
        }
    }

    getItemPictures(itemId) {
        const stmt = this.db.prepare('SELECT * FROM pictures WHERE item_id = ?');
        return stmt.all(itemId);
    }

    updateItemPictures(itemId, pictures) {
        // Remove all existing pictures for this item
        this.db.prepare('DELETE FROM pictures WHERE item_id = ?').run(itemId);

        // Add new pictures
        const stmt = this.db.prepare(`
            INSERT INTO pictures (item_id, picture, title, description)
            VALUES (@item_id, @picture, @title, @description)
        `);

        for (const pic of pictures) {
            stmt.run({
                item_id: itemId,
                picture: pic.picture,
                title: pic.title,
                description: pic.description
            });
        }
    }

    // Notes operations
    addNote(note) {
        const stmt = this.db.prepare(`
            INSERT INTO notes (content, year, subtick)
            VALUES (@content, @year, @subtick)
        `);
        return stmt.run(note);
    }

    getNotes(year = null, subtick = null) {
        let query = 'SELECT * FROM notes';
        const params = [];
        
        if (year !== null) {
            query += ' WHERE year = ?';
            params.push(year);
            if (subtick !== null) {
                query += ' AND subtick = ?';
                params.push(subtick);
            }
        }
        
        query += ' ORDER BY year, subtick, created_at';
        const stmt = this.db.prepare(query);
        return stmt.all(...params);
    }

    // Search operations
    searchItems(criteria) {
        let query = `
            SELECT i.*, s.title as story_title 
            FROM items i 
            LEFT JOIN stories s ON i.story_id = s.id 
            WHERE 1=1
        `;
        const params = [];

        if (criteria.story) {
            query += ' AND s.title LIKE ?';
            params.push(`%${criteria.story}%`);
        }

        if (criteria.tags && criteria.tags.length > 0) {
            query += ` AND i.id IN (
                SELECT item_id FROM item_tags 
                JOIN tags ON item_tags.tag_id = tags.id 
                WHERE tags.name IN (${criteria.tags.map(() => '?').join(',')})
            )`;
            params.push(...criteria.tags);
        }

        if (criteria.startDate) {
            query += ' AND (i.year > ? OR (i.year = ? AND i.subtick >= ?))';
            params.push(criteria.startDate, criteria.startDate, criteria.startSubtick || 0);
        }

        if (criteria.endDate) {
            query += ' AND (i.year < ? OR (i.year = ? AND i.subtick <= ?))';
            params.push(criteria.endDate, criteria.endDate, criteria.endSubtick || 0);
        }

        if (criteria.text) {
            query += ' AND (i.title LIKE ? OR i.description LIKE ? OR i.content LIKE ?)';
            const textParam = `%${criteria.text}%`;
            params.push(textParam, textParam, textParam);
        }

        const stmt = this.db.prepare(query);
        const items = stmt.all(...params);
        return items.map(item => ({
            ...item,
            tags: this.getItemTags(item.id),
            pictures: this.getItemPictures(item.id)
        }));
    }

    updateItemTags(itemId, tags) {
        // Remove all existing tags for this item
        this.db.prepare('DELETE FROM item_tags WHERE item_id = ?').run(itemId);

        // Add new tags
        const addTag = this.db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
        const getTagId = this.db.prepare('SELECT id FROM tags WHERE name = ?');
        const addItemTag = this.db.prepare('INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?, ?)');

        for (const tag of tags) {
            addTag.run(tag);
            const tagId = getTagId.get(tag).id;
            addItemTag.run(itemId, tagId);
        }
    }
}

module.exports = new DatabaseManager(); 