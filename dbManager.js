const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

class DatabaseManager {
    constructor() {
        // Get the user data path from Electron
        const userDataPath = app.getPath('userData');
        const dbPath = path.join(userDataPath, 'timeline.db');

        console.log(dbPath);
        
        this.db = new Database(dbPath);
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
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                font TEXT,
                font_size_scale REAL DEFAULT 1.0,
                pixels_per_subtick INTEGER DEFAULT 20,
                custom_css TEXT,
                use_custom_css BOOLEAN DEFAULT 0,
                is_fullscreen BOOLEAN DEFAULT 0,
                show_guides BOOLEAN DEFAULT 1,
                window_size_x INTEGER,
                window_size_y INTEGER,
                window_position_x INTEGER,
                window_position_y INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
                book_title TEXT,
                chapter TEXT,
                page TEXT,
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
                content TEXT NOT NULL,
                year INTEGER,
                subtick INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Item-Story references (many-to-many)
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS item_story_refs (
                item_id TEXT,
                story_id TEXT,
                PRIMARY KEY (item_id, story_id),
                FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
                FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE
            )
        `);

        // Create triggers for updated_at timestamps
        this.db.exec(`
            CREATE TRIGGER IF NOT EXISTS update_universe_data_timestamp 
            AFTER UPDATE ON universe_data
            BEGIN
                UPDATE universe_data SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
            END
        `);

        this.db.exec(`
            CREATE TRIGGER IF NOT EXISTS update_settings_timestamp 
            AFTER UPDATE ON settings
            BEGIN
                UPDATE settings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
            END
        `);

        this.db.exec(`
            CREATE TRIGGER IF NOT EXISTS update_stories_timestamp 
            AFTER UPDATE ON stories
            BEGIN
                UPDATE stories SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
            END
        `);

        this.db.exec(`
            CREATE TRIGGER IF NOT EXISTS update_items_timestamp 
            AFTER UPDATE ON items
            BEGIN
                UPDATE items SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
            END
        `);

        this.db.exec(`
            CREATE TRIGGER IF NOT EXISTS update_notes_timestamp 
            AFTER UPDATE ON notes
            BEGIN
                UPDATE notes SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
            END
        `);
    }

    initializeDefaultData() {
        // Check if we have any settings
        const settings = this.getSettings();
        if (!settings) {
            const defaultSettings = {
                font: 'Arial',
                font_size_scale: 1.0,
                pixels_per_subtick: 20,
                custom_css: '',
                use_custom_css: false,
                is_fullscreen: false,
                show_guides: true,
                window_size_x: 800,
                window_size_y: 600,
                window_position_x: 100,
                window_position_y: 100
            };
            this.updateSettings(defaultSettings);
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
        return stmt.run(dbData);
    }

    // Settings operations
    getSettings() {
        const stmt = this.db.prepare('SELECT * FROM settings ORDER BY id DESC LIMIT 1');
        const settings = stmt.get();
        
        if (!settings) {
            return null;
        }

        // Convert database field names to frontend field names and convert integers back to booleans
        return {
            font: settings.font,
            fontSizeScale: settings.font_size_scale,
            pixelsPerSubtick: settings.pixels_per_subtick,
            customCSS: settings.custom_css,
            useCustomCSS: Boolean(settings.use_custom_css),
            isFullscreen: Boolean(settings.is_fullscreen),
            size: {
                x: settings.window_size_x,
                y: settings.window_size_y
            },
            position: {
                x: settings.window_position_x,
                y: settings.window_position_y
            }
        };
    }

    updateSettings(settings) {
        // Convert frontend field names to database field names and ensure proper types
        const dbSettings = {
            font: settings.font || 'Arial',
            font_size_scale: parseFloat(settings.fontSizeScale || settings.font_size_scale || 1.0),
            pixels_per_subtick: parseInt(settings.pixelsPerSubtick || settings.pixels_per_subtick || 20),
            custom_css: settings.customCSS || settings.custom_css || '',
            use_custom_css: (settings.useCustomCSS || settings.use_custom_css || false) ? 1 : 0,
            is_fullscreen: (settings.isFullscreen || settings.is_fullscreen || false) ? 1 : 0,
            window_size_x: parseInt((settings.size && settings.size.x) || settings.window_size_x || 800),
            window_size_y: parseInt((settings.size && settings.size.y) || settings.window_size_y || 600),
            window_position_x: parseInt((settings.position && settings.position.x) || settings.window_position_x || 100),
            window_position_y: parseInt((settings.position && settings.position.y) || settings.window_position_y || 100)
        };

        const stmt = this.db.prepare(`
            INSERT INTO settings (
                font, font_size_scale, pixels_per_subtick, custom_css, 
                use_custom_css, is_fullscreen, window_size_x, window_size_y,
                window_position_x, window_position_y
            )
            VALUES (
                @font, @font_size_scale, @pixels_per_subtick, @custom_css,
                @use_custom_css, @is_fullscreen, @window_size_x, @window_size_y,
                @window_position_x, @window_position_y
            )
        `);
        return stmt.run(dbSettings);
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
        // Main story reference (for backward compatibility)
        let storyId = item.story_id || item['story-id'];
        let storyTitle = item.story;
        if (storyId && storyTitle) {
            this.getOrCreateStory(storyTitle, storyId);
        }
        // Generate a unique ID if not provided
        const id = item.id || item['id'] || `ITEM-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        const stmt = this.db.prepare(`
            INSERT INTO items (
                id, title, description, content, story_id, 
                year, subtick, book_title, chapter, page
            )
            VALUES (
                @id, @title, @description, @content, @story_id,
                @year, @subtick, @book_title, @chapter, @page
            )
        `);

        console.log("item: ", item);

        stmt.run({
            id: id,
            title: item.title,
            description: item.description,
            content: item.content,
            story_id: storyId || null,
            year: item.year,
            subtick: item.subtick,
            book_title: item.book_title,
            chapter: item.chapter,
            page: item.page
        });
        if (item.tags && item.tags.length > 0) {
            this.addTagsToItem(id, item.tags);
        }
        if (item.pictures && item.pictures.length > 0) {
            this.addPicturesToItem(id, item.pictures);
        }
        // Handle multiple story references
        if (item.story_refs && Array.isArray(item.story_refs)) {
            this.addStoryReferencesToItem(id, item.story_refs);
        }
        return this.getItem(id);
    }

