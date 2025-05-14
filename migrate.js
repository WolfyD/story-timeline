const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const Database = require('better-sqlite3');

class DatabaseMigration {
    constructor() {
        this.db = new Database(path.join(app.getPath('userData'), 'timeline.db'));
        this.mediaDir = path.join(app.getPath('userData'), 'media', 'pictures');
    }

    async migrate() {
        console.log('Starting database migration...');

        // Create media directory if it doesn't exist
        if (!fs.existsSync(this.mediaDir)) {
            fs.mkdirSync(this.mediaDir, { recursive: true });
        }

        // Begin transaction
        this.db.prepare('BEGIN TRANSACTION').run();

        try {
            // 1. Create new tables
            this.createNewTables();
            
            // 3. Migrate settings
            this.migrateSettings();
            
            // 2. Migrate universe_data to timelines
            await this.migrateUniverseData();

            // 4. Migrate pictures
            await this.migratePictures();

            // 5. Drop old tables
            this.dropOldTables();

            // Commit transaction
            this.db.prepare('COMMIT').run();
            console.log('Migration completed successfully!');
        } catch (error) {
            // Rollback on error
            this.db.prepare('ROLLBACK').run();
            console.error('Migration failed:', error);
            throw error;
        } finally {
            this.db.close();
        }
    }

    createNewTables() {
        console.log('Creating new tables...');

        // Create timelines table
        this.db.prepare(`
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
                UNIQUE(title, author)
            )
        `).run();

        // Create new settings table
        this.db.prepare(`
            CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
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
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (timeline_id) REFERENCES timelines(id)
            )
        `).run();

        // Create new pictures table
        this.db.prepare(`
            CREATE TABLE IF NOT EXISTS pictures (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_id TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_name TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                file_type TEXT NOT NULL,
                width INTEGER,
                height INTEGER,
                title TEXT,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (item_id) REFERENCES items(id)
            )
        `).run();
    }

    async migrateUniverseData() {
        // First check if universe_data table exists
        const tableExists = this.db.prepare(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='universe_data'
        `).get();

        if (!tableExists) {
            console.log('universe_data table does not exist, skipping migration');
            return;
        }

        // Get the universe data
        const universeData = this.db.prepare('SELECT * FROM universe_data').get();
        if (!universeData) {
            console.log('No universe data found, skipping migration');
            return;
        }

        // Create a new timeline with the universe data
        const timeline = {
            title: universeData.title || 'New Timeline',
            author: universeData.author || '',
            description: universeData.description || '',
            start_year: universeData.start_year || 0,
            granularity: universeData.granularity || 4
        };

        // Add the timeline
        const timelineId = this.dbManager.addTimeline(timeline);

        // Get the settings
        const settings = this.db.prepare('SELECT * FROM settings WHERE id = 1').get();
        if (settings) {
            // Update the settings with the timeline_id
            this.db.prepare(`
                UPDATE settings 
                SET timeline_id = @timeline_id 
                WHERE id = @settings_id
            `).run({
                timeline_id: timelineId,
                settings_id: settings.id
            });
        }

        // Drop the universe_data table
        this.db.prepare('DROP TABLE IF EXISTS universe_data').run();
    }

    migrateSettings() {
        console.log('Migrating settings...');

        const oldSettings = this.db.prepare('SELECT * FROM settings').get();
        if (oldSettings) {
            const timeline = this.db.prepare('SELECT id FROM timelines LIMIT 1').get();
            if (timeline) {
                this.db.prepare(`
                    UPDATE settings SET
                        timeline_id = @timeline_id,
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
                    WHERE id = @id
                `).run({
                    ...oldSettings,
                    timeline_id: timeline.id
                });
            }
        }
    }

    async migratePictures() {
        console.log('Migrating pictures...');

        const oldPictures = this.db.prepare('SELECT * FROM pictures').all();
        for (const pic of oldPictures) {
            if (pic.picture) {
                // Generate unique filename
                const timestamp = Date.now();
                const randomStr = Math.random().toString(36).substring(7);
                const fileName = `img_${timestamp}_${randomStr}.png`;
                const filePath = path.join(this.mediaDir, fileName);

                // Convert base64 to buffer and save
                const base64Image = pic.picture.replace(/^data:image\/\w+;base64,/, '');
                const buffer = Buffer.from(base64Image, 'base64');
                await fs.promises.writeFile(filePath, buffer);

                // Get image dimensions
                const size = buffer.length;
                const dimensions = await new Promise((resolve) => {
                    const img = new Image();
                    img.onload = () => resolve({ width: img.width, height: img.height });
                    img.src = pic.picture;
                });

                // Insert into new pictures table
                this.db.prepare(`
                    INSERT INTO pictures (
                        item_id, file_path, file_name, file_size, file_type,
                        width, height, title, description
                    ) VALUES (
                        @item_id, @file_path, @file_name, @file_size, @file_type,
                        @width, @height, @title, @description
                    )
                `).run({
                    item_id: pic.item_id,
                    file_path: filePath,
                    file_name: fileName,
                    file_size: size,
                    file_type: 'image/png',
                    width: dimensions.width,
                    height: dimensions.height,
                    title: pic.title || 'Untitled',
                    description: pic.description || ''
                });
            }
        }
    }

    dropOldTables() {
        console.log('Dropping old tables...');

        this.db.prepare('DROP TABLE IF EXISTS universe_data').run();
        this.db.prepare('DROP TABLE IF EXISTS old_settings').run();
        this.db.prepare('DROP TABLE IF EXISTS old_pictures').run();
    }
}

// Run migration
const migration = new DatabaseMigration();
migration.migrate().catch(console.error); 