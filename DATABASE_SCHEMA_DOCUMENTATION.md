# Story Timeline Database Schema Documentation

This document contains all SQL statements needed to recreate the database schema for the Story Timeline application. This is designed to be used when porting the application to another language while maintaining database compatibility.

## Database: SQLite

The application uses SQLite as its database engine. All SQL statements below are SQLite-compatible.

---

## Table Creation Order

Tables should be created in this order to respect foreign key dependencies:

1. `timelines`
2. `stories`
3. `item_types`
4. `items`
5. `tags`
6. `item_tags`
7. `pictures`
8. `item_pictures`
9. `notes`
10. `item_story_refs`
11. `settings`
12. `characters`
13. `character_relationships`
14. `item_characters`

---

## Core Tables

### 1. timelines

Main table for storing timeline/universe information.

```sql
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
);
```

**Columns:**
- `id`: Primary key, auto-incrementing integer
- `title`: Timeline/universe title (required)
- `author`: Author name (required)
- `description`: Optional description
- `start_year`: Starting year for the timeline (default: 0)
- `granularity`: Detail level (1-30, default: 4 for four seasons)
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp
- **Unique constraint**: (title, author) combination must be unique

---

### 2. stories

Stores story/book information that can be referenced by timeline items.

```sql
CREATE TABLE IF NOT EXISTS stories (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Columns:**
- `id`: Primary key, text (typically UUID)
- `title`: Story title (required)
- `description`: Optional description
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp

---

### 3. item_types

Defines the types of items that can exist on the timeline.

```sql
CREATE TABLE IF NOT EXISTS item_types (
    id INTEGER PRIMARY KEY,
    name TEXT UNIQUE,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Default Data:**
After creating the table, insert these default types:

```sql
INSERT OR IGNORE INTO item_types (id, name, description) VALUES
    (1, 'Event', 'A specific point in time'),
    (2, 'Period', 'A span of time'),
    (3, 'Age', 'A significant era or period'),
    (4, 'Picture', 'An image or visual record'),
    (5, 'Note', 'A text note or annotation'),
    (6, 'Bookmark', 'A marked point of interest'),
    (7, 'Character', 'A person or entity'),
    (8, 'Timeline_start', 'The start point of the timeline'),
    (9, 'Timeline_end', 'The end point of the timeline');
```

**Columns:**
- `id`: Primary key, integer
- `name`: Type name (unique)
- `description`: Type description
- `created_at`: Creation timestamp

---

### 4. items

Main table for timeline items (events, periods, ages, etc.).

```sql
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
);
```

**Columns:**
- `id`: Primary key, text (typically UUID)
- `title`: Item title
- `description`: Item description
- `content`: Full content/text of the item
- `story_id`: Foreign key to stories table
- `type_id`: Foreign key to item_types table (default: 1 = Event)
- `year`: Start year
- `subtick`: Start subtick (within the year based on granularity)
- `original_subtick`: Original subtick value (for reference)
- `end_year`: End year (for periods/ranges)
- `end_subtick`: End subtick
- `original_end_subtick`: Original end subtick value
- `book_title`: Associated book title
- `chapter`: Chapter reference
- `page`: Page reference
- `color`: Display color (hex code)
- `creation_granularity`: Granularity when item was created
- `timeline_id`: Foreign key to timelines table
- `item_index`: Index for ordering items (default: 0)
- `show_in_notes`: Whether to show in notes view (1 = yes, 0 = no, default: 1)
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp

**Note:** The `importance` column is added via migration (see Migrations section below).

---

### 5. tags

Tags for categorizing items.

```sql
CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Columns:**
- `id`: Primary key, auto-incrementing integer
- `name`: Tag name (unique, required)
- `created_at`: Creation timestamp

---

### 6. item_tags

Junction table linking items to tags (many-to-many relationship).

```sql
CREATE TABLE IF NOT EXISTS item_tags (
    item_id TEXT,
    tag_id INTEGER,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (item_id, tag_id)
);
```

**Columns:**
- `item_id`: Foreign key to items table
- `tag_id`: Foreign key to tags table
- **Composite Primary Key**: (item_id, tag_id)

---

### 7. pictures

Stores image/picture information. Note: The `item_id` column is deprecated in favor of the `item_pictures` junction table, but may still exist in older databases.

```sql
CREATE TABLE IF NOT EXISTS pictures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id TEXT,  -- DEPRECATED: Use item_pictures junction table instead
    file_path TEXT,
    file_name TEXT,
    file_size INTEGER,
    file_type TEXT,
    width INTEGER,
    height INTEGER,
    title TEXT,
    description TEXT,
    picture TEXT,  -- Legacy: base64 encoded image (deprecated)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
);
```

**Columns:**
- `id`: Primary key, auto-incrementing integer
- `item_id`: **DEPRECATED** - Foreign key to items table (legacy, use item_pictures instead)
- `file_path`: Full path to image file
- `file_name`: Original filename
- `file_size`: File size in bytes
- `file_type`: MIME type (e.g., 'image/png', 'image/jpeg')
- `width`: Image width in pixels
- `height`: Image height in pixels
- `title`: Picture title
- `description`: Picture description
- `picture`: **DEPRECATED** - Base64 encoded image data (legacy)
- `created_at`: Creation timestamp

**Note:** Modern implementations should use the `item_pictures` junction table instead of `item_id`.

---

### 8. item_pictures

Junction table for many-to-many relationship between items and pictures (enables image reuse).

```sql
CREATE TABLE IF NOT EXISTS item_pictures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id TEXT NOT NULL,
    picture_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
    FOREIGN KEY (picture_id) REFERENCES pictures(id) ON DELETE CASCADE,
    UNIQUE(item_id, picture_id)
);
```

**Columns:**
- `id`: Primary key, auto-incrementing integer
- `item_id`: Foreign key to items table (required)
- `picture_id`: Foreign key to pictures table (required)
- `created_at`: Creation timestamp
- **Unique constraint**: (item_id, picture_id) combination must be unique

---

### 9. notes

Stores timeline notes at specific time points.

```sql
CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year INTEGER,
    subtick INTEGER,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Columns:**
