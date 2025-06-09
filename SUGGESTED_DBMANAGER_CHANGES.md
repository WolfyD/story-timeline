# Suggested Changes for dbManager.js

To support the new image reuse functionality, you'll need to make the following changes to `dbManager.js`:

## 1. Update Pictures Table Schema

The pictures table should support multiple item references through a junction table:

```sql
-- Create a new table for item-picture relationships
CREATE TABLE IF NOT EXISTS item_pictures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id TEXT NOT NULL,
    picture_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
    FOREIGN KEY (picture_id) REFERENCES pictures(id) ON DELETE CASCADE,
    UNIQUE(item_id, picture_id)
);

-- Remove item_id from pictures table (it's now in the junction table)
-- Note: This requires a migration
```

## 2. Add New Methods to DatabaseManager

### Add Image Reference Method
```javascript
addImageReference(itemId, pictureId) {
    const stmt = this.db.prepare(`
        INSERT OR IGNORE INTO item_pictures (item_id, picture_id)
        VALUES (?, ?)
    `);
    return stmt.run(itemId, pictureId);
}
```

### Update getItemPictures Method
```javascript
getItemPictures(itemId) {
    const stmt = this.db.prepare(`
        SELECT p.* 
        FROM pictures p
        JOIN item_pictures ip ON p.id = ip.picture_id
        WHERE ip.item_id = ?
    `);
    return stmt.all(itemId);
}
```

### Add getPictureUsageCount Method
```javascript
getPictureUsageCount(pictureId) {
    const stmt = this.db.prepare(`
        SELECT COUNT(*) as count 
        FROM item_pictures 
        WHERE picture_id = ?
    `);
    return stmt.get(pictureId).count;
}
```

### Update addPicturesToItem Method
```javascript
async addPicturesToItem(itemId, pictures) {
    for (const pic of pictures) {
        if (pic.isReference) {
            // Add reference to existing image
            this.addImageReference(itemId, pic.id);
        } else if (pic.temp_path) {
            // Process and save new image
            const fileInfo = await this.saveImageFile(pic.picture || pic.temp_path, itemId);
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

            // Create reference
            this.addImageReference(itemId, result.lastInsertRowid);
        }
    }
}
```

### Update deleteItem Method
```javascript
deleteItem(id) {
    // Get pictures that will become orphaned
    const orphanedPictures = this.db.prepare(`
        SELECT p.id, p.file_path
        FROM pictures p
        JOIN item_pictures ip ON p.id = ip.picture_id
        WHERE ip.item_id = ? 
        AND (SELECT COUNT(*) FROM item_pictures ip2 WHERE ip2.picture_id = p.id) = 1
    `).all(id);

    // Delete related records first
    this.db.prepare('DELETE FROM item_tags WHERE item_id = ?').run(id);
    this.db.prepare('DELETE FROM item_pictures WHERE item_id = ?').run(id);
    
    // Delete orphaned pictures
    for (const pic of orphanedPictures) {
        this.db.prepare('DELETE FROM pictures WHERE id = ?').run(pic.id);
        // Also delete the physical file
        if (fs.existsSync(pic.file_path)) {
            fs.unlinkSync(pic.file_path);
        }
    }
    
    // Delete the item
    const stmt = this.db.prepare('DELETE FROM items WHERE id = ?');
    return stmt.run(id);
}
```

### Update getAllPictures Method
```javascript
getAllPictures() {
    const stmt = this.db.prepare(`
        SELECT p.*, 
               GROUP_CONCAT(DISTINCT i.id) as linked_items,
               COUNT(DISTINCT ip.item_id) as usage_count
        FROM pictures p
        LEFT JOIN item_pictures ip ON p.id = ip.picture_id
        LEFT JOIN items i ON ip.item_id = i.id AND i.timeline_id = ?
        GROUP BY p.id
        ORDER BY p.file_name
    `);
    return stmt.all(this.currentTimelineId);
}
```

## 3. Migration Script

Add this migration method to handle the schema change:

```javascript
async migratePictureReferences() {
    // Check if migration is needed
    const hasJunctionTable = this.db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='item_pictures'
    `).get();

    if (hasJunctionTable) return; // Already migrated

    // Create junction table
    this.db.exec(`
        CREATE TABLE item_pictures (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id TEXT NOT NULL,
            picture_id INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
            FOREIGN KEY (picture_id) REFERENCES pictures(id) ON DELETE CASCADE,
            UNIQUE(item_id, picture_id)
        )
    `);

    // Migrate existing data
    const existingPictures = this.db.prepare(`
        SELECT id, item_id FROM pictures WHERE item_id IS NOT NULL
    `).all();

    for (const pic of existingPictures) {
        this.db.prepare(`
            INSERT INTO item_pictures (item_id, picture_id)
            VALUES (?, ?)
        `).run(pic.item_id, pic.id);
    }

    // Remove item_id column from pictures table
    // (This requires creating new table and copying data)
    // ... implementation details for column removal
}
```

## 4. Call Migration in Constructor

Add this to the DatabaseManager constructor:

```javascript
constructor() {
    // ... existing code ...
    this.migratePictureReferences();
}
```

## Benefits of These Changes

1. **Image Reuse**: Multiple items can reference the same image file
2. **Storage Efficiency**: No duplicate image files
3. **Orphan Cleanup**: Automatic cleanup of unused images
4. **Usage Tracking**: Track how many items use each image
5. **Backward Compatibility**: Migration preserves existing data

## Testing

After implementing these changes:

1. Test creating new items with new images
2. Test creating items with existing images
3. Test editing items and changing images
4. Test deleting items and verify orphan cleanup
5. Verify the image library shows correct usage counts 