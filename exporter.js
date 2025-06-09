// Export functionality for Story Timeline
class Exporter {
    constructor() {
        // Initialize any required properties
    }

    /**
     * Converts an image file to a base64 data URI
     * @param {string} filePath - Path to the image file
     * @returns {Promise<string|null>} Base64 data URI or null if failed
     */
    async imageToDataUri(filePath) {
        try {
            
            // Use IPC to convert image in main process
            const result = await window.api.invoke('convert-image-to-base64', filePath);
            
            if (result && result.success) {
                return result.dataUri;
            } else {
                console.warn(`[exporter.js] Failed to convert image: ${filePath} - ${result ? result.error : 'Unknown error'}`);
                return null;
            }
            
        } catch (error) {
            console.error(`[exporter.js] Error converting image to data URI: ${filePath}`, error);
            return null;
        }
    }

    /**
     * Exports the timeline data as a document
     * @returns {Promise<void>}
     */
    async exportAsDocument() {
        try {
            // Get the current timeline data
            const timelineData = await window.api.invoke('get-timeline-data');
            const items = await window.api.invoke('get-all-items');
            // Validate data
            if (!timelineData) {
                throw new Error('Timeline data is undefined');
            }
            
            // Handle timeline data - it might be an array
            let currentTimeline;
            if (Array.isArray(timelineData)) {
                if (timelineData.length === 0) {
                    throw new Error('No timelines found');
                }
                currentTimeline = timelineData[0]; // Use the first timeline
            } else {
                currentTimeline = timelineData;
            }
            
            if (!items) {
                throw new Error('Items data is undefined');
            }
            
            if (!Array.isArray(items)) {
                throw new Error('Items is not an array: ' + typeof items);
            }
            
            // Generate hierarchical HTML content
            const htmlContent = await this.generateHierarchicalHTML(currentTimeline, items);
            
            // Generate complete HTML document
            const completeHTML = this.generateCompleteHTMLDocument(currentTimeline, htmlContent);
            
            // Show save dialog and save the file
            
            try {
                const result = await window.api.invoke('save-timeline-export', {
                    title: (currentTimeline && currentTimeline.title) ? currentTimeline.title : 'Timeline',
                    htmlContent: completeHTML
                });
                
                
                if (result && result.success) {
                    
                    // Ask user if they want to open the file
                    const shouldOpen = confirm('Timeline exported successfully! Would you like to open the file now?');
                    if (shouldOpen) {
                        try {
                            console.log('[exporter.js] Attempting to open file:', result.filePath);
                            const openResult = await window.api.invoke('open-exported-file', result.filePath);
                            console.log('[exporter.js] Open file result:', openResult);
                            
                            if (openResult && !openResult.success) {
                                console.error('[exporter.js] Failed to open file:', openResult.error);
                                alert(`Failed to open the exported file: ${openResult.error}\n\nFile saved at: ${result.filePath}`);
                            }
                        } catch (openError) {
                            console.error('[exporter.js] Error opening file:', openError);
                            alert(`Error opening the exported file: ${openError.message}\n\nFile saved at: ${result.filePath}`);
                        }
                    }
                } else {
                    const errorMsg = result ? result.error : 'Unknown error occurred';
                    console.error('Export failed:', errorMsg);
                    console.error('Full result object:', result);
                    alert('Export failed: ' + errorMsg);
                }
            } catch (ipcError) {
                console.error('[exporter.js] IPC call failed:', ipcError);
                console.error('[exporter.js] IPC error stack:', ipcError.stack);
                alert('Export failed due to IPC error: ' + ipcError.message);
            }

        } catch (error) {
            console.error('Error exporting document:', error);
            console.error('Error stack:', error.stack);
            alert('Error exporting document: ' + error.message + '\n\nCheck console for details.');
        }
    }