- `id`: Primary key, auto-incrementing integer
- `year`: Year for the note
- `subtick`: Subtick within the year
- `content`: Note content/text
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp

---

### 10. item_story_refs

Junction table linking items to stories (many-to-many relationship).

```sql
CREATE TABLE IF NOT EXISTS item_story_refs (
    item_id TEXT,
    story_id TEXT,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
    FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE,
    PRIMARY KEY (item_id, story_id)
);
```

**Columns:**
- `item_id`: Foreign key to items table
- `story_id`: Foreign key to stories table
- **Composite Primary Key**: (item_id, story_id)

---

### 11. settings

Application settings per timeline.

```sql
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
    canvas_settings TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (timeline_id) REFERENCES timelines(id) ON DELETE CASCADE
);
```

**Columns:**
- `id`: Primary key, integer (typically 1)
- `timeline_id`: Foreign key to timelines table
- `font`: Default font family (default: 'Arial')
- `font_size_scale`: Font size scaling factor (default: 1.0)
- `pixels_per_subtick`: Width of each tick in pixels (default: 20)
- `custom_css`: Custom CSS styles (TEXT, can be large)
- `use_custom_css`: Whether to use custom CSS (0 = no, 1 = yes, default: 0)
- `is_fullscreen`: Fullscreen mode flag (0 = no, 1 = yes, default: 0)
- `show_guides`: Show timeline guides (0 = no, 1 = yes, default: 1)
- `window_size_x`: Window width in pixels (default: 1000)
- `window_size_y`: Window height in pixels (default: 700)
- `window_position_x`: Window X position (default: 300)
- `window_position_y`: Window Y position (default: 100)
- `use_custom_scaling`: Use custom window scaling (0 = no, 1 = yes, default: 0)
- `custom_scale`: Custom scale factor (0.5 to 2.0, default: 1.0)
- `display_radius`: How many ticks to show on each side (default: 10)
- `canvas_settings`: JSON string containing canvas rendering settings (see below)
- `updated_at`: Last update timestamp

