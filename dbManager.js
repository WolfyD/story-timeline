const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const sharp = require('sharp');
const crypto = require('crypto');

// Try to get Electron app, but don't fail if not in Electron environment
let app;
try {
    app = require('electron').app;
} catch (e) {
    // Not in Electron environment
    app = null;
}

class DatabaseManager {
    // Epic title generation
    static EPIC_ADJECTIVES = [
        'Ancient', 'Mystical', 'Eternal', 'Forgotten', 'Legendary', 'Mythical',
        'Enchanted', 'Celestial', 'Cosmic', 'Divine', 'Sacred', 'Primal',
        'Arcane', 'Ethereal', 'Mysterious', 'Timeless', 'Infinite', 'Boundless',
        'Majestic', 'Noble', 'Radiant', 'Splendid', 'Glorious', 'Magnificent',
        'Astral', 'Eldritch', 'Transcendent', 'Immortal', 'Venerable', 'Sovereign',
        'Mystic', 'Ethereal', 'Astral', 'Cosmic', 'Celestial', 'Divine',
        'Primal', 'Ancient', 'Eternal', 'Infinite', 'Timeless', 'Immortal',
        'Mystical', 'Enchanted', 'Arcane', 'Sacred', 'Legendary', 'Mythical',
        'Majestic', 'Noble', 'Radiant', 'Splendid', 'Glorious', 'Magnificent',
        'Transcendent', 'Venerable', 'Sovereign', 'Eldritch', 'Astral', 'Ethereal',
        'Cosmic', 'Celestial', 'Divine', 'Primal', 'Ancient', 'Eternal',
        'Infinite', 'Timeless', 'Immortal', 'Mystical', 'Enchanted', 'Arcane',
        'Sacred', 'Legendary', 'Mythical', 'Majestic', 'Noble', 'Radiant',
        'Splendid', 'Glorious', 'Magnificent', 'Transcendent', 'Venerable', 'Sovereign'
    ];

    static EPIC_NOUNS = [
        'Chronicles', 'Saga', 'Legacy', 'Destiny', 'Odyssey', 'Voyage',
        'Journey', 'Quest', 'Tale', 'Epic', 'Legend', 'Myth',
        'Realm', 'Domain', 'Empire', 'Kingdom', 'Dynasty', 'Era',
        'Epoch', 'Age', 'Time', 'World', 'Universe', 'Cosmos',
        'Nexus', 'Vortex', 'Abyss', 'Horizon', 'Voyage', 'Expedition',
        'Pilgrimage', 'Crusade', 'Conquest', 'Ascension', 'Transcendence', 'Awakening',
        'Genesis', 'Apocalypse', 'Revelation', 'Prophecy', 'Oracle', 'Vision',
        'Dream', 'Nightmare', 'Fantasy', 'Reality', 'Dimension', 'Existence',
        'Creation', 'Destruction', 'Rebirth', 'Evolution', 'Revolution', 'Transformation',
        'Harmony', 'Chaos', 'Order', 'Balance', 'Equilibrium', 'Paradox',
        'Mystery', 'Enigma', 'Riddle', 'Puzzle', 'Conundrum', 'Maze',
        'Labyrinth', 'Sanctuary', 'Temple', 'Shrine', 'Altar', 'Throne',
        'Crown', 'Scepter', 'Orb', 'Crystal', 'Gem', 'Jewel',
        'Artifact', 'Relic', 'Talisman', 'Amulet', 'Charm', 'Token',
        'Scroll', 'Tome', 'Grimoire', 'Codex', 'Manuscript', 'Archive',
        'Library', 'Repository', 'Vault', 'Treasury', 'Hoard', 'Cache'
    ];

    static generateEpicTitle() {
        const adjective = DatabaseManager.EPIC_ADJECTIVES[Math.floor(Math.random() * DatabaseManager.EPIC_ADJECTIVES.length)];
        const noun = DatabaseManager.EPIC_NOUNS[Math.floor(Math.random() * DatabaseManager.EPIC_NOUNS.length)];
        return `The ${adjective} ${noun}`;
    }

