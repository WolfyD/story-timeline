const path = require('path');
const { app } = require('electron');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const sharp = require('sharp');

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
        // Create timelines table (replacing universe_data)
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS timelines (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                author TEXT NOT NULL,
                description TEXT,
                start_year INTEGER DEFAULT 0,
                granularity INTEGER DEFAULT 4,
                settings_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(title, author),
                FOREIGN KEY (settings_id) REFERENCES settings(id)
            )
        `);

        // Settings table (modified to support multiple timelines)
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY,
                timeline_id INTEGER,
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
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (timeline_id) REFERENCES timelines(id) ON DELETE CASCADE
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

        // Create item_types table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS item_types (
                id INTEGER PRIMARY KEY,
                name TEXT UNIQUE,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Insert default item types
        const defaultTypes = [
            { name: 'Event', description: 'A specific point in time' },
            { name: 'Period', description: 'A span of time' },
            { name: 'Age', description: 'A significant era or period' },
            { name: 'Picture', description: 'An image or visual record' },
            { name: 'Note', description: 'A text note or annotation' },
            { name: 'Bookmark', description: 'A marked point of interest' },
            { name: 'Character', description: 'A person or entity' }
        ];

        const insertTypeStmt = this.db.prepare(`
            INSERT OR IGNORE INTO item_types (name, description)
            VALUES (@name, @description)
        `);

        for (const type of defaultTypes) {
            insertTypeStmt.run(type);
        }

        // Create items table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS items (
                id TEXT PRIMARY KEY,
                title TEXT,
                description TEXT,
                content TEXT,
                story_id TEXT,
                type_id INTEGER DEFAULT 1,
                year INTEGER,
                subtick INTEGER,
                original_subtick INTEGER,
                end_year INTEGER,
                end_subtick INTEGER,
                original_end_subtick INTEGER,
                book_title TEXT,
                chapter TEXT,
                page TEXT,
                color TEXT,
                creation_granularity INTEGER,
                timeline_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (story_id) REFERENCES stories(id),
                FOREIGN KEY (type_id) REFERENCES item_types(id),
                FOREIGN KEY (timeline_id) REFERENCES timelines(id) ON DELETE CASCADE
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

        // Pictures table (modified to store file information)
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS pictures (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_id TEXT,
                file_path TEXT NOT NULL,
                file_name TEXT NOT NULL,
                file_size INTEGER,
                file_type TEXT,
                width INTEGER,
                height INTEGER,
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
            //insertStmt.run(defaultSettings);
        }

        // Check if we have any timelines
        const timelineStmt = this.db.prepare('SELECT COUNT(*) as count FROM timelines');
        const timelineResult = timelineStmt.get();
        
        if (timelineResult.count === 0) {
            // Create a default timeline
            const defaultTimeline = {
                title: 'New Timeline',
                author: '',
                description: '',
                start_year: 0,
                granularity: 4
            };
            this.addTimeline(defaultTimeline);
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
        // Get the first timeline instead of universe_data
        const stmt = this.db.prepare('SELECT * FROM timelines ORDER BY id DESC LIMIT 1');
        const data = stmt.get();
        
        if (!data) {
            return null;
        }

        // Get settings for this timeline
        const settings = this.getTimelineSettings(data.id);

        // Convert database field names to frontend field names
        return {
            id: data.id,
            title: data.title,
            author: data.author,
            description: data.description,
            start: data.start_year,
            granularity: data.granularity,
            settings: settings
        };
    }

    updateUniverseData(data) {
        // Get current timeline data to check if granularity is changing
        const currentData = this.getUniverseData();
        const granularityChanged = currentData && currentData.granularity !== data.granularity;

        // Get the current timeline ID from the data state
        const timelineId = data.timeline_id;
        if (!timelineId) {
            console.error('No timeline ID found in data state');
            return null;
        }

        // Update the existing timeline
        const updateStmt = this.db.prepare(`
            UPDATE timelines 
            SET title = @title,
                author = @author,
                description = @description,
                start_year = @start_year,
                granularity = @granularity,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = @timeline_id
        `);

        const result = updateStmt.run({
            title: data.title || 'New Timeline',
            author: data.author || '',
            description: data.description || '',
            start_year: parseInt(data.start || data.start_year || 0),
            granularity: parseInt(data.granularity || 4),
            timeline_id: timelineId
        });

        // If granularity changed, update all items' subticks
        if (granularityChanged) {
            this.updateItemsForGranularityChange(data.granularity);
        }

        return timelineId;
    }

    // Settings operations
    getSettings() {
        // Get the first timeline's settings
        const timeline = this.getUniverseData();
        if (!timeline) return null;

        const settings = this.getTimelineSettings(timeline.id);
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
        const timelineId = settings.timeline_id;
        if (!timelineId) {
            console.error('No timeline ID found in settings');
            return;
        }

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
            window_size_x: parseInt(settings.windowSizeX || 800),
            window_size_y: parseInt(settings.windowSizeY || 600),
            window_position_x: parseInt(settings.windowPositionX || 100),
            window_position_y: parseInt(settings.windowPositionY || 100),
            use_custom_scaling: settings.useCustomScaling ? 1 : 0,
            custom_scale: parseFloat(settings.customScale || 1.0)
        };

        // Update settings for the timeline
        const stmt = this.db.prepare(`
            UPDATE settings SET
                font = @font,
                font_size_scale = @font_size_scale,
                pixels_per_subtick = @pixels_per_subtick,
                custom_css = @custom_css,
                custom_main_css = @custom_main_css,
                custom_items_css = @custom_items_css,
                use_timeline_css = @use_timeline_css,
                use_main_css = @use_main_css,
                use_items_css = @use_items_css,
                is_fullscreen = @is_fullscreen,
                show_guides = @show_guides,
                window_size_x = @window_size_x,
                window_size_y = @window_size_y,
                window_position_x = @window_position_x,
                window_position_y = @window_position_y,
                use_custom_scaling = @use_custom_scaling,
                custom_scale = @custom_scale,
                updated_at = CURRENT_TIMESTAMP
            WHERE timeline_id = @timeline_id
        `);

        return stmt.run({
            ...dbSettings,
            timeline_id: timelineId
        });
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
        try {
            // Start a transaction
            this.db.prepare('BEGIN').run();

            // Get type_id from type name
            const typeStmt = this.db.prepare('SELECT id FROM item_types WHERE name = ?');
            const typeResult = typeStmt.get(item.type || 'Event');
            const typeId = typeResult ? typeResult.id : 1; // Default to Event (id: 1) if type not found

            // Insert the item
            const stmt = this.db.prepare(`
                INSERT INTO items (
                    id, title, description, content, year, subtick,
                    book_title, chapter, page, type_id, color, timeline_id
                ) VALUES (
                    @id, @title, @description, @content, @year, @subtick,
                    @book_title, @chapter, @page, @type_id, @color, @timeline_id
                )
            `);

            const result = stmt.run({
                id: item.id,
                title: item.title,
                description: item.description || '',
                content: item.content || '',
                year: item.year,
                subtick: item.subtick,
                book_title: item.book_title || '',
                chapter: item.chapter || '',
                page: item.page || '',
                type_id: typeId,
                color: item.color || null,
                timeline_id: this.getUniverseData().id
            });

            // Add tags if any
            if (item.tags && item.tags.length > 0) {
                this.addTagsToItem(item.id, item.tags);
            }

            // Add story references if any
            if (item.story_refs && item.story_refs.length > 0) {
                this.addStoryReferencesToItem(item.id, item.story_refs);
            }

            // Add pictures if any
            if (item.pictures && item.pictures.length > 0) {
                // First, update any pictures that were uploaded before the item was created
                const pictureIds = item.pictures
                    .filter(pic => pic.id) // Only include pictures that have an ID (were already saved)
                    .map(pic => pic.id);
                
                if (pictureIds.length > 0) {
                    this.updatePicturesItemId(pictureIds, item.id);
                }

                // Then add any new pictures
                const newPictures = item.pictures.filter(pic => !pic.id);
                if (newPictures.length > 0) {
                    this.addPicturesToItem(item.id, newPictures);
                }
            }

            // Commit the transaction
            this.db.prepare('COMMIT').run();

            return result.lastInsertRowid;
        } catch (error) {
            // Rollback on error
            this.db.prepare('ROLLBACK').run();
            console.error('Error adding item:', error);
            throw error;
        }
    }

    getItem(id) {
        const stmt = this.db.prepare(`
            SELECT i.*, 
                   t.name as type_name,
                   GROUP_CONCAT(DISTINCT tg.name) as tags,
                   GROUP_CONCAT(DISTINCT s.id || ':' || s.title) as story_refs
            FROM items i
            LEFT JOIN item_types t ON i.type_id = t.id
            LEFT JOIN item_tags it ON i.id = it.item_id
            LEFT JOIN tags tg ON it.tag_id = tg.id
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
            type: item.type_name,
            year: item.year,
            subtick: item.subtick,
            original_subtick: item.original_subtick,
            end_year: item.end_year || item.year,
            end_subtick: item.end_subtick || item.subtick,
            original_end_subtick: item.original_end_subtick || item.original_subtick,
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
        const timeline = this.getUniverseData();
        if (!timeline) return [];

        const stmt = this.db.prepare(`
            SELECT i.*, s.title as story_title, s.id as story_id, s.description as story_description,
                   t.name as type
            FROM items i 
            LEFT JOIN stories s ON i.story_id = s.id 
            LEFT JOIN item_types t ON i.type_id = t.id
            WHERE i.timeline_id = ?
            ORDER BY i.year, i.subtick
        `);
        const items = stmt.all(timeline.id);
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
        const endSubtickChanged = item.end_subtick !== existingItem.end_subtick;

        // Get type_id from type name if provided
        let typeId = existingItem.type_id;
        if (item.type) {
            const typeStmt = this.db.prepare('SELECT id FROM item_types WHERE name = ?');
            const typeResult = typeStmt.get(item.type);
            if (typeResult) {
                typeId = typeResult.id;
            }
        }

        const stmt = this.db.prepare(`
            UPDATE items SET
                title = @title,
                description = @description,
                content = @content,
                story_id = @story_id,
                type_id = @type_id,
                year = @year,
                subtick = @subtick,
                original_subtick = CASE 
                    WHEN @subtick_changed = 1 THEN @subtick 
                    ELSE original_subtick 
                END,
                end_year = @end_year,
                end_subtick = @end_subtick,
                original_end_subtick = CASE 
                    WHEN @end_subtick_changed = 1 THEN @end_subtick 
                    ELSE original_end_subtick 
                END,
                book_title = @book_title,
                chapter = @chapter,
                page = @page,
                color = @color
            WHERE id = @id
        `);

        const result = stmt.run({
            id: id,
            title: item.title,
            description: item.description,
            content: item.content,
            story_id: item['story-id'],
            type_id: typeId,
            year: item.year,
            subtick: item.subtick,
            subtick_changed: subtickChanged ? 1 : 0,
            end_year: item.end_year || item.year,
            end_subtick: item.end_subtick || item.subtick,
            end_subtick_changed: endSubtickChanged ? 1 : 0,
            book_title: item.book_title,
            chapter: item.chapter,
            page: item.page,
            color: item.color
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
            INSERT INTO pictures (item_id, file_path, file_name, file_size, file_type, width, height, title, description)
            VALUES (@item_id, @file_path, @file_name, @file_size, @file_type, @width, @height, @title, @description)
        `);

        for (const pic of pictures) {
            stmt.run({
                item_id: itemId,
                file_path: pic.file_path,
                file_name: pic.file_name,
                file_size: pic.file_size,
                file_type: pic.file_type,
                width: pic.width,
                height: pic.height,
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
            INSERT INTO pictures (item_id, file_path, file_name, file_size, file_type, width, height, title, description)
            VALUES (@item_id, @file_path, @file_name, @file_size, @file_type, @width, @height, @title, @description)
        `);

        for (const pic of pictures) {
            stmt.run({
                item_id: itemId,
                file_path: pic.file_path,
                file_name: pic.file_name,
                file_size: pic.file_size,
                file_type: pic.file_type,
                width: pic.width,
                height: pic.height,
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

    // Timeline operations
    getTimeline(title, author) {
        const stmt = this.db.prepare('SELECT * FROM timelines WHERE title = ? AND author = ?');
        return stmt.get(title, author);
    }

    getAllTimelines() {
        const stmt = this.db.prepare(`
            WITH timeline_years AS (
                SELECT 
                    t.id,
                    t.title,
                    t.author,
                    t.description,
                    t.start_year,
                    t.granularity,
                    t.settings_id,
                    t.created_at,
                    t.updated_at,
                    MIN(i.year) as min_year,
                    MAX(i.year) as max_year,
                    COUNT(i.id) as item_count
                FROM timelines t
                LEFT JOIN items i ON i.timeline_id = t.id
                GROUP BY t.id, t.title, t.author, t.description, t.start_year, t.granularity, t.settings_id, t.created_at, t.updated_at
            )
            SELECT 
                id,
                title,
                author,
                description,
                start_year,
                granularity,
                settings_id,
                created_at,
                updated_at,
                CASE 
                    WHEN item_count = 0 THEN -2147483648
                    WHEN item_count = 1 THEN min_year
                    ELSE min_year
                END as start_year,
                CASE 
                    WHEN item_count = 0 THEN 2147483647
                    WHEN item_count = 1 THEN max_year
                    ELSE max_year
                END as end_year
            FROM timeline_years
            ORDER BY title, author
        `);
        return stmt.all();
    }

    createTimeline(timeline) {
        // First create settings for this timeline
        const settingsStmt = this.db.prepare(`
            INSERT INTO settings (
                font, font_size_scale, pixels_per_subtick, custom_css,
                custom_main_css, custom_items_css, use_timeline_css, use_main_css, use_items_css,
                is_fullscreen, show_guides, window_size_x, window_size_y, window_position_x, window_position_y,
                use_custom_scaling, custom_scale
            ) VALUES (
                @font, @font_size_scale, @pixels_per_subtick, @custom_css,
                @custom_main_css, @custom_items_css, @use_timeline_css, @use_main_css, @use_items_css,
                @is_fullscreen, @show_guides, @window_size_x, @window_size_y, @window_position_x, @window_position_y,
                @use_custom_scaling, @custom_scale
            )
        `);

        const defaultSettings = {
            font: 'Arial',
            font_size_scale: 1.0,
            pixels_per_subtick: 20,
            custom_css: '',
            custom_main_css: '',
            custom_items_css: '',
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

        const settingsResult = settingsStmt.run(defaultSettings);
        const settingsId = settingsResult.lastInsertRowid;

        // Then create the timeline
        const timelineStmt = this.db.prepare(`
            INSERT INTO timelines (
                title, author, description, start_year, granularity, settings_id
            ) VALUES (
                @title, @author, @description, @start_year, @granularity, @settings_id
            )
        `);

        const timelineData = {
            title: timeline.title,
            author: timeline.author,
            description: timeline.description || '',
            start_year: timeline.start_year || 0,
            granularity: timeline.granularity || 4,
            settings_id: settingsId
        };

        const timelineResult = timelineStmt.run(timelineData);
        const timelineId = timelineResult.lastInsertRowid;

        // Update settings with timeline_id if the column exists
        try {
            const updateSettingsStmt = this.db.prepare(`
                UPDATE settings 
                SET timeline_id = @timeline_id 
                WHERE id = @settings_id
            `);
            updateSettingsStmt.run({
                timeline_id: timelineId,
                settings_id: settingsId
            });
        } catch (error) {
            // If the timeline_id column doesn't exist, ignore the error
            console.log('Settings table does not have timeline_id column');
        }

        return timelineResult;
    }

    updateTimeline(timeline) {
        const stmt = this.db.prepare(`
            UPDATE timelines SET
                description = @description,
                start_year = @start_year,
                granularity = @granularity
            WHERE id = @id
        `);

        return stmt.run({
            id: timeline.id,
            description: timeline.description,
            start_year: timeline.start_year,
            granularity: timeline.granularity
        });
    }

    deleteTimeline(timelineId) {
        // Start a transaction
        this.db.prepare('BEGIN').run();

        try {
            // First delete item-related records
            this.db.prepare('DELETE FROM item_tags WHERE item_id IN (SELECT id FROM items WHERE timeline_id = ?)').run(timelineId);
            this.db.prepare('DELETE FROM pictures WHERE item_id IN (SELECT id FROM items WHERE timeline_id = ?)').run(timelineId);
            this.db.prepare('DELETE FROM item_story_refs WHERE item_id IN (SELECT id FROM items WHERE timeline_id = ?)').run(timelineId);
            
            // Then delete the items themselves
            this.db.prepare('DELETE FROM items WHERE timeline_id = ?').run(timelineId);
            
            // Delete the timeline itself
            this.db.prepare('DELETE FROM timelines WHERE id = ?').run(timelineId);
            
            // Settings will be automatically deleted due to ON DELETE CASCADE

            // Commit the transaction
            this.db.prepare('COMMIT').run();
            return true;
        } catch (error) {
            // Rollback on error
            this.db.prepare('ROLLBACK').run();
            console.error('Error deleting timeline:', error);
            throw error;
        }
    }

    getTimelineSettings(timelineId) {
        const stmt = this.db.prepare(`
            SELECT * FROM settings 
            WHERE timeline_id = @timeline_id
        `);
        const settings = stmt.get({ timeline_id: timelineId });
        
        if (!settings) {
            // If no settings exist, create default settings for this timeline
            const defaultSettings = {
                font: 'Arial',
                font_size_scale: 1.0,
                pixels_per_subtick: 20,
                custom_css: '',
                custom_main_css: '',
                custom_items_css: '',
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
                    timeline_id, font, font_size_scale, pixels_per_subtick, custom_css,
                    custom_main_css, custom_items_css, use_timeline_css, use_main_css, use_items_css,
                    is_fullscreen, show_guides, window_size_x, window_size_y, window_position_x, window_position_y,
                    use_custom_scaling, custom_scale
                ) VALUES (
                    @timeline_id, @font, @font_size_scale, @pixels_per_subtick, @custom_css,
                    @custom_main_css, @custom_items_css, @use_timeline_css, @use_main_css, @use_items_css,
                    @is_fullscreen, @show_guides, @window_size_x, @window_size_y, @window_position_x, @window_position_y,
                    @use_custom_scaling, @custom_scale
                )
            `);
            const result = insertStmt.run({ ...defaultSettings, timeline_id: timelineId });
            return { ...defaultSettings, id: result.lastInsertRowid, timeline_id: timelineId };
        }

        return settings;
    }

    // Add a new method to get timeline with its settings
    getTimelineWithSettings(timelineId) {
        const timelineStmt = this.db.prepare('SELECT * FROM timelines WHERE id = ?');
        const timeline = timelineStmt.get(timelineId);
        
        if (!timeline) {
            return null;
        }

        const settings = this.getTimelineSettings(timelineId);
        
        // Convert database snake_case to frontend camelCase
        return {
            id: timeline.id,
            title: timeline.title,
            author: timeline.author,
            description: timeline.description,
            start_year: timeline.start_year,
            granularity: timeline.granularity,
            settings: {
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
            }
        };
    }

    updateTimelineSettings(timelineId, settings) {
        const stmt = this.db.prepare(`
            UPDATE settings SET
                font = @font,
                font_size_scale = @font_size_scale,
                pixels_per_subtick = @pixels_per_subtick,
                custom_css = @custom_css,
                custom_main_css = @custom_main_css,
                custom_items_css = @custom_items_css,
                use_timeline_css = @use_timeline_css,
                use_main_css = @use_main_css,
                use_items_css = @use_items_css,
                is_fullscreen = @is_fullscreen,
                show_guides = @show_guides,
                window_size_x = @window_size_x,
                window_size_y = @window_size_y,
                window_position_x = @window_position_x,
                window_position_y = @window_position_y,
                use_custom_scaling = @use_custom_scaling,
                custom_scale = @custom_scale
            WHERE timeline_id = @timeline_id
        `);

        return stmt.run({
            ...settings,
            timeline_id: timelineId
        });
    }

    // Helper function to save image file and return file info
    async saveImageFile(base64Data, itemId) {
        const fs = require('fs');
        const path = require('path');
        const { app } = require('electron');

        // Get the timeline ID for this item
        const item = this.getItem(itemId);
        const timelineId = item.timeline_id;

        // Create media directory if it doesn't exist
        const mediaDir = path.join(app.getPath('userData'), 'media', 'pictures', timelineId);
        if (!fs.existsSync(mediaDir)) {
            fs.mkdirSync(mediaDir, { recursive: true });
        }

        // Generate unique filename
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(7);
        const fileName = `img_${timestamp}_${randomStr}.png`;
        const filePath = path.join(mediaDir, fileName);

        // Convert base64 to buffer and save
        const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Image, 'base64');
        await fs.promises.writeFile(filePath, buffer);

        // Get image dimensions
        const size = buffer.length;
        const dimensions = await new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve({ width: img.width, height: img.height });
            img.src = base64Data;
        });

        return {
            file_path: filePath,
            file_name: fileName,
            file_size: size,
            file_type: 'image/png',
            width: dimensions.width,
            height: dimensions.height
        };
    }

    // Modified addPicturesToItem to handle file storage
    async addPicturesToItem(itemId, pictures) {
        for (const pic of pictures) {
            if (pic.picture) {
                const fileInfo = await this.saveImageFile(pic.picture, itemId);
                const stmt = this.db.prepare(`
                    INSERT INTO pictures (
                        item_id, file_path, file_name, file_size, file_type,
                        width, height, title, description
                    ) VALUES (
                        @item_id, @file_path, @file_name, @file_size, @file_type,
                        @width, @height, @title, @description
                    )
                `);

                stmt.run({
                    item_id: itemId,
                    ...fileInfo,
                    title: pic.title || 'Untitled',
                    description: pic.description || ''
                });
            }
        }
    }

    // Modified getItemPictures to return file paths instead of base64
    getItemPictures(itemId) {
        const stmt = this.db.prepare('SELECT * FROM pictures WHERE item_id = ?');
        return stmt.all(itemId);
    }

    // Add a new timeline
    addTimeline(timeline) {
        // First create default settings
        const settingsStmt = this.db.prepare(`
            INSERT INTO settings (
                font, font_size_scale, pixels_per_subtick, custom_css,
                custom_main_css, custom_items_css, use_timeline_css, use_main_css, use_items_css,
                is_fullscreen, show_guides, window_size_x, window_size_y, window_position_x, window_position_y,
                use_custom_scaling, custom_scale
            ) VALUES (
                @font, @font_size_scale, @pixels_per_subtick, @custom_css,
                @custom_main_css, @custom_items_css, @use_timeline_css, @use_main_css, @use_items_css,
                @is_fullscreen, @show_guides, @window_size_x, @window_size_y, @window_position_x, @window_position_y,
                @use_custom_scaling, @custom_scale
            )
        `);

        const defaultSettings = {
            font: 'Arial',
            font_size_scale: 1.0,
            pixels_per_subtick: 20,
            custom_css: '',
            custom_main_css: '',
            custom_items_css: '',
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

        const settingsResult = settingsStmt.run(defaultSettings);
        const settingsId = settingsResult.lastInsertRowid;

        // Then create the timeline with the settings_id
        const timelineStmt = this.db.prepare(`
            INSERT INTO timelines (
                title, author, description, start_year, granularity, settings_id
            ) VALUES (
                @title, @author, @description, @start_year, @granularity, @settings_id
            )
        `);
        
        const timelineData = {
            title: timeline.title || 'New Timeline',
            author: timeline.author || '',
            description: timeline.description || '',
            start_year: timeline.start_year || 0,
            granularity: timeline.granularity || 4,
            settings_id: settingsId
        };

        const timelineResult = timelineStmt.run(timelineData);
        const timelineId = timelineResult.lastInsertRowid;

        // Update settings with timeline_id
        const updateSettingsStmt = this.db.prepare(`
            UPDATE settings 
            SET timeline_id = @timeline_id 
            WHERE id = @settings_id
        `);
        updateSettingsStmt.run({
            timeline_id: timelineId,
            settings_id: settingsId
        });
        
        return timelineId;
    }

    /**
     * Gets all items for a specific timeline
     * @param {string} timelineId - The ID of the timeline
     * @returns {Array} Array of items for the timeline
     */
    getItemsByTimeline(timelineId) {
        const stmt = this.db.prepare(`
            SELECT * FROM items 
            WHERE timeline_id = @timelineId
            ORDER BY year ASC, subtick ASC
        `);
        
        return stmt.all({ timelineId });
    }

    async saveNewImage(fileInfo) {
        const { app } = require('electron');
        const path = require('path');
        const fs = require('fs');

        try {
            // Get the current timeline ID
            const timeline = this.getUniverseData();
            if (!timeline || !timeline.id) {
                throw new Error('No active timeline found or timeline ID is missing');
            }

            // Create media directory if it doesn't exist
            const timelineMediaDir = path.join(app.getPath('userData'), 'media', 'pictures', timeline.id.toString());
            if (!fs.existsSync(timelineMediaDir)) {
                fs.mkdirSync(timelineMediaDir, { recursive: true });
            }

            // Generate unique filename
            const timestamp = Date.now();
            const randomStr = Math.random().toString(36).substring(7);
            const fileName = `img_${timestamp}_${randomStr}${path.extname(fileInfo.file_name)}`;
            const filePath = path.join(timelineMediaDir, fileName);

            // If we have a full file path, copy the file
            if (fileInfo.file_path && fileInfo.file_path !== fileInfo.file_name) {
                await fs.promises.copyFile(fileInfo.file_path, filePath);
            } else {
                // If we only have a filename, create an empty file
                await fs.promises.writeFile(filePath, '');
            }

            // Get image dimensions using sharp
            const metadata = await sharp(filePath).metadata();

            // Create the file info object
            const fileInfoObj = {
                file_path: filePath,
                file_name: fileName,
                file_size: fileInfo.file_size,
                file_type: fileInfo.file_type,
                width: metadata.width,
                height: metadata.height,
                title: path.parse(fileInfo.file_name).name,
                description: ''
            };

            // Insert into pictures table
            const stmt = this.db.prepare(`
                INSERT INTO pictures (
                    item_id, file_path, file_name, file_size, file_type,
                    width, height, title, description
                ) VALUES (
                    @item_id, @file_path, @file_name, @file_size, @file_type,
                    @width, @height, @title, @description
                )
            `);

            const result = stmt.run({
                item_id: fileInfo.item_id || null,  // Allow null for standalone images
                ...fileInfoObj
            });

            // Add the picture ID to the returned object
            fileInfoObj.id = result.lastInsertRowid;

            return fileInfoObj;
        } catch (error) {
            console.error('Error saving new image:', error);
            throw error;
        }
    }

    // Add a new method to update item_id for pictures after item creation
    updatePicturesItemId(pictureIds, itemId) {
        if (!Array.isArray(pictureIds) || pictureIds.length === 0 || !itemId) {
            return;
        }

        const stmt = this.db.prepare(`
            UPDATE pictures 
            SET item_id = @item_id 
            WHERE id IN (${pictureIds.map(() => '?').join(',')})
        `);

        return stmt.run({ item_id: itemId }, ...pictureIds);
    }
}

module.exports = new DatabaseManager(); 