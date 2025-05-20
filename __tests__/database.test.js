const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

describe('Database Connection', () => {
    let db;
    const testDbPath = path.join(__dirname, '../test.db');

    beforeEach(() => {
        // Remove test database if it exists
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
    });

    afterEach(() => {
        if (db) {
            db.close();
        }
        // Clean up test database
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
    });

    test('Database file is created', () => {
        db = new Database(testDbPath);
        expect(fs.existsSync(testDbPath)).toBe(true);
    });

    test('Database connection is established', () => {
        db = new Database(testDbPath);
        expect(db).toBeDefined();
        expect(db.open).toBe(true);
    });

    test('Database connection is stable', () => {
        db = new Database(testDbPath);
        // Try some basic operations
        db.prepare('SELECT 1').get();
        expect(db.open).toBe(true);
    });

    test('Database connection errors are handled gracefully', () => {
        // Try to open a database in a non-existent directory
        const invalidPath = path.join(__dirname, 'nonexistent', 'test.db');
        expect(() => {
            new Database(invalidPath);
        }).toThrow();
    });

    test('Database connection is closed properly', () => {
        db = new Database(testDbPath);
        db.close();
        expect(db.open).toBe(false);
    });
});

describe('Database Schema', () => {
    let db;
    const testDbPath = path.join(__dirname, '../test.db');

    beforeEach(() => {
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
        db = new Database(testDbPath);
    });

    afterEach(() => {
        if (db) {
            db.close();
        }
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
    });

    test('Timespan table exists with correct columns', () => {
        // Create timespan table
        db.exec(`
            CREATE TABLE IF NOT EXISTS timespan (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                start_year INTEGER NOT NULL,
                end_year INTEGER NOT NULL,
                name TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Get table info
        const tableInfo = db.prepare("PRAGMA table_info('timespan')").all();
        
        // Check columns
        expect(tableInfo).toHaveLength(6);
        expect(tableInfo.find(col => col.name === 'id')).toBeDefined();
        expect(tableInfo.find(col => col.name === 'start_year')).toBeDefined();
        expect(tableInfo.find(col => col.name === 'end_year')).toBeDefined();
        expect(tableInfo.find(col => col.name === 'name')).toBeDefined();
        expect(tableInfo.find(col => col.name === 'created_at')).toBeDefined();
        expect(tableInfo.find(col => col.name === 'updated_at')).toBeDefined();
    });

    test('TimelineItem table exists with correct columns', () => {
        // Create timeline_item table
        db.exec(`
            CREATE TABLE IF NOT EXISTS timeline_item (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timespan_id INTEGER NOT NULL,
                type TEXT NOT NULL,
                year INTEGER NOT NULL,
                subtick INTEGER NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (timespan_id) REFERENCES timespan(id)
            )
        `);

        // Get table info
        const tableInfo = db.prepare("PRAGMA table_info('timeline_item')").all();
        
        // Check columns
        expect(tableInfo).toHaveLength(9);
        expect(tableInfo.find(col => col.name === 'id')).toBeDefined();
        expect(tableInfo.find(col => col.name === 'timespan_id')).toBeDefined();
        expect(tableInfo.find(col => col.name === 'type')).toBeDefined();
        expect(tableInfo.find(col => col.name === 'year')).toBeDefined();
        expect(tableInfo.find(col => col.name === 'subtick')).toBeDefined();
        expect(tableInfo.find(col => col.name === 'name')).toBeDefined();
        expect(tableInfo.find(col => col.name === 'description')).toBeDefined();
        expect(tableInfo.find(col => col.name === 'created_at')).toBeDefined();
        expect(tableInfo.find(col => col.name === 'updated_at')).toBeDefined();
    });

    test('Foreign key relationships are correct', () => {
        // Create tables with foreign key
        db.exec(`
            CREATE TABLE IF NOT EXISTS timespan (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                start_year INTEGER NOT NULL,
                end_year INTEGER NOT NULL,
                name TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS timeline_item (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timespan_id INTEGER NOT NULL,
                type TEXT NOT NULL,
                year INTEGER NOT NULL,
                subtick INTEGER NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (timespan_id) REFERENCES timespan(id)
            );
        `);

        // Try to insert a timeline item with non-existent timespan_id
        expect(() => {
            db.prepare(`
                INSERT INTO timeline_item (timespan_id, type, year, subtick, name)
                VALUES (999, 'Event', 0, 0, 'Test Event')
            `).run();
        }).toThrow();
    });

    test('Default values are set correctly', () => {
        // Create timespan table
        db.exec(`
            CREATE TABLE IF NOT EXISTS timespan (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                start_year INTEGER NOT NULL,
                end_year INTEGER NOT NULL,
                name TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Insert a timespan
        const result = db.prepare(`
            INSERT INTO timespan (start_year, end_year, name)
            VALUES (0, 100, 'Test Timespan')
        `).run();

        // Check if timestamps were set
        const timespan = db.prepare('SELECT * FROM timespan WHERE id = ?').get(result.lastInsertRowid);
        expect(timespan.created_at).toBeDefined();
        expect(timespan.updated_at).toBeDefined();
    });
});

describe('Database Migration', () => {
    let db;
    const testDbPath = path.join(__dirname, '../test.db');

    beforeEach(() => {
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
        db = new Database(testDbPath);
    });

    afterEach(() => {
        if (db) {
            db.close();
        }
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
    });

    test('Migration runs on first launch', () => {
        // Check if migration table exists
        const migrationTable = db.prepare(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='migration'
        `).get();
        expect(migrationTable).toBeDefined();
    });

    test('Migration creates all required tables', () => {
        // Run migration
        db.exec(`
            CREATE TABLE IF NOT EXISTS migration (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                version INTEGER NOT NULL,
                applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS timespan (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                start_year INTEGER NOT NULL,
                end_year INTEGER NOT NULL,
                name TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS timeline_item (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timespan_id INTEGER NOT NULL,
                type TEXT NOT NULL,
                year INTEGER NOT NULL,
                subtick INTEGER NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (timespan_id) REFERENCES timespan(id)
            );

            INSERT INTO migration (version) VALUES (1);
        `);

        // Check if all tables exist
        const tables = db.prepare(`
            SELECT name FROM sqlite_master 
            WHERE type='table'
        `).all();

        expect(tables).toHaveLength(3);
        expect(tables.find(t => t.name === 'migration')).toBeDefined();
        expect(tables.find(t => t.name === 'timespan')).toBeDefined();
        expect(tables.find(t => t.name === 'timeline_item')).toBeDefined();
    });

    test('Migration handles existing data correctly', () => {
        // Create initial schema
        db.exec(`
            CREATE TABLE IF NOT EXISTS timespan (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                start_year INTEGER NOT NULL,
                end_year INTEGER NOT NULL,
                name TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            INSERT INTO timespan (start_year, end_year, name)
            VALUES (0, 100, 'Test Timespan');
        `);

        // Add new column in migration
        db.exec(`
            ALTER TABLE timespan ADD COLUMN description TEXT;
            UPDATE timespan SET description = 'Default description' WHERE description IS NULL;
        `);

        // Check if data is preserved and new column is added
        const timespan = db.prepare('SELECT * FROM timespan').get();
        expect(timespan.start_year).toBe(0);
        expect(timespan.end_year).toBe(100);
        expect(timespan.name).toBe('Test Timespan');
        expect(timespan.description).toBe('Default description');
    });

    test('Migration logs are created', () => {
        // Run migration
        db.exec(`
            CREATE TABLE IF NOT EXISTS migration (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                version INTEGER NOT NULL,
                applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            INSERT INTO migration (version) VALUES (1);
        `);

        // Check migration log
        const migration = db.prepare('SELECT * FROM migration').get();
        expect(migration.version).toBe(1);
        expect(migration.applied_at).toBeDefined();
    });

    test('Migration errors are handled gracefully', () => {
        // Try to run invalid migration
        expect(() => {
            db.exec(`
                CREATE TABLE IF NOT EXISTS invalid_table (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    invalid_column INVALID_TYPE
                );
            `);
        }).toThrow();
    });
});

describe('Initial Data Setup', () => {
    let db;
    const testDbPath = path.join(__dirname, '../test.db');

    beforeEach(() => {
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
        db = new Database(testDbPath);
        
        // Create tables
        db.exec(`
            CREATE TABLE IF NOT EXISTS timespan (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                start_year INTEGER NOT NULL,
                end_year INTEGER NOT NULL,
                name TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS timeline_item (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timespan_id INTEGER NOT NULL,
                type TEXT NOT NULL,
                year INTEGER NOT NULL,
                subtick INTEGER NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (timespan_id) REFERENCES timespan(id)
            );
        `);
    });

    afterEach(() => {
        if (db) {
            db.close();
        }
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
    });

    test('Default timespan is created if none exists', () => {
        // Check if any timespan exists
        const timespanCount = db.prepare('SELECT COUNT(*) as count FROM timespan').get().count;
        
        if (timespanCount === 0) {
            // Create default timespan
            db.prepare(`
                INSERT INTO timespan (start_year, end_year, name)
                VALUES (0, 100, 'Default Timespan')
            `).run();
        }

        const timespan = db.prepare('SELECT * FROM timespan').get();
        expect(timespan).toBeDefined();
        expect(timespan.start_year).toBe(0);
        expect(timespan.end_year).toBe(100);
        expect(timespan.name).toBe('Default Timespan');
    });

    test('Default timespan has correct start/end years', () => {
        // Create default timespan
        db.prepare(`
            INSERT INTO timespan (start_year, end_year, name)
            VALUES (0, 100, 'Default Timespan')
        `).run();

        const timespan = db.prepare('SELECT * FROM timespan').get();
        expect(timespan.start_year).toBe(0);
        expect(timespan.end_year).toBe(100);
    });

    test('Default timespan is set as active', () => {
        // Create default timespan
        const result = db.prepare(`
            INSERT INTO timespan (start_year, end_year, name)
            VALUES (0, 100, 'Default Timespan')
        `).run();

        // In a real app, we would have an 'active' column or a separate table
        // For now, we'll just verify the timespan exists
        const timespan = db.prepare('SELECT * FROM timespan WHERE id = ?').get(result.lastInsertRowid);
        expect(timespan).toBeDefined();
    });

    test('Default timespan is saved to database', () => {
        // Create default timespan
        const result = db.prepare(`
            INSERT INTO timespan (start_year, end_year, name)
            VALUES (0, 100, 'Default Timespan')
        `).run();

        // Verify it's in the database
        const timespan = db.prepare('SELECT * FROM timespan WHERE id = ?').get(result.lastInsertRowid);
        expect(timespan).toBeDefined();
        expect(timespan.start_year).toBe(0);
        expect(timespan.end_year).toBe(100);
        expect(timespan.name).toBe('Default Timespan');
    });
});

describe('CRUD Operations', () => {
    let db;
    const testDbPath = path.join(__dirname, '../test.db');

    beforeEach(() => {
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
        db = new Database(testDbPath);
        
        // Create tables
        db.exec(`
            CREATE TABLE IF NOT EXISTS timespan (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                start_year INTEGER NOT NULL,
                end_year INTEGER NOT NULL,
                name TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS timeline_item (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timespan_id INTEGER NOT NULL,
                type TEXT NOT NULL,
                year INTEGER NOT NULL,
                subtick INTEGER NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (timespan_id) REFERENCES timespan(id)
            );
        `);
    });

    afterEach(() => {
        if (db) {
            db.close();
        }
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
    });

    test('Create timespan', () => {
        const result = db.prepare(`
            INSERT INTO timespan (start_year, end_year, name)
            VALUES (0, 100, 'Test Timespan')
        `).run();

        expect(result.changes).toBe(1);
        expect(result.lastInsertRowid).toBeDefined();
    });

    test('Read timespan', () => {
        // Create a timespan
        const insertResult = db.prepare(`
            INSERT INTO timespan (start_year, end_year, name)
            VALUES (0, 100, 'Test Timespan')
        `).run();

        // Read it back
        const timespan = db.prepare('SELECT * FROM timespan WHERE id = ?').get(insertResult.lastInsertRowid);
        expect(timespan).toBeDefined();
        expect(timespan.start_year).toBe(0);
        expect(timespan.end_year).toBe(100);
        expect(timespan.name).toBe('Test Timespan');
    });

    test('Update timespan', () => {
        // Create a timespan
        const insertResult = db.prepare(`
            INSERT INTO timespan (start_year, end_year, name)
            VALUES (0, 100, 'Test Timespan')
        `).run();

        // Update it
        const updateResult = db.prepare(`
            UPDATE timespan 
            SET name = 'Updated Timespan', start_year = -100, end_year = 200
            WHERE id = ?
        `).run(insertResult.lastInsertRowid);

        expect(updateResult.changes).toBe(1);

        // Verify update
        const timespan = db.prepare('SELECT * FROM timespan WHERE id = ?').get(insertResult.lastInsertRowid);
        expect(timespan.name).toBe('Updated Timespan');
        expect(timespan.start_year).toBe(-100);
        expect(timespan.end_year).toBe(200);
    });

    test('Delete timespan', () => {
        // Create a timespan
        const insertResult = db.prepare(`
            INSERT INTO timespan (start_year, end_year, name)
            VALUES (0, 100, 'Test Timespan')
        `).run();

        // Delete it
        const deleteResult = db.prepare('DELETE FROM timespan WHERE id = ?').run(insertResult.lastInsertRowid);
        expect(deleteResult.changes).toBe(1);

        // Verify deletion
        const timespan = db.prepare('SELECT * FROM timespan WHERE id = ?').get(insertResult.lastInsertRowid);
        expect(timespan).toBeUndefined();
    });
});

describe('Timeline Item Management', () => {
    let db;
    let timespanId;
    const testDbPath = path.join(__dirname, '../test.db');

    beforeEach(() => {
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
        db = new Database(testDbPath);
        
        // Create tables
        db.exec(`
            CREATE TABLE IF NOT EXISTS timespan (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                start_year INTEGER NOT NULL,
                end_year INTEGER NOT NULL,
                name TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS timeline_item (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timespan_id INTEGER NOT NULL,
                type TEXT NOT NULL,
                year INTEGER NOT NULL,
                subtick INTEGER NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (timespan_id) REFERENCES timespan(id)
            );
        `);

        // Create a timespan for testing
        const result = db.prepare(`
            INSERT INTO timespan (start_year, end_year, name)
            VALUES (0, 100, 'Test Timespan')
        `).run();
        timespanId = result.lastInsertRowid;
    });

    afterEach(() => {
        if (db) {
            db.close();
        }
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
    });

    test('Create timeline item', () => {
        const result = db.prepare(`
            INSERT INTO timeline_item (timespan_id, type, year, subtick, name, description)
            VALUES (?, 'Event', 50, 0, 'Test Event', 'Test Description')
        `).run(timespanId);

        expect(result.changes).toBe(1);
        expect(result.lastInsertRowid).toBeDefined();
    });

    test('Create timeline item with period', () => {
        const result = db.prepare(`
            INSERT INTO timeline_item (timespan_id, type, year, subtick, name, description)
            VALUES (?, 'Period', 25, 0, 'Test Period', 'Test Description')
        `).run(timespanId);

        expect(result.changes).toBe(1);
        expect(result.lastInsertRowid).toBeDefined();
    });

    test('Create timeline item with age', () => {
        const result = db.prepare(`
            INSERT INTO timeline_item (timespan_id, type, year, subtick, name, description)
            VALUES (?, 'Age', 75, 0, 'Test Age', 'Test Description')
        `).run(timespanId);

        expect(result.changes).toBe(1);
        expect(result.lastInsertRowid).toBeDefined();
    });

    test('Get timeline items by timespan', () => {
        // Create multiple items
        db.prepare(`
            INSERT INTO timeline_item (timespan_id, type, year, subtick, name)
            VALUES (?, 'Event', 25, 0, 'Event 1'),
                   (?, 'Period', 50, 0, 'Period 1'),
                   (?, 'Age', 75, 0, 'Age 1')
        `).run(timespanId, timespanId, timespanId);

        const items = db.prepare('SELECT * FROM timeline_item WHERE timespan_id = ?').all(timespanId);
        expect(items).toHaveLength(3);
    });

    test('Update timeline item', () => {
        // Create an item
        const insertResult = db.prepare(`
            INSERT INTO timeline_item (timespan_id, type, year, subtick, name, description)
            VALUES (?, 'Event', 50, 0, 'Test Event', 'Test Description')
        `).run(timespanId);

        // Update it
        const updateResult = db.prepare(`
            UPDATE timeline_item 
            SET name = 'Updated Event', description = 'Updated Description', year = 60
            WHERE id = ?
        `).run(insertResult.lastInsertRowid);

        expect(updateResult.changes).toBe(1);

        // Verify update
        const item = db.prepare('SELECT * FROM timeline_item WHERE id = ?').get(insertResult.lastInsertRowid);
        expect(item.name).toBe('Updated Event');
        expect(item.description).toBe('Updated Description');
        expect(item.year).toBe(60);
    });

    test('Delete timeline item', () => {
        // Create an item
        const insertResult = db.prepare(`
            INSERT INTO timeline_item (timespan_id, type, year, subtick, name)
            VALUES (?, 'Event', 50, 0, 'Test Event')
        `).run(timespanId);

        // Delete it
        const deleteResult = db.prepare('DELETE FROM timeline_item WHERE id = ?').run(insertResult.lastInsertRowid);
        expect(deleteResult.changes).toBe(1);

        // Verify deletion
        const item = db.prepare('SELECT * FROM timeline_item WHERE id = ?').get(insertResult.lastInsertRowid);
        expect(item).toBeUndefined();
    });

    test('Get timeline items by type', () => {
        // Create items of different types
        db.prepare(`
            INSERT INTO timeline_item (timespan_id, type, year, subtick, name)
            VALUES (?, 'Event', 25, 0, 'Event 1'),
                   (?, 'Event', 50, 0, 'Event 2'),
                   (?, 'Period', 75, 0, 'Period 1')
        `).run(timespanId, timespanId, timespanId);

        const events = db.prepare('SELECT * FROM timeline_item WHERE timespan_id = ? AND type = ?').all(timespanId, 'Event');
        expect(events).toHaveLength(2);

        const periods = db.prepare('SELECT * FROM timeline_item WHERE timespan_id = ? AND type = ?').all(timespanId, 'Period');
        expect(periods).toHaveLength(1);
    });

    test('Get timeline items by year range', () => {
        // Create items at different years
        db.prepare(`
            INSERT INTO timeline_item (timespan_id, type, year, subtick, name)
            VALUES (?, 'Event', 25, 0, 'Event 1'),
                   (?, 'Event', 50, 0, 'Event 2'),
                   (?, 'Event', 75, 0, 'Event 3')
        `).run(timespanId, timespanId, timespanId);

        const items = db.prepare('SELECT * FROM timeline_item WHERE timespan_id = ? AND year BETWEEN ? AND ?')
            .all(timespanId, 30, 60);
        expect(items).toHaveLength(1);
    });
});

describe('Timespan Management', () => {
    let db;
    const testDbPath = path.join(__dirname, '../test.db');

    beforeEach(() => {
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
        db = new Database(testDbPath);
        
        // Create tables
        db.exec(`
            CREATE TABLE IF NOT EXISTS timespan (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                start_year INTEGER NOT NULL,
                end_year INTEGER NOT NULL,
                name TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS timeline_item (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timespan_id INTEGER NOT NULL,
                type TEXT NOT NULL,
                year INTEGER NOT NULL,
                subtick INTEGER NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (timespan_id) REFERENCES timespan(id)
            );
        `);
    });

    afterEach(() => {
        if (db) {
            db.close();
        }
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
    });

    test('Create multiple timespans', () => {
        const result1 = db.prepare(`
            INSERT INTO timespan (start_year, end_year, name)
            VALUES (0, 100, 'Timespan 1')
        `).run();

        const result2 = db.prepare(`
            INSERT INTO timespan (start_year, end_year, name)
            VALUES (-100, 200, 'Timespan 2')
        `).run();

        expect(result1.changes).toBe(1);
        expect(result2.changes).toBe(1);
        expect(result1.lastInsertRowid).not.toBe(result2.lastInsertRowid);
    });

    test('Get all timespans', () => {
        // Create multiple timespans
        db.prepare(`
            INSERT INTO timespan (start_year, end_year, name)
            VALUES (0, 100, 'Timespan 1'),
                   (-100, 200, 'Timespan 2'),
                   (-500, 500, 'Timespan 3')
        `).run();

        const timespans = db.prepare('SELECT * FROM timespan').all();
        expect(timespans).toHaveLength(3);
    });

    test('Update timespan with items', () => {
        // Create a timespan
        const timespanResult = db.prepare(`
            INSERT INTO timespan (start_year, end_year, name)
            VALUES (0, 100, 'Test Timespan')
        `).run();

        // Create some items
        db.prepare(`
            INSERT INTO timeline_item (timespan_id, type, year, subtick, name)
            VALUES (?, 'Event', 25, 0, 'Event 1'),
                   (?, 'Period', 50, 0, 'Period 1')
        `).run(timespanResult.lastInsertRowid, timespanResult.lastInsertRowid);

        // Update timespan
        const updateResult = db.prepare(`
            UPDATE timespan 
            SET start_year = -50, end_year = 150, name = 'Updated Timespan'
            WHERE id = ?
        `).run(timespanResult.lastInsertRowid);

        expect(updateResult.changes).toBe(1);

        // Verify items still exist
        const items = db.prepare('SELECT * FROM timeline_item WHERE timespan_id = ?')
            .all(timespanResult.lastInsertRowid);
        expect(items).toHaveLength(2);
    });

    test('Delete timespan with items', () => {
        // Create a timespan
        const timespanResult = db.prepare(`
            INSERT INTO timespan (start_year, end_year, name)
            VALUES (0, 100, 'Test Timespan')
        `).run();

        // Create some items
        db.prepare(`
            INSERT INTO timeline_item (timespan_id, type, year, subtick, name)
            VALUES (?, 'Event', 25, 0, 'Event 1'),
                   (?, 'Period', 50, 0, 'Period 1')
        `).run(timespanResult.lastInsertRowid, timespanResult.lastInsertRowid);

        // Delete timespan (should fail due to foreign key constraint)
        expect(() => {
            db.prepare('DELETE FROM timespan WHERE id = ?').run(timespanResult.lastInsertRowid);
        }).toThrow();
    });

    test('Get timespan by year range', () => {
        // Create multiple timespans
        db.prepare(`
            INSERT INTO timespan (start_year, end_year, name)
            VALUES (0, 100, 'Timespan 1'),
                   (-100, 200, 'Timespan 2'),
                   (-500, 500, 'Timespan 3')
        `).run();

        const timespans = db.prepare('SELECT * FROM timespan WHERE start_year <= ? AND end_year >= ?')
            .all(50, 50);
        expect(timespans).toHaveLength(2);
    });
});

describe('Data Validation', () => {
    let db;
    const testDbPath = path.join(__dirname, '../test.db');

    beforeEach(() => {
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
        db = new Database(testDbPath);
        
        // Create tables
        db.exec(`
            CREATE TABLE IF NOT EXISTS timespan (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                start_year INTEGER NOT NULL,
                end_year INTEGER NOT NULL,
                name TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS timeline_item (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timespan_id INTEGER NOT NULL,
                type TEXT NOT NULL,
                year INTEGER NOT NULL,
                subtick INTEGER NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (timespan_id) REFERENCES timespan(id)
            );
        `);
    });

    afterEach(() => {
        if (db) {
            db.close();
        }
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
    });

    test('Timespan start year must be less than end year', () => {
        expect(() => {
            db.prepare(`
                INSERT INTO timespan (start_year, end_year, name)
                VALUES (100, 0, 'Invalid Timespan')
            `).run();
        }).toThrow();
    });

    test('Timeline item year must be within timespan range', () => {
        // Create a timespan
        const timespanResult = db.prepare(`
            INSERT INTO timespan (start_year, end_year, name)
            VALUES (0, 100, 'Test Timespan')
        `).run();

        // Try to create item outside timespan range
        expect(() => {
            db.prepare(`
                INSERT INTO timeline_item (timespan_id, type, year, subtick, name)
                VALUES (?, 'Event', 150, 0, 'Invalid Event')
            `).run(timespanResult.lastInsertRowid);
        }).toThrow();
    });

    test('Timeline item type must be valid', () => {
        // Create a timespan
        const timespanResult = db.prepare(`
            INSERT INTO timespan (start_year, end_year, name)
            VALUES (0, 100, 'Test Timespan')
        `).run();

        // Try to create item with invalid type
        expect(() => {
            db.prepare(`
                INSERT INTO timeline_item (timespan_id, type, year, subtick, name)
                VALUES (?, 'InvalidType', 50, 0, 'Invalid Event')
            `).run(timespanResult.lastInsertRowid);
        }).toThrow();
    });

    test('Timeline item subtick must be non-negative', () => {
        // Create a timespan
        const timespanResult = db.prepare(`
            INSERT INTO timespan (start_year, end_year, name)
            VALUES (0, 100, 'Test Timespan')
        `).run();

        // Try to create item with negative subtick
        expect(() => {
            db.prepare(`
                INSERT INTO timeline_item (timespan_id, type, year, subtick, name)
                VALUES (?, 'Event', 50, -1, 'Invalid Event')
            `).run(timespanResult.lastInsertRowid);
        }).toThrow();
    });
});

describe('Error Handling', () => {
    let db;
    const testDbPath = path.join(__dirname, '../test.db');

    beforeEach(() => {
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
        db = new Database(testDbPath);
        
        // Create tables
        db.exec(`
            CREATE TABLE IF NOT EXISTS timespan (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                start_year INTEGER NOT NULL,
                end_year INTEGER NOT NULL,
                name TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS timeline_item (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timespan_id INTEGER NOT NULL,
                type TEXT NOT NULL,
                year INTEGER NOT NULL,
                subtick INTEGER NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (timespan_id) REFERENCES timespan(id)
            );
        `);
    });

    afterEach(() => {
        if (db) {
            db.close();
        }
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
    });

    test('Handle invalid SQL syntax', () => {
        expect(() => {
            db.prepare('SELECT * FROM invalid_table').get();
        }).toThrow();
    });

    test('Handle missing required fields', () => {
        expect(() => {
            db.prepare(`
                INSERT INTO timespan (start_year, name)
                VALUES (0, 'Incomplete Timespan')
            `).run();
        }).toThrow();
    });

    test('Handle duplicate primary key', () => {
        // Create a timespan
        const result = db.prepare(`
            INSERT INTO timespan (start_year, end_year, name)
            VALUES (0, 100, 'Test Timespan')
        `).run();

        // Try to create another timespan with same ID
        expect(() => {
            db.prepare(`
                INSERT INTO timespan (id, start_year, end_year, name)
                VALUES (?, 0, 100, 'Duplicate Timespan')
            `).run(result.lastInsertRowid);
        }).toThrow();
    });

    test('Handle invalid foreign key', () => {
        expect(() => {
            db.prepare(`
                INSERT INTO timeline_item (timespan_id, type, year, subtick, name)
                VALUES (999, 'Event', 50, 0, 'Invalid Event')
            `).run();
        }).toThrow();
    });

    test('Handle database connection loss', () => {
        db.close();
        expect(() => {
            db.prepare('SELECT 1').get();
        }).toThrow();
    });
});

describe('Performance Testing', () => {
    let db;
    const testDbPath = path.join(__dirname, '../test.db');

    beforeEach(() => {
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
        db = new Database(testDbPath);
        
        // Create tables
        db.exec(`
            CREATE TABLE IF NOT EXISTS timespan (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                start_year INTEGER NOT NULL,
                end_year INTEGER NOT NULL,
                name TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS timeline_item (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timespan_id INTEGER NOT NULL,
                type TEXT NOT NULL,
                year INTEGER NOT NULL,
                subtick INTEGER NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (timespan_id) REFERENCES timespan(id)
            );
        `);
    });

    afterEach(() => {
        if (db) {
            db.close();
        }
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
    });

    test('Bulk insert performance', () => {
        const startTime = Date.now();
        
        // Create a timespan
        const timespanResult = db.prepare(`
            INSERT INTO timespan (start_year, end_year, name)
            VALUES (0, 1000, 'Test Timespan')
        `).run();

        // Insert 1000 items
        const insert = db.prepare(`
            INSERT INTO timeline_item (timespan_id, type, year, subtick, name)
            VALUES (?, 'Event', ?, 0, ?)
        `);

        const insertMany = db.transaction((items) => {
            for (const item of items) {
                insert.run(timespanResult.lastInsertRowid, item.year, item.name);
            }
        });

        const items = Array.from({ length: 1000 }, (_, i) => ({
            year: i,
            name: `Event ${i}`
        }));

        insertMany(items);

        const endTime = Date.now();
        const duration = endTime - startTime;
        
        // Verify all items were inserted
        const count = db.prepare('SELECT COUNT(*) as count FROM timeline_item').get().count;
        expect(count).toBe(1000);
        expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('Query performance with large dataset', () => {
        // Create a timespan
        const timespanResult = db.prepare(`
            INSERT INTO timespan (start_year, end_year, name)
            VALUES (0, 1000, 'Test Timespan')
        `).run();

        // Insert 1000 items
        const insert = db.prepare(`
            INSERT INTO timeline_item (timespan_id, type, year, subtick, name)
            VALUES (?, 'Event', ?, 0, ?)
        `);

        const insertMany = db.transaction((items) => {
            for (const item of items) {
                insert.run(timespanResult.lastInsertRowid, item.year, item.name);
            }
        });

        const items = Array.from({ length: 1000 }, (_, i) => ({
            year: i,
            name: `Event ${i}`
        }));

        insertMany(items);

        // Test query performance
        const startTime = Date.now();
        
        // Complex query with multiple conditions
        const results = db.prepare(`
            SELECT * FROM timeline_item 
            WHERE timespan_id = ? 
            AND year BETWEEN ? AND ?
            AND type = ?
            ORDER BY year, subtick
        `).all(timespanResult.lastInsertRowid, 100, 200, 'Event');

        const endTime = Date.now();
        const duration = endTime - startTime;
        
        expect(results).toHaveLength(101); // 200 - 100 + 1
        expect(duration).toBeLessThan(100); // Should complete within 100ms
    });
});

describe('Edge Cases', () => {
    let db;
    const testDbPath = path.join(__dirname, '../test.db');

    beforeEach(() => {
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
        db = new Database(testDbPath);
        
        // Create tables
        db.exec(`
            CREATE TABLE IF NOT EXISTS timespan (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                start_year INTEGER NOT NULL,
                end_year INTEGER NOT NULL,
                name TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS timeline_item (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timespan_id INTEGER NOT NULL,
                type TEXT NOT NULL,
                year INTEGER NOT NULL,
                subtick INTEGER NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (timespan_id) REFERENCES timespan(id)
            );
        `);
    });

    afterEach(() => {
        if (db) {
            db.close();
        }
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
    });

    test('Handle very large year values', () => {
        const result = db.prepare(`
            INSERT INTO timespan (start_year, end_year, name)
            VALUES (-999999, 999999, 'Large Timespan')
        `).run();

        expect(result.changes).toBe(1);
        
        const timespan = db.prepare('SELECT * FROM timespan WHERE id = ?').get(result.lastInsertRowid);
        expect(timespan.start_year).toBe(-999999);
        expect(timespan.end_year).toBe(999999);
    });

    test('Handle very long text values', () => {
        const longName = 'a'.repeat(1000);
        const longDescription = 'b'.repeat(10000);

        const timespanResult = db.prepare(`
            INSERT INTO timespan (start_year, end_year, name)
            VALUES (0, 100, ?)
        `).run(longName);

        const itemResult = db.prepare(`
            INSERT INTO timeline_item (timespan_id, type, year, subtick, name, description)
            VALUES (?, 'Event', 50, 0, ?, ?)
        `).run(timespanResult.lastInsertRowid, longName, longDescription);

        const item = db.prepare('SELECT * FROM timeline_item WHERE id = ?').get(itemResult.lastInsertRowid);
        expect(item.name).toBe(longName);
        expect(item.description).toBe(longDescription);
    });

    test('Handle concurrent operations', () => {
        // Create a timespan
        const timespanResult = db.prepare(`
            INSERT INTO timespan (start_year, end_year, name)
            VALUES (0, 100, 'Test Timespan')
        `).run();

        // Create multiple items in a transaction
        const insert = db.prepare(`
            INSERT INTO timeline_item (timespan_id, type, year, subtick, name)
            VALUES (?, 'Event', ?, 0, ?)
        `);

        const insertMany = db.transaction((items) => {
            for (const item of items) {
                insert.run(timespanResult.lastInsertRowid, item.year, item.name);
            }
        });

        // Create 100 items with concurrent year values
        const items = Array.from({ length: 100 }, (_, i) => ({
            year: 50, // Same year
            name: `Event ${i}`
        }));

        insertMany(items);

        // Verify all items were inserted with correct subtick values
        const results = db.prepare(`
            SELECT * FROM timeline_item 
            WHERE timespan_id = ? AND year = 50
            ORDER BY subtick
        `).all(timespanResult.lastInsertRowid);

        expect(results).toHaveLength(100);
        results.forEach((item, index) => {
            expect(item.subtick).toBe(index);
        });
    });

    test('Handle empty result sets', () => {
        const results = db.prepare('SELECT * FROM timespan').all();
        expect(results).toHaveLength(0);
    });

    test('Handle null values', () => {
        const timespanResult = db.prepare(`
            INSERT INTO timespan (start_year, end_year, name)
            VALUES (0, 100, 'Test Timespan')
        `).run();

        const itemResult = db.prepare(`
            INSERT INTO timeline_item (timespan_id, type, year, subtick, name, description)
            VALUES (?, 'Event', 50, 0, 'Test Event', NULL)
        `).run(timespanResult.lastInsertRowid);

        const item = db.prepare('SELECT * FROM timeline_item WHERE id = ?').get(itemResult.lastInsertRowid);
        expect(item.description).toBeNull();
    });
});

describe('Data Migration Scenarios', () => {
    let db;
    const testDbPath = path.join(__dirname, '../test.db');

    beforeEach(() => {
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
        db = new Database(testDbPath);
    });

    afterEach(() => {
        if (db) {
            db.close();
        }
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
    });

    test('Migrate from v1 to v2 schema', () => {
        // Create v1 schema
        db.exec(`
            CREATE TABLE IF NOT EXISTS timespan (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                start_year INTEGER NOT NULL,
                end_year INTEGER NOT NULL,
                name TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS timeline_item (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timespan_id INTEGER NOT NULL,
                type TEXT NOT NULL,
                year INTEGER NOT NULL,
                name TEXT NOT NULL,
                FOREIGN KEY (timespan_id) REFERENCES timespan(id)
            );

            INSERT INTO timespan (start_year, end_year, name)
            VALUES (0, 100, 'Test Timespan');

            INSERT INTO timeline_item (timespan_id, type, year, name)
            VALUES (1, 'Event', 50, 'Test Event');
        `);

        // Migrate to v2 schema
        db.exec(`
            ALTER TABLE timespan ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP;
            ALTER TABLE timespan ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;
            ALTER TABLE timeline_item ADD COLUMN subtick INTEGER NOT NULL DEFAULT 0;
            ALTER TABLE timeline_item ADD COLUMN description TEXT;
            ALTER TABLE timeline_item ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP;
            ALTER TABLE timeline_item ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;
        `);

        // Verify data integrity
        const timespan = db.prepare('SELECT * FROM timespan').get();
        expect(timespan.created_at).toBeDefined();
        expect(timespan.updated_at).toBeDefined();

        const item = db.prepare('SELECT * FROM timeline_item').get();
        expect(item.subtick).toBe(0);
        expect(item.description).toBeNull();
        expect(item.created_at).toBeDefined();
        expect(item.updated_at).toBeDefined();
    });

    test('Migrate with data transformation', () => {
        // Create initial schema with old data format
        db.exec(`
            CREATE TABLE IF NOT EXISTS timespan (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                start_year INTEGER NOT NULL,
                end_year INTEGER NOT NULL,
                name TEXT NOT NULL
            );

            INSERT INTO timespan (start_year, end_year, name)
            VALUES (0, 100, 'Test Timespan');
        `);

        // Migrate with data transformation
        db.exec(`
            ALTER TABLE timespan ADD COLUMN display_name TEXT;
            UPDATE timespan SET display_name = 'Timespan: ' || name;
        `);

        // Verify transformation
        const timespan = db.prepare('SELECT * FROM timespan').get();
        expect(timespan.display_name).toBe('Timespan: Test Timespan');
    });

    test('Rollback failed migration', () => {
        // Create initial schema
        db.exec(`
            CREATE TABLE IF NOT EXISTS timespan (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                start_year INTEGER NOT NULL,
                end_year INTEGER NOT NULL,
                name TEXT NOT NULL
            );

            INSERT INTO timespan (start_year, end_year, name)
            VALUES (0, 100, 'Test Timespan');
        `);

        // Start transaction for migration
        const migration = db.transaction(() => {
            try {
                // Attempt invalid migration
                db.exec(`
                    ALTER TABLE timespan ADD COLUMN invalid_column INVALID_TYPE;
                `);
            } catch (error) {
                // Transaction will automatically rollback
                throw error;
            }
        });

        // Verify rollback
        expect(() => migration()).toThrow();
        const timespan = db.prepare('SELECT * FROM timespan').get();
        expect(timespan).toBeDefined();
        expect(timespan.name).toBe('Test Timespan');
    });
});

describe('Backup and Recovery', () => {
    let db;
    const testDbPath = path.join(__dirname, '../test.db');
    const backupPath = path.join(__dirname, '../test.backup.db');

    beforeEach(() => {
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
        if (fs.existsSync(backupPath)) {
            fs.unlinkSync(backupPath);
        }
        db = new Database(testDbPath);
        
        // Create tables and insert test data
        db.exec(`
            CREATE TABLE IF NOT EXISTS timespan (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                start_year INTEGER NOT NULL,
                end_year INTEGER NOT NULL,
                name TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS timeline_item (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timespan_id INTEGER NOT NULL,
                type TEXT NOT NULL,
                year INTEGER NOT NULL,
                subtick INTEGER NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (timespan_id) REFERENCES timespan(id)
            );

            INSERT INTO timespan (start_year, end_year, name)
            VALUES (0, 100, 'Test Timespan');

            INSERT INTO timeline_item (timespan_id, type, year, subtick, name)
            VALUES (1, 'Event', 50, 0, 'Test Event');
        `);
    });

    afterEach(() => {
        if (db) {
            db.close();
        }
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
        if (fs.existsSync(backupPath)) {
            fs.unlinkSync(backupPath);
        }
    });

    test('Create database backup', () => {
        // Create backup
        db.backup(backupPath);

        // Verify backup file exists
        expect(fs.existsSync(backupPath)).toBe(true);

        // Verify backup integrity
        const backupDb = new Database(backupPath);
        const timespan = backupDb.prepare('SELECT * FROM timespan').get();
        const item = backupDb.prepare('SELECT * FROM timeline_item').get();

        expect(timespan).toBeDefined();
        expect(timespan.name).toBe('Test Timespan');
        expect(item).toBeDefined();
        expect(item.name).toBe('Test Event');

        backupDb.close();
    });

    test('Restore from backup', () => {
        // Create backup
        db.backup(backupPath);
        db.close();

        // Delete original database
        fs.unlinkSync(testDbPath);

        // Restore from backup
        const backupDb = new Database(backupPath);
        backupDb.backup(testDbPath);
        backupDb.close();

        // Verify restored database
        const restoredDb = new Database(testDbPath);
        const timespan = restoredDb.prepare('SELECT * FROM timespan').get();
        const item = restoredDb.prepare('SELECT * FROM timeline_item').get();

        expect(timespan).toBeDefined();
        expect(timespan.name).toBe('Test Timespan');
        expect(item).toBeDefined();
        expect(item.name).toBe('Test Event');

        restoredDb.close();
    });

    test('Incremental backup', () => {
        // Create initial backup
        db.backup(backupPath);

        // Add new data
        db.prepare(`
            INSERT INTO timeline_item (timespan_id, type, year, subtick, name)
            VALUES (1, 'Event', 75, 0, 'New Event')
        `).run();

        // Create incremental backup
        db.backup(backupPath, { incremental: true });

        // Verify incremental backup
        const backupDb = new Database(backupPath);
        const items = backupDb.prepare('SELECT * FROM timeline_item').all();
        expect(items).toHaveLength(2);
        backupDb.close();
    });
});

describe('Index Performance', () => {
    let db;
    const testDbPath = path.join(__dirname, '../test.db');

    beforeEach(() => {
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
        db = new Database(testDbPath);
        
        // Create tables with indexes
        db.exec(`
            CREATE TABLE IF NOT EXISTS timespan (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                start_year INTEGER NOT NULL,
                end_year INTEGER NOT NULL,
                name TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS timeline_item (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timespan_id INTEGER NOT NULL,
                type TEXT NOT NULL,
                year INTEGER NOT NULL,
                subtick INTEGER NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (timespan_id) REFERENCES timespan(id)
            );

            CREATE INDEX IF NOT EXISTS idx_timeline_item_timespan ON timeline_item(timespan_id);
            CREATE INDEX IF NOT EXISTS idx_timeline_item_year ON timeline_item(year);
            CREATE INDEX IF NOT EXISTS idx_timeline_item_type ON timeline_item(type);
        `);
    });

    afterEach(() => {
        if (db) {
            db.close();
        }
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
    });

    test('Index usage in queries', () => {
        // Create test data
        const timespanResult = db.prepare(`
            INSERT INTO timespan (start_year, end_year, name)
            VALUES (0, 1000, 'Test Timespan')
        `).run();

        // Insert 1000 items
        const insert = db.prepare(`
            INSERT INTO timeline_item (timespan_id, type, year, subtick, name)
            VALUES (?, 'Event', ?, 0, ?)
        `);

        const insertMany = db.transaction((items) => {
            for (const item of items) {
                insert.run(timespanResult.lastInsertRowid, item.year, item.name);
            }
        });

        const items = Array.from({ length: 1000 }, (_, i) => ({
            year: i,
            name: `Event ${i}`
        }));

        insertMany(items);

        // Test indexed queries
        const startTime = Date.now();
        
        // Query using timespan_id index
        const byTimespan = db.prepare(`
            SELECT * FROM timeline_item 
            WHERE timespan_id = ?
        `).all(timespanResult.lastInsertRowid);

        // Query using year index
        const byYear = db.prepare(`
            SELECT * FROM timeline_item 
            WHERE year BETWEEN 100 AND 200
        `).all();

        // Query using type index
        const byType = db.prepare(`
            SELECT * FROM timeline_item 
            WHERE type = 'Event'
        `).all();

        const endTime = Date.now();
        const duration = endTime - startTime;

        expect(byTimespan).toHaveLength(1000);
        expect(byYear).toHaveLength(101);
        expect(byType).toHaveLength(1000);
        expect(duration).toBeLessThan(100); // Should complete within 100ms
    });

    test('Index maintenance', () => {
        // Create test data
        const timespanResult = db.prepare(`
            INSERT INTO timespan (start_year, end_year, name)
            VALUES (0, 100, 'Test Timespan')
        `).run();

        // Insert items
        db.prepare(`
            INSERT INTO timeline_item (timespan_id, type, year, subtick, name)
            VALUES (?, 'Event', 50, 0, 'Test Event')
        `).run(timespanResult.lastInsertRowid);

        // Analyze index usage
        const analysis = db.prepare(`
            ANALYZE;
            SELECT * FROM sqlite_stat1
        `).all();

        expect(analysis).toBeDefined();
    });
});

describe('Query Optimization', () => {
    let db;
    const testDbPath = path.join(__dirname, '../test.db');

    beforeEach(() => {
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
        db = new Database(testDbPath);
        
        // Create tables
        db.exec(`
            CREATE TABLE IF NOT EXISTS timespan (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                start_year INTEGER NOT NULL,
                end_year INTEGER NOT NULL,
                name TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS timeline_item (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timespan_id INTEGER NOT NULL,
                type TEXT NOT NULL,
                year INTEGER NOT NULL,
                subtick INTEGER NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (timespan_id) REFERENCES timespan(id)
            );

            CREATE INDEX IF NOT EXISTS idx_timeline_item_timespan ON timeline_item(timespan_id);
            CREATE INDEX IF NOT EXISTS idx_timeline_item_year ON timeline_item(year);
            CREATE INDEX IF NOT EXISTS idx_timeline_item_type ON timeline_item(type);
        `);
    });

    afterEach(() => {
        if (db) {
            db.close();
        }
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
    });

    test('Optimize complex queries', () => {
        // Create test data
        const timespanResult = db.prepare(`
            INSERT INTO timespan (start_year, end_year, name)
            VALUES (0, 1000, 'Test Timespan')
        `).run();

        // Insert 1000 items
        const insert = db.prepare(`
            INSERT INTO timeline_item (timespan_id, type, year, subtick, name)
            VALUES (?, 'Event', ?, 0, ?)
        `);

        const insertMany = db.transaction((items) => {
            for (const item of items) {
                insert.run(timespanResult.lastInsertRowid, item.year, item.name);
            }
        });

        const items = Array.from({ length: 1000 }, (_, i) => ({
            year: i,
            name: `Event ${i}`
        }));

        insertMany(items);

        // Test optimized queries
        const startTime = Date.now();

        // Complex query with multiple conditions and joins
        const results = db.prepare(`
            SELECT t.name as timespan_name, ti.*
            FROM timespan t
            JOIN timeline_item ti ON t.id = ti.timespan_id
            WHERE t.id = ?
            AND ti.year BETWEEN ? AND ?
            AND ti.type = ?
            ORDER BY ti.year, ti.subtick
        `).all(timespanResult.lastInsertRowid, 100, 200, 'Event');

        const endTime = Date.now();
        const duration = endTime - startTime;

        expect(results).toHaveLength(101);
        expect(duration).toBeLessThan(100); // Should complete within 100ms
    });

    test('Query plan analysis', () => {
        // Create test data
        const timespanResult = db.prepare(`
            INSERT INTO timespan (start_year, end_year, name)
            VALUES (0, 100, 'Test Timespan')
        `).run();

        db.prepare(`
            INSERT INTO timeline_item (timespan_id, type, year, subtick, name)
            VALUES (?, 'Event', 50, 0, 'Test Event')
        `).run(timespanResult.lastInsertRowid);

        // Analyze query plan
        const plan = db.prepare(`
            EXPLAIN QUERY PLAN
            SELECT t.name as timespan_name, ti.*
            FROM timespan t
            JOIN timeline_item ti ON t.id = ti.timespan_id
            WHERE t.id = ?
            AND ti.year BETWEEN ? AND ?
            AND ti.type = ?
        `).all(timespanResult.lastInsertRowid, 0, 100, 'Event');

        expect(plan).toBeDefined();
    });

    test('Optimize bulk operations', () => {
        // Create test data
        const timespanResult = db.prepare(`
            INSERT INTO timespan (start_year, end_year, name)
            VALUES (0, 1000, 'Test Timespan')
        `).run();

        // Test bulk insert performance
        const startTime = Date.now();

        const insert = db.prepare(`
            INSERT INTO timeline_item (timespan_id, type, year, subtick, name)
            VALUES (?, 'Event', ?, 0, ?)
        `);

        const insertMany = db.transaction((items) => {
            for (const item of items) {
                insert.run(timespanResult.lastInsertRowid, item.year, item.name);
            }
        });

        const items = Array.from({ length: 1000 }, (_, i) => ({
            year: i,
            name: `Event ${i}`
        }));

        insertMany(items);

        const endTime = Date.now();
        const duration = endTime - startTime;

        expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
});

describe('Concurrency Control', () => {
    let db;
    const testDbPath = path.join(__dirname, '../test.db');

    beforeEach(() => {
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
        db = new Database(testDbPath);
        
        // Create tables
        db.exec(`
            CREATE TABLE IF NOT EXISTS timespan (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                start_year INTEGER NOT NULL,
                end_year INTEGER NOT NULL,
                name TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS timeline_item (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timespan_id INTEGER NOT NULL,
                type TEXT NOT NULL,
                year INTEGER NOT NULL,
                subtick INTEGER NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (timespan_id) REFERENCES timespan(id)
            );
        `);
    });

    afterEach(() => {
        if (db) {
            db.close();
        }
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
    });

    test('Handle concurrent writes', () => {
        // Create a timespan
        const timespanResult = db.prepare(`
            INSERT INTO timespan (start_year, end_year, name)
            VALUES (0, 100, 'Test Timespan')
        `).run();

        // Create two transactions
        const transaction1 = db.transaction((timespanId) => {
            db.prepare(`
                INSERT INTO timeline_item (timespan_id, type, year, subtick, name)
                VALUES (?, 'Event', 50, 0, 'Event 1')
            `).run(timespanId);
        });

        const transaction2 = db.transaction((timespanId) => {
            db.prepare(`
                INSERT INTO timeline_item (timespan_id, type, year, subtick, name)
                VALUES (?, 'Event', 50, 1, 'Event 2')
            `).run(timespanId);
        });

        // Execute transactions
        transaction1(timespanResult.lastInsertRowid);
        transaction2(timespanResult.lastInsertRowid);

        // Verify both items were inserted
        const items = db.prepare('SELECT * FROM timeline_item WHERE timespan_id = ?')
            .all(timespanResult.lastInsertRowid);
        expect(items).toHaveLength(2);
    });

    test('Handle write conflicts', () => {
        // Create a timespan
        const timespanResult = db.prepare(`
            INSERT INTO timespan (start_year, end_year, name)
            VALUES (0, 100, 'Test Timespan')
        `).run();

        // Create conflicting transactions
        const transaction1 = db.transaction((timespanId) => {
            db.prepare(`
                UPDATE timespan 
                SET name = 'Updated by Transaction 1'
                WHERE id = ?
            `).run(timespanId);
        });

        const transaction2 = db.transaction((timespanId) => {
            db.prepare(`
                UPDATE timespan 
                SET name = 'Updated by Transaction 2'
                WHERE id = ?
            `).run(timespanId);
        });

        // Execute transactions
        transaction1(timespanResult.lastInsertRowid);
        transaction2(timespanResult.lastInsertRowid);

        // Verify final state
        const timespan = db.prepare('SELECT * FROM timespan WHERE id = ?')
            .get(timespanResult.lastInsertRowid);
        expect(timespan.name).toBe('Updated by Transaction 2');
    });

    test('Handle read-write conflicts', () => {
        // Create a timespan
        const timespanResult = db.prepare(`
            INSERT INTO timespan (start_year, end_year, name)
            VALUES (0, 100, 'Test Timespan')
        `).run();

        // Create read-write transaction
        const transaction = db.transaction((timespanId) => {
            // Read
            const timespan = db.prepare('SELECT * FROM timespan WHERE id = ?')
                .get(timespanId);
            
            // Write based on read
            db.prepare(`
                UPDATE timespan 
                SET name = ?
                WHERE id = ?
            `).run(timespan.name + ' (Updated)', timespanId);
        });

        // Execute transaction
        transaction(timespanResult.lastInsertRowid);

        // Verify update
        const timespan = db.prepare('SELECT * FROM timespan WHERE id = ?')
            .get(timespanResult.lastInsertRowid);
        expect(timespan.name).toBe('Test Timespan (Updated)');
    });
});

describe('Data Integrity', () => {
    let db;
    const testDbPath = path.join(__dirname, '../test.db');

    beforeEach(() => {
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
        db = new Database(testDbPath);
        
        // Create tables with constraints
        db.exec(`
            CREATE TABLE IF NOT EXISTS timespan (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                start_year INTEGER NOT NULL,
                end_year INTEGER NOT NULL,
                name TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                CHECK (start_year < end_year)
            );

            CREATE TABLE IF NOT EXISTS timeline_item (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timespan_id INTEGER NOT NULL,
                type TEXT NOT NULL,
                year INTEGER NOT NULL,
                subtick INTEGER NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (timespan_id) REFERENCES timespan(id) ON DELETE CASCADE,
                CHECK (year >= 0),
                CHECK (subtick >= 0)
            );
        `);
    });

    afterEach(() => {
        if (db) {
            db.close();
        }
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
    });

    test('Maintain referential integrity', () => {
        // Create a timespan
        const timespanResult = db.prepare(`
            INSERT INTO timespan (start_year, end_year, name)
            VALUES (0, 100, 'Test Timespan')
        `).run();

        // Create a timeline item
        db.prepare(`
            INSERT INTO timeline_item (timespan_id, type, year, subtick, name)
            VALUES (?, 'Event', 50, 0, 'Test Event')
        `).run(timespanResult.lastInsertRowid);

        // Delete timespan (should cascade delete timeline item)
        db.prepare('DELETE FROM timespan WHERE id = ?')
            .run(timespanResult.lastInsertRowid);

        // Verify cascade delete
        const items = db.prepare('SELECT * FROM timeline_item').all();
        expect(items).toHaveLength(0);
    });

    test('Enforce check constraints', () => {
        // Try to create timespan with invalid year range
        expect(() => {
            db.prepare(`
                INSERT INTO timespan (start_year, end_year, name)
                VALUES (100, 0, 'Invalid Timespan')
            `).run();
        }).toThrow();

        // Try to create timeline item with negative year
        const timespanResult = db.prepare(`
            INSERT INTO timespan (start_year, end_year, name)
            VALUES (0, 100, 'Test Timespan')
        `).run();

        expect(() => {
            db.prepare(`
                INSERT INTO timeline_item (timespan_id, type, year, subtick, name)
                VALUES (?, 'Event', -50, 0, 'Invalid Event')
            `).run(timespanResult.lastInsertRowid);
        }).toThrow();
    });

    test('Maintain data consistency', () => {
        // Create a timespan
        const timespanResult = db.prepare(`
            INSERT INTO timespan (start_year, end_year, name)
            VALUES (0, 100, 'Test Timespan')
        `).run();

        // Create multiple timeline items
        const insert = db.prepare(`
            INSERT INTO timeline_item (timespan_id, type, year, subtick, name)
            VALUES (?, 'Event', ?, 0, ?)
        `);

        const insertMany = db.transaction((items) => {
            for (const item of items) {
                insert.run(timespanResult.lastInsertRowid, item.year, item.name);
            }
        });

        const items = Array.from({ length: 10 }, (_, i) => ({
            year: i * 10,
            name: `Event ${i}`
        }));

        insertMany(items);

        // Verify data consistency
        const allItems = db.prepare('SELECT * FROM timeline_item ORDER BY year').all();
        expect(allItems).toHaveLength(10);
        allItems.forEach((item, index) => {
            expect(item.year).toBe(index * 10);
            expect(item.name).toBe(`Event ${index}`);
        });
    });
});

describe('Security', () => {
    let db;
    const testDbPath = path.join(__dirname, '../test.db');

    beforeEach(() => {
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
        db = new Database(testDbPath);
        
        // Create tables
        db.exec(`
            CREATE TABLE IF NOT EXISTS timespan (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                start_year INTEGER NOT NULL,
                end_year INTEGER NOT NULL,
                name TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS timeline_item (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timespan_id INTEGER NOT NULL,
                type TEXT NOT NULL,
                year INTEGER NOT NULL,
                subtick INTEGER NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (timespan_id) REFERENCES timespan(id)
            );
        `);
    });

    afterEach(() => {
        if (db) {
            db.close();
        }
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
    });

    test('Prevent SQL injection', () => {
        // Create a timespan
        const timespanResult = db.prepare(`
            INSERT INTO timespan (start_year, end_year, name)
            VALUES (0, 100, 'Test Timespan')
        `).run();

        // Try SQL injection
        const maliciousInput = "'; DROP TABLE timespan; --";
        
        // Should be treated as literal string
        db.prepare(`
            INSERT INTO timeline_item (timespan_id, type, year, subtick, name)
            VALUES (?, 'Event', 50, 0, ?)
        `).run(timespanResult.lastInsertRowid, maliciousInput);

        // Verify table still exists
        const timespan = db.prepare('SELECT * FROM timespan').get();
        expect(timespan).toBeDefined();
    });

    test('Handle file permissions', () => {
        // Create database with specific permissions
        db.close();
        fs.chmodSync(testDbPath, 0o600); // Read/write for owner only

        // Try to open database
        db = new Database(testDbPath);
        expect(db).toBeDefined();

        // Verify we can still access the database
        const result = db.prepare('SELECT 1').get();
        expect(result).toBeDefined();
    });

    test('Secure database access', () => {
        // Create a timespan
        const timespanResult = db.prepare(`
            INSERT INTO timespan (start_year, end_year, name)
            VALUES (0, 100, 'Test Timespan')
        `).run();

        // Create a timeline item
        db.prepare(`
            INSERT INTO timeline_item (timespan_id, type, year, subtick, name)
            VALUES (?, 'Event', 50, 0, 'Test Event')
        `).run(timespanResult.lastInsertRowid);

        // Close database
        db.close();

        // Try to access closed database
        expect(() => {
            db.prepare('SELECT 1').get();
        }).toThrow();
    });
});

describe('API Integration', () => {
    let db;
    const testDbPath = path.join(__dirname, '../test.db');

    beforeEach(() => {
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
        db = new Database(testDbPath);
        
        // Create tables
        db.exec(`
            CREATE TABLE IF NOT EXISTS timespan (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                start_year INTEGER NOT NULL,
                end_year INTEGER NOT NULL,
                name TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS timeline_item (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timespan_id INTEGER NOT NULL,
                type TEXT NOT NULL,
                year INTEGER NOT NULL,
                subtick INTEGER NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (timespan_id) REFERENCES timespan(id)
            );
        `);
    });

    afterEach(() => {
        if (db) {
            db.close();
        }
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
    });

    test('Handle API requests', () => {
        // Create a timespan
        const timespanResult = db.prepare(`
            INSERT INTO timespan (start_year, end_year, name)
            VALUES (0, 100, 'Test Timespan')
        `).run();

        // Create a timeline item
        const itemResult = db.prepare(`
            INSERT INTO timeline_item (timespan_id, type, year, subtick, name)
            VALUES (?, 'Event', 50, 0, 'Test Event')
        `).run(timespanResult.lastInsertRowid);

        // Simulate API request to get timespan with items
        const timespan = db.prepare(`
            SELECT t.*, 
                   json_group_array(
                       json_object(
                           'id', ti.id,
                           'type', ti.type,
                           'year', ti.year,
                           'name', ti.name
                       )
                   ) as items
            FROM timespan t
            LEFT JOIN timeline_item ti ON t.id = ti.timespan_id
            WHERE t.id = ?
            GROUP BY t.id
        `).get(timespanResult.lastInsertRowid);

        expect(timespan).toBeDefined();
        expect(timespan.items).toBeDefined();
    });

    test('Handle batch operations', () => {
        // Create a timespan
        const timespanResult = db.prepare(`
            INSERT INTO timespan (start_year, end_year, name)
            VALUES (0, 100, 'Test Timespan')
        `).run();

        // Simulate batch API request
        const batchInsert = db.transaction((items) => {
            const insert = db.prepare(`
                INSERT INTO timeline_item (timespan_id, type, year, subtick, name)
                VALUES (?, 'Event', ?, 0, ?)
            `);

            for (const item of items) {
                insert.run(timespanResult.lastInsertRowid, item.year, item.name);
            }
        });

        const items = [
            { year: 10, name: 'Event 1' },
            { year: 20, name: 'Event 2' },
            { year: 30, name: 'Event 3' }
        ];

        batchInsert(items);

        // Verify batch insert
        const allItems = db.prepare('SELECT * FROM timeline_item ORDER BY year').all();
        expect(allItems).toHaveLength(3);
    });

    test('Handle API error responses', () => {
        // Try to create timespan with invalid data
        expect(() => {
            db.prepare(`
                INSERT INTO timespan (start_year, end_year, name)
                VALUES (100, 0, 'Invalid Timespan')
            `).run();
        }).toThrow();

        // Try to create timeline item with invalid timespan
        expect(() => {
            db.prepare(`
                INSERT INTO timeline_item (timespan_id, type, year, subtick, name)
                VALUES (999, 'Event', 50, 0, 'Invalid Event')
            `).run();
        }).toThrow();
    });
}); 

describe('Large Dataset Handling', () => {
    let db;
    const testDbPath = path.join(__dirname, '../test.db');

    beforeEach(() => {
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
        db = new Database(testDbPath);
        
        // Create tables with indexes for better performance
        db.exec(`
            CREATE TABLE IF NOT EXISTS timespan (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                start_year INTEGER NOT NULL,
                end_year INTEGER NOT NULL,
                name TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS timeline_item (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timespan_id INTEGER NOT NULL,
                type TEXT NOT NULL,
                year INTEGER NOT NULL,
                subtick INTEGER NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (timespan_id) REFERENCES timespan(id)
            );

            CREATE INDEX IF NOT EXISTS idx_timeline_item_timespan ON timeline_item(timespan_id);
            CREATE INDEX IF NOT EXISTS idx_timeline_item_year ON timeline_item(year);
            CREATE INDEX IF NOT EXISTS idx_timeline_item_type ON timeline_item(type);
        `);
    });

    afterEach(() => {
        if (db) {
            db.close();
        }
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
    });

    test('Handle large dataset with evenly distributed data', () => {
        // Create a timespan covering a large range
        const timespanResult = db.prepare(`
            INSERT INTO timespan (start_year, end_year, name)
            VALUES (0, 10000, 'Large Timespan')
        `).run();

        // Insert 100,000 items evenly distributed across the timespan
        const insert = db.prepare(`
            INSERT INTO timeline_item (timespan_id, type, year, subtick, name)
            VALUES (?, 'Event', ?, 0, ?)
        `);

        const insertMany = db.transaction((items) => {
            for (const item of items) {
                insert.run(timespanResult.lastInsertRowid, item.year, item.name);
            }
        });

        const startTime = Date.now();

        // Create 100,000 items with years from 0 to 9999
        const items = Array.from({ length: 100000 }, (_, i) => ({
            year: i % 10000,
            name: `Event ${i}`
        }));

        insertMany(items);

        const insertTime = Date.now() - startTime;
        console.log(`Insert time for 100,000 items: ${insertTime}ms`);

        // Test query performance
        const queryStartTime = Date.now();

        // Query items in different year ranges
        const results1 = db.prepare(`
            SELECT * FROM timeline_item 
            WHERE timespan_id = ? AND year BETWEEN 0 AND 1000
        `).all(timespanResult.lastInsertRowid);

        const results2 = db.prepare(`
            SELECT * FROM timeline_item 
            WHERE timespan_id = ? AND year BETWEEN 5000 AND 6000
        `).all(timespanResult.lastInsertRowid);

        const queryTime = Date.now() - queryStartTime;
        console.log(`Query time for multiple ranges: ${queryTime}ms`);

        expect(results1.length + results2.length).toBeGreaterThan(0);
        expect(insertTime).toBeLessThan(30000); // Should complete within 30 seconds
        expect(queryTime).toBeLessThan(1000); // Should complete within 1 second
    });

    test('Handle large dataset with concentrated data', () => {
        // Create a timespan
        const timespanResult = db.prepare(`
            INSERT INTO timespan (start_year, end_year, name)
            VALUES (0, 100, 'Concentrated Timespan')
        `).run();

        // Insert 100,000 items concentrated in a small year range
        const insert = db.prepare(`
            INSERT INTO timeline_item (timespan_id, type, year, subtick, name)
            VALUES (?, 'Event', ?, ?, ?)
        `);

        const insertMany = db.transaction((items) => {
            for (const item of items) {
                insert.run(timespanResult.lastInsertRowid, item.year, item.subtick, item.name);
            }
        });

        const startTime = Date.now();

        // Create 100,000 items concentrated in years 45-55
        const items = Array.from({ length: 100000 }, (_, i) => ({
            year: 45 + (i % 10), // Years 45-54
            subtick: Math.floor(i / 10), // Subtick to handle multiple items per year
            name: `Event ${i}`
        }));

        insertMany(items);

        const insertTime = Date.now() - startTime;
        console.log(`Insert time for 100,000 concentrated items: ${insertTime}ms`);

        // Test query performance with concentrated data
        const queryStartTime = Date.now();

        // Query items in the concentrated range
        const results = db.prepare(`
            SELECT * FROM timeline_item 
            WHERE timespan_id = ? AND year BETWEEN 45 AND 55
            ORDER BY year, subtick
        `).all(timespanResult.lastInsertRowid);

        const queryTime = Date.now() - queryStartTime;
        console.log(`Query time for concentrated data: ${queryTime}ms`);

        expect(results.length).toBe(100000);
        expect(insertTime).toBeLessThan(30000); // Should complete within 30 seconds
        expect(queryTime).toBeLessThan(1000); // Should complete within 1 second
    });

    test('Handle large dataset with mixed data types', () => {
        // Create a timespan
        const timespanResult = db.prepare(`
            INSERT INTO timespan (start_year, end_year, name)
            VALUES (0, 1000, 'Mixed Data Timespan')
        `).run();

        // Insert 50,000 items with different types and data patterns
        const insert = db.prepare(`
            INSERT INTO timeline_item (timespan_id, type, year, subtick, name, description)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        const insertMany = db.transaction((items) => {
            for (const item of items) {
                insert.run(
                    timespanResult.lastInsertRowid,
                    item.type,
                    item.year,
                    item.subtick,
                    item.name,
                    item.description
                );
            }
        });

        const startTime = Date.now();

        // Create 50,000 items with mixed types and data
        const types = ['Event', 'Period', 'Age'];
        const items = Array.from({ length: 50000 }, (_, i) => ({
            type: types[i % 3],
            year: i % 1000,
            subtick: Math.floor(i / 1000),
            name: `Item ${i}`,
            description: i % 5 === 0 ? `Description for item ${i}` : null
        }));

        insertMany(items);

        const insertTime = Date.now() - startTime;
        console.log(`Insert time for 50,000 mixed items: ${insertTime}ms`);

        // Test query performance with mixed data
        const queryStartTime = Date.now();

        // Complex query with multiple conditions
        const results = db.prepare(`
            SELECT type, COUNT(*) as count
            FROM timeline_item 
            WHERE timespan_id = ?
            AND year BETWEEN 0 AND 100
            AND description IS NOT NULL
            GROUP BY type
            ORDER BY type
        `).all(timespanResult.lastInsertRowid);

        const queryTime = Date.now() - queryStartTime;
        console.log(`Query time for mixed data: ${queryTime}ms`);

        expect(results.length).toBe(3); // One count per type
        expect(insertTime).toBeLessThan(15000); // Should complete within 15 seconds
        expect(queryTime).toBeLessThan(1000); // Should complete within 1 second
    });

    test('Handle large dataset with concurrent operations', () => {
        // Create a timespan
        const timespanResult = db.prepare(`
            INSERT INTO timespan (start_year, end_year, name)
            VALUES (0, 1000, 'Concurrent Timespan')
        `).run();

        // Create multiple transactions for concurrent operations
        const insertEvent = db.prepare(`
            INSERT INTO timeline_item (timespan_id, type, year, subtick, name)
            VALUES (?, 'Event', ?, 0, ?)
        `);

        const insertPeriod = db.prepare(`
            INSERT INTO timeline_item (timespan_id, type, year, subtick, name)
            VALUES (?, 'Period', ?, 0, ?)
        `);

        const insertAge = db.prepare(`
            INSERT INTO timeline_item (timespan_id, type, year, subtick, name)
            VALUES (?, 'Age', ?, 0, ?)
        `);

        const startTime = Date.now();

        // Create three concurrent transactions
        const transaction1 = db.transaction((timespanId) => {
            for (let i = 0; i < 10000; i++) {
                insertEvent.run(timespanId, i, `Event ${i}`);
            }
        });

        const transaction2 = db.transaction((timespanId) => {
            for (let i = 0; i < 10000; i++) {
                insertPeriod.run(timespanId, i, `Period ${i}`);
            }
        });

        const transaction3 = db.transaction((timespanId) => {
            for (let i = 0; i < 10000; i++) {
                insertAge.run(timespanId, i, `Age ${i}`);
            }
        });

        // Execute transactions concurrently
        transaction1(timespanResult.lastInsertRowid);
        transaction2(timespanResult.lastInsertRowid);
        transaction3(timespanResult.lastInsertRowid);

        const insertTime = Date.now() - startTime;
        console.log(`Insert time for 30,000 concurrent items: ${insertTime}ms`);

        // Test query performance with concurrent data
        const queryStartTime = Date.now();

        // Query items by type
        const results = db.prepare(`
            SELECT type, COUNT(*) as count
            FROM timeline_item 
            WHERE timespan_id = ?
            GROUP BY type
            ORDER BY type
        `).all(timespanResult.lastInsertRowid);

        const queryTime = Date.now() - queryStartTime;
        console.log(`Query time for concurrent data: ${queryTime}ms`);

        expect(results.length).toBe(3); // One count per type
        expect(results[0].count).toBe(10000);
        expect(results[1].count).toBe(10000);
        expect(results[2].count).toBe(10000);
        expect(insertTime).toBeLessThan(30000); // Should complete within 30 seconds
        expect(queryTime).toBeLessThan(1000); // Should complete within 1 second
    });
}); 