**canvas_settings JSON Structure:**
```json
{
    "showYearMarkers": true,
    "fontFamily": "Arial",
    "fontSize": 12,
    "fontStyle": "normal",
    "textColor": "#4b2e2e",
    "textOffsetX": 0,
    "textOffsetY": 0,
    "letterSpacing": 0
}
```

---

### 12. characters

Stores character information.

```sql
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
);
```

**Columns:**
- `id`: Primary key, text (typically UUID)
- `name`: Character name (required)
- `nicknames`: Comma-separated nicknames
- `aliases`: Comma-separated aliases
- `race`: Character race/species
- `description`: Character description
- `notes`: Additional notes
- `birth_year`: Birth year
- `birth_subtick`: Birth subtick
- `birth_date`: Birth date as text (alternative format)
- `birth_alternative_year`: Alternative year format for birth
- `death_year`: Death year
- `death_subtick`: Death subtick
- `death_date`: Death date as text (alternative format)
- `death_alternative_year`: Alternative year format for death
- `importance`: Importance level (1-10, default: 5)
- `color`: Display color (hex code)
- `timeline_id`: Foreign key to timelines table (required)
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp

---

### 13. character_relationships

Stores relationships between characters.

```sql
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
);
```

**Columns:**
- `id`: Primary key, auto-incrementing integer
- `character_1_id`: Foreign key to characters table (required)
- `character_2_id`: Foreign key to characters table (required)
- `relationship_type`: Type of relationship (required, see CHECK constraint for valid values)
- `custom_relationship_type`: Custom type if relationship_type is 'custom'
- `relationship_degree`: Degree of relationship (e.g., "first", "second")
- `relationship_modifier`: Additional modifier
- `relationship_strength`: Strength of relationship (0-100, default: 50)
- `is_bidirectional`: Whether relationship is bidirectional (0 = no, 1 = yes, default: 0)
- `notes`: Additional notes about the relationship
- `timeline_id`: Foreign key to timelines table (required)
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp

**Valid relationship_type values:**
- Family: parent, child, sibling, spouse, partner, ex-spouse, ex-partner
- Extended family: grandparent, grandchild, great-grandparent, great-grandchild, great-great-grandparent, great-great-grandchild
- Relatives: aunt, uncle, niece, nephew, cousin, great-aunt, great-uncle, great-niece, great-nephew
- Step/half: step-parent, step-child, step-sibling, half-sibling, step-grandparent, step-grandchild
- In-laws: parent-in-law, child-in-law, sibling-in-law, grandparent-in-law, grandchild-in-law
- Adoptive/foster: adoptive-parent, adoptive-child, adoptive-sibling, foster-parent, foster-child, foster-sibling
- Biological: biological-parent, biological-child
- Other family: godparent, godchild, mentor, apprentice, guardian, ward
- Social: best-friend, friend, ally, enemy, rival, acquaintance, colleague, neighbor
- Special: familiar, bonded, master, servant, liege, vassal, clan-member, pack-member
- Custom: custom, other

---

### 14. item_characters

Junction table linking items to characters (many-to-many relationship).

```sql
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
);
```

**Columns:**
- `id`: Primary key, auto-incrementing integer
- `item_id`: Foreign key to items table (required)
- `character_id`: Foreign key to characters table (required)
- `relationship_type`: How the character relates to the item (default: 'appears')
- `timeline_id`: Foreign key to timelines table (required)
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp
- **Unique constraint**: (item_id, character_id) combination must be unique

---

## Indexes

Create these indexes for performance optimization:

