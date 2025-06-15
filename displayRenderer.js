class DisplayRenderer {
    constructor() {
        this.canvas = document.getElementById('display-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.isRunning = false;
        this.lastFrameTime = 0;
        this.fps = 60;
        this.frameInterval = 1000 / this.fps;
        
        // New properties for our implementation
        this.isDirty = false;
        this.timelineItems = [];
        this.densityCache = null;
        this.minYear = Infinity;
        this.maxYear = -Infinity;
        this.config = {
            colors: {
                timeline: '#4b2e2e',
                densityGraph: 'rgba(75, 46, 46, 0.2)',
                itemMarker: '#4b2e2e',
                rangeItem: 'rgba(75, 46, 46, 0.3)',
                bookmark: '#8a4e4e',
                startMarker: '#2c7a2c',
                endMarker: '#c0392b',
                yearMarker: '#4b2e2e',
                yearLabel: '#4b2e2e',
                ageMarker: '#2c7a2c',      // Green for ages
                ageRange: 'rgba(44, 122, 44, 0.3)',
                periodMarker: '#8a4e4e',   // Red-brown for periods
                periodRange: 'rgba(138, 78, 78, 0.3)',
                currentYearLabel: '#ff0000'  // Red for current year
            },
            sizes: {
                timelineHeight: 2,
                itemMarkerSize: 4,
                densityGraphHeight: 50,
                densityGraphSegments: 100,
                markerHeight: 8,
                rangeItemHeight: 4,
                specialMarkerSize: 6,
                specialMarkerHeight: 12,
                yearMarkerHeight: 4,
                yearMarkerWidth: 1,
                yearLabelFont: '10px Arial',
                minMarkerSpacing: 20,  // Minimum pixels between markers to show them separately
                currentYearFont: '12px Arial',
                currentYearPadding: 25
            },
            spacing: {
                timelinePadding: 20,
                itemSpacing: 10,
                yearLabelPadding: 12
            }
        };

        // Set up resize handling
        this.handleResize();
        window.addEventListener('resize', () => this.handleResize());

        // Set up message handlers
        this.setupMessageHandlers();

        // Create and set up the now marker element
        this.setupNowMarker();
    }

    setupMessageHandlers() {
        // Handle items update
        window.api.receive('items', (items) => {
            this.updateItems(items);
        });

        // Handle window scale changes
        window.api.receive('window-scale-changed', (scale) => {
            this.updateScale(scale);
        });

        // Handle timeline updates
        window.api.receive('timeline-updated', (state) => {
            //The current year marker needs to be updated, not rerendered

            // Update the now marker position based on the new state
            const nowMarker = document.getElementById('display-now-marker');
            if (!nowMarker){ return; }

            const displayContent = document.getElementById('display-content');
            if (!displayContent) { return; }

            const displayRect = displayContent.getBoundingClientRect();
            
            // Use the stored min and max years
            if (this.minYear === Infinity || this.maxYear === -Infinity) {
                return;
            }

            // Calculate the center year based on the timeline's current position
            const centerX = displayRect.width / 2;
            const centerYear = state.focusYear + 
                ((centerX - displayRect.width/2 - state.offsetPx) / 
                (state.pixelsPerSubtick * state.granularity));

            // Calculate the position based on the center year
            const relativePosition = (centerYear - this.minYear) / (this.maxYear - this.minYear);
            const x = relativePosition * displayRect.width;


            // Update the now marker position
            nowMarker.style.left = `${x}px`;
            nowMarker.style.top = `${displayRect.height - this.config.spacing.timelinePadding}px`;
        });

        // Start the render loop
        this.start();
    }

    setupNowMarker() {
        // Create the now marker element if it doesn't exist
        let nowMarker = document.getElementById('display-now-marker');
        if (!nowMarker) {
            nowMarker = document.createElement('div');
            nowMarker.id = 'display-now-marker';
            nowMarker.style.cssText = `
                position: absolute;
                width: 2px;
                height: 8px;
                background-color: #ff0000;
                pointer-events: none;
                z-index: 1;
            `;
            document.getElementById('display-content').appendChild(nowMarker);
        }

        // Set up mutation observer to watch for now marker movement
        const observer = new MutationObserver(() => this.updateNowMarkerPosition());
        const nowMarkerElement = document.getElementById('now-marker');
        if (nowMarkerElement) {
            observer.observe(nowMarkerElement, {
                attributes: true,
                attributeFilter: ['style']
            });
        }
    }

    updateNowMarkerPosition() {
        const nowMarker = document.getElementById('display-now-marker');
        const timelineNowMarker = document.getElementById('now-marker');
        const timelineContainer = document.getElementById('timeline-container');
        const displayContent = document.getElementById('display-content');

        if (!nowMarker || !timelineNowMarker || !timelineContainer || !displayContent) return;

        const containerRect = timelineContainer.getBoundingClientRect();
        const markerRect = timelineNowMarker.getBoundingClientRect();
        const displayRect = displayContent.getBoundingClientRect();
        
        // Calculate the relative position (0 to 1) of the now marker
        const relativePosition = (markerRect.left - containerRect.left) / containerRect.width;
        
        // Calculate the x position in the display content
        const x = relativePosition * displayRect.width;

        // Update the now marker position
        nowMarker.style.left = `${x}px`;
        nowMarker.style.top = `${displayRect.height - this.config.spacing.timelinePadding}px`;
    }

    handleResize() {
        const container = document.getElementById('display-content');
        const rect = container.getBoundingClientRect();
        
        // Set canvas size to match container size
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        
        // Update now marker position
        this.updateNowMarkerPosition();
        
        // Mark as dirty and redraw
        this.isDirty = true;
        this.render();
    }

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // New method to update timeline items
    updateItems(items) {
        this.timelineItems = items;
        this.densityCache = null; // Clear density cache
        this.isDirty = true;
        
        // Force an immediate render
        this.render();
        
        // Also request a frame to ensure smooth updates
        requestAnimationFrame(() => {
            if (this.isDirty) {
                this.render();
            }
        });
    }

    // New method to handle UI scale changes
    updateScale(scale) {
        // Update any scale-dependent properties
        this.isDirty = true;
        this.render();
    }

    render() {
        if (!this.isDirty) return;

        this.clear();
        
        // Calculate min and max years before rendering
        this.minYear = Infinity;
        this.maxYear = -Infinity;
        this.timelineItems.forEach(item => {
            this.minYear = Math.min(this.minYear, item.year);
            this.maxYear = Math.max(this.maxYear, item.end_year !== undefined && item.end_year !== null ? item.end_year : item.year);
        });
        
        // Render components in order
        this.renderDensityGraph();
        this.renderRangeItems();
        this.renderItemMarkers();
        this.renderSpecialItems();
        this.renderTimelineBase();
        this.renderYearMarkers();
        this.renderCurrentYear();

        this.isDirty = false;
    }

    // New rendering methods
    renderTimelineBase() {
        const { timelineHeight, timelinePadding } = this.config.sizes;
        const y = this.canvas.height - timelinePadding;
        
        this.ctx.beginPath();
        this.ctx.strokeStyle = this.config.colors.timeline;
        this.ctx.lineWidth = timelineHeight;
        this.ctx.moveTo(0, y);
        this.ctx.lineTo(this.canvas.width, y);
        this.ctx.stroke();
    }

    calculateDensity() {
        if (this.densityCache) return this.densityCache;

        const { densityGraphSegments } = this.config.sizes;
        const density = new Array(densityGraphSegments).fill(0);
        
        // Find min and max years across all items
        let minYear = Infinity;
        let maxYear = -Infinity;
        
        this.timelineItems.forEach(item => {
            minYear = Math.min(minYear, item.year);
            maxYear = Math.max(maxYear, item.end_year !== undefined && item.end_year !== null ? item.end_year : item.year);
        });

        if (minYear === Infinity || maxYear === -Infinity) {
            this.densityCache = density;
            return density;
        }

        const yearRange = maxYear - minYear;
        const segmentWidth = yearRange / densityGraphSegments;

        // Calculate density for each segment
        this.timelineItems.forEach(item => {
            const startYear = item.year;
            const endYear = item.end_year !== undefined && item.end_year !== null ? item.end_year : item.year;
            
            // Calculate which segments this item spans
            const startSegment = Math.floor((startYear - minYear) / segmentWidth);
            const endSegment = Math.ceil((endYear - minYear) / segmentWidth);
            
            // Increment density for each affected segment
            for (let i = Math.max(0, startSegment); i < Math.min(densityGraphSegments, endSegment + 1); i++) {
                density[i]++;
            }
        });

        // Normalize density values to 0-1 range
        const maxDensity = Math.max(...density);
        if (maxDensity > 0) {
            for (let i = 0; i < density.length; i++) {
                density[i] = density[i] / maxDensity;
            }
        }

        this.densityCache = density;
        return density;
    }

    renderDensityGraph() {
        const density = this.calculateDensity();
        const { densityGraphHeight } = this.config.sizes;
        const { densityGraph } = this.config.colors;
        
        // Draw density graph at the top of the canvas
        const graphY = 0;
        const segmentWidth = this.canvas.width / density.length;
        
        this.ctx.fillStyle = densityGraph;
        
        density.forEach((value, index) => {
            const x = index * segmentWidth;
            const height = value * densityGraphHeight;
            
            this.ctx.fillRect(
                x,
                graphY + (densityGraphHeight - height), // Draw from bottom up
                segmentWidth,
                height
            );
        });
    }

    calculateItemPosition(year) {
        // Find min and max years across all items
        let minYear = Infinity;
        let maxYear = -Infinity;
        
        this.timelineItems.forEach(item => {
            minYear = Math.min(minYear, item.year);
            maxYear = Math.max(maxYear, item.end_year !== undefined && item.end_year !== null ? item.end_year : item.year);
        });

        if (minYear === Infinity || maxYear === -Infinity) {
            return 0;
        }

        const yearRange = maxYear - minYear;
        const x = ((year - minYear) / yearRange) * this.canvas.width;
        return Math.max(0, Math.min(this.canvas.width, x));
    }

    renderItemMarkers() {
        const { itemMarkerSize, markerHeight } = this.config.sizes;
        const { itemMarker } = this.config.colors;
        const timelineY = this.canvas.height - this.config.spacing.timelinePadding;

        // Group items by type
        const events = [];
        const ages = [];
        const periods = [];

        this.timelineItems.forEach(item => {
            if (item.end_year && item.end_year !== item.year) {
                if (item.type.toLowerCase() === 'age') {
                    ages.push(item);
                } else if (item.type.toLowerCase() === 'period') {
                    periods.push(item);
                }
            } else {
                events.push(item);
            }
        });

        // Option 3: Vertical lines with dots
        events.forEach(item => {
            const x = this.calculateItemPosition(item.year);
            this.ctx.beginPath();
            this.ctx.strokeStyle = item.color || itemMarker;
            this.ctx.lineWidth = 1.5; // Thinner lines
            this.ctx.moveTo(x, timelineY);
            this.ctx.lineTo(x, timelineY - markerHeight * 1.5); // Longer line
            this.ctx.stroke();
            
            // Add smaller dot at top
            this.ctx.beginPath();
            this.ctx.fillStyle = item.color || itemMarker;
            this.ctx.arc(x, timelineY - markerHeight * 1.5, itemMarkerSize * 0.6, 0, Math.PI * 2); // Smaller dot
            this.ctx.fill();
        });

        // Render ages
        ages.forEach(item => {
            const x = this.calculateItemPosition(item.year);
            this.ctx.beginPath();
            this.ctx.fillStyle = item.color || itemMarker;
            this.ctx.moveTo(x, timelineY);
            this.ctx.lineTo(x - itemMarkerSize, timelineY - markerHeight);
            this.ctx.lineTo(x + itemMarkerSize, timelineY - markerHeight);
            this.ctx.closePath();
            this.ctx.fill();
        });

        // Render periods
        periods.forEach(item => {
            const x = this.calculateItemPosition(item.year);
            this.ctx.beginPath();
            this.ctx.fillStyle = item.color || itemMarker;
            this.ctx.moveTo(x, timelineY);
            this.ctx.lineTo(x - itemMarkerSize, timelineY - markerHeight);
            this.ctx.lineTo(x + itemMarkerSize, timelineY - markerHeight);
            this.ctx.closePath();
            this.ctx.fill();
        });
    }

    renderRangeItems() {
        const { rangeItemHeight } = this.config.sizes;
        const { rangeItem } = this.config.colors;
        const timelineY = this.canvas.height - this.config.spacing.timelinePadding;
        const lineSpacing = 4; // Space between period lines

        // Group items by type
        const ages = [];
        const periods = [];

        this.timelineItems.forEach(item => {
            if (!item.end_year || item.end_year === item.year) return;
            
            if (item.type.toLowerCase() === 'age') {
                ages.push(item);
            } else if (item.type.toLowerCase() === 'period') {
                periods.push(item);
            }
        });

        // Render ages
        ages.forEach(item => {
            const startX = this.calculateItemPosition(item.year);
            const endX = this.calculateItemPosition(item.end_year);
            
            this.ctx.beginPath();
            this.ctx.fillStyle = item.color || rangeItem;
            this.ctx.fillRect(
                startX,
                timelineY - rangeItemHeight,
                endX - startX,
                rangeItemHeight
            );

            // Draw start and end markers
            this.ctx.fillRect(
                startX - 1,
                timelineY - rangeItemHeight - 2,
                2,
                rangeItemHeight + 4
            );
            this.ctx.fillRect(
                endX - 1,
                timelineY - rangeItemHeight - 2,
                2,
                rangeItemHeight + 4
            );
        });

        // Sort periods by start year to process them in order
        periods.sort((a, b) => a.year - b.year);

        // Track occupied spaces for stacking
        const occupiedSpaces = [];
        
        // Render periods with stacking
        periods.forEach(item => {
            const startX = this.calculateItemPosition(item.year);
            const endX = this.calculateItemPosition(item.end_year);
            
            // Find the lowest available level
            let level = 0;
            let foundSpace = false;
            
            while (!foundSpace) {
                // Check if this level is available for the entire period
                const isLevelAvailable = !occupiedSpaces.some(space => 
                    space.level === level && 
                    ((startX >= space.startX && startX <= space.endX) || 
                     (endX >= space.startX && endX <= space.endX) ||
                     (startX <= space.startX && endX >= space.endX))
                );
                
                if (isLevelAvailable) {
                    foundSpace = true;
                } else {
                    level++;
                }
            }
            
            // Add this period to occupied spaces
            occupiedSpaces.push({
                level,
                startX,
                endX
            });
            
            // Calculate y position based on level
            const periodY = timelineY + (level + 1) * lineSpacing;
            
            // Draw the period line
            this.ctx.beginPath();
            this.ctx.strokeStyle = item.color || rangeItem;
            this.ctx.lineWidth = 2;
            this.ctx.moveTo(startX, periodY);
            this.ctx.lineTo(endX, periodY);
            this.ctx.stroke();

            // Draw start and end markers
            this.ctx.fillStyle = item.color || rangeItem;
            this.ctx.fillRect(
                startX - 2,
                periodY - 2,
                4,
                4
            );
            this.ctx.fillRect(
                endX - 2,
                periodY - 2,
                4,
                4
            );
        });
    }

    renderSpecialItems() {
        const { specialMarkerSize, specialMarkerHeight } = this.config.sizes;
        const { bookmark, startMarker, endMarker } = this.config.colors;
        const timelineY = this.canvas.height - this.config.spacing.timelinePadding;

        // Add mouse move handler for hover effects
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Check if mouse is over any bookmark
            let isOverBookmark = false;
            let hoveredBookmark = null;
            this.timelineItems.forEach(item => {
                if (item.type && item.type.toLowerCase() === 'bookmark') {
                    const itemX = this.calculateItemPosition(item.year);
                    const distance = Math.abs(x - itemX);
                    if (distance < specialMarkerSize * 2 && 
                        y >= timelineY - specialMarkerHeight && 
                        y <= timelineY) {
                        isOverBookmark = true;
                        hoveredBookmark = item;
                        this.canvas.style.cursor = 'pointer';
                        return;
                    }
                }
            });

            if (!isOverBookmark) {
                this.canvas.style.cursor = 'default';
            }

            // Store the hovered bookmark for rendering
            this.hoveredBookmark = hoveredBookmark;
            this.isDirty = true;
        });

        // Add click handler for bookmarks
        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            this.timelineItems.forEach(item => {
                if (item.type && item.type.toLowerCase() === 'bookmark') {
                    const itemX = this.calculateItemPosition(item.year);
                    const distance = Math.abs(x - itemX);
                    if (distance < specialMarkerSize * 2 && 
                        y >= timelineY - specialMarkerHeight && 
                        y <= timelineY) {
                        // Jump to the bookmark's year
                        window.jumpToDate(item.year, item.subtick);
                        return;
                    }
                }
            });
        });

        this.timelineItems.forEach(item => {
            if (!item.type) return;

            const x = this.calculateItemPosition(item.year);
            let color;
            let shape;

            switch (item.type.toLowerCase()) {
                case 'bookmark':
                    color = bookmark;
                    shape = 'bookmark';
                    break;
                case 'timelinestart':
                    color = startMarker;
                    shape = 'start';
                    break;
                case 'timelineend':
                    color = endMarker;
                    shape = 'end';
                    break;
                default:
                    return; // Skip non-special items
            }

            this.ctx.beginPath();
            this.ctx.fillStyle = color;

            switch (shape) {
                case 'bookmark':
                    // Draw bookmark shape (triangle pointing up)
                    this.ctx.moveTo(x, timelineY - specialMarkerHeight);
                    this.ctx.lineTo(x - specialMarkerSize, timelineY);
                    this.ctx.lineTo(x + specialMarkerSize, timelineY);
                    this.ctx.closePath();
                    break;

                case 'start':
                    // Draw start marker (triangle pointing right)
                    this.ctx.moveTo(x, timelineY - specialMarkerHeight/2);
                    this.ctx.lineTo(x + specialMarkerHeight, timelineY);
                    this.ctx.lineTo(x, timelineY + specialMarkerHeight/2);
                    this.ctx.closePath();
                    break;

                case 'end':
                    // Draw end marker (triangle pointing left)
                    this.ctx.moveTo(x, timelineY - specialMarkerHeight/2);
                    this.ctx.lineTo(x - specialMarkerHeight, timelineY);
                    this.ctx.lineTo(x, timelineY + specialMarkerHeight/2);
                    this.ctx.closePath();
                    break;
            }

            this.ctx.fill();

            // Add a subtle glow effect for special markers
            this.ctx.shadowColor = color;
            this.ctx.shadowBlur = 4;
            this.ctx.fill();
            this.ctx.shadowBlur = 0; // Reset shadow
        });

        // Draw tooltip for hovered bookmark
        if (this.hoveredBookmark) {
            const x = this.calculateItemPosition(this.hoveredBookmark.year);
            const bubblePadding = 4;
            const bubbleRadius = 3;
            const lineHeight = 12;
            const bubbleY = timelineY - specialMarkerHeight - 50;

            // Set up text
            this.ctx.font = '11px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';

            // Calculate text dimensions
            const title = this.hoveredBookmark.title || 'Untitled Bookmark';
            const year = Math.round(this.hoveredBookmark.year).toString();
            const titleWidth = this.ctx.measureText(title).width;
            const yearWidth = this.ctx.measureText(year).width;
            const bubbleWidth = Math.max(titleWidth, yearWidth) + bubblePadding * 2;
            const bubbleHeight = lineHeight * 2 + bubblePadding * 2;

            // Draw connecting line
            this.ctx.beginPath();
            this.ctx.strokeStyle = bookmark;
            this.ctx.lineWidth = 1;
            this.ctx.moveTo(x, timelineY - specialMarkerHeight);
            this.ctx.lineTo(x, bubbleY + bubbleHeight);
            this.ctx.stroke();

            // Draw bubble background
            this.ctx.beginPath();
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
            this.ctx.strokeStyle = bookmark;
            this.ctx.lineWidth = 1;
            
            // Draw rounded rectangle
            const bubbleX = x - bubbleWidth / 2;
            this.ctx.moveTo(bubbleX + bubbleRadius, bubbleY);
            this.ctx.lineTo(bubbleX + bubbleWidth - bubbleRadius, bubbleY);
            this.ctx.quadraticCurveTo(bubbleX + bubbleWidth, bubbleY, bubbleX + bubbleWidth, bubbleY + bubbleRadius);
            this.ctx.lineTo(bubbleX + bubbleWidth, bubbleY + bubbleHeight - bubbleRadius);
            this.ctx.quadraticCurveTo(bubbleX + bubbleWidth, bubbleY + bubbleHeight, bubbleX + bubbleWidth - bubbleRadius, bubbleY + bubbleHeight);
            this.ctx.lineTo(bubbleX + bubbleRadius, bubbleY + bubbleHeight);
            this.ctx.quadraticCurveTo(bubbleX, bubbleY + bubbleHeight, bubbleX, bubbleY + bubbleHeight - bubbleRadius);
            this.ctx.lineTo(bubbleX, bubbleY + bubbleRadius);
            this.ctx.quadraticCurveTo(bubbleX, bubbleY, bubbleX + bubbleRadius, bubbleY);
            this.ctx.closePath();
            
            this.ctx.fill();
            this.ctx.stroke();

            // Draw text
            this.ctx.fillStyle = '#333';
            this.ctx.fillText(title, x, bubbleY + bubblePadding + lineHeight / 2);
            this.ctx.fillText(year, x, bubbleY + bubblePadding + lineHeight * 1.5);
        }
    }

    renderYearMarkers() {
        const { yearMarkerHeight, yearMarkerWidth, yearLabelFont } = this.config.sizes;
        const { yearMarker, yearLabel } = this.config.colors;
        const timelineY = this.canvas.height - this.config.spacing.timelinePadding;
        const labelY = timelineY + this.config.spacing.yearLabelPadding;

        // Set up text rendering
        this.ctx.font = yearLabelFont;
        this.ctx.fillStyle = yearLabel;
        this.ctx.textAlign = 'center';

        if (this.timelineItems.length === 0) {
            // If no items, just show the current year in the middle
            const centerX = this.canvas.width / 2;
            this.ctx.fillText('Year 0', centerX, labelY);
            return;
        }

        // Find min and max years
        let minYear = Infinity;
        let maxYear = -Infinity;
        
        this.timelineItems.forEach(item => {
            minYear = Math.min(minYear, item.year);
            maxYear = Math.max(maxYear, item.end_year !== undefined && item.end_year !== null ? item.end_year : item.year);
        });

        if (minYear === Infinity || maxYear === -Infinity) return;

        const yearRange = maxYear - minYear;
        const markerInterval = yearRange / 20; // Show a marker every 5% of the range
        const labelInterval = yearRange / 5; // Show a label every 20% of the range

        // Calculate the number of markers needed
        const numMarkers = Math.ceil(yearRange / markerInterval);

        for (let i = 0; i <= numMarkers; i++) {
            const year = minYear + (i * markerInterval);
            const x = this.calculateItemPosition(year);

            // Draw marker
            this.ctx.fillStyle = yearMarker;
            this.ctx.fillRect(
                x - (yearMarkerWidth / 2),
                timelineY,
                yearMarkerWidth,
                yearMarkerHeight
            );

            // Draw year label if it's a label interval
            if (i % 4 === 0) {
                this.ctx.fillStyle = yearLabel;
                
                // Calculate label width for positioning
                const yearText = Math.round(year).toString();
                const labelWidth = this.ctx.measureText(yearText).width;
                
                // Adjust position for first and last labels
                let labelX = x;
                if (i === 0) {
                    // First label: shift right by 60% of its width
                    labelX = x + (labelWidth * 0.6);
                } else if (i === numMarkers) {
                    // Last label: shift left by 60% of its width
                    labelX = x - (labelWidth * 0.6);
                }
                
                this.ctx.fillText(yearText, labelX, labelY);
            }
        }
    }

    renderCurrentYear() {
        const timelineY = this.canvas.height - this.config.spacing.timelinePadding;
        const centerX = this.canvas.width / 2;
        
        // Get the current year from the timeline state
        const timelineState = window.timelineState;
        if (!timelineState) return;

        const containerRect = document.getElementById('timeline-container')?.getBoundingClientRect();
        if (!containerRect) return;

        // Calculate the year at the center position
        const centerYear = timelineState.focusYear + 
            ((centerX - containerRect.width/2 - timelineState.offsetPx) / 
            (timelineState.pixelsPerSubtick * timelineState.granularity));
        
        // Draw the year text
        this.ctx.font = this.config.sizes.currentYearFont;
        this.ctx.fillStyle = this.config.colors.currentYearLabel;
        this.ctx.textAlign = 'center';
        this.ctx.fillText(
            Math.round(centerYear).toString(),
            centerX,
            timelineY - this.config.sizes.currentYearPadding
        );
    }

    start() {
        if (!this.isRunning) {
            this.isRunning = true;
            this.lastFrameTime = performance.now();
            requestAnimationFrame((timestamp) => this.gameLoop(timestamp));
        }
    }

    stop() {
        this.isRunning = false;
    }

    gameLoop(timestamp) {
        if (!this.isRunning) return;

        // Calculate time since last frame
        const deltaTime = timestamp - this.lastFrameTime;

        // Only render if enough time has passed and dirty
        if (deltaTime >= this.frameInterval && this.isDirty) {
            this.render();
            this.lastFrameTime = timestamp;
        }

        // Request next frame
        requestAnimationFrame((timestamp) => this.gameLoop(timestamp));
    }
}

// Create and export the renderer instance
const displayRenderer = new DisplayRenderer();
window.displayRenderer = displayRenderer; // Make it globally accessible if needed 