    getItem(id) {
        const stmt = this.db.prepare(`
            SELECT i.*, s.title as story_title, s.id as story_id, s.description as story_description
            FROM items i 
            LEFT JOIN stories s ON i.story_id = s.id 
            WHERE i.id = ?
        `);
        const item = stmt.get(id);
        if (item) {
            item.tags = this.getItemTags(id);
            item.pictures = this.getItemPictures(id);
            item.story_refs = this.getItemStoryReferences(id);
        }
        return item;
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
        const stmt = this.db.prepare(`
            UPDATE items 
            SET title = @title,
                description = @description,
                content = @content,
                story_id = @story_id,
                year = @year,
                subtick = @subtick,
                book_title = @book_title,
                chapter = @chapter,
                page = @page
            WHERE id = @id
        `);
        
        stmt.run({
            id: id,
            title: item.title,
            description: item.description,
            content: item.content,
            story_id: item['story-id'],
            year: item.year,
            subtick: item.subtick,
            book_title: item.book_title,
            chapter: item.chapter,
            page: item.page
        });

        // Update tags and pictures if provided
        if (item.tags) {
            this.updateItemTags(id, item.tags);
        }
        if (item.pictures) {
            this.updateItemPictures(id, item.pictures);
        }

        // Update story references
        if (item.story_refs) {
            this.db.prepare('DELETE FROM item_story_refs WHERE item_id = ?').run(id);
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