```sql
-- Items table indexes
CREATE INDEX IF NOT EXISTS idx_items_timeline_id ON items(timeline_id);
CREATE INDEX IF NOT EXISTS idx_items_year_subtick ON items(year, subtick);
CREATE INDEX IF NOT EXISTS idx_items_type_id ON items(type_id);
CREATE INDEX IF NOT EXISTS idx_items_item_index ON items(item_index);
CREATE INDEX IF NOT EXISTS idx_items_story_id ON items(story_id);

-- Item-Tags junction table indexes
CREATE INDEX IF NOT EXISTS idx_item_tags_item_id ON item_tags(item_id);
CREATE INDEX IF NOT EXISTS idx_item_tags_tag_id ON item_tags(tag_id);

-- Item-Pictures junction table indexes
CREATE INDEX IF NOT EXISTS idx_item_pictures_item_id ON item_pictures(item_id);
CREATE INDEX IF NOT EXISTS idx_item_pictures_picture_id ON item_pictures(picture_id);
CREATE INDEX IF NOT EXISTS idx_item_pictures_combined ON item_pictures(item_id, picture_id);

-- Item-Story References table indexes
CREATE INDEX IF NOT EXISTS idx_item_story_refs_item_id ON item_story_refs(item_id);
CREATE INDEX IF NOT EXISTS idx_item_story_refs_story_id ON item_story_refs(story_id);

-- Tags table indexes
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);

-- Notes table indexes
CREATE INDEX IF NOT EXISTS idx_notes_year_subtick ON notes(year, subtick);
```

---

## Migrations