    constructor() {
        // Get the user data path from Electron or use a local path
        let userDataPath;
        if (app) {
            userDataPath = app.getPath('userData');
        } else {
            // Use a local directory for testing
            userDataPath = path.join(__dirname, 'test_data');
            if (!fs.existsSync(userDataPath)) {
                fs.mkdirSync(userDataPath, { recursive: true });
            }
        }
        
        const dbPath = path.join(userDataPath, 'timeline.db');
        console.log('Database path:', dbPath);
        
        this.db = require('better-sqlite3')(dbPath);
        this.initializeTables();
        this.migrateDatabase();
        this.initializeDefaultData();
        this.createIndexes();

        // Initialize currentTimelineId with the first timeline
        const firstTimeline = this.db.prepare('SELECT id FROM timelines ORDER BY id ASC LIMIT 1').get();
        this.currentTimelineId = firstTimeline ? firstTimeline.id : null;
        console.log('[dbManager.js] Initialized current timeline ID to:', this.currentTimelineId);
    }

    initializeTables() {
        // Check if universe_data table exists
        const universeDataExists = this.db.prepare(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='universe_data'
        `).get();

        // Check if timelines table exists
        const timelinesExists = this.db.prepare(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='timelines'
        `).get();

        // If no universe_data and timelines exists, DB is already initialized
        if (!universeDataExists && timelinesExists) {
            console.log('Database already initialized, skipping initialization');
            return;
        }

        // Create timelines table (replacing universe_data)
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS timelines (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                author TEXT NOT NULL,
                description TEXT,
                start_year INTEGER DEFAULT 0,
                granularity INTEGER DEFAULT 4,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(title, author)
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
                window_size_x INTEGER DEFAULT 1000,
                window_size_y INTEGER DEFAULT 700,
                window_position_x INTEGER DEFAULT 300,
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
            { name: 'Character', description: 'A person or entity' },
            { name: 'Timeline_start', description: 'The start point of the timeline' },
            { name: 'Timeline_end', description: 'The end point of the timeline' }
        ];

        const insertTypeStmt = this.db.prepare(`
            INSERT OR IGNORE INTO item_types (id, name, description)
            VALUES (@id, @name, @description)
        `);

        for (const type of defaultTypes) {
            insertTypeStmt.run({
                id: type.name === 'Timeline_start' ? 8 : type.name === 'Timeline_end' ? 9 : undefined,
                name: type.name,
                description: type.description
            });
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
                item_index INTEGER DEFAULT 0,
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
                file_path TEXT,
                file_name TEXT,
                file_size INTEGER,
                file_type TEXT,
                width INTEGER,
                height INTEGER,
                title TEXT,
                description TEXT,
                picture TEXT,
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

        // If universe_data exists, add required columns to existing tables
        if (universeDataExists) {
            console.log('Adding required columns for migration...');

            // Helper function to check if column exists
            const columnExists = (table, column) => {
                const columns = this.db.prepare(`PRAGMA table_info('${table}')`).all();
                return columns.some(col => col.name === column);
            };

            // Add columns to items table
            if (!columnExists('items', 'timeline_id')) {
                this.db.exec('ALTER TABLE items ADD COLUMN timeline_id INTEGER');
            }
            if (!columnExists('items', 'item_index')) {
                this.db.exec('ALTER TABLE items ADD COLUMN item_index INTEGER DEFAULT 0');
            }

            // Add columns to pictures table
            const pictureColumns = [
                { name: 'file_path', type: 'TEXT' },
                { name: 'file_name', type: 'TEXT' },
                { name: 'file_size', type: 'INTEGER' },
                { name: 'file_type', type: 'TEXT' },
                { name: 'width', type: 'INTEGER' },
                { name: 'height', type: 'INTEGER' }
            ];

            for (const col of pictureColumns) {
                if (!columnExists('pictures', col.name)) {
                    this.db.exec(`ALTER TABLE pictures ADD COLUMN ${col.name} ${col.type}`);
                }
            }

            // Add column to settings table
            if (!columnExists('settings', 'timeline_id')) {
                this.db.exec('ALTER TABLE settings ADD COLUMN timeline_id INTEGER');
            }

            console.log('Added required columns for migration');
        }
    }

    // Helper method to check and add missing columns
    ensureTableColumns(tableName, requiredColumns) {
        // Get current columns
        const currentColumns = this.db.prepare(`PRAGMA table_info(${tableName})`).all();
        const existingColumnNames = currentColumns.map(col => col.name);

        // Check each required column
        for (const column of requiredColumns) {
            if (!existingColumnNames.includes(column.name)) {
                console.log(`Adding missing column ${column.name} to ${tableName}`);
                const alterStmt = `ALTER TABLE ${tableName} ADD COLUMN ${column.name} ${column.type}${column.default ? ` DEFAULT ${column.default}` : ''}`;
                this.db.prepare(alterStmt).run();
            }
        }
    }

    async migrateDatabase() {
        try {
            // Start a transaction
            this.db.prepare('BEGIN').run();

            // Check if universe_data table exists
            const tableExists = this.db.prepare(`
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='universe_data'
            `).get();

            if (tableExists) {
                console.log('Found universe_data table, starting migration...');
                
                // Get the current universe data
                const universeData = this.db.prepare('SELECT * FROM universe_data ORDER BY id DESC LIMIT 1').get();
                
                if (universeData) {
                    // Create a new timeline with the universe data
                    const insertStmt = this.db.prepare(`
                        INSERT INTO timelines (
                            title, author, description, start_year, granularity, created_at, updated_at
                        ) VALUES (
                            @title, @author, @description, @start_year, @granularity, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                        )
                    `);

                    insertStmt.run({
                        title: universeData.title || 'Untitled Timeline',
                        author: universeData.author || '',
                        description: universeData.description || '',
                        start_year: universeData.start_year || 0,
                        granularity: universeData.granularity || 4
                    });

                    const timelineId = this.db.prepare('SELECT id FROM timelines ORDER BY id DESC LIMIT 1').get().id;

                    // Update items with timeline_id and default type_id
                    const itemStmt = this.db.prepare(`
                        UPDATE items 
                        SET timeline_id = @timeline_id,
                            type_id = CASE 
                                WHEN type_id IS NULL THEN 1 
                                ELSE type_id 
                            END
                        WHERE timeline_id IS NULL
                    `);

                    itemStmt.run({ timeline_id: timelineId });

                    // Update settings with timeline_id
                    const settingsStmt = this.db.prepare(`
                        UPDATE settings 
                        SET timeline_id = @timeline_id 
                        WHERE timeline_id IS NULL
                    `);

                    settingsStmt.run({ timeline_id: timelineId });
                    console.log('Updated settings with timeline_id');

                    // Migrate pictures from base64 to files
                    await this.migratePictures(true);
                }

                // Drop the universe_data table
                this.db.prepare('DROP TABLE IF EXISTS universe_data').run();
                console.log('Migration completed successfully');
            }

            // Reindex items within the same transaction
            this.reindexItems(true);

            // Commit the transaction
            this.db.prepare('COMMIT').run();
        } catch (error) {
            // Rollback on error
            this.db.prepare('ROLLBACK').run();
            console.error('Error during database migration:', error);
            throw error;
        }
    }

    initializeDefaultData() {
        // Initialize default settings if none exist
        const settingsStmt = this.db.prepare('SELECT COUNT(*) as count FROM settings');
        const settingsResult = settingsStmt.get();
        
        if (settingsResult.count === 0) {
            const defaultSettings = {
                id: 1,
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
                window_size_x: 1000,
                window_size_y: 700,
                window_position_x: 300,
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
            // Create a default timeline with an epic title
            const defaultTimeline = {
                title: DatabaseManager.generateEpicTitle(),
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
        // Get the current timeline by ID
        const stmt = this.db.prepare('SELECT * FROM timelines WHERE id = ?');
        const data = stmt.get(this.currentTimelineId);
        
        if (!data) {
            console.error('[dbManager.js] No timeline found with ID:', this.currentTimelineId);
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

    // Add a method to set the current timeline
    setCurrentTimeline(timelineId) {
        this.currentTimelineId = timelineId;
        console.log('[dbManager.js] Set current timeline ID to:', timelineId);
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
        let timeline_id = this.currentTimelineId;
        if (!timeline) return null;
        
        const settings = this.getTimelineSettings(timeline_id);
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
            useCustomScaling: settings.use_custom_scaling === 1,
            customScale: settings.custom_scale,
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

        // First check if settings exist for this timeline
        const checkStmt = this.db.prepare('SELECT id FROM settings WHERE timeline_id = ?');
        const existingSettings = checkStmt.get(timelineId);

        if (!existingSettings) {
            // If no settings exist, create them
            console.log('No existing settings found, creating new settings');
            const insertStmt = this.db.prepare(`
                INSERT INTO settings (
                    timeline_id, font, font_size_scale, pixels_per_subtick,
                    custom_css, custom_main_css, custom_items_css,
                    use_timeline_css, use_main_css, use_items_css,
                    is_fullscreen, show_guides,
                    window_size_x, window_size_y,
                    window_position_x, window_position_y,
                    use_custom_scaling, custom_scale
                ) VALUES (
                    @timeline_id, @font, @font_size_scale, @pixels_per_subtick,
                    @custom_css, @custom_main_css, @custom_items_css,
                    @use_timeline_css, @use_main_css, @use_items_css,
                    @is_fullscreen, @show_guides,
                    @window_size_x, @window_size_y,
                    @window_position_x, @window_position_y,
                    @use_custom_scaling, @custom_scale
                )
            `);
            return insertStmt.run(settings);
        }

        // Update existing settings
        console.log('Updating existing settings');
        const updateStmt = this.db.prepare(`
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

        const result = updateStmt.run(settings);
        console.log('Settings update result:', result);
        return result;
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

    getAllPictures() {
        // Get all items for the current timeline
        const items = this.getAllItems();

        let itemIds_string = items.map(item => "'" + item.id + "'").join(',');

        // Get all pictures for the current timeline
        const stmt = this.db.prepare("SELECT * FROM pictures where item_id is null or item_id = '' or item_id in (" + itemIds_string + ") ORDER BY file_name");
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
            // Generate a new ID if one isn't provided
            const itemId = item.id || require('uuid').v4();

            // Get type_id from type name
            const typeStmt = this.db.prepare('SELECT id FROM item_types WHERE name = ?');
            const typeResult = typeStmt.get(item.type || 'Event');
            const typeId = typeResult ? typeResult.id : 1; // Default to Event (id: 1) if type not found

            // Get the next index for this timeline
            const getMaxIndex = this.db.prepare('SELECT MAX(item_index) as max_index FROM items WHERE timeline_id = ?');
            const maxIndexResult = getMaxIndex.get(item.timeline_id);
            const nextIndex = (maxIndexResult.max_index || 0) + 1;

            // Insert the item
            const stmt = this.db.prepare(`
                INSERT INTO items (
                    id, title, description, content, year, subtick,
                    original_subtick, end_year, end_subtick, original_end_subtick,
                    creation_granularity, book_title, chapter, page, type_id, color, timeline_id, item_index
                ) VALUES (
                    @id, @title, @description, @content, @year, @subtick,
                    @original_subtick, @end_year, @end_subtick, @original_end_subtick,
                    @creation_granularity, @book_title, @chapter, @page, @type_id, @color, @timeline_id, @item_index
                )
            `);

            const result = stmt.run({
                id: itemId,
                title: item.title,
                description: item.description || '',
                content: item.content || '',
                year: item.year,
                subtick: item.subtick,
                original_subtick: item.original_subtick || item.subtick,
                end_year: item.end_year || item.year,
                end_subtick: item.end_subtick || item.subtick,
                original_end_subtick: item.original_end_subtick || item.original_subtick || item.subtick,
                creation_granularity: item.creation_granularity || this.getUniverseData().granularity,
                book_title: item.book_title || '',
                chapter: item.chapter || '',
                page: item.page || '',
                type_id: typeId,
                color: item.color || null,
                timeline_id: item.timeline_id || this.currentTimelineId,
                item_index: nextIndex
            });

            // Add tags if any
            if (item.tags && item.tags.length > 0) {
                this.addTagsToItem(itemId, item.tags);
            }

            // Add story references if any
            if (item.story_refs && item.story_refs.length > 0) {
                this.addStoryReferencesToItem(itemId, item.story_refs);
            }

            // Add pictures if any
            if (item.pictures && item.pictures.length > 0) {
                // First, update any pictures that were uploaded before the item was created
                const pictureIds = item.pictures
                    .filter(pic => pic.id) // Only include pictures that have an ID (were already saved)
                    .map(pic => pic.id);
                
                if (pictureIds.length > 0) {
                    this.updatePicturesItemId(pictureIds, itemId);
                }

                // Then add any new pictures
                const newPictures = item.pictures.filter(pic => !pic.id);
                if (newPictures.length > 0) {
                    this.addPicturesToItem(itemId, newPictures);
                }
            }

            return { id: itemId };
        } catch (error) {
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
            ORDER BY i.year, i.subtick, i.item_index
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

    getAllTags() {
        const stmt = this.db.prepare('SELECT name FROM tags ORDER BY name');
        return stmt.all().map(row => row.name);
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
                    t.created_at,
                    t.updated_at,
                    MIN(CASE 
                        WHEN i.type_id IN (SELECT id FROM item_types WHERE name IN ('Period', 'Age')) 
                        THEN i.year 
                        ELSE i.year 
                    END) as min_year,
                    MAX(CASE 
                        WHEN i.type_id IN (SELECT id FROM item_types WHERE name IN ('Period', 'Age')) 
                        THEN i.end_year 
                        ELSE i.year 
                    END) as max_year,
                    COUNT(i.id) as item_count
                FROM timelines t
                LEFT JOIN items i ON i.timeline_id = t.id
                LEFT JOIN item_types it ON i.type_id = it.id
                GROUP BY t.id, t.title, t.author, t.description, t.start_year, t.granularity, t.created_at, t.updated_at
            )
            SELECT 
                id,
                title,
                author,
                description,
                start_year,
                granularity,
                created_at,
                updated_at,
                CASE 
                    WHEN item_count = 0 THEN '−∞ - ∞'
                    ELSE CAST(min_year AS TEXT) || ' - ' || CAST(max_year AS TEXT)
                END as year_range,
                item_count
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
            id: 1,
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
            window_size_x: 1000,
            window_size_y: 700,
            window_position_x: 300,
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
            // First delete settings (due to foreign key constraint)
            this.db.prepare('DELETE FROM settings WHERE timeline_id = ?').run(timelineId);
            
            // Then delete item-related records
            this.db.prepare('DELETE FROM item_tags WHERE item_id IN (SELECT id FROM items WHERE timeline_id = ?)').run(timelineId);
            this.db.prepare('DELETE FROM pictures WHERE item_id IN (SELECT id FROM items WHERE timeline_id = ?)').run(timelineId);
            this.db.prepare('DELETE FROM item_story_refs WHERE item_id IN (SELECT id FROM items WHERE timeline_id = ?)').run(timelineId);
            
            // Then delete the items themselves
            this.db.prepare('DELETE FROM items WHERE timeline_id = ?').run(timelineId);
            
            // Finally delete the timeline itself
            this.db.prepare('DELETE FROM timelines WHERE id = ?').run(timelineId);

            // Delete the timeline's images folder
            const fs = require('fs');
            const path = require('path');
            let baseDir;
            if (app) {
                baseDir = path.join(app.getPath('userData'), 'media', 'pictures');
            } else {
                baseDir = path.join(__dirname, 'test_data', 'media', 'pictures');
            }
            const timelineMediaDir = path.join(baseDir, timelineId.toString());
            if (fs.existsSync(timelineMediaDir)) {
                fs.rmSync(timelineMediaDir, { recursive: true, force: true });
            }

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
                id: 1,
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
                window_size_x: 1000,
                window_size_y: 700,
                window_position_x: 300,
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

        // Get the timeline ID for this item
        const item = this.getItem(itemId);
        const timelineId = item.timeline_id;

        // Get the base directory for media
        let baseDir;
        if (app) {
            baseDir = path.join(app.getPath('userData'), 'media', 'pictures');
        } else {
            baseDir = path.join(__dirname, 'test_data', 'media', 'pictures');
        }

        // Create media directory if it doesn't exist
        const mediaDir = path.join(baseDir, timelineId.toString());
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
        // First create the timeline
        const timelineStmt = this.db.prepare(`
            INSERT INTO timelines (
                title, author, description, start_year, granularity
            ) VALUES (
                @title, @author, @description, @start_year, @granularity
            )
        `);
        
        const timelineData = {
            title: timeline.title || 'New Timeline',
            author: timeline.author || '',
            description: timeline.description || '',
            start_year: timeline.start_year || 0,
            granularity: timeline.granularity || 4
        };

        const timelineResult = timelineStmt.run(timelineData);
        const timelineId = timelineResult.lastInsertRowid;

        // Then create settings for this timeline
        const settingsStmt = this.db.prepare(`
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

        const defaultSettings = {
            timeline_id: timelineId,
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
            window_size_x: 1000,
            window_size_y: 700,
            window_position_x: 300,
            window_position_y: 100,
            use_custom_scaling: 0,
            custom_scale: 1.0
        };

        settingsStmt.run(defaultSettings);
        
        return timelineId;
    }

    /**
     * Gets all items for a specific timeline
     * @param {string} timelineId - The ID of the timeline
     * @returns {Array} Array of items for the timeline
     */
    getItemsByTimeline(timelineId) {
        const stmt = this.db.prepare(`
            SELECT i.*, t.name as type
            FROM items i
            LEFT JOIN item_types t ON i.type_id = t.id
            WHERE i.timeline_id = @timelineId
            ORDER BY i.year ASC, i.subtick ASC, i.item_index ASC
        `);
        
        const items = stmt.all({ timelineId });
        return items.map(item => ({
            ...item,
            tags: this.getItemTags(item.id),
            pictures: this.getItemPictures(item.id),
            story_refs: this.getItemStoryReferences(item.id)
        }));
    }

    async saveNewImage(fileInfo) {
        const path = require('path');
        const fs = require('fs');

        try {
            // Get the current timeline ID
            const timeline = this.getUniverseData();
            if (!timeline || !timeline.id) {
                throw new Error('No active timeline found or timeline ID is missing');
            }

            // Get the base directory for media
            let baseDir;
            if (app) {
                baseDir = path.join(app.getPath('userData'), 'media', 'pictures');
            } else {
                baseDir = path.join(__dirname, 'test_data', 'media', 'pictures');
            }

            // Create media directory if it doesn't exist
            const timelineMediaDir = path.join(baseDir, timeline.id.toString());
            if (!fs.existsSync(timelineMediaDir)) {
                fs.mkdirSync(timelineMediaDir, { recursive: true });
            }

            // Generate unique filename
            const timestamp = Date.now();
            const randomStr = Math.random().toString(36).substring(7);
            const fileName = `img_${timestamp}_${randomStr}${path.extname(fileInfo.file_name)}`;
            const filePath = path.join(timelineMediaDir, fileName);

            // Define maximum dimensions
            const MAX_WIDTH = 1920;
            const MAX_HEIGHT = 1080;
            const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

            let imageBuffer;
            if (fileInfo.file_path && fileInfo.file_path !== fileInfo.file_name) {
                // Read the source file
                imageBuffer = await fs.promises.readFile(fileInfo.file_path);
            } else {
                // If we only have a filename, create an empty file
                await fs.promises.writeFile(filePath, '');
                return null;
            }

            // Process the image with sharp
            let sharpImage = sharp(imageBuffer);
            const metadata = await sharpImage.metadata();

            // Check if image needs resizing
            if (metadata.width > MAX_WIDTH || metadata.height > MAX_HEIGHT) {
                sharpImage = sharpImage.resize({
                    width: Math.min(metadata.width, MAX_WIDTH),
                    height: Math.min(metadata.height, MAX_HEIGHT),
                    fit: 'inside',
                    withoutEnlargement: true
                });
            }

            // Check if file size needs compression
            const fileSize = imageBuffer.length;
            if (fileSize > MAX_FILE_SIZE) {
                sharpImage = sharpImage.jpeg({ quality: 80 }); // Convert to JPEG with 80% quality
            }

            // Save the processed image
            await sharpImage.toFile(filePath);

            // Get final metadata after processing
            const finalMetadata = await sharp(filePath).metadata();

            // Create the file info object
            const fileInfoObj = {
                file_path: filePath,
                file_name: fileName,
                file_size: finalMetadata.size || fileSize,
                file_type: 'image/jpeg', // Always JPEG after processing
                width: finalMetadata.width,
                height: finalMetadata.height,
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

    /**
     * Reindexes all items in the database to ensure even distribution above/below timeline
     * Items are ordered by year and subtick, then assigned sequential indices
     * @param {boolean} inTransaction - Whether this method is being called from within a transaction
     */
    reindexItems(inTransaction = false) {
        try {
            // Only start a transaction if we're not already in one
            if (!inTransaction) {
                this.db.prepare('BEGIN').run();
            }

            // Get all timelines
            const timelines = this.db.prepare('SELECT id FROM timelines').all();

            for (const timeline of timelines) {
                // Get all items for this timeline, ordered by year and subtick
                const items = this.db.prepare(`
                    SELECT id FROM items 
                    WHERE timeline_id = ? 
                    ORDER BY year, subtick
                `).all(timeline.id);

                // Update each item with a new index
                const updateStmt = this.db.prepare(`
                    UPDATE items 
                    SET item_index = ? 
                    WHERE id = ?
                `);

                items.forEach((item, index) => {
                    updateStmt.run(index, item.id);
                });
            }

            // Only commit if we started the transaction
            if (!inTransaction) {
                this.db.prepare('COMMIT').run();
            }
            console.log('Successfully reindexed all items');
        } catch (error) {
            // Only rollback if we started the transaction
            if (!inTransaction) {
                this.db.prepare('ROLLBACK').run();
            }
            console.error('Error reindexing items:', error);
            throw error;
        }
    }

    createIndexes() {
        console.log('Creating database indexes...');
        
        // Items table indexes
        this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_items_timeline_id ON items(timeline_id);
            CREATE INDEX IF NOT EXISTS idx_items_year_subtick ON items(year, subtick);
            CREATE INDEX IF NOT EXISTS idx_items_type_id ON items(type_id);
            CREATE INDEX IF NOT EXISTS idx_items_item_index ON items(item_index);
            CREATE INDEX IF NOT EXISTS idx_items_story_id ON items(story_id);
        `);

        // Item-Tags junction table indexes
        this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_item_tags_item_id ON item_tags(item_id);
            CREATE INDEX IF NOT EXISTS idx_item_tags_tag_id ON item_tags(tag_id);
        `);

        // Pictures table indexes
        this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_pictures_item_id ON pictures(item_id);
        `);

        // Item-Story References table indexes
        this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_item_story_refs_item_id ON item_story_refs(item_id);
            CREATE INDEX IF NOT EXISTS idx_item_story_refs_story_id ON item_story_refs(story_id);
        `);

        // Tags table indexes
        this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
        `);

        // Notes table indexes
        this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_notes_year_subtick ON notes(year, subtick);
        `);

        console.log('Database indexes created successfully');
    }

    async migratePictures(inTransaction = false) {
        const fs = require('fs');
        const path = require('path');
        const { app } = require('electron');
        const sharp = require('sharp');

        // Only start a transaction if we're not already in one
        if (!inTransaction) {
            this.db.prepare('BEGIN').run();
        }

        try {
            // Backup existing pictures data
            const existingPictures = this.db.prepare(`
                SELECT i.id as item_id, p.id as picture_id, p.picture as base64_data, p.title, p.description
                FROM items i
                JOIN pictures p ON i.id = p.item_id
                WHERE p.picture IS NOT NULL
            `).all();

            // Drop and recreate pictures table with new schema
            this.db.prepare('DROP TABLE IF EXISTS pictures').run();
            this.db.prepare(`
                CREATE TABLE pictures (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    item_id TEXT,
                    file_path TEXT,
                    file_name TEXT,
                    file_size INTEGER,
                    file_type TEXT,
                    width INTEGER,
                    height INTEGER,
                    title TEXT,
                    description TEXT,
                    picture TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
                )
            `).run();

            console.log(`Found ${existingPictures.length} items with base64 pictures to migrate`);

            // Now migrate the pictures to files
            for (const item of existingPictures) {
                // Get the timeline_id for this item
                const timelineId = this.db.prepare('SELECT timeline_id FROM items WHERE id = ?').get(item.item_id).timeline_id;

                // Create media directory if it doesn't exist
                const mediaDir = path.join(app.getPath('userData'), 'media', 'pictures', timelineId.toString());
                if (!fs.existsSync(mediaDir)) {
                    fs.mkdirSync(mediaDir, { recursive: true });
                }

                // Generate unique filename
                const timestamp = Date.now();
                const randomStr = Math.random().toString(36).substring(7);
                const fileName = `img_${timestamp}_${randomStr}.png`;
                const filePath = path.join(mediaDir, fileName);

                // Convert base64 to buffer and save
                const base64Image = item.base64_data.replace(/^data:image\/\w+;base64,/, '');
                const buffer = Buffer.from(base64Image, 'base64');
                await fs.promises.writeFile(filePath, buffer);

                // Get image dimensions using sharp
                const metadata = await sharp(buffer).metadata();
                const size = buffer.length;

                // Insert the picture with file information and maintain the item_id connection
                const insertStmt = this.db.prepare(`
                    INSERT INTO pictures (
                        item_id, file_path, file_name, file_size, file_type,
                        width, height, title, description
                    ) VALUES (
                        @item_id, @file_path, @file_name, @file_size, @file_type,
                        @width, @height, @title, @description
                    )
                `);

                insertStmt.run({
                    item_id: item.item_id,
                    file_path: filePath,
                    file_name: fileName,
                    file_size: size,
                    file_type: 'image/png',
                    width: metadata.width,
                    height: metadata.height,
                    title: item.title || 'Untitled',
                    description: item.description || ''
                });

                console.log(`Migrated picture for item ${item.item_id}`);
            }

            // Only commit if we started the transaction
            if (!inTransaction) {
                this.db.prepare('COMMIT').run();
            }
            console.log('Picture migration completed successfully');
        } catch (error) {
            // Only rollback if we started the transaction
            if (!inTransaction) {
                this.db.prepare('ROLLBACK').run();
            }
            console.error('Error during picture migration:', error);
            throw error;
        }
    }
}

module.exports = new DatabaseManager(); 