    /**
     * Generates a complete HTML document with proper DOCTYPE and metadata
     * @param {Object} timelineData - Timeline metadata
     * @param {string} htmlContent - The timeline content HTML
     * @returns {string} Complete HTML document
     */
    generateCompleteHTMLDocument(timelineData, htmlContent) {
        
        // Safety checks for timelineData
        if (!timelineData || typeof timelineData !== 'object') {
            console.warn('[exporter.js] timelineData is not a valid object, using defaults');
            timelineData = {};
        }
        
        const title = (timelineData.title && typeof timelineData.title === 'string') ? timelineData.title : 'Timeline Export';
        const author = (timelineData.author && typeof timelineData.author === 'string') ? timelineData.author : '';
        const description = (timelineData.description && typeof timelineData.description === 'string') ? timelineData.description : '';
        
        
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}${author ? ` - by ${author}` : ''}</title>
         <meta name="generator" content="Story Timeline App">
     ${author ? `<meta name="author" content="${author}">` : ''}
     ${description ? `<meta name="description" content="${description}">` : ''}
    <style>
        body {
            margin: 0;
            padding: 20px;
            background-color: #faf8f5;
            min-height: 100vh;
        }
        .export-header {
            text-align: center;
            margin-bottom: 2rem;
            padding: 1rem;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .export-footer {
            margin-top: 3rem;
            padding: 1rem;
            text-align: center;
            color: #666;
            font-size: 0.9rem;
            border-top: 1px solid #ddd;
        }
        .timeline-export {
            background: white;
            border-radius: 8px;
            padding: 2rem;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        /* Print styles */
        @media print {
            body {
                background-color: white;
                padding: 0;
            }
            .export-header,
            .timeline-export {
                box-shadow: none;
                border-radius: 0;
            }
            .timeline-export {
                padding: 1rem;
            }
        }
        .item-image {
            max-width: 200px;
            height: auto;
            margin: 0.5rem 0;
            border-radius: 4px;
            border: 1px solid #ddd;
        }
        .item-image-placeholder {
            max-width: 200px;
            padding: 1rem;
            margin: 0.5rem 0;
            border: 2px dashed #ccc;
            border-radius: 4px;
            background: #f9f9f9;
            color: #666;
            font-style: italic;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="export-header">
        <h1>Timeline Export</h1>
        <p>Generated from <strong>Story Timeline</strong> application</p>
        <p><em>Exported on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</em></p>
    </div>
    
    ${htmlContent}
    
    <div class="export-footer">
        <p>This timeline was exported from the <strong>Story Timeline</strong> application.</p>
        <p>For more information about Story Timeline, visit the project repository.</p>
    </div>
</body>
</html>`;
    }

    /**
     * Generates hierarchical HTML from timeline data
     * @param {Object} timelineData - The timeline metadata
     * @param {Array} items - Array of timeline items
     * @returns {Promise<string>} HTML content
     */
    async generateHierarchicalHTML(timelineData, items) {
        
        // Ensure items is an array
        if (!Array.isArray(items)) {
            console.error('[exporter.js] Items is not an array:', typeof items, items);
            throw new Error('Items must be an array');
        }
        
        // Safety checks for timelineData
        if (!timelineData || typeof timelineData !== 'object') {
            console.warn('[exporter.js] timelineData is not a valid object, using defaults');
            timelineData = {};
        }
        
        const title = (timelineData.title && typeof timelineData.title === 'string') ? timelineData.title : 'Timeline';
        const author = (timelineData.author && typeof timelineData.author === 'string') ? timelineData.author : '';
        const description = (timelineData.description && typeof timelineData.description === 'string') ? timelineData.description : '';
        
        // Sort items chronologically
        const sortedItems = [...items].sort((a, b) => {
            // Add safety checks for item properties
            const aYear = (a && typeof a.year === 'number') ? a.year : 0;
            const aSubtick = (a && typeof a.subtick === 'number') ? a.subtick : 0;
            const bYear = (b && typeof b.year === 'number') ? b.year : 0;
            const bSubtick = (b && typeof b.subtick === 'number') ? b.subtick : 0;
            
            const aStart = aYear + aSubtick / 1000;
            const bStart = bYear + bSubtick / 1000;
            return aStart - bStart;
        });

        // Separate items by type
        const ages = sortedItems.filter(item => item && item.type === 'Age');
        const periods = sortedItems.filter(item => item && item.type === 'Period');
        const singleItems = sortedItems.filter(item => item && !['Age', 'Period'].includes(item.type));
        
        // Build hierarchical structure
        const hierarchy = this.buildHierarchy(ages, periods, singleItems);

        // Generate HTML
        let html = `
            <div class="timeline-export">
                <style>
                    .timeline-export {
                        font-family: 'Georgia', serif;
                        max-width: 800px;
                        margin: 0 auto;
                        line-height: 1.6;
                        color: #333;
                    }
                    .timeline-header {
                        text-align: center;
                        margin-bottom: 2rem;
                        border-bottom: 2px solid #4b2e2e;
                        padding-bottom: 1rem;
                    }
                    .timeline-title {
                        font-size: 2rem;
                        color: #4b2e2e;
                        margin-bottom: 0.5rem;
                    }
                    .timeline-author {
                        font-style: italic;
                        color: #666;
                    }
                    .age-container {
                        margin: 1.5rem 0;
                        padding-left: 1rem;
                        background: linear-gradient(to right, rgba(139, 69, 19, 0.05), transparent);
                    }
                    .period-container {
                        margin: 1rem 0 1rem 1rem;
                        padding-left: 1rem;
                        background: linear-gradient(to right, rgba(0, 0, 0, 0.05), transparent);
                    }
                    .item-container {
                        margin-left: 30px;
                        margin: 0.8rem 0 0.8rem 1.5rem;
                        padding: 20px;
                        padding: 0.5rem;
                        border-radius: 4px;
                        background: rgba(245, 230, 212, 0.3);
                    }
                    .item-title {
                        font-weight: bold;
                        color: #4b2e2e;
                        margin-bottom: 0.3rem;
                    }
                    .item-date {
                        font-size: 0.9rem;
                        color: #666;
                        font-style: italic;
                        margin-bottom: 0.3rem;
                    }
                    .item-description {
                        margin-bottom: 0.5rem;
                    }
                    .item-content {
                        margin-top: 0.5rem;
                        padding-top: 0.5rem;
                        border-top: 1px solid #ddd;
                        font-style: italic;
                    }
                </style>
                
                <div class="timeline-header">
                    <h1 class="timeline-title">${title}</h1>
                    ${author ? `<div class="timeline-author">by ${author}</div>` : ''}
                    ${description ? `<div class="timeline-description">${description}</div>` : ''}
                </div>
                
                <div class="timeline-content">
        `;

        // Render the hierarchy
        html += await this.renderHierarchy(hierarchy);

        html += `
                </div>
            </div>
        `;

        return html;
    }

    /**
     * Builds hierarchical structure from timeline items
     * @param {Array} ages - Age items
     * @param {Array} periods - Period items  
     * @param {Array} singleItems - Individual items
     * @returns {Array} Hierarchical structure
     */
    buildHierarchy(ages, periods, singleItems) {
        const hierarchy = [];

        // For now, let's implement a simple approach and handle overlaps later
        // Sort ages chronologically
        const sortedAges = ages.sort((a, b) => a.year - b.year);

        for (const age of sortedAges) {
            const ageStart = age.year + (age.subtick || 0) / 1000;
            const ageEnd = (age.end_year || age.year) + (age.end_subtick || age.subtick || 0) / 1000;

            // Find periods within this age
            const periodsInAge = periods.filter(period => {
                const periodStart = period.year + (period.subtick || 0) / 1000;
                const periodEnd = (period.end_year || period.year) + (period.end_subtick || period.subtick || 0) / 1000;
                
                // Period is within age if it starts within the age
                return periodStart >= ageStart && periodStart <= ageEnd;
            });

            // Find single items within this age
            const itemsInAge = singleItems.filter(item => {
                const itemStart = item.year + (item.subtick || 0) / 1000;
                return itemStart >= ageStart && itemStart <= ageEnd;
            });

            hierarchy.push({
                type: 'age',
                item: age,
                periods: periodsInAge.map(period => {
                    const periodStart = period.year + (period.subtick || 0) / 1000;
                    const periodEnd = (period.end_year || period.year) + (period.end_subtick || period.subtick || 0) / 1000;
                    
                    // Find items within this period
                    const itemsInPeriod = itemsInAge.filter(item => {
                        const itemStart = item.year + (item.subtick || 0) / 1000;
                        return itemStart >= periodStart && itemStart <= periodEnd;
                    });

                    return {
                        type: 'period',
                        item: period,
                        items: itemsInPeriod
                    };
                }),
                items: itemsInAge.filter(item => {
                    // Only include items that aren't already in a period
                    return !periodsInAge.some(period => {
                        const periodStart = period.year + (period.subtick || 0) / 1000;
                        const periodEnd = (period.end_year || period.year) + (period.end_subtick || period.subtick || 0) / 1000;
                        const itemStart = item.year + (item.subtick || 0) / 1000;
                        return itemStart >= periodStart && itemStart <= periodEnd;
                    });
                })
            });
        }

        // Add items that don't fall within any age
        const orphanedItems = singleItems.filter(item => {
            const itemStart = item.year + (item.subtick || 0) / 1000;
            return !ages.some(age => {
                const ageStart = age.year + (age.subtick || 0) / 1000;
                const ageEnd = (age.end_year || age.year) + (age.end_subtick || age.subtick || 0) / 1000;
                return itemStart >= ageStart && itemStart <= ageEnd;
            });
        });

        // Add orphaned items as top-level items
        orphanedItems.forEach(item => {
            hierarchy.push({
                type: 'item',
                item: item
            });
        });

        return hierarchy;
    }

    /**
     * Renders the hierarchical structure as HTML
     * @param {Array} hierarchy - The hierarchical structure
     * @returns {Promise<string>} HTML content
     */
    async renderHierarchy(hierarchy) {
        let html = '';

        for (const entry of hierarchy) {
            if (entry.type === 'age') {
                html += await this.renderAge(entry);
            } else if (entry.type === 'item') {
                html += await this.renderItem(entry.item);
            }
        }

        return html;
    }

    /**
     * Renders an age with its nested content
     * @param {Object} ageEntry - Age entry from hierarchy
     * @returns {Promise<string>} HTML content
     */
    async renderAge(ageEntry) {
        const age = ageEntry.item;
        const dateRange = this.formatDateRange(age);
        
        let html = `
            <div class="age-container" style="border-left: 16px solid ${age.color || '#8B4513'};">
                <div class="item-title">${age.title || '(Untitled Age)'}</div>
                <div class="item-date">${dateRange}</div>
                ${age.description ? `<div class="item-description">${age.description}</div>` : ''}
                ${age.content ? `<div class="item-content">${age.content}</div>` : ''}
        `;

        // Add first image if available
        if (age.pictures && age.pictures.length > 0) {
            const firstImage = age.pictures[0];
            if (firstImage.file_path) {
                const dataUri = await this.imageToDataUri(firstImage.file_path);
                if (dataUri) {
                    html += `<img src="${dataUri}" alt="${firstImage.description || age.title}" class="item-image">`;
                } else {
                    // Fallback if image conversion fails
                    html += `<div class="item-image-placeholder">[Image: ${firstImage.description || age.title}]</div>`;
                }
            }
        }

        // Render nested periods
        if (ageEntry.periods && ageEntry.periods.length > 0) {
            for (const periodEntry of ageEntry.periods) {
                html += await this.renderPeriod(periodEntry);
            }
        }

        // Render items directly in the age
        if (ageEntry.items && ageEntry.items.length > 0) {
            for (const item of ageEntry.items) {
                html += await this.renderItem(item);
            }
        }

        html += '</div>';
        return html;
    }

    /**
     * Renders a period with its nested content
     * @param {Object} periodEntry - Period entry from hierarchy
     * @returns {Promise<string>} HTML content
     */
    async renderPeriod(periodEntry) {
        const period = periodEntry.item;
        const dateRange = this.formatDateRange(period);
        const borderColor = period.color || '#4CAF50';
        
        let html = `
            <div class="period-container" style="border-left: 8px solid ${borderColor};">
                <div class="item-title">${period.title || '(Untitled Period)'}</div>
                <div class="item-date">${dateRange}</div>
                ${period.description ? `<div class="item-description">${period.description}</div>` : ''}
                ${period.content ? `<div class="item-content">${period.content}</div>` : ''}
        `;

        // Render items within the period
        if (periodEntry.items && periodEntry.items.length > 0) {
            for (const item of periodEntry.items) {
                html += await this.renderItem(item);
            }
        }

        html += '</div>';
        return html;
    }

    /**
     * Renders a single timeline item
     * @param {Object} item - Timeline item
     * @returns {Promise<string>} HTML content
     */
    async renderItem(item) {
        const date = this.formatDate(item);
        
        let html = `
            <div class="item-container">
                <div class="item-title">${item.title || '(Untitled Item)'}</div>
                <div class="item-date">${date}</div>
                ${item.description ? `<div class="item-description">${item.description}</div>` : ''}
        `;

        // // Add images if available
        // if (item.pictures && item.pictures.length > 0) {
        //     for (const picture of item.pictures) {
        //         if (picture.file_path) {
        //             const dataUri = await this.imageToDataUri(picture.file_path);
        //             if (dataUri) {
        //                 html += `<img src="${dataUri}" alt="${picture.description || item.title}" class="item-image">`;
        //             } else {
        //                 // Fallback if image conversion fails
        //                 html += `<div class="item-image-placeholder">[Image: ${picture.description || item.title}]</div>`;
        //             }
        //         }
        //     }
        // }

        html += `${item.content ? `<div class="item-content">${item.content}</div>` : ''}
            </div>
        `;
        
        return html;
    }

    /**
     * Formats a date range for periods and ages
     * @param {Object} item - Item with start and end dates
     * @returns {string} Formatted date range
     */
    formatDateRange(item) {
        const start = `${item.year}.${(item.subtick || 0).toString().padStart(2, '0')}`;
        
        if (item.end_year && (item.end_year !== item.year || item.end_subtick !== item.subtick)) {
            const end = `${item.end_year}.${(item.end_subtick || 0).toString().padStart(2, '0')}`;
            return `${start} - ${end}`;
        }
        
        return start;
    }

    /**
     * Formats a single date
     * @param {Object} item - Item with date
     * @returns {string} Formatted date
     */
    formatDate(item) {
        return `${item.year}.${(item.subtick || 0).toString().padStart(2, '0')}`;
    }
}

// Create and export a singleton instance
const exporter = new Exporter();
export default exporter; 