The following migrations may need to be applied to existing databases. These should be checked and applied conditionally (only if the columns/tables don't already exist).

### Migration 1: Add timeline_id, item_index, show_in_notes to items table

```sql
-- Check if column exists before adding (SQLite doesn't support IF NOT EXISTS for ALTER TABLE)
-- Use PRAGMA table_info('items') to check, then:
ALTER TABLE items ADD COLUMN timeline_id INTEGER;
ALTER TABLE items ADD COLUMN item_index INTEGER DEFAULT 0;
ALTER TABLE items ADD COLUMN show_in_notes INTEGER DEFAULT 1;
```

### Migration 2: Add file metadata columns to pictures table

```sql
ALTER TABLE pictures ADD COLUMN file_path TEXT;
ALTER TABLE pictures ADD COLUMN file_name TEXT;
ALTER TABLE pictures ADD COLUMN file_size INTEGER;
ALTER TABLE pictures ADD COLUMN file_type TEXT;
ALTER TABLE pictures ADD COLUMN width INTEGER;
ALTER TABLE pictures ADD COLUMN height INTEGER;
```

### Migration 3: Add timeline_id to settings table

```sql
ALTER TABLE settings ADD COLUMN timeline_id INTEGER;
```

### Migration 4: Add importance column to items table

```sql
ALTER TABLE items ADD COLUMN importance INTEGER DEFAULT 5;
```

### Migration 5: Add display_radius to settings table

```sql
ALTER TABLE settings ADD COLUMN display_radius INTEGER DEFAULT 10;
```

### Migration 6: Add canvas_settings to settings table

```sql
ALTER TABLE settings ADD COLUMN canvas_settings TEXT;
```

### Migration 7: CSS Columns Consolidation

This migration consolidates old CSS columns (`custom_main_css`, `custom_items_css`, `use_main_css`, `use_items_css`) into the unified `custom_css` and `use_custom_css` columns. This is a complex migration that requires:

1. Reading existing CSS data from old columns
2. Consolidating into `custom_css`
3. Recreating the settings table without old columns
4. Copying data to new table

**Note:** This migration is complex and should be handled programmatically. See the `migrateCSSColumns()` method in dbManager.js for reference.

### Migration 8: Picture References Migration

This migration moves from the old `pictures.item_id` system to the new `item_pictures` junction table. This migration:

1. Creates `item_pictures` junction table if it doesn't exist
2. Migrates existing `pictures.item_id` references to `item_pictures`
3. Optionally removes `item_id` column from `pictures` table (by recreating table)

**Note:** This migration is complex and should be handled programmatically. See the `migratePictureReferences()` method in dbManager.js for reference.

### Migration 9: Character Tables Migration

This migration ensures character-related tables exist and have all required columns. It:

1. Creates `characters` table if it doesn't exist
2. Creates `character_relationships` table if it doesn't exist
3. Creates `item_characters` table if it doesn't exist
4. Adds missing columns to existing character tables

**Note:** This migration should be handled programmatically. See the `migrateCharacterTables()` method in dbManager.js for reference.

---

## Default Data

### Default Settings

When creating a new timeline, insert default settings:

```sql
INSERT INTO settings (
    id, timeline_id, font, font_size_scale, pixels_per_subtick, custom_css, use_custom_css,
    is_fullscreen, show_guides, window_size_x, window_size_y, window_position_x, window_position_y,
    use_custom_scaling, custom_scale, display_radius
) VALUES (
    1, ?, 'Arial', 1.0, 20, '', 0,
    0, 1, 1000, 700, 300, 100,
    0, 1.0, 10
);
```

Replace `?` with the timeline_id.

---

## Foreign Key Relationships Summary

- `items.story_id` → `stories.id`
- `items.type_id` → `item_types.id`
- `items.timeline_id` → `timelines.id` (CASCADE DELETE)
- `item_tags.item_id` → `items.id` (CASCADE DELETE)
- `item_tags.tag_id` → `tags.id` (CASCADE DELETE)
- `pictures.item_id` → `items.id` (CASCADE DELETE) [DEPRECATED]
- `item_pictures.item_id` → `items.id` (CASCADE DELETE)
- `item_pictures.picture_id` → `pictures.id` (CASCADE DELETE)
- `item_story_refs.item_id` → `items.id` (CASCADE DELETE)
- `item_story_refs.story_id` → `stories.id` (CASCADE DELETE)
- `settings.timeline_id` → `timelines.id` (CASCADE DELETE)
- `characters.timeline_id` → `timelines.id` (CASCADE DELETE)
- `character_relationships.character_1_id` → `characters.id` (CASCADE DELETE)
- `character_relationships.character_2_id` → `characters.id` (CASCADE DELETE)
- `character_relationships.timeline_id` → `timelines.id` (CASCADE DELETE)
- `item_characters.item_id` → `items.id` (CASCADE DELETE)
- `item_characters.character_id` → `characters.id` (CASCADE DELETE)
- `item_characters.timeline_id` → `timelines.id` (CASCADE DELETE)

---

## Important Notes

1. **SQLite Limitations:**
   - SQLite doesn't support `IF NOT EXISTS` for `ALTER TABLE ADD COLUMN`
   - Always check if a column exists using `PRAGMA table_info('table_name')` before adding
   - SQLite doesn't support dropping columns directly; use table recreation for complex migrations

2. **CASCADE DELETE:**
   - When a timeline is deleted, all related items, settings, characters, and relationships are automatically deleted
   - When an item is deleted, all related tags, pictures, story references, and character references are automatically deleted

3. **Legacy Columns:**
   - `pictures.item_id` is deprecated but may exist in older databases
   - `pictures.picture` (base64) is deprecated but may exist in older databases
   - Always check for existence before using these columns

4. **Data Types:**
   - Use `INTEGER` for boolean values (0 = false, 1 = true)
   - Use `TEXT` for strings, JSON, and UUIDs
   - Use `REAL` for floating-point numbers
   - Use `DATETIME` for timestamps (SQLite stores as TEXT in ISO8601 format)

5. **Primary Keys:**
   - Most tables use `INTEGER PRIMARY KEY AUTOINCREMENT`
   - Some tables use `TEXT PRIMARY KEY` (typically UUIDs)
   - Junction tables use composite primary keys

---

## Complete Schema Creation Script

For a fresh database, execute all CREATE TABLE statements in the order listed above, followed by the index creation statements, and then insert the default item_types data.

For existing databases, check for table/column existence before applying migrations.






