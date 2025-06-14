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

        // Check if item_pictures table exists
        const itemPicturesExists = this.db.prepare(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='item_pictures'
        `).get();

        // If no universe_data and timelines exists, DB is already initialized
        if (!universeDataExists && timelinesExists && !itemPicturesExists) {
            // But still ensure new tables exist
            this.ensureNewTables();
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
                use_custom_css INTEGER DEFAULT 0,
                is_fullscreen INTEGER DEFAULT 0,
                show_guides INTEGER DEFAULT 1,
                window_size_x INTEGER DEFAULT 1000,
                window_size_y INTEGER DEFAULT 700,
                window_position_x INTEGER DEFAULT 300,
                window_position_y INTEGER DEFAULT 100,
                use_custom_scaling INTEGER DEFAULT 0,
                custom_scale REAL DEFAULT 1.0,
                display_radius INTEGER DEFAULT 10,
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
                show_in_notes INTEGER DEFAULT 1,
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

        // Ensure new tables are created
        this.ensureNewTables();

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
            if (!columnExists('items', 'show_in_notes')) {
                this.db.exec('ALTER TABLE items ADD COLUMN show_in_notes INTEGER DEFAULT 1');
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

    // Ensure new tables that might not exist in older databases are created
    ensureNewTables() {
        console.log('[dbManager.js] Ensuring new tables exist...');
        
        // Item-Pictures junction table (for image reuse functionality)
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS item_pictures (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_id TEXT NOT NULL,
                picture_id INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
                FOREIGN KEY (picture_id) REFERENCES pictures(id) ON DELETE CASCADE,
                UNIQUE(item_id, picture_id)
            )
        `);

        // Characters table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS characters (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                nicknames TEXT,
                aliases TEXT,
                race TEXT,
                description TEXT,
                notes TEXT,
                birth_year INTEGER,
                birth_subtick INTEGER,
                birth_date TEXT,
                birth_alternative_year TEXT,
                death_year INTEGER,
                death_subtick INTEGER,
                death_date TEXT,
                death_alternative_year TEXT,
                importance INTEGER DEFAULT 5,
                color TEXT,
                timeline_id INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (timeline_id) REFERENCES timelines(id) ON DELETE CASCADE
            )
        `);

        // Character Relationships table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS character_relationships (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                character_1_id TEXT NOT NULL,
                character_2_id TEXT NOT NULL,
                relationship_type TEXT NOT NULL CHECK (relationship_type IN (
                    'parent', 'child', 'sibling', 'spouse', 'partner', 'ex-spouse', 'ex-partner',
                    'grandparent', 'grandchild', 'great-grandparent', 'great-grandchild',
                    'great-great-grandparent', 'great-great-grandchild',
                    'aunt', 'uncle', 'niece', 'nephew', 'cousin', 'great-aunt', 'great-uncle',
                    'great-niece', 'great-nephew',
                    'step-parent', 'step-child', 'step-sibling', 'half-sibling',
                    'step-grandparent', 'step-grandchild',
                    'parent-in-law', 'child-in-law', 'sibling-in-law', 'grandparent-in-law', 'grandchild-in-law',
                    'adoptive-parent', 'adoptive-child', 'adoptive-sibling',
                    'foster-parent', 'foster-child', 'foster-sibling',
                    'biological-parent', 'biological-child',
                    'godparent', 'godchild', 'mentor', 'apprentice', 'guardian', 'ward',
                    'best-friend', 'friend', 'ally', 'enemy', 'rival', 'acquaintance', 'colleague', 'neighbor',
                    'familiar', 'bonded', 'master', 'servant', 'liege', 'vassal', 'clan-member', 'pack-member',
                    'custom', 'other'
                )),
                custom_relationship_type TEXT,
                relationship_degree TEXT,
                relationship_modifier TEXT,
                relationship_strength INTEGER DEFAULT 50,
                is_bidirectional INTEGER DEFAULT 0,
                notes TEXT,
                timeline_id INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (character_1_id) REFERENCES characters(id) ON DELETE CASCADE,
                FOREIGN KEY (character_2_id) REFERENCES characters(id) ON DELETE CASCADE,
                FOREIGN KEY (timeline_id) REFERENCES timelines(id) ON DELETE CASCADE
            )
        `);

        // Item-Characters junction table (for character references in timeline items)
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS item_characters (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_id TEXT NOT NULL,
                character_id TEXT NOT NULL,
                relationship_type TEXT DEFAULT 'appears',
                timeline_id INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
                FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
                FOREIGN KEY (timeline_id) REFERENCES timelines(id) ON DELETE CASCADE,
                UNIQUE(item_id, character_id)
            )
        `);

        console.log('[dbManager.js] New tables ensured');
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
        console.log('--> [dbManager.js] Migrating database...');

        // Check and add show_in_notes column to items table if it doesn't exist
        this.ensureTableColumns('items', [
            {
                name: 'show_in_notes',
                type: 'INTEGER',
                default: 1
            }
        ]);

        // Check and add importance column to items table if it doesn't exist
        this.ensureTableColumns('items', [
            {
                name: 'importance',
                type: 'INTEGER',
                default: 5
            }
        ]);

        // Check and add display_radius column to settings table if it doesn't exist
        this.ensureTableColumns('settings', [
            {
                name: 'display_radius',
                type: 'INTEGER',
                default: 10
            }
        ]);

        // Migrate CSS columns to consolidate them
        await this.migrateCSSColumns();
        
        // Migrate character tables and ensure they exist
        await this.migrateCharacterTables();
        
        // Check if the pictures has item_id column by querying the sqlite_master table
        const hasItemIdColumn = this.db.prepare(`
            SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='pictures' AND sql LIKE '%item_id%'
        `).get();
        
        if (hasItemIdColumn.count === 0) {
            console.log('[dbManager.js] Pictures table has no item_id column, skipping migration');
            return;
        }
        
        // Migrate to new picture reference system
        await this.migratePictureReferences();
    }

    async migrateCSSColumns() {
        console.log('--> [dbManager.js] Migrating CSS columns...');

        // Check if we need to migrate (if the old columns still exist)
        const columns = this.db.prepare(`PRAGMA table_info(settings)`).all();
        const columnNames = columns.map(col => col.name);
        
        const hasOldColumns = columnNames.includes('custom_main_css') || columnNames.includes('custom_items_css') ||
                             columnNames.includes('use_main_css') || columnNames.includes('use_items_css');

        if (!hasOldColumns) {
            console.log('[dbManager.js] CSS columns already migrated, skipping...');
            return;
        }

        try {
            this.db.prepare('BEGIN').run();

            // Get all existing settings with their CSS data
            const existingSettings = this.db.prepare(`
                SELECT id, timeline_id,
                       COALESCE(custom_css, '') as custom_css,
                       COALESCE(custom_main_css, '') as custom_main_css,
                       COALESCE(custom_items_css, '') as custom_items_css,
                       COALESCE(use_timeline_css, 0) as use_timeline_css,
                       COALESCE(use_main_css, 0) as use_main_css,
                       COALESCE(use_items_css, 0) as use_items_css
                FROM settings
            `).all();

            console.log(`[dbManager.js] Found ${existingSettings.length} settings records to migrate`);

            // Consolidate CSS for each settings record
            for (const setting of existingSettings) {
                // Combine all CSS sections that have content
                const cssComponents = [];
                
                if (setting.custom_css && setting.custom_css.trim()) {
                    cssComponents.push(setting.custom_css.trim());
                }
                if (setting.custom_main_css && setting.custom_main_css.trim()) {
                    cssComponents.push('/* Main CSS */\n' + setting.custom_main_css.trim());
                }
                if (setting.custom_items_css && setting.custom_items_css.trim()) {
                    cssComponents.push('/* Items CSS */\n' + setting.custom_items_css.trim());
                }

                // Join with double newlines for separation
                const consolidatedCSS = cssComponents.join('\n\n');

                // Determine if any custom CSS should be enabled
                const useCustomCSS = setting.use_timeline_css || setting.use_main_css || setting.use_items_css ? 1 : 0;

                // Update the record with consolidated data
                this.db.prepare(`
                    UPDATE settings 
                    SET custom_css = ?,
                        use_timeline_css = ?
                    WHERE id = ?
                `).run(consolidatedCSS, useCustomCSS, setting.id);

                console.log(`[dbManager.js] Migrated CSS for settings ID ${setting.id} (${consolidatedCSS.length} chars, enabled: ${useCustomCSS})`);
            }

            // Now remove the old columns by recreating the table
            console.log('[dbManager.js] Removing old CSS columns...');

            // Create new settings table with consolidated schema
            this.db.prepare(`CREATE TABLE IF NOT EXISTS settings_new (
                id INTEGER PRIMARY KEY,
                timeline_id INTEGER,
                font TEXT DEFAULT 'Arial',
                font_size_scale REAL DEFAULT 1.0,
                pixels_per_subtick INTEGER DEFAULT 20,
                custom_css TEXT,
                use_custom_css INTEGER DEFAULT 0,
                is_fullscreen INTEGER DEFAULT 0,
                show_guides INTEGER DEFAULT 1,
                window_size_x INTEGER DEFAULT 1000,
                window_size_y INTEGER DEFAULT 700,
                window_position_x INTEGER DEFAULT 300,
                window_position_y INTEGER DEFAULT 100,
                use_custom_scaling INTEGER DEFAULT 0,
                custom_scale REAL DEFAULT 1.0,
                display_radius INTEGER DEFAULT 10,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (timeline_id) REFERENCES timelines(id) ON DELETE CASCADE
            )`).run();

            // Copy data to new table (renaming use_timeline_css to use_custom_css)
            this.db.prepare(`INSERT INTO settings_new (
                id, timeline_id, font, font_size_scale, pixels_per_subtick, custom_css, use_custom_css,
                is_fullscreen, show_guides, window_size_x, window_size_y, window_position_x, window_position_y,
                use_custom_scaling, custom_scale, display_radius, updated_at
            ) SELECT 
                id, timeline_id, font, font_size_scale, pixels_per_subtick, custom_css, use_timeline_css,
                is_fullscreen, show_guides, window_size_x, window_size_y, window_position_x, window_position_y,
                use_custom_scaling, custom_scale, display_radius, updated_at
            FROM settings`).run();

            // Drop old table and rename new one
            this.db.prepare('DROP TABLE settings').run();
            this.db.prepare('ALTER TABLE settings_new RENAME TO settings').run();

            this.db.prepare('COMMIT').run();
            console.log('[dbManager.js] CSS columns migration completed successfully');

        } catch (error) {
            this.db.prepare('ROLLBACK').run();
            console.error('[dbManager.js] Error migrating CSS columns:', error);
            throw error;
        }
    }

    async migrateCharacterTables() {
        console.log('--> [dbManager.js] Migrating character tables...');

        try {
            // Check if character tables exist
            const charactersTableExists = this.db.prepare(`
                SELECT COUNT(*) as count FROM sqlite_master 
                WHERE type='table' AND name='characters'
            `).get().count > 0;

            const characterRelationshipsTableExists = this.db.prepare(`
                SELECT COUNT(*) as count FROM sqlite_master 
                WHERE type='table' AND name='character_relationships'
            `).get().count > 0;

            const itemCharactersTableExists = this.db.prepare(`
                SELECT COUNT(*) as count FROM sqlite_master 
                WHERE type='table' AND name='item_characters'
            `).get().count > 0;

            // Create characters table if it doesn't exist
            if (!charactersTableExists) {
                console.log('[dbManager.js] Creating characters table...');
                this.db.exec(`
                    CREATE TABLE characters (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        nicknames TEXT,
                        aliases TEXT,
                        race TEXT,
                        description TEXT,
                        notes TEXT,
                        birth_year INTEGER,
                        birth_subtick INTEGER,
                        birth_date TEXT,
                        birth_alternative_year TEXT,
                        death_year INTEGER,
                        death_subtick INTEGER,
                        death_date TEXT,
                        death_alternative_year TEXT,
                        importance INTEGER DEFAULT 5,
                        color TEXT,
                        timeline_id INTEGER NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (timeline_id) REFERENCES timelines(id) ON DELETE CASCADE
                    )
                `);
                console.log('[dbManager.js] Characters table created successfully');
            } else {
                console.log('[dbManager.js] Characters table already exists, checking columns...');
                
                // Ensure all required columns exist in characters table
                this.ensureTableColumns('characters', [
                    { name: 'nicknames', type: 'TEXT' },
                    { name: 'aliases', type: 'TEXT' },
                    { name: 'race', type: 'TEXT' },
                    { name: 'description', type: 'TEXT' },
                    { name: 'notes', type: 'TEXT' },
                    { name: 'birth_year', type: 'INTEGER' },
                    { name: 'birth_subtick', type: 'INTEGER' },
                    { name: 'birth_date', type: 'TEXT' },
                    { name: 'birth_alternative_year', type: 'TEXT' },
                    { name: 'death_year', type: 'INTEGER' },
                    { name: 'death_subtick', type: 'INTEGER' },
                    { name: 'death_date', type: 'TEXT' },
                    { name: 'death_alternative_year', type: 'TEXT' },
                    { name: 'importance', type: 'INTEGER', default: 5 },
                    { name: 'color', type: 'TEXT' },
                    { name: 'timeline_id', type: 'INTEGER' },
                    { name: 'created_at', type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },
                    { name: 'updated_at', type: 'DATETIME', default: 'CURRENT_TIMESTAMP' }
                ]);
            }

            // Create character_relationships table if it doesn't exist
            if (!characterRelationshipsTableExists) {
                console.log('[dbManager.js] Creating character_relationships table...');
                this.db.exec(`
                    CREATE TABLE character_relationships (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        character_1_id TEXT NOT NULL,
                        character_2_id TEXT NOT NULL,
                        relationship_type TEXT NOT NULL CHECK (relationship_type IN (
                            'parent', 'child', 'sibling', 'spouse', 'partner', 'ex-spouse', 'ex-partner',
                            'grandparent', 'grandchild', 'great-grandparent', 'great-grandchild',
                            'great-great-grandparent', 'great-great-grandchild',
                            'aunt', 'uncle', 'niece', 'nephew', 'cousin', 'great-aunt', 'great-uncle',
                            'great-niece', 'great-nephew',
                            'step-parent', 'step-child', 'step-sibling', 'half-sibling',
                            'step-grandparent', 'step-grandchild',
                            'parent-in-law', 'child-in-law', 'sibling-in-law', 'grandparent-in-law', 'grandchild-in-law',
                            'adoptive-parent', 'adoptive-child', 'adoptive-sibling',
                            'foster-parent', 'foster-child', 'foster-sibling',
                            'biological-parent', 'biological-child',
                            'godparent', 'godchild', 'mentor', 'apprentice', 'guardian', 'ward',
                            'best-friend', 'friend', 'ally', 'enemy', 'rival', 'acquaintance', 'colleague', 'neighbor',
                            'familiar', 'bonded', 'master', 'servant', 'liege', 'vassal', 'clan-member', 'pack-member',
                            'custom', 'other'
                        )),
                        custom_relationship_type TEXT,
                        relationship_degree TEXT,
                        relationship_modifier TEXT,
                        relationship_strength INTEGER DEFAULT 50,
                        is_bidirectional INTEGER DEFAULT 0,
                        notes TEXT,
                        timeline_id INTEGER NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (character_1_id) REFERENCES characters(id) ON DELETE CASCADE,
                        FOREIGN KEY (character_2_id) REFERENCES characters(id) ON DELETE CASCADE,
                        FOREIGN KEY (timeline_id) REFERENCES timelines(id) ON DELETE CASCADE
                    )
                `);
                console.log('[dbManager.js] Character_relationships table created successfully');
            } else {
                console.log('[dbManager.js] Character_relationships table already exists, checking columns...');
                
                // For existing tables, we can't easily add CHECK constraints via ALTER TABLE
                // So we'll just ensure the basic columns exist
                this.ensureTableColumns('character_relationships', [
                    { name: 'character_1_id', type: 'TEXT' },
                    { name: 'character_2_id', type: 'TEXT' },
                    { name: 'relationship_type', type: 'TEXT' },
                    { name: 'custom_relationship_type', type: 'TEXT' },
                    { name: 'relationship_degree', type: 'TEXT' },
                    { name: 'relationship_modifier', type: 'TEXT' },
                    { name: 'relationship_strength', type: 'INTEGER', default: 50 },
                    { name: 'is_bidirectional', type: 'INTEGER', default: 0 },
                    { name: 'notes', type: 'TEXT' },
                    { name: 'timeline_id', type: 'INTEGER' },
                    { name: 'created_at', type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },
                    { name: 'updated_at', type: 'DATETIME', default: 'CURRENT_TIMESTAMP' }
                ]);
                
                // Note: CHECK constraint validation will be handled at the application level
                // for existing tables that don't have the constraint
                console.log('[dbManager.js] Note: CHECK constraint for relationship_type will be enforced at application level for existing tables');
            }

            // Create item_characters table if it doesn't exist
            if (!itemCharactersTableExists) {
                console.log('[dbManager.js] Creating item_characters table...');
                this.db.exec(`
                    CREATE TABLE item_characters (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        item_id TEXT NOT NULL,
                        character_id TEXT NOT NULL,
                        relationship_type TEXT DEFAULT 'appears',
                        timeline_id INTEGER NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
                        FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
                        FOREIGN KEY (timeline_id) REFERENCES timelines(id) ON DELETE CASCADE,
                        UNIQUE(item_id, character_id)
                    )
                `);
                console.log('[dbManager.js] Item_characters table created successfully');
            } else {
                console.log('[dbManager.js] Item_characters table already exists, checking columns...');
                
                // Ensure all required columns exist in item_characters table
                this.ensureTableColumns('item_characters', [
                    { name: 'item_id', type: 'TEXT' },
                    { name: 'character_id', type: 'TEXT' },
                    { name: 'relationship_type', type: 'TEXT', default: "'appears'" },
                    { name: 'timeline_id', type: 'INTEGER' },
                    { name: 'created_at', type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },
                    { name: 'updated_at', type: 'DATETIME', default: 'CURRENT_TIMESTAMP' }
                ]);
            }

            // Ensure all new tables are created (including character tables)
            this.ensureNewTables();

            console.log('[dbManager.js] Character tables migration completed successfully');

        } catch (error) {
            console.error('[dbManager.js] Error migrating character tables:', error);
            throw error;
        }
    }

    async migratePictureReferences() {
        console.log('--> [dbManager.js] Migrating picture references...');

        // Check if migration is needed by checking if the pictures table has item_id
        const hasItemPicturesTable = this.db.prepare(`
            SELECT COUNT(*) as count FROM pictures WHERE item_id IS NOT NULL
        `).get();

        if (hasItemPicturesTable.count === 0) {
            return;
        }

        console.log('[dbManager.js] Migrating picture references...');

        try {
            this.db.prepare('BEGIN').run();

            // Get all existing pictures with item_id
            const existingPictures = this.db.prepare(`
                SELECT id, item_id, file_path FROM pictures WHERE item_id IS NOT NULL
            `).all();

            console.log(`[dbManager.js] Found ${existingPictures.length} pictures with item_id`);

            // ---------------------------------------- Hash-based duplicate detection and consolidation
            console.log('--> [dbManager.js] Starting duplicate image detection...');
            
            // Calculate hashes for all images and group by hash
            const hashGroups = new Map(); // hash -> [picture1, picture2, ...]
            const fs = require('fs');
            
            for (const picture of existingPictures) {
                try {
                    if (picture.file_path && fs.existsSync(picture.file_path)) {
                        const fileBuffer = fs.readFileSync(picture.file_path);
                        const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
                        
                        if (!hashGroups.has(hash)) {
                            hashGroups.set(hash, []);
                        }
                        hashGroups.get(hash).push(picture);
                    } else {
                        console.warn(`[dbManager.js] Image file not found: ${picture.file_path}`);
                    }
                } catch (error) {
                    console.error(`[dbManager.js] Error processing image ${picture.file_path}:`, error);
                }
            }

            // Find groups with duplicates (more than 1 image with same hash)
            const duplicateGroups = Array.from(hashGroups.entries())
                .filter(([hash, pictures]) => pictures.length > 1);

            // Consolidate duplicates
            let duplicatesConsolidated = 0;
            let filesDeleted = 0;
            const duplicateMapping = new Map(); // old_id -> master_id
            
            for (const [hash, duplicatePictures] of duplicateGroups) {
                // Sort by ID to keep the oldest (lowest ID) as the master
                duplicatePictures.sort((a, b) => a.id - b.id);
                const masterPicture = duplicatePictures[0];
                const duplicates = duplicatePictures.slice(1);
                
                console.log(`[dbManager.js] Group ${hash.substring(0, 8)}: keeping master ID ${masterPicture.id}, removing ${duplicates.length} duplicates`);
                
                // Map duplicates to master for later reference updating
                for (const duplicate of duplicates) {
                    duplicateMapping.set(duplicate.id, masterPicture.id);
                    
                    // Delete duplicate file immediately during migration
                    if (duplicate.file_path && fs.existsSync(duplicate.file_path)) {
                        try {
                            fs.unlinkSync(duplicate.file_path);
                            filesDeleted++;
                            console.log(`[dbManager.js] Deleted duplicate file: ${duplicate.file_path}`);
                        } catch (error) {
                            console.error(`[dbManager.js] Failed to delete duplicate file ${duplicate.file_path}:`, error);
                        }
                    }
                    
                    duplicatesConsolidated++;
                }
            }

            console.log(`[dbManager.js] Consolidated ${duplicatesConsolidated} duplicate images, deleted ${filesDeleted} files`);

            // ---------------------------------------- Removing old columns from pictures table

            console.log('--> [dbManager.js] Cleaning up orphaned images...');
            // Clean up orphaned images
            this.cleanupOrphanedImages();

            console.log('--> [dbManager.js] Migrating pictures table...');

            //this.db.prepare('BEGIN').run();
               
            // Create new pictures table
            this.db.prepare(`CREATE TABLE IF NOT EXISTS pictures_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_path TEXT,
                file_name TEXT,
                file_size INTEGER,
                file_type TEXT,
                width INTEGER,
                height INTEGER,
                title TEXT,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`).run();

            // Clean up old columns from pictures table
            console.log('[dbManager.js] Removing old columns from pictures table...');


            // Copy data to new table - only keep original images (not duplicates)
            const originalPictures = existingPictures.filter(pic => {
                // Check if this picture is a duplicate (if it's mapped to another ID)
                return !duplicateMapping.has(pic.id);
            });

            for (const pic of originalPictures) {
                this.db.prepare(`INSERT INTO pictures_new (id, file_path, file_name, file_size, file_type, width, height, title, description) 
                    SELECT id, file_path, file_name, file_size, file_type, width, height, title, description 
                    FROM pictures WHERE id = ?`).run(pic.id);
            }

            // Drop old table
            this.db.prepare('DROP TABLE pictures').run();

            // Rename new table to old table name
            this.db.prepare('ALTER TABLE pictures_new RENAME TO pictures').run();


            // ---------------------------------------- Creating references in the junction table

            // Create references in the junction table - map duplicates to originals
            const insertRefStmt = this.db.prepare(`
                INSERT OR IGNORE INTO item_pictures (item_id, picture_id)
                VALUES (?, ?)
            `);

            for (const pic of existingPictures) {
                let targetPictureId = pic.id;
                
                // Check if this picture is a duplicate, if so, use the master's ID
                if (duplicateMapping.has(pic.id)) {
                    targetPictureId = duplicateMapping.get(pic.id);
                    console.log(`[dbManager.js] Mapping duplicate picture ${pic.id} to master ${targetPictureId} for item ${pic.item_id}`);
                }
                
                console.log(`[dbManager.js] Creating reference: item ${pic.item_id} -> picture ${targetPictureId}`);
                insertRefStmt.run(pic.item_id, targetPictureId);
            }

            console.log(`[dbManager.js] Migration completed - consolidated ${duplicatesConsolidated} duplicates, created ${existingPictures.length} references`);

            this.db.prepare('COMMIT').run();

            // If duplicates were found and consolidated during migration, 
            // suggest running a full consolidation check on remaining images
            if (duplicatesConsolidated > 0) {
                console.log(`[dbManager.js] Migration consolidated ${duplicatesConsolidated} duplicates. Consider running consolidateDuplicateImages() for a full check of remaining images.`);
            }


        } catch (error) {
            this.db.prepare('ROLLBACK').run();
            console.error('Error migrating picture references:', error);
            throw error;
        }
    }

    /**
     * Clean up orphaned images
     * This function is called after the migration of the pictures table.
     * It deletes images that are not referenced by any items.
     * It also deletes the physical files of the images.
     * @returns {number} The number of deleted images
     */
    cleanupOrphanedImages() {
        const fs = require('fs');
        
        // Find images that are not referenced by any items
        const orphanedImages = this.db.prepare(`
            SELECT p.id, p.file_path, p.file_name
            FROM pictures p
            LEFT JOIN item_pictures ip ON p.id = ip.picture_id
            WHERE ip.picture_id IS NULL AND p.item_id IS NULL
        `).all();

        let deletedCount = 0;
        for (const image of orphanedImages) {
            try {
                // Delete from database
                this.db.prepare('DELETE FROM pictures WHERE id = ?').run(image.id);
                
                //// Delete physical file
                //if (image.file_path && fs.existsSync(image.file_path)) {
                //    fs.unlinkSync(image.file_path);
                //    console.log(`[dbManager.js] Cleaned up orphaned image: ${image.file_name}`);
                //}
                //deletedCount++;
            } catch (error) {
                console.error(`[dbManager.js] Failed to cleanup image ${image.file_name}:`, error);
            }
        }

        console.log(`[dbManager.js] Cleaned up ${deletedCount} orphaned images`);
        return deletedCount;
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
                use_custom_css: 0,
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
                    id, font, font_size_scale, pixels_per_subtick, custom_css, use_custom_css,
                    is_fullscreen, show_guides, window_size_x, window_size_y, window_position_x, window_position_y,
                    use_custom_scaling, custom_scale
                ) VALUES (
                    @id, @font, @font_size_scale, @pixels_per_subtick, @custom_css, @use_custom_css,
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
            customCSS: settings.custom_css || '',
            useCustomCSS: settings.use_custom_css === 1,
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
            customScale: settings.custom_scale,
            displayRadius: settings.display_radius
        };
    }

    updateSettings(settings) {
        const timelineId = settings.timeline_id;
        if (!timelineId) {
            console.error('No timeline ID found in settings');
            return;
        }

        // Convert camelCase field names to snake_case for database
        const dbSettings = {
            timeline_id: timelineId,
            font: settings.font,
            font_size_scale: settings.font_size_scale || settings.fontSizeScale,
            pixels_per_subtick: settings.pixels_per_subtick || settings.pixelsPerSubtick,
            custom_css: settings.custom_css || settings.customCSS,
            use_custom_css: settings.use_custom_css !== undefined ? settings.use_custom_css : 
                           (settings.useCustomCSS !== undefined ? (settings.useCustomCSS ? 1 : 0) : 0),
            is_fullscreen: settings.is_fullscreen !== undefined ? settings.is_fullscreen :
                          (settings.isFullscreen !== undefined ? (settings.isFullscreen ? 1 : 0) : 0),
            show_guides: settings.show_guides !== undefined ? settings.show_guides :
                        (settings.showGuides !== undefined ? (settings.showGuides ? 1 : 0) : 1),
            window_size_x: settings.window_size_x || settings.windowSizeX || (settings.size && settings.size.x),
            window_size_y: settings.window_size_y || settings.windowSizeY || (settings.size && settings.size.y),
            window_position_x: settings.window_position_x || settings.windowPositionX || (settings.position && settings.position.x),
            window_position_y: settings.window_position_y || settings.windowPositionY || (settings.position && settings.position.y),
            use_custom_scaling: settings.use_custom_scaling !== undefined ? settings.use_custom_scaling :
                               (settings.useCustomScaling !== undefined ? (settings.useCustomScaling ? 1 : 0) : 0),
            custom_scale: settings.custom_scale || settings.customScale,
            display_radius: settings.display_radius || settings.displayRadius
        };

        // First check if settings exist for this timeline
        const checkStmt = this.db.prepare('SELECT id FROM settings WHERE timeline_id = ?');
        const existingSettings = checkStmt.get(timelineId);

        if (!existingSettings) {
            // If no settings exist, create them
            console.log('No existing settings found, creating new settings');
            const insertStmt = this.db.prepare(`
                INSERT INTO settings (
                    timeline_id, font, font_size_scale, pixels_per_subtick,
                    custom_css, use_custom_css,
                    is_fullscreen, show_guides,
                    window_size_x, window_size_y,
                    window_position_x, window_position_y,
                    use_custom_scaling, custom_scale, display_radius
                ) VALUES (
                    @timeline_id, @font, @font_size_scale, @pixels_per_subtick,
                    @custom_css, @use_custom_css,
                    @is_fullscreen, @show_guides,
                    @window_size_x, @window_size_y,
                    @window_position_x, @window_position_y,
                    @use_custom_scaling, @custom_scale, @display_radius
                )
            `);
            return insertStmt.run(dbSettings);
        }

        // Update existing settings
        console.log('Updating existing settings');
        const updateStmt = this.db.prepare(`
            UPDATE settings SET
                font = @font,
                font_size_scale = @font_size_scale,
                pixels_per_subtick = @pixels_per_subtick,
                custom_css = @custom_css,
                use_custom_css = @use_custom_css,
                is_fullscreen = @is_fullscreen,
                show_guides = @show_guides,
                window_size_x = @window_size_x,
                window_size_y = @window_size_y,
                window_position_x = @window_position_x,
                window_position_y = @window_position_y,
                use_custom_scaling = @use_custom_scaling,
                custom_scale = @custom_scale,
                display_radius = @display_radius,
                updated_at = CURRENT_TIMESTAMP
            WHERE timeline_id = @timeline_id
        `);

        const result = updateStmt.run(dbSettings);
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

    getAllStoryReferences() {
        const stmt = this.db.prepare('SELECT * FROM item_story_refs ORDER BY item_id');
        return stmt.all();

    }

    getAllPictures() {
        // Get only pictures that are used within the current timeline
        const stmt = this.db.prepare(`
            SELECT p.*,
                   COUNT(DISTINCT ip.item_id) as usage_count,
                   GROUP_CONCAT(DISTINCT ip.item_id) as linked_items
            FROM pictures p
            INNER JOIN item_pictures ip ON p.id = ip.picture_id
            INNER JOIN items i ON ip.item_id = i.id AND i.timeline_id = ?
            GROUP BY p.id
            ORDER BY p.file_name
        `);

        // Add a filter that filters out pictures that don't exist on the filesystem
        const fs = require('fs');
        const pictures = stmt.all(this.currentTimelineId);
        return pictures.filter(pic => fs.existsSync(pic.file_path));

        return stmt.all(this.currentTimelineId);
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

    async addItem(item) {
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
                    id, title, description, content, year, subtick, original_subtick,
                    end_year, end_subtick, original_end_subtick, creation_granularity,
                    book_title, chapter, page, type_id, color, timeline_id, item_index, show_in_notes, importance
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            stmt.run(
                item.id,
                item.title,
                item.description,
                item.content,
                item.year,
                item.subtick,
                item.original_subtick || item.subtick,
                item.end_year || item.year,
                item.end_subtick || item.subtick,
                item.original_end_subtick || item.original_subtick || item.subtick,
                item.creation_granularity || this.getUniverseData().granularity,
                item.book_title || '',
                item.chapter || '',
                item.page || '',
                typeId,
                item.color,
                item.timeline_id || this.currentTimelineId,
                nextIndex,
                item.show_in_notes !== undefined ? (item.show_in_notes ? 1 : 0) : 1,
                item.importance !== undefined ? parseInt(item.importance) : 5
            );

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
                // Check if any pictures have new image reuse markers
                const hasEnhancedPictures = item.pictures.some(pic => 
                    pic.isReference || pic.isNew || pic.temp_path
                );

                if (hasEnhancedPictures) {
                    // Use the enhanced method for new image reuse functionality
                    await this.addPicturesToItemEnhanced(itemId, item.pictures);
                } else {
                    // Use the old method for backward compatibility
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
            show_in_notes: item.show_in_notes === 1,
            importance: item.importance || 5,
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
            WHERE i.timeline_id = ? AND i.type_id != 7
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
                color = @color,
                show_in_notes = @show_in_notes,
                importance = @importance
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
            color: item.color,
            show_in_notes: item.show_in_notes !== undefined ? (item.show_in_notes ? 1 : 0) : 1,
            importance: item.importance !== undefined ? parseInt(item.importance) : 5
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
        try {
            this.db.prepare('BEGIN').run();

            // Get pictures that will become orphaned after this item is deleted
            const orphanedPictures = this.db.prepare(`
                SELECT p.id, p.file_path
                FROM pictures p
                LEFT JOIN item_pictures ip ON p.id = ip.picture_id
                WHERE ip.item_id = ?
                AND (
                    SELECT COUNT(*) 
                    FROM item_pictures ip2 
                    WHERE ip2.picture_id = p.id AND ip2.item_id != ?
                ) = 0
            `).all(id, id);

            // Delete related records first
            this.db.prepare('DELETE FROM item_tags WHERE item_id = ?').run(id);
            this.db.prepare('DELETE FROM item_pictures WHERE item_id = ?').run(id);
            
            // Delete orphaned pictures from the new system
            for (const pic of orphanedPictures) {
                this.db.prepare('DELETE FROM pictures WHERE id = ?').run(pic.id);
                // Also delete the physical file
                const fs = require('fs');
                if (pic.file_path && fs.existsSync(pic.file_path)) {
                    try {
                        fs.unlinkSync(pic.file_path);
                        console.log(`[dbManager.js] Deleted orphaned image file: ${pic.file_path}`);
                    } catch (error) {
                        console.error(`[dbManager.js] Failed to delete image file: ${pic.file_path}`, error);
                    }
                }
            }
            
            // Delete the item
            const stmt = this.db.prepare('DELETE FROM items WHERE id = ?');
            const result = stmt.run(id);

            this.db.prepare('COMMIT').run();
            return result;
        } catch (error) {
            this.db.prepare('ROLLBACK').run();
            console.error('Error deleting item:', error);
            throw error;
        }
    }

    getMedia(id) {
        const stmt = this.db.prepare('SELECT * FROM pictures WHERE id = ?');
        return stmt.get(id);
    }

    deleteMedia(id, file_path) {
        try{
            // Delete related records first
            this.db.prepare('DELETE FROM item_pictures WHERE picture_id = ?').run(id);
            this.db.prepare('DELETE FROM pictures WHERE id = ?').run(id);

            // Delete the physical file
            const fs = require('fs');
            if (file_path && fs.existsSync(file_path)) {
                try {
                    fs.unlinkSync(file_path);
                    console.log(`[dbManager.js] Deleted orphaned image file: ${file_path}`);
                } catch (error) {
                    console.error(`[dbManager.js] Failed to delete image file: ${file_path}`, error);
                }
            }

            return true;
        } catch (error) {
            console.error('Error deleting media:', error);
            throw error;
        }
    }

    deleteStory(id) {
        // Delete related records first
        this.db.prepare('DELETE FROM item_story_refs WHERE story_id = ?').run(id);
        this.db.prepare('DELETE FROM stories WHERE id = ?').run(id);
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

    getAllTagsWithCounts() {
        // The following query counts the number of items associated with each tag using the item_tags table
        const stmt = this.db.prepare(`
            SELECT t.name, t.id, COUNT(it.item_id) as item_count, GROUP_CONCAT(DISTINCT it.item_id) as item_ids
            FROM tags t
            LEFT JOIN item_tags it ON t.id = it.tag_id
            GROUP BY t.name
            ORDER BY item_count DESC
        `);
        return stmt.all();
    }

    deleteTag(tagId) {
        const stmt = this.db.prepare('DELETE FROM tags WHERE id = ?');
        return stmt.run(tagId);
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
            INSERT INTO pictures (file_path, file_name, file_size, file_type, width, height, title, description)
            VALUES (@file_path, @file_name, @file_size, @file_type, @width, @height, @title, @description)
        `);

        for (const pic of pictures) {
            const result = stmt.run({
                file_path: pic.file_path,
                file_name: pic.file_name,
                file_size: pic.file_size,
                file_type: pic.file_type,
                width: pic.width,
                height: pic.height,
                title: pic.title,
                description: pic.description
            });

            // Create a reference in the junction table
            if (result.lastInsertRowid) {
                this.addImageReference(itemId, result.lastInsertRowid);
            }
        }
    }

    // Enhanced picture operations for image reuse
    addImageReference(itemId, pictureId) {
        const stmt = this.db.prepare(`
            INSERT OR IGNORE INTO item_pictures (item_id, picture_id)
            VALUES (?, ?)
        `);
        return stmt.run(itemId, pictureId);
    }

    removeImageReference(itemId, pictureId) {
        const stmt = this.db.prepare(`
            DELETE FROM item_pictures WHERE item_id = ? AND picture_id = ?
        `);
        return stmt.run(itemId, pictureId);
    }

    getPictureUsageCount(pictureId) {
        const stmt = this.db.prepare(`
            SELECT COUNT(*) as count 
            FROM item_pictures 
            WHERE picture_id = ?
        `);
        return stmt.get(pictureId).count;
    }

    updatePictureDescription(pictureId, description) {
        const stmt = this.db.prepare(`
            UPDATE pictures 
            SET description = @description 
            WHERE id = @pictureId
        `);
        return stmt.run({
            pictureId: pictureId,
            description: description || ''
        });
    }

    async addPicturesToItemEnhanced(itemId, pictures) {
        for (const pic of pictures) {

            if ((pic.isReference || pic.isExisting) && pic.id) {
                // Add reference to existing image
                this.addImageReference(itemId, pic.id);
            } else if (pic.isNew || pic.temp_path) {
                // Process and save new image, then create reference
                const result = await this.saveNewImage({
                    file_path: pic.temp_path || pic.file_path,
                    file_name: pic.file_name,
                    file_size: pic.file_size,
                    file_type: pic.file_type,
                    description: pic.description || ''
                });

                if (result && result.id) {
                    this.addImageReference(itemId, result.id);
                } else {
                    console.error(`[dbManager.js] Failed to save new image, no result returned`);
                }
            } else if (pic.file_path && !pic.id && !pic.isReference && !pic.isNew) {
                // Fallback: save image to pictures table directly (for backward compatibility)
                const stmt = this.db.prepare(`
                    INSERT INTO pictures (file_path, file_name, file_size, file_type, width, height, title, description)
                    VALUES (@file_path, @file_name, @file_size, @file_type, @width, @height, @title, @description)
                `);

                const result = stmt.run({
                    file_path: pic.file_path,
                    file_name: pic.file_name,
                    file_size: pic.file_size,
                    file_type: pic.file_type,
                    width: pic.width,
                    height: pic.height,
                    title: pic.title,
                    description: pic.description
                });

                // Create a reference for the new image
                if (result.lastInsertRowid) {
                    this.addImageReference(itemId, result.lastInsertRowid);
                } else {
                    console.error(`[dbManager.js] Failed to save fallback image`);
                }
            } else {
                console.warn(`[dbManager.js] Skipping picture - no valid processing path found`, pic);
            }
        }
    }

    getItemPictures(itemId) {
        // Try the new junction table first
        const junctionStmt = this.db.prepare(`
            SELECT p.* 
            FROM pictures p
            JOIN item_pictures ip ON p.id = ip.picture_id
            WHERE ip.item_id = ?
        `);
        const junctionResults = junctionStmt.all(itemId);

        // If we found results in the junction table, return them
        if (junctionResults.length > 0) {
            return junctionResults;
        }

        // Fallback to old method for backward compatibility
        //const oldStmt = this.db.prepare('SELECT * FROM pictures WHERE item_id = ?');
        //return oldStmt.all(itemId);
        return [];
    }

    async updateItemPictures(itemId, pictures) {
        try {
            this.db.prepare('BEGIN').run();

            // Get existing picture references to preserve descriptions for existing images
            const existingPictures = this.getItemPictures(itemId);
            const existingPictureMap = new Map(existingPictures.map(pic => [pic.id, pic]));

            // Remove all existing picture references for this item
            this.db.prepare('DELETE FROM item_pictures WHERE item_id = ?').run(itemId);

            // Process pictures: update descriptions for existing ones, add new ones
            if (pictures && pictures.length > 0) {
                for (const pic of pictures) {
                    console.log(`[dbManager.js] Updating picture for item ${itemId}:`, {
                        isReference: pic.isReference,
                        isNew: pic.isNew,
                        hasTempPath: !!pic.temp_path,
                        hasId: !!pic.id,
                        wasLinked: existingPictureMap.has(pic.id),
                        title: pic.title,
                        file_name: pic.file_name
                    });

                    if ((pic.isReference || pic.isExisting) && pic.id) {
                        // Handle reference to existing image (could be new reference or existing)
                        if (existingPictureMap.has(pic.id)) {
                            console.log(`[dbManager.js] Updating description for existing referenced image ${pic.id}`);
                            // Update description for existing referenced image
                            const updateStmt = this.db.prepare(`
                                UPDATE pictures 
                                SET description = @description 
                                WHERE id = @id
                            `);
                            updateStmt.run({
                                id: pic.id,
                                description: pic.description || ''
                            });
                        } else {
                            console.log(`[dbManager.js] Adding new reference to existing image ${pic.id}`);
                            // Update description for the referenced image
                            if (pic.description) {
                                const updateStmt = this.db.prepare(`
                                    UPDATE pictures 
                                    SET description = @description 
                                    WHERE id = @id
                                `);
                                updateStmt.run({
                                    id: pic.id,
                                    description: pic.description
                                });
                            }
                        }
                        
                        // Re-add the reference (for both existing and new references)
                        this.addImageReference(itemId, pic.id);
                    } else if (pic.isNew || pic.temp_path) {
                        // For completely new images, use the enhanced method
                        console.log(`[dbManager.js] Processing new image via addPicturesToItemEnhanced`);
                        await this.addPicturesToItemEnhanced(itemId, [pic]);
                    } else if (pic.file_path && !pic.id && !pic.isReference) {
                        // Fallback for legacy images without proper flags
                        console.log(`[dbManager.js] Processing legacy image via addPicturesToItemEnhanced`);
                        await this.addPicturesToItemEnhanced(itemId, [pic]);
                    } else {
                        console.warn(`[dbManager.js] Skipping picture in update - no valid processing path found`, pic);
                    }
                }
            }

            this.db.prepare('COMMIT').run();
        } catch (error) {
            this.db.prepare('ROLLBACK').run();
            console.error('Error updating item pictures:', error);
            throw error;
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

    // Get all timeline data
    getAllTimelineData() {
        let id = this.currentTimelineId;
        const stmt = this.db.prepare('SELECT * FROM timelines where id = ?');
        return stmt.all(id);
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
                font, font_size_scale, pixels_per_subtick, custom_css, use_custom_css,
                is_fullscreen, show_guides, window_size_x, window_size_y, window_position_x, window_position_y,
                use_custom_scaling, custom_scale
            ) VALUES (
                @font, @font_size_scale, @pixels_per_subtick, @custom_css, @use_custom_css,
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
            use_custom_css: 0,
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
            this.db.prepare('DELETE FROM item_pictures WHERE item_id IN (SELECT id FROM items WHERE timeline_id = ?)').run(timelineId);

            // Delete pictures that have no item_pictures references
            this.db.prepare('DELETE FROM pictures WHERE id NOT IN (SELECT picture_id FROM item_pictures)').run();
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
                use_custom_css: 0,
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
                    timeline_id, font, font_size_scale, pixels_per_subtick, custom_css, use_custom_css,
                    is_fullscreen, show_guides, window_size_x, window_size_y, window_position_x, window_position_y,
                    use_custom_scaling, custom_scale
                ) VALUES (
                    @timeline_id, @font, @font_size_scale, @pixels_per_subtick, @custom_css, @use_custom_css,
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
                useCustomCSS: settings.use_custom_css === 1,
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
                customScale: settings.custom_scale,
                displayRadius: settings.display_radius
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
                use_custom_css = @use_custom_css,
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

    // Modified addPicturesToItem to handle file storage with junction table
    async addPicturesToItem(itemId, pictures) {
        for (const pic of pictures) {
            if (pic.picture) {
                const fileInfo = await this.saveImageFile(pic.picture, itemId);
                const stmt = this.db.prepare(`
                    INSERT INTO pictures (
                        file_path, file_name, file_size, file_type,
                        width, height, title, description
                    ) VALUES (
                        @file_path, @file_name, @file_size, @file_type,
                        @width, @height, @title, @description
                    )
                `);

                const result = stmt.run({
                    ...fileInfo,
                    title: pic.title || 'Untitled',
                    description: pic.description || ''
                });

                // Create a reference in the junction table
                if (result.lastInsertRowid) {
                    this.addImageReference(itemId, result.lastInsertRowid);
                }
            }
        }
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
                timeline_id, font, font_size_scale, pixels_per_subtick, custom_css, use_custom_css,
                is_fullscreen, show_guides, window_size_x, window_size_y, window_position_x, window_position_y,
                use_custom_scaling, custom_scale, display_radius
            ) VALUES (
                @timeline_id, @font, @font_size_scale, @pixels_per_subtick, @custom_css, @use_custom_css,
                @is_fullscreen, @show_guides, @window_size_x, @window_size_y, @window_position_x, @window_position_y,
                @use_custom_scaling, @custom_scale, @display_radius
            )
        `);

        const defaultSettings = {
            timeline_id: timelineId,
            font: 'Arial',
            font_size_scale: 1.0,
            pixels_per_subtick: 20,
            custom_css: '',
            use_custom_css: 0,
            is_fullscreen: 0,
            show_guides: 1,
            window_size_x: 1000,
            window_size_y: 700,
            window_position_x: 300,
            window_position_y: 100,
            use_custom_scaling: 0,
            custom_scale: 1.0,
            display_radius: 10
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
            // Add stack trace to see what's calling this method
            console.log(`[dbManager.js] saveNewImage called with:`, {
                file_path: fileInfo.file_path,
                file_name: fileInfo.file_name,
                file_size: fileInfo.file_size,
                description: fileInfo.description
            });
            console.log(`[dbManager.js] saveNewImage call stack:`, new Error().stack);

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
                description: fileInfo.description || ''
            };

            // Insert into pictures table
            const stmt = this.db.prepare(`
                INSERT INTO pictures (
                    file_path, file_name, file_size, file_type,
                    width, height, title, description
                ) VALUES (
                    @file_path, @file_name, @file_size, @file_type,
                    @width, @height, @title, @description
                )
            `);

            const result = stmt.run({
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

    // Add image references for pictures after item creation
    updatePicturesItemId(pictureIds, itemId) {
        if (!Array.isArray(pictureIds) || pictureIds.length === 0 || !itemId) {
            return;
        }

        // Instead of updating the old item_id column, create references in the junction table
        for (const pictureId of pictureIds) {
            this.addImageReference(itemId, pictureId);
        }
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

        // Item-Pictures junction table indexes
        this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_item_pictures_item_id ON item_pictures(item_id);
            CREATE INDEX IF NOT EXISTS idx_item_pictures_picture_id ON item_pictures(picture_id);
            CREATE INDEX IF NOT EXISTS idx_item_pictures_combined ON item_pictures(item_id, picture_id);
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

    /**
     * Detects and consolidates duplicate images in the current database
     * This can be run on an already migrated database to find and remove duplicates
     * @returns {Object} Statistics about the consolidation process
     */
    async consolidateDuplicateImages() {
        const fs = require('fs');
        
        console.log('[dbManager.js] Starting duplicate image consolidation...');
        
        try {
            this.db.prepare('BEGIN').run();
            
            // Get all pictures in the current system
            const allPictures = this.db.prepare(`
                SELECT id, file_path, file_name, file_size 
                FROM pictures 
                WHERE file_path IS NOT NULL
                ORDER BY id ASC
            `).all();
            
            console.log(`[dbManager.js] Analyzing ${allPictures.length} images for duplicates...`);
            
            // Calculate hashes for all images and group by hash
            const hashGroups = new Map(); // hash -> [picture1, picture2, ...]
            
            for (const picture of allPictures) {
                try {
                    if (picture.file_path && fs.existsSync(picture.file_path)) {
                        const fileBuffer = fs.readFileSync(picture.file_path);
                        const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
                        
                        if (!hashGroups.has(hash)) {
                            hashGroups.set(hash, []);
                        }
                        hashGroups.get(hash).push(picture);
                    } else {
                        console.warn(`[dbManager.js] Image file not found: ${picture.file_path}`);
                    }
                } catch (error) {
                    console.error(`[dbManager.js] Error processing image ${picture.file_path}:`, error);
                }
            }
            
            // Find groups with duplicates (more than 1 image with same hash)
            const duplicateGroups = Array.from(hashGroups.entries())
                .filter(([hash, pictures]) => pictures.length > 1);
            
            console.log(`[dbManager.js] Found ${duplicateGroups.length} groups with duplicates`);
            
            let duplicatesConsolidated = 0;
            let filesDeleted = 0;
            let referencesUpdated = 0;
            
            for (const [hash, duplicatePictures] of duplicateGroups) {
                console.log(`[dbManager.js] Processing duplicate group with ${duplicatePictures.length} images (hash: ${hash.substring(0, 8)}...)`);
                
                // Sort by ID to keep the oldest (lowest ID) as the master
                duplicatePictures.sort((a, b) => a.id - b.id);
                const masterPicture = duplicatePictures[0];
                const duplicates = duplicatePictures.slice(1);
                
                console.log(`[dbManager.js] Keeping master image ID ${masterPicture.id}: ${masterPicture.file_path}`);
                
                // For each duplicate, update all references to point to the master
                for (const duplicate of duplicates) {
                    console.log(`[dbManager.js] Processing duplicate ID ${duplicate.id}: ${duplicate.file_path}`);
                    
                    // Get all references to this duplicate image
                    const references = this.db.prepare(`
                        SELECT item_id FROM item_pictures WHERE picture_id = ?
                    `).all(duplicate.id);
                    
                    console.log(`[dbManager.js] Found ${references.length} references to duplicate ID ${duplicate.id}`);
                    
                    // Update each reference to point to the master image instead
                    for (const ref of references) {
                        // Check if master already has a reference to this item (prevent duplicates)
                        const existingRef = this.db.prepare(`
                            SELECT COUNT(*) as count 
                            FROM item_pictures 
                            WHERE item_id = ? AND picture_id = ?
                        `).get(ref.item_id, masterPicture.id).count;
                        
                        if (existingRef === 0) {
                            // Update reference to point to master
                            const updateResult = this.db.prepare(`
                                UPDATE item_pictures 
                                SET picture_id = ? 
                                WHERE item_id = ? AND picture_id = ?
                            `).run(masterPicture.id, ref.item_id, duplicate.id);
                            
                            referencesUpdated += updateResult.changes;
                            console.log(`[dbManager.js] Updated reference: item ${ref.item_id} now points to master ${masterPicture.id}`);
                        } else {
                            // Master already referenced by this item, just delete the duplicate reference
                            this.db.prepare(`
                                DELETE FROM item_pictures 
                                WHERE item_id = ? AND picture_id = ?
                            `).run(ref.item_id, duplicate.id);
                            
                            console.log(`[dbManager.js] Removed duplicate reference: item ${ref.item_id} already references master ${masterPicture.id}`);
                        }
                    }
                    
                    // Now it's safe to delete the duplicate image record from database
                    this.db.prepare(`DELETE FROM pictures WHERE id = ?`).run(duplicate.id);
                    console.log(`[dbManager.js] Deleted duplicate image record ID ${duplicate.id}`);
                    
                    duplicatesConsolidated++;
                }
            }
            
            // Commit database changes BEFORE deleting files
            this.db.prepare('COMMIT').run();
            console.log('[dbManager.js] Database changes committed, now deleting duplicate files...');
            
            // Now delete the physical files (after database is safely updated)
            for (const [hash, duplicatePictures] of duplicateGroups) {
                const masterPicture = duplicatePictures[0]; // Same sorting as above
                const duplicates = duplicatePictures.slice(1);
                
                for (const duplicate of duplicates) {
                    if (duplicate.file_path && fs.existsSync(duplicate.file_path)) {
                        try {
                            fs.unlinkSync(duplicate.file_path);
                            filesDeleted++;
                            console.log(`[dbManager.js] Deleted duplicate file: ${duplicate.file_path}`);
                        } catch (error) {
                            console.error(`[dbManager.js] Failed to delete duplicate file ${duplicate.file_path}:`, error);
                        }
                    }
                }
            }
            
            const stats = {
                totalImagesAnalyzed: allPictures.length,
                duplicateGroupsFound: duplicateGroups.length,
                duplicatesConsolidated: duplicatesConsolidated,
                filesDeleted: filesDeleted,
                referencesUpdated: referencesUpdated,
                storageSpaceSaved: 'Calculate manually' // Could calculate file sizes if needed
            };
            
            console.log(`[dbManager.js] Consolidation completed:`, stats);
            return stats;
            
        } catch (error) {
            this.db.prepare('ROLLBACK').run();
            console.error('[dbManager.js] Error during duplicate consolidation:', error);
            throw error;
        }
    }

    /**
     * Detects and consolidates visually similar images (not just byte-identical)
     * This is more permissive than hash-based detection and catches images that look the same
     * but have different metadata, compression, etc.
     * @returns {Object} Statistics about the consolidation process
     */
    async consolidateVisuallyDuplicateImages() {
        const fs = require('fs');
        
        console.log('[dbManager.js] Starting visual duplicate image consolidation...');
        
        try {
            this.db.prepare('BEGIN').run();
            
            // Get all pictures in the current system
            const allPictures = this.db.prepare(`
                SELECT id, file_path, file_name, file_size, width, height, file_type
                FROM pictures 
                WHERE file_path IS NOT NULL
                ORDER BY id ASC
            `).all();
            
            console.log(`[dbManager.js] Analyzing ${allPictures.length} images for visual duplicates...`);
            
            // Group by dimensions and file size first (quick filter)
            const visualGroups = new Map(); // "width_height_size" -> [picture1, picture2, ...]
            
            for (const picture of allPictures) {
                if (picture.file_path && fs.existsSync(picture.file_path)) {
                    // Create a key based on visual characteristics
                    const visualKey = `${picture.width || 0}_${picture.height || 0}_${picture.file_size || 0}`;
                    
                    if (!visualGroups.has(visualKey)) {
                        visualGroups.set(visualKey, []);
                    }
                    visualGroups.get(visualKey).push(picture);
                } else {
                    console.warn(`[dbManager.js] Image file not found: ${picture.file_path}`);
                }
            }
            
            // Find groups with potential duplicates (same dimensions and size)
            const potentialDuplicateGroups = Array.from(visualGroups.entries())
                .filter(([key, pictures]) => pictures.length > 1);
            
            console.log(`[dbManager.js] Found ${potentialDuplicateGroups.length} groups with potential visual duplicates`);
            
            let duplicatesConsolidated = 0;
            let filesDeleted = 0;
            let referencesUpdated = 0;
            
            for (const [visualKey, duplicatePictures] of potentialDuplicateGroups) {
                const [width, height, size] = visualKey.split('_').map(Number);
                console.log(`[dbManager.js] Processing visual duplicate group: ${width}x${height} ${size}bytes (${duplicatePictures.length} images)`);
                
                // Sort by ID to keep the oldest (lowest ID) as the master
                duplicatePictures.sort((a, b) => a.id - b.id);
                const masterPicture = duplicatePictures[0];
                const duplicates = duplicatePictures.slice(1);
                
                console.log(`[dbManager.js] Keeping master image ID ${masterPicture.id}: ${masterPicture.file_name}`);
                
                // For images with same dimensions and file size, treat as duplicates
                // This catches cases where metadata differs but the visual content is the same
                for (const duplicate of duplicates) {
                    console.log(`[dbManager.js] Processing visual duplicate ID ${duplicate.id}: ${duplicate.file_name}`);
                    
                    // Get all references to this duplicate image
                    const references = this.db.prepare(`
                        SELECT item_id FROM item_pictures WHERE picture_id = ?
                    `).all(duplicate.id);
                    
                    console.log(`[dbManager.js] Found ${references.length} references to duplicate ID ${duplicate.id}`);
                    
                    // Update each reference to point to the master image instead
                    for (const ref of references) {
                        // Check if master already has a reference to this item (prevent duplicates)
                        const existingRef = this.db.prepare(`
                            SELECT COUNT(*) as count 
                            FROM item_pictures 
                            WHERE item_id = ? AND picture_id = ?
                        `).get(ref.item_id, masterPicture.id).count;
                        
                        if (existingRef === 0) {
                            // Update reference to point to master
                            const updateResult = this.db.prepare(`
                                UPDATE item_pictures 
                                SET picture_id = ? 
                                WHERE item_id = ? AND picture_id = ?
                            `).run(masterPicture.id, ref.item_id, duplicate.id);
                            
                            referencesUpdated += updateResult.changes;
                            console.log(`[dbManager.js] Updated reference: item ${ref.item_id} now points to master ${masterPicture.id}`);
                        } else {
                            // Master already referenced by this item, just delete the duplicate reference
                            this.db.prepare(`
                                DELETE FROM item_pictures 
                                WHERE item_id = ? AND picture_id = ?
                            `).run(ref.item_id, duplicate.id);
                            
                            console.log(`[dbManager.js] Removed duplicate reference: item ${ref.item_id} already references master ${masterPicture.id}`);
                        }
                    }
                    
                    // Now it's safe to delete the duplicate image record from database
                    this.db.prepare(`DELETE FROM pictures WHERE id = ?`).run(duplicate.id);
                    console.log(`[dbManager.js] Deleted duplicate image record ID ${duplicate.id}`);
                    
                    duplicatesConsolidated++;
                }
            }
            
            // Commit database changes BEFORE deleting files
            this.db.prepare('COMMIT').run();
            console.log('[dbManager.js] Database changes committed, now deleting duplicate files...');
            
            // Now delete the physical files (after database is safely updated)
            for (const [visualKey, duplicatePictures] of potentialDuplicateGroups) {
                const masterPicture = duplicatePictures[0]; // Same sorting as above
                const duplicates = duplicatePictures.slice(1);
                
                for (const duplicate of duplicates) {
                    if (duplicate.file_path && fs.existsSync(duplicate.file_path)) {
                        try {
                            fs.unlinkSync(duplicate.file_path);
                            filesDeleted++;
                            console.log(`[dbManager.js] Deleted visual duplicate file: ${duplicate.file_path}`);
                        } catch (error) {
                            console.error(`[dbManager.js] Failed to delete duplicate file ${duplicate.file_path}:`, error);
                        }
                    }
                }
            }
            
            const stats = {
                totalImagesAnalyzed: allPictures.length,
                duplicateGroupsFound: potentialDuplicateGroups.length,
                duplicatesConsolidated: duplicatesConsolidated,
                filesDeleted: filesDeleted,
                referencesUpdated: referencesUpdated,
                method: 'visual-similarity',
                criteria: 'Same dimensions and file size'
            };
            
            console.log(`[dbManager.js] Visual duplicate consolidation completed:`, stats);
            return stats;
            
        } catch (error) {
            this.db.prepare('ROLLBACK').run();
            console.error('[dbManager.js] Error during visual duplicate consolidation:', error);
            throw error;
        }
    }

    // ==================== CHARACTER MANAGEMENT METHODS ====================

    /**
     * Generates a unique character ID
     * @param {string} name - Character name
     * @returns {string} Unique character ID
     */
    generateCharacterId(name) {
        // Use the same random ID generation as timeline items for proper uniqueness
        let id;
        let attempts = 0;
        const maxAttempts = 100; // Safety limit to prevent infinite loops
        
        do {
            id = this.generateRandomId();
            attempts++;
            
            if (attempts >= maxAttempts) {
                // Fallback: add timestamp to ensure uniqueness
                id = this.generateRandomId() + '_' + Date.now();
                break;
            }
        } while (this.db.prepare('SELECT id FROM characters WHERE id = ?').get(id));
        
        return id;
    }

    /**
     * Generates a random ID for timeline items and characters
     * @returns {string} Random ID (16 characters, ~95 bits of entropy)
     */
    generateRandomId() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 16; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    /**
     * Adds a new character
     * @param {Object} character - Character data
     * @returns {string} Character ID
     */
    async addCharacter(character) {
        const characterId = character.id || this.generateCharacterId(character.name);
        
        try {
            this.db.prepare('BEGIN').run();
            
            // Images will be handled through the character reference item, not stored directly on character
            
            // Insert character (without image columns - images handled via character reference item)
            const stmt = this.db.prepare(`
                INSERT INTO characters (
                    id, name, nicknames, aliases, race, description, notes,
                    birth_year, birth_subtick, birth_date, birth_alternative_year,
                    death_year, death_subtick, death_date, death_alternative_year,
                    importance, color, timeline_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            stmt.run(
                characterId,
                character.name,
                character.nicknames || null,
                character.aliases || null,
                character.race || null,
                character.description || null,
                character.notes || null,
                character.birth_year || null,
                character.birth_subtick !== undefined ? character.birth_subtick : null, // Fix: preserve 0 values
                character.birth_date || null,
                character.birth_alternative_year || null,
                character.death_year || null,
                character.death_subtick !== undefined ? character.death_subtick : null, // Fix: preserve 0 values
                character.death_date || null,
                character.death_alternative_year || null,
                character.importance || 5,
                character.color || null,
                character.timeline_id || this.currentTimelineId
            );

            // Auto-create a character timeline item (type_id = 7)
            const characterItemId = this.generateRandomId();
            const currentGranularity = this.getUniverseData().granularity || 1; // Fix: use actual current granularity
            
            // Create content as JSON for easier parsing
            const contentData = {};
            if (character.notes) contentData.notes = character.notes;
            if (character.aliases) contentData.aliases = character.aliases;
            if (character.birth_alternative_year) contentData.birth_alternative_year = character.birth_alternative_year;
            if (character.death_alternative_year) contentData.death_alternative_year = character.death_alternative_year;
            if (character.nicknames) contentData.nicknames = character.nicknames;
            if (character.race) contentData.race = character.race;
            
            const content = Object.keys(contentData).length > 0 ? JSON.stringify(contentData) : null;
            
            const characterItemStmt = this.db.prepare(`
                INSERT INTO items (
                    id, title, description, content, type_id, year, subtick, end_year, end_subtick,
                    original_subtick, original_end_subtick, creation_granularity,
                    color, timeline_id, show_in_notes, created_at, updated_at
                ) VALUES (?, ?, ?, ?, 7, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `);
            
            const endYear = character.death_year || character.birth_year;
            const endSubtick = character.death_subtick !== undefined ? character.death_subtick : character.birth_subtick;
            const birthSubtick = character.birth_subtick !== undefined ? character.birth_subtick : 0;
            const finalEndSubtick = endSubtick !== undefined ? endSubtick : 0;
            
            characterItemStmt.run(
                characterItemId,
                `character_item_${character.name}`,
                character.description || null,
                content,
                character.birth_year || 0,
                birthSubtick,  // Fix: preserve 0 values
                endYear || 0,
                finalEndSubtick,  // Fix: preserve 0 values
                birthSubtick,  // original_subtick - Fix: preserve 0 values
                finalEndSubtick,  // original_end_subtick - Fix: preserve 0 values
                currentGranularity,  // Fix: use actual current granularity
                character.color || null,
                character.timeline_id || this.currentTimelineId
            );

            // Add character reference to the item
            this.addCharacterReferencesToItem(characterItemId, [{ character_id: characterId }], true);

            // Add images to the character reference item
            if (character.images && character.images.length > 0) {
                await this.addPicturesToItemEnhanced(characterItemId, character.images);
            }

            // Add tags if provided
            if (character.tags && character.tags.length > 0) {
                this.addTagsToItem(characterItemId, character.tags);
            }
            
            // Add story references if provided
            if (character.story_refs && character.story_refs.length > 0) {
                this.addStoryReferencesToItem(characterItemId, character.story_refs);
            }
            
            // Handle connected item creation if specified
            if (character.connected_item_type) {
                const connectedItemId = this.generateRandomId();
                const typeId = parseInt(character.connected_item_type);
                
                // Determine if it's a range item (Period or Age)
                const isRangeItem = typeId === 2 || typeId === 3; // Period or Age
                
                const connectedItemStmt = this.db.prepare(`
                    INSERT INTO items (
                        id, title, description, content, type_id, year, subtick, end_year, end_subtick,
                        original_subtick, original_end_subtick, creation_granularity,
                        color, timeline_id, show_in_notes, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                `);
                
                connectedItemStmt.run(
                    connectedItemId,
                    character.name, // Copy character name as title
                    character.description || null, // Copy description
                    content, // Use the same JSON content as character item
                    typeId,
                    character.birth_year || 0,
                    birthSubtick,  // Fix: preserve 0 values
                    isRangeItem ? (endYear || 0) : (character.birth_year || 0),
                    isRangeItem ? finalEndSubtick : birthSubtick,  // Fix: preserve 0 values
                    birthSubtick,  // original_subtick - Fix: preserve 0 values
                    isRangeItem ? finalEndSubtick : birthSubtick, // original_end_subtick - Fix: preserve 0 values
                    currentGranularity,            // creation_granularity
                    character.color || null,       // Copy color
                    character.timeline_id || this.currentTimelineId
                );
                
                // Add character reference to connected item
                this.addCharacterReferencesToItem(connectedItemId, [{ character_id: characterId }], true);
                
                // Copy tags to connected item
                if (character.tags && character.tags.length > 0) {
                    this.addTagsToItem(connectedItemId, character.tags);
                }
                
                // Copy story references to connected item
                if (character.story_refs && character.story_refs.length > 0) {
                    this.addStoryReferencesToItem(connectedItemId, character.story_refs);
                }
                
                // Copy images to connected item
                if (character.images && character.images.length > 0) {
                    await this.addPicturesToItemEnhanced(connectedItemId, character.images);
                }
            }
            
            this.db.prepare('COMMIT').run();
            console.log(`[dbManager.js] Added character: ${characterId}`);
            return characterId;
            
        } catch (error) {
            this.db.prepare('ROLLBACK').run();
            console.error('[dbManager.js] Error adding character:', error);
            throw error;
        }
    }

    /**
     * Gets a character by ID with images, tags, and story references from character reference item
     * @param {string} id - Character ID
     * @returns {Object|null} Character data with images, tags, and story references
     */
    getCharacter(id) {
        // Get the basic character data
        const character = this.db.prepare('SELECT * FROM characters WHERE id = ?').get(id);
        
        if (!character) {
            return null;
        }
        
        // Find the character reference item (type_id = 7)
        const characterItemQuery = this.db.prepare(`
            SELECT i.id FROM items i
            JOIN item_characters ic ON i.id = ic.item_id
            WHERE ic.character_id = ? AND i.type_id = 7
            LIMIT 1
        `);
        const characterItem = characterItemQuery.get(id);
        
        if (characterItem) {
            // Get images from the character reference item
            character.images = this.getItemPictures(characterItem.id);
            
            // Get tags from the character reference item
            character.tags = this.getItemTags(characterItem.id);
            
            // Get story references from the character reference item
            character.story_refs = this.getItemStoryReferences(characterItem.id);
        } else {
            // No character reference item found, set empty arrays
            character.images = [];
            character.tags = [];
            character.story_refs = [];
        }
        
        return character;
    }

    /**
     * Gets all characters for the current timeline with images, tags, and story references
     * @param {number} timelineId - Timeline ID (optional, uses current if not provided)
     * @returns {Array} Array of characters with images, tags, and story references
     */
    getAllCharacters(timelineId = null) {
        const timeline = timelineId || this.currentTimelineId;
        const characters = this.db.prepare('SELECT * FROM characters WHERE timeline_id = ? ORDER BY name').all(timeline);
        
        // For each character, get their images, tags, and story references from the character reference item
        return characters.map(character => {
            // Find the character reference item (type_id = 7)
            const characterItemQuery = this.db.prepare(`
                SELECT i.id FROM items i
                JOIN item_characters ic ON i.id = ic.item_id
                WHERE ic.character_id = ? AND i.type_id = 7
                LIMIT 1
            `);
            const characterItem = characterItemQuery.get(character.id);
            
            if (characterItem) {
                // Get images from the character reference item
                character.images = this.getItemPictures(characterItem.id);
                
                // Get tags from the character reference item
                character.tags = this.getItemTags(characterItem.id);
                
                // Get story references from the character reference item
                character.story_refs = this.getItemStoryReferences(characterItem.id);
            } else {
                // No character reference item found, set empty arrays
                character.images = [];
                character.tags = [];
                character.story_refs = [];
            }
            
            return character;
        });
    }

    /**
     * Updates a character
     * @param {string} id - Character ID
     * @param {Object} character - Updated character data
     * @returns {boolean} Success status
     */
    async updateCharacter(id, character) {
        try {
            this.db.prepare('BEGIN').run();
            
            const stmt = this.db.prepare(`
                UPDATE characters SET
                    name = ?, nicknames = ?, aliases = ?, race = ?, description = ?, notes = ?,
                    birth_year = ?, birth_subtick = ?, birth_date = ?, birth_alternative_year = ?,
                    death_year = ?, death_subtick = ?, death_date = ?, death_alternative_year = ?,
                    importance = ?, color = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `);
            
            const result = stmt.run(
                character.name,
                character.nicknames || null,
                character.aliases || null,
                character.race || null,
                character.description || null,
                character.notes || null,
                character.birth_year || null,
                character.birth_subtick !== undefined ? character.birth_subtick : null,
                character.birth_date || null,
                character.birth_alternative_year || null,
                character.death_year || null,
                character.death_subtick !== undefined ? character.death_subtick : null,
                character.death_date || null,
                character.death_alternative_year || null,
                character.importance || 5,
                character.color || null,
                id
            );

            // Find and update the corresponding character item (type_id = 7)
            const characterItemQuery = this.db.prepare(`
                SELECT i.id FROM items i
                JOIN item_characters ic ON i.id = ic.item_id
                WHERE ic.character_id = ? AND i.type_id = 7
                LIMIT 1
            `);
            const characterItem = characterItemQuery.get(id);
            
            if (characterItem) {
                // Create content as JSON for easier parsing
                const contentData = {};
                if (character.notes) contentData.notes = character.notes;
                if (character.aliases) contentData.aliases = character.aliases;
                if (character.birth_alternative_year) contentData.birth_alternative_year = character.birth_alternative_year;
                if (character.death_alternative_year) contentData.death_alternative_year = character.death_alternative_year;
                if (character.nicknames) contentData.nicknames = character.nicknames;
                if (character.race) contentData.race = character.race;
                
                const content = Object.keys(contentData).length > 0 ? JSON.stringify(contentData) : null;
                
                const endYear = character.death_year || character.birth_year;
                const endSubtick = character.death_subtick !== undefined ? character.death_subtick : character.birth_subtick;
                const birthSubtick = character.birth_subtick !== undefined ? character.birth_subtick : 0;
                const finalEndSubtick = endSubtick !== undefined ? endSubtick : 0;
                
                this.db.prepare(`
                    UPDATE items SET
                        title = ?, description = ?, content = ?, year = ?, subtick = ?, 
                        end_year = ?, end_subtick = ?, color = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).run(
                    `character_item_${character.name}`,
                    character.description || null,
                    content,
                    character.birth_year || 0,
                    birthSubtick,
                    endYear || 0,
                    finalEndSubtick,
                    character.color || null,
                    characterItem.id
                );

                // Update tags if provided
                if (character.tags !== undefined) {
                    this.updateItemTags(characterItem.id, character.tags);
                }
                
                // Update story references if provided
                if (character.story_refs !== undefined) {
                    // Remove existing story references
                    this.db.prepare('DELETE FROM story_references WHERE item_id = ?').run(characterItem.id);
                    // Add new story references
                    if (character.story_refs.length > 0) {
                        this.addStoryReferencesToItem(characterItem.id, character.story_refs);
                    }
                }
                
                // Update images if provided
                if (character.images !== undefined) {
                    await this.updateItemPictures(characterItem.id, character.images);
                }
            }
            
            this.db.prepare('COMMIT').run();
            return result.changes > 0;
            
        } catch (error) {
            this.db.prepare('ROLLBACK').run();
            console.error('[dbManager.js] Error updating character:', error);
            throw error;
        }
    }

    /**
     * Deletes a character and all related data
     * @param {string} id - Character ID
     * @returns {boolean} Success status
     */
    deleteCharacter(id) {
        try {
            this.db.prepare('BEGIN').run();
            
            // Delete character relationships
            this.db.prepare('DELETE FROM character_relationships WHERE character_1_id = ? OR character_2_id = ?').run(id, id);
            
            // Delete item-character references
            this.db.prepare('DELETE FROM item_characters WHERE character_id = ?').run(id);
            
            // Find and delete the corresponding character item (this will cascade to tags)
            const characterItemQuery = this.db.prepare(`
                SELECT i.id FROM items i
                JOIN item_characters ic ON i.id = ic.item_id
                WHERE ic.character_id = ? AND i.type_id = 7
                LIMIT 1
            `);
            const characterItem = characterItemQuery.get(id);
            
            if (characterItem) {
                this.db.prepare('DELETE FROM items WHERE id = ?').run(characterItem.id);
            }
            
            // Delete the character
            const result = this.db.prepare('DELETE FROM characters WHERE id = ?').run(id);
            
            this.db.prepare('COMMIT').run();
            console.log(`[dbManager.js] Deleted character: ${id}`);
            return result.changes > 0;
            
        } catch (error) {
            this.db.prepare('ROLLBACK').run();
            console.error('[dbManager.js] Error deleting character:', error);
            throw error;
        }
    }

    // ==================== CHARACTER RELATIONSHIP METHODS ====================

    /**
     * Validates relationship type
     * @param {string} relationshipType - Relationship type to validate
     * @returns {boolean} True if valid
     */
    validateRelationshipType(relationshipType) {
        const validTypes = [
            'parent', 'child', 'sibling', 'spouse', 'partner', 'ex-spouse', 'ex-partner',
            'grandparent', 'grandchild', 'great-grandparent', 'great-grandchild',
            'great-great-grandparent', 'great-great-grandchild',
            'aunt', 'uncle', 'niece', 'nephew', 'cousin', 'great-aunt', 'great-uncle',
            'great-niece', 'great-nephew',
            'step-parent', 'step-child', 'step-sibling', 'half-sibling',
            'step-grandparent', 'step-grandchild',
            'parent-in-law', 'child-in-law', 'sibling-in-law', 'grandparent-in-law', 'grandchild-in-law',
            'adoptive-parent', 'adoptive-child', 'adoptive-sibling',
            'foster-parent', 'foster-child', 'foster-sibling',
            'biological-parent', 'biological-child',
            'godparent', 'godchild', 'mentor', 'apprentice', 'guardian', 'ward',
            'best-friend', 'friend', 'ally', 'enemy', 'rival', 'acquaintance', 'colleague', 'neighbor',
            'familiar', 'bonded', 'master', 'servant', 'liege', 'vassal', 'clan-member', 'pack-member',
            'custom', 'other'
        ];
        return validTypes.includes(relationshipType);
    }

    /**
     * Adds a relationship between two characters
     * @param {Object} relationship - Relationship data
     * @returns {number} Relationship ID
     */
    addCharacterRelationship(relationship) {
        // Validate relationship type
        if (!this.validateRelationshipType(relationship.relationship_type)) {
            throw new Error(`Invalid relationship type: ${relationship.relationship_type}`);
        }

        const stmt = this.db.prepare(`
            INSERT INTO character_relationships (
                character_1_id, character_2_id, relationship_type, custom_relationship_type,
                relationship_degree, relationship_modifier, relationship_strength,
                is_bidirectional, notes, timeline_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        const result = stmt.run(
            relationship.character_1_id,
            relationship.character_2_id,
            relationship.relationship_type,
            relationship.custom_relationship_type || null,
            relationship.relationship_degree || null,
            relationship.relationship_modifier || null,
            relationship.relationship_strength || 50,
            relationship.is_bidirectional ? 1 : 0,
            relationship.notes || null,
            relationship.timeline_id || this.currentTimelineId
        );
        
        console.log(`[dbManager.js] Added character relationship: ${relationship.character_1_id} -> ${relationship.character_2_id}`);
        return result.lastInsertRowid;
    }

    /**
     * Gets all relationships for a character
     * @param {string} characterId - Character ID
     * @returns {Array} Array of relationships
     */
    getCharacterRelationships(characterId) {
        return this.db.prepare(`
            SELECT cr.*, 
                   c1.name as character_1_name,
                   c2.name as character_2_name
            FROM character_relationships cr
            JOIN characters c1 ON cr.character_1_id = c1.id
            JOIN characters c2 ON cr.character_2_id = c2.id
            WHERE cr.character_1_id = ? OR cr.character_2_id = ?
            ORDER BY cr.relationship_strength DESC, cr.created_at ASC
        `).all(characterId, characterId);
    }

    /**
     * Gets all relationships for the current timeline
     * @param {number} timelineId - Timeline ID (optional)
     * @returns {Array} Array of all relationships
     */
    getAllCharacterRelationships(timelineId = null) {
        const timeline = timelineId || this.currentTimelineId;
        return this.db.prepare(`
            SELECT cr.*, 
                   c1.name as character_1_name,
                   c2.name as character_2_name
            FROM character_relationships cr
            JOIN characters c1 ON cr.character_1_id = c1.id
            JOIN characters c2 ON cr.character_2_id = c2.id
            WHERE cr.timeline_id = ?
            ORDER BY cr.relationship_strength DESC, cr.created_at ASC
        `).all(timeline);
    }

    /**
     * Updates a character relationship
     * @param {number} id - Relationship ID
     * @param {Object} relationship - Updated relationship data
     * @returns {boolean} Success status
     */
    updateCharacterRelationship(id, relationship) {
        // Validate relationship type
        if (!this.validateRelationshipType(relationship.relationship_type)) {
            throw new Error(`Invalid relationship type: ${relationship.relationship_type}`);
        }

        const stmt = this.db.prepare(`
            UPDATE character_relationships SET
                relationship_type = ?, custom_relationship_type = ?,
                relationship_degree = ?, relationship_modifier = ?,
                relationship_strength = ?, is_bidirectional = ?,
                notes = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);
        
        const result = stmt.run(
            relationship.relationship_type,
            relationship.custom_relationship_type || null,
            relationship.relationship_degree || null,
            relationship.relationship_modifier || null,
            relationship.relationship_strength || 50,
            relationship.is_bidirectional ? 1 : 0,
            relationship.notes || null,
            id
        );
        
        return result.changes > 0;
    }

    /**
     * Deletes a character relationship
     * @param {number} id - Relationship ID
     * @returns {boolean} Success status
     */
    deleteCharacterRelationship(id) {
        const result = this.db.prepare('DELETE FROM character_relationships WHERE id = ?').run(id);
        return result.changes > 0;
    }

    // ==================== ITEM-CHARACTER REFERENCE METHODS ====================

    /**
     * Adds character references to an item
     * @param {string} itemId - Item ID
     * @param {Array} characterRefs - Array of character reference objects
     * @param {boolean} inTransaction - Whether we're already in a transaction
     */
    addCharacterReferencesToItem(itemId, characterRefs, inTransaction = false) {
        if (!characterRefs || characterRefs.length === 0) return;
        
        const executeOperations = () => {
            // Clear existing character references for this item
            this.db.prepare('DELETE FROM item_characters WHERE item_id = ?').run(itemId);
            
            // Add new character references
            const stmt = this.db.prepare(`
                INSERT INTO item_characters (item_id, character_id, relationship_type, timeline_id)
                VALUES (?, ?, ?, ?)
            `);
            
            for (const ref of characterRefs) {
                stmt.run(
                    itemId,
                    ref.character_id,
                    ref.relationship_type || 'appears',
                    ref.timeline_id || this.currentTimelineId
                );
            }
            
            console.log(`[dbManager.js] Added ${characterRefs.length} character references to item ${itemId}`);
        };
        
        if (inTransaction) {
            // We're already in a transaction, just execute the operations
            try {
                executeOperations();
            } catch (error) {
                console.error('[dbManager.js] Error adding character references to item:', error);
                throw error;
            }
        } else {
            // Manage our own transaction
            try {
                this.db.prepare('BEGIN').run();
                executeOperations();
                this.db.prepare('COMMIT').run();
            } catch (error) {
                this.db.prepare('ROLLBACK').run();
                console.error('[dbManager.js] Error adding character references to item:', error);
                throw error;
            }
        }
    }

    /**
     * Gets character references for an item
     * @param {string} itemId - Item ID
     * @returns {Array} Array of character references
     */
    getItemCharacterReferences(itemId) {
        return this.db.prepare(`
            SELECT ic.*, c.name as character_name
            FROM item_characters ic
            JOIN characters c ON ic.character_id = c.id
            WHERE ic.item_id = ?
            ORDER BY c.name
        `).all(itemId);
    }

    /**
     * Gets all character references for the current timeline
     * @param {number} timelineId - Timeline ID (optional)
     * @returns {Array} Array of all character references
     */
    getAllCharacterReferences(timelineId = null) {
        const timeline = timelineId || this.currentTimelineId;
        return this.db.prepare(`
            SELECT ic.*, c.name as character_name, i.title as item_title
            FROM item_characters ic
            JOIN characters c ON ic.character_id = c.id
            JOIN items i ON ic.item_id = i.id
            WHERE ic.timeline_id = ?
            ORDER BY c.name, i.title
        `).all(timeline);
    }

    /**
     * Gets all items that reference a specific character
     * @param {string} characterId - Character ID
     * @returns {Array} Array of items
     */
    getItemsReferencingCharacter(characterId) {
        return this.db.prepare(`
            SELECT i.*, ic.relationship_type
            FROM items i
            JOIN item_characters ic ON i.id = ic.item_id
            WHERE ic.character_id = ?
            ORDER BY i.year, i.subtick
        `).all(characterId);
    }

    /**
     * Searches characters by name, description, or other fields
     * @param {Object} criteria - Search criteria
     * @returns {Array} Array of matching characters
     */
    searchCharacters(criteria) {
        let query = 'SELECT * FROM characters WHERE timeline_id = ?';
        const params = [criteria.timeline_id || this.currentTimelineId];
        
        if (criteria.name) {
            query += ' AND (name LIKE ? OR nicknames LIKE ? OR aliases LIKE ?)';
            const namePattern = `%${criteria.name}%`;
            params.push(namePattern, namePattern, namePattern);
        }
        
        if (criteria.race) {
            query += ' AND race LIKE ?';
            params.push(`%${criteria.race}%`);
        }
        
        if (criteria.importance_min) {
            query += ' AND importance >= ?';
            params.push(criteria.importance_min);
        }
        
        if (criteria.importance_max) {
            query += ' AND importance <= ?';
            params.push(criteria.importance_max);
        }
        
        if (criteria.alive_in_year) {
            query += ' AND (birth_year IS NULL OR birth_year <= ?) AND (death_year IS NULL OR death_year >= ?)';
            params.push(criteria.alive_in_year, criteria.alive_in_year);
        }
        
        query += ' ORDER BY importance DESC, name';
        
        return this.db.prepare(query).all(...params);
    }

    /**
     * Gets character statistics for the current timeline
     * @param {number} timelineId - Timeline ID (optional)
     * @returns {Object} Character statistics
     */
    getCharacterStats(timelineId = null) {
        const timeline = timelineId || this.currentTimelineId;
        
        const totalCharacters = this.db.prepare('SELECT COUNT(*) as count FROM characters WHERE timeline_id = ?').get(timeline).count;
        const totalRelationships = this.db.prepare('SELECT COUNT(*) as count FROM character_relationships WHERE timeline_id = ?').get(timeline).count;
        const totalReferences = this.db.prepare('SELECT COUNT(*) as count FROM item_characters WHERE timeline_id = ?').get(timeline).count;
        
        const raceStats = this.db.prepare(`
            SELECT race, COUNT(*) as count 
            FROM characters 
            WHERE timeline_id = ? AND race IS NOT NULL 
            GROUP BY race 
            ORDER BY count DESC
        `).all(timeline);
        
        const importanceStats = this.db.prepare(`
            SELECT 
                AVG(importance) as avg_importance,
                MIN(importance) as min_importance,
                MAX(importance) as max_importance
            FROM characters 
            WHERE timeline_id = ?
        `).get(timeline);
        
        return {
            totalCharacters,
            totalRelationships,
            totalReferences,
            raceStats,
            importanceStats
        };
    }
}

module.exports = new DatabaseManager(); 