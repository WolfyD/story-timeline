/**
 * relationshipVisualizer.js
 * 
 * This script handles the rendering and interaction for the relationship visualizer canvas.
 * It includes classes for character nodes, relationship connections, and layout management.
 */

// Global variables
let canvas, ctx;
let characters = [];
let connections = [];
let nodes = [];
let nodeMap = new Map();
let currentLayout = 'force'; // Default layout
let showGroupBoundaries = true;
let relationshipData = [];

let viewport = {
    x: 0,
    y: 0,
    zoom: 0.1, // Start more zoomed out
    minZoom: 0.05,
    maxZoom: 2.0
};

let dragging = false;
let lastMousePos = { x: 0, y: 0 };
let draggedNode = null;
let hoveredNode = null;
let selectedNode = null;
let selectedNodes = new Set(); // For multi-selection
let isSelecting = false;
let selectionStart = { x: 0, y: 0 };
let selectionEnd = { x: 0, y: 0 };
let ctrlPressed = false;

// Focus character and path highlighting
let focusCharacter = null;
let currentPath = null;
let pathConnections = new Set();

const nodeDistanceScale = 1.0; // Can be adjusted by user controls

// ===== Classes =====

class CharacterNode {
    constructor(character) {
        this.id = character.id;
        this.character = character;
        this.name = character.name;
        this.x = Math.random() * 1000 - 500;
        this.y = Math.random() * 1000 - 500;
        this.targetX = this.x;
        this.targetY = this.y;
        this.radius = this.calculateRadius();
        this.color = character.color || this.generateColor();
        this.image = null;
        this.imageLoaded = false;
        if (character.image_path) {
            this.loadImage(character.image_path);
        }

        // Physics properties
        this.vx = 0;
        this.vy = 0;
        this.mass = 1 + (character.importance || 5);

        // Highlighting
        this.isHighlighted = false;
        this.highlightColor = 'rgba(255, 255, 0, 0.7)';
    }

    calculateRadius() {
        return 20 + (this.character.importance || 5) * 2;
    }

    loadImage(imagePath) {
        this.image = new Image();
        this.image.src = imagePath;
        this.image.onload = () => {
            this.imageLoaded = true;
            render(); // Redraw once image is loaded
        };
        this.image.onerror = () => {
            console.error(`Failed to load image for ${this.name} at ${imagePath}`);
            this.image = null;
        };
    }

    generateColor() {
        // Simple hash function for consistent color based on name
        let hash = 0;
        for (let i = 0; i < this.name.length; i++) {
            hash = this.name.charCodeAt(i) + ((hash << 5) - hash);
        }
        let color = '#';
        for (let i = 0; i < 3; i++) {
            let value = (hash >> (i * 8)) & 0xFF;
            color += ('00' + value.toString(16)).substr(-2);
        }
        return color;
    }

    update(deltaTime) {
        // Check if this node is being dragged by user
        const isBeingDragged = (draggedNode === this);
        
        if (!isBeingDragged) {
            // For layout changes, use moderately faster spring force
            const forceStrength = 0.04; // Faster than original 0.01, but not too fast
            const forceX = (this.targetX - this.x) * forceStrength;
            const forceY = (this.targetY - this.y) * forceStrength;

            // Light damping for layout transitions
            const damping = 0.82;
            this.vx = (this.vx + forceX) * damping;
            this.vy = (this.vy + forceY) * damping;
        } else {
            // When being dragged, apply light damping to maintain momentum/inertia
            const damping = 0.92; // Higher value = more momentum/inertia
            this.vx *= damping;
            this.vy *= damping;
        }

        // Always update position based on velocity (for both dragging momentum and layout transitions)
        this.x += this.vx * deltaTime;
        this.y += this.vy * deltaTime;
    }

    draw(ctx, viewport) {
        const screenPos = this.getScreenPosition(viewport);
        const screenRadius = this.radius * viewport.zoom;

        if (screenRadius < 2) return; // Don't draw if too small to see

        // Draw highlight circle with glow effect for path nodes
        if (this.isHighlighted || selectedNode === this) {
            if (this.isPathNode) {
                // Draw glow effect for path nodes
                ctx.save();
                ctx.shadowColor = this.highlightColor;
                ctx.shadowBlur = 15 * viewport.zoom;
                ctx.beginPath();
                ctx.arc(screenPos.x, screenPos.y, screenRadius + 12 * viewport.zoom, 0, Math.PI * 2);
                ctx.fillStyle = this.highlightColor;
                ctx.fill();
                ctx.restore();
            } else {
                // Regular highlight
                ctx.beginPath();
                ctx.arc(screenPos.x, screenPos.y, screenRadius + 8 * viewport.zoom, 0, Math.PI * 2);
                ctx.fillStyle = this.highlightColor;
                ctx.fill();
            }
        }

        // Draw main node circle
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, screenRadius, 0, Math.PI * 2);

        // Image clipping
        if (this.imageLoaded && this.image) {
            ctx.save();
            ctx.clip();
            try {
                ctx.drawImage(
                    this.image,
                    screenPos.x - screenRadius,
                    screenPos.y - screenRadius,
                    screenRadius * 2,
                    screenRadius * 2
                );
            } catch (e) {
                console.error("Error drawing image:", e);
                this.image = null; // Prevent future errors
                ctx.fillStyle = this.color;
                ctx.fill();
            }
            ctx.restore();
        } else {
            ctx.fillStyle = this.color;
            ctx.fill();
        }

        // Draw border
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2 * viewport.zoom;
        ctx.stroke();

        // Draw name label
        if (viewport.zoom > 0.3) {
            ctx.fillStyle = document.body.classList.contains('dark-mode') ? '#FFF' : '#000';
            ctx.font = `${Math.max(12, 16 * viewport.zoom)}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.name, screenPos.x, screenPos.y + screenRadius + 15 * viewport.zoom);
        }
    }

    containsPoint(x, y) {
        const screenPos = this.getScreenPosition(viewport);
        const dist = Math.hypot(x - screenPos.x, y - screenPos.y);
        return dist <= this.radius * viewport.zoom;
    }

    getScreenPosition(viewport) {
        return {
            x: (this.x - viewport.x) * viewport.zoom + canvas.width / 2,
            y: (this.y - viewport.y) * viewport.zoom + canvas.height / 2
        };
    }
}

class RelationshipConnection {
    constructor(relationship, fromNode, toNode) {
        this.id = relationship.id;
        this.relationship = relationship;
        this.type = relationship.relationship_type;
        this.fromNode = fromNode;
        this.toNode = toNode;
        this.isBidirectional = relationship.is_bidirectional;

        this.color = this.getTypeColor();

        // Highlighting
        this.isHighlighted = false;
        this.highlightColor = 'rgba(255, 255, 0, 0.9)';
    }

    getTypeColor() {
        const type = this.type;
        if (this.isFamilyRelationship()) return '#D32F2F'; // Red for family
        if (type === 'friend' || type === 'best-friend' || type === 'ally') return '#388E3C'; // Green for positive
        if (type === 'enemy' || type === 'rival') return '#E64A19'; // Orange for negative
        if (type === 'romantic' || type === 'ex-romantic') return '#C2185B'; // Pink for romantic
        return '#7B1FA2'; // Purple for others
    }

    isFamilyRelationship() {
        const familyTypes = ['parent', 'child', 'sibling', 'spouse', 'partner', 'grandparent', 'grandchild', 
                           'uncle', 'aunt', 'cousin', 'nephew', 'niece', 'step-parent', 'step-child', 
                           'step-sibling', 'half-sibling', 'adoptive-parent', 'adoptive-child'];
        
        const relType = this.type || (this.relationship && this.relationship.relationship_type);
        return familyTypes.includes(relType);
    }

    draw(ctx, viewport) {
        const fromScreen = this.fromNode.getScreenPosition(viewport);
        const toScreen = this.toNode.getScreenPosition(viewport);
        
        // --- CRITICAL SAFEGUARD ---
        // Do not attempt to draw if coordinates are invalid. This prevents GPU artifacts.
        if (!fromScreen || !toScreen || 
            !isFinite(fromScreen.x) || !isFinite(fromScreen.y) ||
            !isFinite(toScreen.x) || !isFinite(toScreen.y)) {
            return; 
        }
        
        // Special handling for radiating layout
        if (currentLayout === 'radiating' && window.radiatingPaths) {
            const pathKey1 = `${this.fromNode.id}-${this.toNode.id}`;
            const pathKey2 = `${this.toNode.id}-${this.fromNode.id}`;
            if (!window.radiatingPaths.has(pathKey1) && !window.radiatingPaths.has(pathKey2)) {
                return; // Don't draw connections that are not part of the main radiating paths
            }
        }

        ctx.save();

        const lineWidth = this.isHighlighted ? (this.isPathConnection ? 6 * viewport.zoom : 4 * viewport.zoom) : 2 * viewport.zoom;
        const lineCap = 'round';
        const color = this.isHighlighted ? this.highlightColor : this.color;
        
        // Add glow effect for path connections
        if (this.isPathConnection) {
            ctx.shadowColor = color;
            ctx.shadowBlur = 10 * viewport.zoom;
        }
        
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = lineCap;

        if (this.shouldCurveAroundNodes()) {
            this.drawCurvedConnection(ctx, fromScreen, toScreen, viewport.zoom);
        } else {
            this.drawStraightConnection(ctx, fromScreen, toScreen, viewport.zoom);
        }

        // Draw relationship label only if this connection is highlighted (part of a path)
        if (viewport.zoom > 0.3 && this.isHighlighted) {
            this.drawRelationshipLabel(ctx, fromScreen, toScreen, viewport.zoom);
        }

        ctx.restore();
    }
    
    shouldCurveAroundNodes() {
        // Check if there are any nodes between the start and end points
        return this.hasObstacleNodes();
    }
    
    hasObstacleNodes() {
        const fromPos = this.fromNode.getScreenPosition(viewport);
        const toPos = this.toNode.getScreenPosition(viewport);
        const threshold = 30 * viewport.zoom; // Minimum distance to consider as obstacle
        
        for (let node of nodes) {
            if (node === this.fromNode || node === this.toNode) continue;
            
            const nodePos = node.getScreenPosition(viewport);
            const distance = this.distanceFromPointToLineSegment(
                nodePos.x, nodePos.y, 
                fromPos.x, fromPos.y, 
                toPos.x, toPos.y
            );
            
            if (distance < node.radius * viewport.zoom + threshold) {
                return true;
            }
        }
        return false;
    }

    distanceFromPointToLineSegment(px, py, x1, y1, x2, y2) {
        const l2 = Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2);
        if (l2 === 0) return Math.hypot(px - x1, py - y1);
        let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
        t = Math.max(0, Math.min(1, t));
        const
            x = x1 + t * (x2 - x1),
            y = y1 + t * (y2 - y1);
        return Math.hypot(px - x, py - y);
    }

    drawStraightConnection(ctx, fromScreen, toScreen, zoom) {
        const angle = Math.atan2(toScreen.y - fromScreen.y, toScreen.x - fromScreen.x);
        const arrowSize = Math.max(12, 18 * zoom);
        
        // Calculate arrow positions at line ends, offset by node radius
        const fromRadius = this.fromNode.radius * zoom;
        const toRadius = this.toNode.radius * zoom;
        
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        
        const startX = fromScreen.x + dx * fromRadius;
        const startY = fromScreen.y + dy * fromRadius;
        const endX = toScreen.x - dx * (toRadius + arrowSize);
        const endY = toScreen.y - dy * (toRadius + arrowSize);
        
        // Draw the line
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        if (this.isBidirectional) {
            // Arrow at end (pointing to toNode)
            this.drawArrow(ctx, endX + dx * arrowSize, endY + dy * arrowSize, angle, zoom);
            // Arrow at start (pointing to fromNode)
            const startArrowX = startX - dx * arrowSize;
            const startArrowY = startY - dy * arrowSize;
            this.drawArrow(ctx, startArrowX, startArrowY, angle + Math.PI, zoom);
        } else {
            // Single arrow at end
            this.drawArrow(ctx, endX + dx * arrowSize, endY + dy * arrowSize, angle, zoom);
        }
    }

    drawCurvedConnection(ctx, fromScreen, toScreen, zoom) {
        const
            dx = toScreen.x - fromScreen.x,
            dy = toScreen.y - fromScreen.y,
            dist = Math.hypot(dx, dy);

        // Control point for the quadratic curve
        const
            midX = (fromScreen.x + toScreen.x) / 2,
            midY = (fromScreen.y + toScreen.y) / 2,
            // Perpendicular vector
            perpX = -dy / dist,
            perpY = dx / dist;

        const curveAmount = dist * 0.2; // Adjust for more/less curve

        const
            cpX = midX + perpX * curveAmount,
            cpY = midY + perpY * curveAmount;

        // Calculate start and end points offset by node radius
        const fromRadius = this.fromNode.radius * zoom;
        const toRadius = this.toNode.radius * zoom;
        
        // Get tangent at start and end for proper offset
        const startTangentX = 2 * (cpX - fromScreen.x);
        const startTangentY = 2 * (cpY - fromScreen.y);
        const startTangentLength = Math.hypot(startTangentX, startTangentY);
        const startOffsetX = (startTangentX / startTangentLength) * fromRadius;
        const startOffsetY = (startTangentY / startTangentLength) * fromRadius;
        
        const endTangentX = 2 * (toScreen.x - cpX);
        const endTangentY = 2 * (toScreen.y - cpY);
        const endTangentLength = Math.hypot(endTangentX, endTangentY);
        const endOffsetX = (endTangentX / endTangentLength) * toRadius;
        const endOffsetY = (endTangentY / endTangentLength) * toRadius;

        const startX = fromScreen.x + startOffsetX;
        const startY = fromScreen.y + startOffsetY;
        const endX = toScreen.x - endOffsetX;
        const endY = toScreen.y - endOffsetY;

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo(cpX, cpY, endX, endY);
        ctx.stroke();

        // Arrows at curve ends
        const arrowSize = Math.max(12, 18 * zoom);
        
        if (this.isBidirectional) {
            // Arrow at end
            const endAngle = Math.atan2(endTangentY, endTangentX);
            this.drawArrow(ctx, endX, endY, endAngle, zoom);
            
            // Arrow at start
            const startAngle = Math.atan2(-startTangentY, -startTangentX);
            this.drawArrow(ctx, startX, startY, startAngle, zoom);
        } else {
            // Single arrow at end
            const endAngle = Math.atan2(endTangentY, endTangentX);
            this.drawArrow(ctx, endX, endY, endAngle, zoom);
        }
    }

    drawArrowHead(ctx, x, y, dirX, dirY, zoom) {
        const arrowSize = 10 * zoom;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - dirX * arrowSize + dirY * arrowSize / 2, y - dirY * arrowSize - dirX * arrowSize / 2);
        ctx.lineTo(x - dirX * arrowSize - dirY * arrowSize / 2, y - dirY * arrowSize + dirX * arrowSize / 2);
        ctx.closePath();
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fill();
    }
    


    drawRelationshipLabel(ctx, fromScreen, toScreen, zoom) {
        const midX = (fromScreen.x + toScreen.x) / 2;
        const midY = (fromScreen.y + toScreen.y) / 2;
        let text = this.type;
        if (this.relationship.custom_relationship_type) {
            text = this.relationship.custom_relationship_type;
        }

        // Draw background for better readability
        ctx.font = `${Math.max(10, 12 * zoom)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const textWidth = ctx.measureText(text).width;
        const padding = 4 * zoom;
        
        // Background
        ctx.fillStyle = document.body.classList.contains('dark-mode') ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.8)';
        ctx.fillRect(midX - textWidth/2 - padding, midY - 15 * zoom - 8 * zoom, textWidth + padding * 2, 16 * zoom);
        
        // Text
        ctx.fillStyle = document.body.classList.contains('dark-mode') ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.8)';
        ctx.fillText(text, midX, midY - 15 * zoom);
    }

    drawArrow(ctx, x, y, angle, zoom) {
        const arrowSize = Math.max(12, 18 * zoom);
        
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        
        if (this.type === 'romantic' || this.type === 'ex-romantic') {
            this.drawHeartArrow(ctx, arrowSize, this.type === 'ex-romantic');
        } else if (this.isFamilyRelationship()) {
            this.drawFamilyArrow(ctx, arrowSize);
        } else if (this.type === 'enemy' || this.type === 'rival') {
            this.drawHostileArrow(ctx, arrowSize);
        } else if (this.type === 'friend' || this.type === 'best-friend' || this.type === 'ally') {
            this.drawFriendlyArrow(ctx, arrowSize);
        } else {
            this.drawDefaultArrow(ctx, arrowSize);
        }
        
        ctx.restore();
    }

    drawDefaultArrow(ctx, size) {
        // Modern sleek arrow design
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-size * 0.8, -size * 0.3);
        ctx.lineTo(-size * 0.6, 0);
        ctx.lineTo(-size * 0.8, size * 0.3);
        ctx.closePath();
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fill();
        
        // Add subtle outline for better visibility
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    drawFamilyArrow(ctx, size) {
        // House-shaped arrow for family relationships
        ctx.fillStyle = ctx.strokeStyle;
        
        // Draw house shape
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-size * 0.4, -size * 0.3);
        ctx.lineTo(-size * 0.8, -size * 0.3);
        ctx.lineTo(-size, 0);
        ctx.lineTo(-size * 0.8, size * 0.3);
        ctx.lineTo(-size * 0.4, size * 0.3);
        ctx.closePath();
        ctx.fill();
        
        // Add roof triangle
        ctx.beginPath();
        ctx.moveTo(-size * 0.4, -size * 0.3);
        ctx.lineTo(-size * 0.6, -size * 0.5);
        ctx.lineTo(-size * 0.8, -size * 0.3);
        ctx.closePath();
        ctx.fill();
        
        // Add outline
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    drawFriendlyArrow(ctx, size) {
        // Smiley face arrow for friendship
        ctx.fillStyle = ctx.strokeStyle;
        
        // Draw circular base
        ctx.beginPath();
        ctx.arc(-size * 0.6, 0, size * 0.3, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw arrow point
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-size * 0.3, -size * 0.2);
        ctx.lineTo(-size * 0.3, size * 0.2);
        ctx.closePath();
        ctx.fill();
        
        // Add smiley face details
        ctx.fillStyle = 'white';
        // Eyes
        ctx.beginPath();
        ctx.arc(-size * 0.7, -size * 0.1, size * 0.05, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(-size * 0.5, -size * 0.1, size * 0.05, 0, Math.PI * 2);
        ctx.fill();
        
        // Smile
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(-size * 0.6, 0, size * 0.15, 0.2, Math.PI - 0.2);
        ctx.stroke();
    }

    drawHostileArrow(ctx, size) {
        // Lightning bolt arrow for hostile relationships
        ctx.fillStyle = ctx.strokeStyle;
        
        // Draw lightning bolt shape
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-size * 0.3, -size * 0.4);
        ctx.lineTo(-size * 0.5, -size * 0.2);
        ctx.lineTo(-size * 0.7, -size * 0.6);
        ctx.lineTo(-size, -size * 0.1);
        ctx.lineTo(-size * 0.7, 0);
        ctx.lineTo(-size * 0.5, size * 0.4);
        ctx.lineTo(-size * 0.3, size * 0.2);
        ctx.closePath();
        ctx.fill();
        
        // Add glow effect for menacing look
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 5;
        ctx.fill();
        
        // Reset shadow
        ctx.shadowBlur = 0;
        
        // Add outline
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    drawHeartArrow(ctx, size, isBroken = false) {
        const heartColor = isBroken ? '#8B4B8C' : '#E91E63';
        ctx.fillStyle = heartColor;
        
        // More refined heart shape
        ctx.beginPath();
        ctx.moveTo(0, size * 0.2);
        
        // Left lobe
        ctx.bezierCurveTo(-size * 0.3, -size * 0.2, -size * 0.6, -size * 0.2, -size * 0.6, size * 0.1);
        ctx.bezierCurveTo(-size * 0.6, size * 0.3, -size * 0.3, size * 0.5, 0, size * 0.7);
        
        // Right lobe
        ctx.bezierCurveTo(size * 0.3, size * 0.5, size * 0.6, size * 0.3, size * 0.6, size * 0.1);
        ctx.bezierCurveTo(size * 0.6, -size * 0.2, size * 0.3, -size * 0.2, 0, size * 0.2);
        
        ctx.fill();
        
        // Add shine effect
        if (!isBroken) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.beginPath();
            ctx.ellipse(-size * 0.3, size * 0.1, size * 0.15, size * 0.1, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // If broken relationship, add dramatic crack
        if (isBroken) {
            ctx.strokeStyle = '#2C2C2C';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-size * 0.2, -size * 0.1);
            ctx.lineTo(size * 0.3, size * 0.4);
            ctx.moveTo(-size * 0.3, size * 0.1);
            ctx.lineTo(size * 0.2, size * 0.5);
            ctx.stroke();
            
            // Add jagged edges to crack
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-size * 0.1, 0);
            ctx.lineTo(-size * 0.05, size * 0.05);
            ctx.lineTo(0, size * 0.1);
            ctx.lineTo(size * 0.05, size * 0.15);
            ctx.stroke();
        }
        
        // Add outline
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }
}

// ===== Layout Manager (Removed - Now using separate layout classes) =====

// ===== Initialization =====
function initializeVisualizer() {
    console.log("Initializing Relationship Visualizer");
    canvas = document.getElementById('relationship-canvas');
    if (!canvas) {
        console.error("Canvas element not found!");
        return;
    }
    ctx = canvas.getContext('2d');

    const timelineId = new URLSearchParams(window.location.search).get('timelineId');
    const focusCharacterId = new URLSearchParams(window.location.search).get('focusCharacterId');

    // Listen for filtered initialization
    window.api.receive('initialize-visualizer-filtered', (data) => {
        console.log("Received filtered initialization data:", data);
        loadFilteredData(data);
    });

    // Listen for normal initialization
    window.api.receive('initialize-visualizer', (data) => {
        console.log("Received normal initialization data:", data);
        loadData(data.timelineId, data.focusCharacterId);
    });

    // Listen for relationship updates
    window.api.receive('relationship-created', () => {
        console.log("Relationship created, refreshing canvas...");
        refreshCanvas();
    });

    window.api.receive('relationship-updated', () => {
        console.log("Relationship updated, refreshing canvas...");
        refreshCanvas();
    });

    // Fallback to URL parameters if no IPC data received
    if (timelineId) {
        loadData(timelineId, focusCharacterId);
    }
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    setupEventListeners();
    
    initializeDarkMode();

    // Start render loop
    render();
}

function initializeDarkMode() {
    const darkMode = window.api.invoke('get-setting', 'darkMode');
    darkMode.then(enabled => {
        document.body.classList.toggle('dark-mode', enabled);
        const darkModeToggle = document.getElementById('dark-mode-toggle');
        if (darkModeToggle) {
            const icon = darkModeToggle.querySelector('i');
            if (icon) {
                icon.className = enabled ? 'ri-sun-line' : 'ri-moon-line';
            }
        }
    });
}

function resizeCanvas() {
    const container = document.querySelector('.canvas-container');
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    render();
}

function setupEventListeners() {
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp); // End drag if mouse leaves
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('click', handleGlobalClick);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    // Toolbar controls
    document.getElementById('zoom-in-btn')?.addEventListener('click', zoomIn);
    document.getElementById('zoom-out-btn')?.addEventListener('click', zoomOut);
    document.getElementById('reset-view-btn')?.addEventListener('click', resetView);
    document.getElementById('center-focus-btn')?.addEventListener('click', centerOnFocus);
    document.getElementById('close-btn')?.addEventListener('click', closeWindow);
    document.getElementById('dark-mode-toggle')?.addEventListener('click', toggleDarkMode);
    
    // Distance controls
    document.getElementById('increase-distance-btn')?.addEventListener('click', increaseDistance);
    document.getElementById('decrease-distance-btn')?.addEventListener('click', decreaseDistance);
    document.getElementById('apply-layout-btn')?.addEventListener('click', applyLayout);
    
    const layoutSelect = document.getElementById('layout-select');
    if (layoutSelect) {
        // Set initial value
        layoutSelect.value = currentLayout;
        
        layoutSelect.addEventListener('change', (e) => {
            currentLayout = e.target.value;
            applyLayout();
        });
    }
    
    const searchInput = document.getElementById('search-characters');
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
    }

    const filterSelect = document.getElementById('relationship-filter');
    if (filterSelect) {
        filterSelect.addEventListener('change', handleFilter);
    }

    // Info panel close button
    const closeInfoPanel = document.getElementById('close-info-panel');
    if (closeInfoPanel) {
        closeInfoPanel.addEventListener('click', () => {
            selectCharacter(null);
        });
    }
    
    // Focus character display click
    const focusDisplay = document.getElementById('focus-character-display');
    if (focusDisplay) {
        focusDisplay.addEventListener('click', () => {
            if (focusCharacter) {
                viewport.zoom = 1.0;
                centerOnCharacter(focusCharacter);
            }
        });
    }
}

// ===== Event Handlers =====

function handleMouseDown(e) {
    if (e.button === 0) { // Left-click
        const mousePos = { x: e.offsetX, y: e.offsetY };
        const clickedNode = findCharacterAt(mousePos.x, mousePos.y);

        if (ctrlPressed && !clickedNode) {
            // Start selection rectangle
            isSelecting = true;
            selectionStart = { x: mousePos.x, y: mousePos.y };
            selectionEnd = { x: mousePos.x, y: mousePos.y };
        } else if (clickedNode) {
            draggedNode = clickedNode;
            selectCharacter(clickedNode);
        } else {
            dragging = true;
            draggedNode = null;
            if (!ctrlPressed) {
                clearMultiSelection();
            }
        }
        lastMousePos = mousePos;

        // Hide context menu
        const contextMenu = document.getElementById('context-menu');
        contextMenu.classList.add('hidden');
    }
}

function handleMouseMove(e) {
    const mousePos = { x: e.offsetX, y: e.offsetY };
    
    if (isSelecting) {
        // Update selection rectangle
        selectionEnd = { x: mousePos.x, y: mousePos.y };
    } else if (draggedNode) {
        // Dragging a node (and all selected nodes if multiple are selected)
        const dx = (mousePos.x - lastMousePos.x) / viewport.zoom;
        const dy = (mousePos.y - lastMousePos.y) / viewport.zoom;
        
        // Move the primary dragged node
        draggedNode.x += dx;
        draggedNode.y += dy;
        draggedNode.targetX = draggedNode.x;
        draggedNode.targetY = draggedNode.y;
        
        // Move all other selected nodes if multi-selection is active
        if (selectedNodes.size > 1) {
            selectedNodes.forEach(nodeId => {
                const node = nodeMap.get(nodeId);
                if (node && node !== draggedNode) {
                    node.x += dx;
                    node.y += dy;
                    node.targetX = node.x;
                    node.targetY = node.y;
                }
            });
        }
    } else if (dragging) {
        // Panning the canvas
        const dx = (mousePos.x - lastMousePos.x) / viewport.zoom;
        const dy = (mousePos.y - lastMousePos.y) / viewport.zoom;
        viewport.x -= dx;
        viewport.y -= dy;
    } else {
        // Hovering
        hoveredNode = findCharacterAt(mousePos.x, mousePos.y);
        canvas.style.cursor = ctrlPressed ? 'crosshair' : (hoveredNode ? 'pointer' : 'grab');
    }

    lastMousePos = mousePos;
}

function handleMouseUp(e) {
    if (isSelecting) {
        finishSelection();
    } else if (dragging) {
        canvas.style.cursor = ctrlPressed ? 'crosshair' : 'grab';
    }
    dragging = false;
    draggedNode = null;
    isSelecting = false;
}

function handleWheel(e) {
    e.preventDefault();
    const zoomFactor = 1.1;
    const oldZoom = viewport.zoom;

    if (e.deltaY < 0) {
        // Zoom in
        viewport.zoom = Math.min(viewport.maxZoom, viewport.zoom * zoomFactor);
    } else {
        // Zoom out
        viewport.zoom = Math.max(viewport.minZoom, viewport.zoom / zoomFactor);
    }

    // Zoom towards the mouse cursor
    const mouseX = e.offsetX;
    const mouseY = e.offsetY;
    const worldX = (mouseX - canvas.width / 2) / oldZoom + viewport.x;
    const worldY = (mouseY - canvas.height / 2) / oldZoom + viewport.y;
    
    viewport.x = worldX - (mouseX - canvas.width / 2) / viewport.zoom;
    viewport.y = worldY - (mouseY - canvas.height / 2) / viewport.zoom;
}

function handleContextMenu(e) {
    e.preventDefault();
    const mousePos = { x: e.offsetX, y: e.offsetY };
    const character = findCharacterAt(mousePos.x, mousePos.y);
    showContextMenu(e.clientX, e.clientY, character);
}

function handleGlobalClick(e) {
    const contextMenu = document.getElementById('context-menu');
    if (!contextMenu.contains(e.target)) {
        contextMenu.classList.add('hidden');
    }
}

function handleKeyDown(e) {
    if (e.key === 'Control') {
        ctrlPressed = true;
        canvas.style.cursor = 'crosshair';
    } else if (e.key === 'Escape') {
        const contextMenu = document.getElementById('context-menu');
        if (!contextMenu.classList.contains('hidden')) {
            contextMenu.classList.add('hidden');
        } else {
            selectCharacter(null); // Deselect character
            clearMultiSelection();
        }
    } else if (e.key === '+' || e.key === '=' || e.key === 'NumpadAdd') {
        // Increase distance between selected nodes
        if (selectedNodes.size >= 2) {
            adjustSelectedNodesDistance(1.1); // Increase by 10%
            e.preventDefault();
        }
    } else if (e.key === '-' || e.key === 'NumpadSubtract') {
        // Decrease distance between selected nodes
        if (selectedNodes.size >= 2) {
            adjustSelectedNodesDistance(0.9); // Decrease by 10%
            e.preventDefault();
        }
    }
}

function handleKeyUp(e) {
    if (e.key === 'Control') {
        ctrlPressed = false;
        canvas.style.cursor = hoveredNode ? 'pointer' : 'grab';
        if (isSelecting) {
            finishSelection();
        }
    }
}

// ===== Interaction Logic =====

function findCharacterAt(x, y) {
    // Iterate backwards so we find the top-most node
    for (let i = nodes.length - 1; i >= 0; i--) {
        if (nodes[i].containsPoint(x, y)) {
            return nodes[i];
        }
    }
    return null;
}

function selectCharacter(character) {
    if (selectedNode === character) return;
    
    selectedNode = character;

    // Clear previous highlights
    clearPathHighlight();

    if (character) {
        character.isHighlighted = true;
        
        // If we have a focus character and it's different from selected, show path
        if (focusCharacter && focusCharacter.id !== character.id) {
            highlightPathToCharacter(focusCharacter, character);
        } else {
            // Just highlight direct connections
            connections.forEach(conn => {
                if (conn.fromNode.id === character.id || conn.toNode.id === character.id) {
                    conn.isHighlighted = true;
                    conn.fromNode.isHighlighted = true;
                    conn.toNode.isHighlighted = true;
                }
            });
        }
    }

    updateCharacterInfoPanel();
    updateStatusBar();
}

function highlightPathToCharacter(fromChar, toChar) {
    clearPathHighlight();
    if (!fromChar || !toChar) return;

    const path = findShortestPath(fromChar, toChar);
    if (path) {
        highlightPath(path);
        updateBreadcrumb(path);
    } else {
        // If no path, just highlight direct relationship if it exists
        highlightDirectRelationship(fromChar, toChar);
    }
}

function highlightDirectRelationship(char1, char2) {
    connections.forEach(conn => {
        if ((conn.fromNode.id === char1.id && conn.toNode.id === char2.id) ||
            (conn.fromNode.id === char2.id && conn.toNode.id === char1.id)) {
            conn.isHighlighted = true;
        }
    });
}

function findShortestPath(startNode, endNode) {
    const queue = [[startNode]];
    const visited = new Set([startNode.id]);

    while (queue.length > 0) {
        const path = queue.shift();
        const lastNode = path[path.length - 1];

        if (lastNode.id === endNode.id) {
            return path;
        }

        connections.forEach(conn => {
            let neighbor = null;
            if (conn.fromNode.id === lastNode.id) neighbor = conn.toNode;
            if (conn.toNode.id === lastNode.id) neighbor = conn.fromNode;

            if (neighbor && !visited.has(neighbor.id)) {
                visited.add(neighbor.id);
                const newPath = [...path, neighbor];
                queue.push(newPath);
            }
        });
    }
    return null; // No path found
}

function highlightPath(path) {
    const pathNodeIds = new Set(path.map(n => n.id));
    currentPath = path;
    pathConnections.clear();

    nodes.forEach(n => {
        if (pathNodeIds.has(n.id)) {
            n.isHighlighted = true;
            // Special path highlighting with glow effect
            n.highlightColor = 'rgba(0, 255, 255, 0.8)'; // Cyan highlight for path
            n.isPathNode = true;
        }
    });

    for (let i = 0; i < path.length - 1; i++) {
        const node1Id = path[i].id;
        const node2Id = path[i + 1].id;
        connections.forEach(conn => {
            if ((conn.fromNode.id === node1Id && conn.toNode.id === node2Id) ||
                (conn.fromNode.id === node2Id && conn.toNode.id === node1Id)) {
                conn.isHighlighted = true;
                // Special path connection highlighting with glow
                conn.highlightColor = 'rgba(0, 255, 255, 1.0)'; // Bright cyan for path
                conn.isPathConnection = true;
                pathConnections.add(conn);
            }
        });
    }
}

function clearPathHighlight() {
    nodes.forEach(n => {
        n.isHighlighted = false;
        n.highlightColor = 'rgba(255, 255, 0, 0.7)'; // Reset to default
        n.isPathNode = false;
    });
    connections.forEach(c => {
        c.isHighlighted = false;
        c.highlightColor = 'rgba(255, 255, 0, 0.9)'; // Reset to default
        c.isPathConnection = false;
    });
    currentPath = null;
    pathConnections.clear();
    clearBreadcrumb();
}

function updateBreadcrumb(path) {
    // Store the path for canvas rendering
    currentPath = path;
}

function findRelationshipBetween(node1, node2) {
    return connections.find(conn => 
        (conn.fromNode.id === node1.id && conn.toNode.id === node2.id) ||
        (conn.fromNode.id === node2.id && conn.toNode.id === node1.id)
    );
}

function clearBreadcrumb() {
    currentPath = null;
}

function drawCanvasBreadcrumb(ctx) {
    if (!currentPath || currentPath.length < 2) return;
    
    const startX = 20;
    const startY = canvas.height - 60;
    const fontSize = 14;
    const arrowSpacing = 10;
    
    ctx.save();
    ctx.font = `${fontSize}px Arial`;
    ctx.textBaseline = 'middle';
    
    let currentX = startX;
    
    // Draw background
    const totalWidth = calculateBreadcrumbWidth(ctx, currentPath);
    ctx.fillStyle = document.body.classList.contains('dark-mode') ? 'rgba(45, 45, 45, 0.9)' : 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(startX - 10, startY - 20, totalWidth + 20, 40);
    ctx.strokeStyle = document.body.classList.contains('dark-mode') ? '#404040' : '#ccc';
    ctx.strokeRect(startX - 10, startY - 20, totalWidth + 20, 40);
    
    currentPath.forEach((node, index) => {
        // Draw character name
        ctx.fillStyle = document.body.classList.contains('dark-mode') ? '#e0e0e0' : '#333';
        ctx.fillText(node.name, currentX, startY);
        currentX += ctx.measureText(node.name).width + arrowSpacing;
        
        // Draw arrow and relationship type if not the last item
        if (index < currentPath.length - 1) {
            const nextNode = currentPath[index + 1];
            const relationship = findRelationshipBetween(node, nextNode);
            
            // Draw arrow
            ctx.fillStyle = document.body.classList.contains('dark-mode') ? '#ff6347' : '#FF4500';
            ctx.fillText('→', currentX, startY);
            currentX += ctx.measureText('→').width + arrowSpacing;
            
            // Draw relationship type below arrow
            if (relationship) {
                ctx.save();
                ctx.font = `${fontSize - 2}px Arial`;
                ctx.fillStyle = document.body.classList.contains('dark-mode') ? '#aaa' : '#666';
                const relText = relationship.type;
                const relWidth = ctx.measureText(relText).width;
                ctx.fillText(relText, currentX - ctx.measureText('→').width - arrowSpacing - relWidth/2, startY + 15);
                ctx.restore();
            }
        }
    });
    
    ctx.restore();
}

function calculateBreadcrumbWidth(ctx, path) {
    let width = 0;
    const arrowSpacing = 10;
    
    path.forEach((node, index) => {
        width += ctx.measureText(node.name).width + arrowSpacing;
        if (index < path.length - 1) {
            width += ctx.measureText('→').width + arrowSpacing;
        }
    });
    
    return width;
}

function centerOnCharacter(character) {
    if (character) {
        viewport.x = character.x;
        viewport.y = character.y;
    }
}

function centerOnFocus() {
    if (selectedNode) {
        centerOnCharacter(selectedNode);
    }
}

function zoomIn() {
    viewport.zoom = Math.min(viewport.maxZoom, viewport.zoom * 1.2);
}

function zoomOut() {
    viewport.zoom = Math.max(viewport.minZoom, viewport.zoom / 1.2);
}

function resetView() {
    viewport.x = 0;
    viewport.y = 0;
    viewport.zoom = 0.1;
}

function increaseDistance() {
    const currentScale = window.nodeDistanceScale || 1.0;
    const currentPercentage = Math.round(currentScale * 100);
    
    // Increase by 20% increments, maximum 10000%
    const newPercentage = Math.min(10000, currentPercentage + 20);
    window.nodeDistanceScale = newPercentage / 100;
    
    // Re-apply the current layout with the new distance scale
    applyLayout();
    updateDistanceDisplay();
}

function decreaseDistance() {
    const currentScale = window.nodeDistanceScale || 1.0;
    const currentPercentage = Math.round(currentScale * 100);
    
    // Decrease by 20% increments, minimum 1%
    const newPercentage = Math.max(1, currentPercentage - 20);
    window.nodeDistanceScale = newPercentage / 100;
    
    // Re-apply the current layout with the new distance scale
    applyLayout();
    updateDistanceDisplay();
}

function applyCurrentDistanceScale() {
    // This function is no longer needed since we re-apply layouts
    // The distance scaling is now handled in the layout algorithms themselves
    // by multiplying their base distances by window.nodeDistanceScale
}

function updateDistanceDisplay() {
    const distanceDisplay = document.getElementById('distance-display');
    if (distanceDisplay) {
        const scale = window.nodeDistanceScale || 1.0;
        distanceDisplay.textContent = `${Math.round(scale * 100)}%`;
    }
}

function toggleDarkMode() {
    const isDarkMode = !document.body.classList.contains('dark-mode');
    document.body.classList.toggle('dark-mode', isDarkMode);
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    if (darkModeToggle) {
        const icon = darkModeToggle.querySelector('i');
        if (icon) {
            icon.className = isDarkMode ? 'ri-sun-line' : 'ri-moon-line';
        }
    }
    window.api.send('set-setting', { key: 'darkMode', value: isDarkMode });
}

function applyLayout() {
    if (nodes.length === 0) return;
    
    showLoading(true);
    
    // Use a timeout to allow the loading screen to render before blocking the main thread
    setTimeout(() => {
        switch (currentLayout) {
            case 'force':
                ForceLayout.apply(nodes, connections);
                break;
            case 'circular':
                CircularLayout.apply(nodes);
                break;
            case 'grid':
                GridLayout.apply(nodes);
                break;
            case 'hierarchical':
                HierarchicalLayout.apply(nodes, connections, selectedNode);
                break;
            case 'family-forest':
                FamilyForestLayout.apply(nodes, connections);
                break;
            case 'radiating':
                RadiatingLayout.apply(nodes, connections, selectedNode);
                break;
        }
        showLoading(false);
    }, 50);
}

// ===== Data Handling and UI Updates =====

function handleSearch(e) {
    const query = e.target.value.toLowerCase();
    filterData(query, document.getElementById('relationship-filter').value);
}

function handleFilter(e) {
    const type = e.target.value;
    filterData(document.getElementById('search-characters').value.toLowerCase(), type);
}

function filterData(searchQuery, relationshipType) {
    nodes.forEach(n => n.isDimmed = true);
    connections.forEach(c => c.isDimmed = true);

    if (!searchQuery && !relationshipType) {
        nodes.forEach(n => n.isDimmed = false);
        connections.forEach(c => c.isDimmed = false);
        render();
        return;
    }

    const matchedNodes = new Set();

    nodes.forEach(node => {
        if (node.name.toLowerCase().includes(searchQuery)) {
            matchedNodes.add(node.id);
        }
    });

    connections.forEach(conn => {
        const typeMatch = !relationshipType || conn.type === relationshipType;
        if (typeMatch) {
            if (matchedNodes.has(conn.fromNode.id) || matchedNodes.has(conn.toNode.id)) {
                matchedNodes.add(conn.fromNode.id);
                matchedNodes.add(conn.toNode.id);
            }
        }
    });

    nodes.forEach(n => n.isDimmed = !matchedNodes.has(n.id));
    connections.forEach(c => {
        c.isDimmed = !(matchedNodes.has(c.fromNode.id) && matchedNodes.has(c.toNode.id));
    });

    render();
}

function updateStatusBar() {
    document.getElementById('character-count').textContent = `${nodes.length} characters`;
    document.getElementById('relationship-count').textContent = `${connections.length} relationships`;
    document.getElementById('view-coordinates').textContent = `View: (${Math.round(viewport.x)}, ${Math.round(viewport.y)})`;
    document.getElementById('zoom-level').textContent = `Zoom: ${Math.round(viewport.zoom * 100)}%`;
    document.getElementById('selected-info').textContent = selectedNode ? selectedNode.name : 'No selection';
}

function updateCharacterInfoPanel() {
    const panel = document.getElementById('character-info-panel');
    if (!selectedNode) {
        panel.classList.add('hidden');
        return;
    }

    panel.classList.remove('hidden');

    // Update character name
    const nameElement = document.getElementById('panel-character-name');
    if (nameElement) {
        nameElement.textContent = selectedNode.name;
    }

    // Update character details
    const detailsContainer = document.getElementById('panel-character-details');
    if (detailsContainer) {
        detailsContainer.innerHTML = `
            <div class="character-detail">
                <span class="detail-label">ID:</span>
                <span class="detail-value">${selectedNode.id}</span>
            </div>
            <div class="character-detail">
                <span class="detail-label">Race:</span>
                <span class="detail-value">${selectedNode.character.race || 'N/A'}</span>
            </div>
            <div class="character-detail">
                <span class="detail-label">Birth Year:</span>
                <span class="detail-value">${selectedNode.character.birth_year || 'Unknown'}</span>
            </div>
            <div class="character-detail">
                <span class="detail-label">Importance:</span>
                <span class="detail-value">${selectedNode.character.importance || 'N/A'}</span>
            </div>
        `;
    }
    
    // Update relationships
    const relationshipsContainer = document.getElementById('panel-relationships');
    if (relationshipsContainer) {
        const directConnections = connections.filter(c => c.fromNode.id === selectedNode.id || c.toNode.id === selectedNode.id);

        if (directConnections.length === 0) {
            relationshipsContainer.innerHTML = '<h4>Relationships</h4><p>No direct relationships.</p>';
        } else {
            let relationshipsHTML = '<h4>Relationships</h4>';
            directConnections.forEach(conn => {
                const otherNode = conn.fromNode.id === selectedNode.id ? conn.toNode : conn.fromNode;
                const direction = conn.isBidirectional ? '↔' : (conn.fromNode.id === selectedNode.id ? '→' : '←');
                
                relationshipsHTML += `
                    <div class="relationship-item" onclick="selectAndCenterCharacter('${otherNode.id}')">
                        <span class="relationship-type">${direction}</span>
                        <span class="relationship-target">${conn.type}: ${otherNode.name}</span>
                    </div>
                `;
            });
            relationshipsContainer.innerHTML = relationshipsHTML;
        }
    }
}

// Helper function for relationship clicking
function selectAndCenterCharacter(characterId) {
    const character = nodes.find(n => n.id === characterId);
    if (character) {
        selectCharacter(character);
        centerOnCharacter(character);
    }
}

// Multi-selection functions
function finishSelection() {
    const rect = getSelectionRect();
    const selectedInRect = nodes.filter(node => {
        const screenPos = node.getScreenPosition(viewport);
        return screenPos.x >= rect.left && screenPos.x <= rect.right &&
               screenPos.y >= rect.top && screenPos.y <= rect.bottom;
    });
    
    selectedNodes.clear();
    selectedInRect.forEach(node => {
        selectedNodes.add(node.id);
        node.isHighlighted = true;
    });
    
    if (selectedNodes.size > 0) {
        updateMultiSelectionInfo();
    }
}

function clearMultiSelection() {
    selectedNodes.clear();
    nodes.forEach(node => {
        if (node !== selectedNode) {
            node.isHighlighted = false;
        }
    });
}

function getSelectionRect() {
    return {
        left: Math.min(selectionStart.x, selectionEnd.x),
        right: Math.max(selectionStart.x, selectionEnd.x),
        top: Math.min(selectionStart.y, selectionEnd.y),
        bottom: Math.max(selectionStart.y, selectionEnd.y)
    };
}

function updateMultiSelectionInfo() {
    const statusRight = document.querySelector('.status-right');
    if (statusRight && selectedNodes.size > 0) {
        const selectedInfo = document.getElementById('selected-info');
        if (selectedInfo) {
            let text = `${selectedNodes.size} characters selected`;
            if (selectedNodes.size >= 2) {
                text += ' (Use +/- keys to adjust distance)';
            }
            selectedInfo.textContent = text;
        }
    }
}

function adjustSelectedNodesDistance(scaleFactor) {
    if (selectedNodes.size < 2) return;
    
    const selectedCharacters = Array.from(selectedNodes).map(id => nodeMap.get(id)).filter(n => n);
    
    // Calculate center point of selected nodes
    const centerX = selectedCharacters.reduce((sum, node) => sum + node.x, 0) / selectedCharacters.length;
    const centerY = selectedCharacters.reduce((sum, node) => sum + node.y, 0) / selectedCharacters.length;
    
    // Adjust each selected node's position relative to the center
    selectedCharacters.forEach(node => {
        const dx = node.x - centerX;
        const dy = node.y - centerY;
        
        // Scale the distance from center
        const newDx = dx * scaleFactor;
        const newDy = dy * scaleFactor;
        
        // Update both current position and target position
        node.x = centerX + newDx;
        node.y = centerY + newDy;
        node.targetX = node.x;
        node.targetY = node.y;
    });
}

function showContextMenu(x, y, character) {
    const menu = document.getElementById('context-menu');
    
    // Create context menu items if they don't exist
    if (menu.children.length === 0) {
        createContextMenuItems(menu);
    }
    
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.classList.remove('hidden');

    // Check if we have exactly 2 characters selected for relationship creation
    const hasTwoSelected = selectedNodes.size === 2;
    const selectedCharacters = Array.from(selectedNodes).map(id => nodeMap.get(id)).filter(n => n);

    // Show/hide menu items based on context
    const characterItems = menu.querySelectorAll('.character-item');
    const multiSelectItems = menu.querySelectorAll('.multi-select-item');
    
    characterItems.forEach(item => {
        item.style.display = character ? 'block' : 'none';
        item.onclick = (e) => {
            const action = e.currentTarget.dataset.action;
            switch (action) {
                case 'set-focus':
                    setFocusCharacter(character);
                    break;
                case 'edit':
                    editCharacter(character);
                    break;
                case 'delete':
                    deleteCharacter(character);
                    break;
                case 'add-relationship':
                    addRelationship(character);
                    break;
            }
            menu.classList.add('hidden');
        };
    });

    // Handle multi-select items (only show when exactly 2 characters are selected)
    multiSelectItems.forEach(item => {
        item.style.display = hasTwoSelected ? 'block' : 'none';
        item.onclick = (e) => {
            const action = e.currentTarget.dataset.action;
            switch (action) {
                case 'add-relationship-between':
                    if (selectedCharacters.length === 2) {
                        addRelationshipBetween(selectedCharacters[0], selectedCharacters[1]);
                    }
                    break;
            }
            menu.classList.add('hidden');
        };
    });

    const addCharacterItem = menu.querySelector('[data-action="add-character"]');
    if (addCharacterItem) {
        addCharacterItem.onclick = () => {
        addCharacter();
        menu.classList.add('hidden');
    };
    }
}

function createContextMenuItems(menu) {
    menu.innerHTML = `
        <div class="context-menu-item character-item" data-action="set-focus">
            <i class="ri-focus-3-line"></i>
            Set as Focus Character
        </div>
        <div class="context-menu-item character-item" data-action="edit">
            <i class="ri-edit-line"></i>
            Edit Character
        </div>
        <div class="context-menu-item character-item" data-action="add-relationship">
            <i class="ri-links-line"></i>
            Add Relationship
        </div>
        <div class="context-menu-separator character-item"></div>
        <div class="context-menu-item character-item" data-action="delete">
            <i class="ri-delete-bin-line"></i>
            Delete Character
        </div>
        <div class="context-menu-separator multi-select-item"></div>
        <div class="context-menu-item multi-select-item" data-action="add-relationship-between">
            <i class="ri-links-line"></i>
            Add Relationship Between Selected
        </div>
        <div class="context-menu-separator"></div>
        <div class="context-menu-item" data-action="add-character">
            <i class="ri-user-add-line"></i>
            Add New Character
        </div>
    `;
}

function setFocusCharacter(character) {
    if (!character) return;
    
    // Update URL without reloading
    const url = new URL(window.location);
    url.searchParams.set('focusCharacterId', character.id);
    window.history.replaceState({}, '', url.href);
    
    // Set focus character and update display
    focusCharacter = character;
    selectedNode = character;
    
    // Clear previous path highlighting
    clearPathHighlight();
    
    // Update displays
    updateFocusCharacterDisplay();
    updateCharacterInfoPanel();
    centerOnCharacter(character);
    
    // Re-highlight if another character is selected
    if (selectedNode && selectedNode !== focusCharacter) {
        highlightPathToCharacter(focusCharacter, selectedNode);
    }
}

function processRelationshipsForBidirectional(relationshipData, characters) {
    const characterMap = new Map(characters.map(c => [c.id, c]));
    const processedRels = [];
    const handledPairs = new Set();

    relationshipData.forEach(rel => {
        const key1 = `${rel.character_1_id}-${rel.character_2_id}`;
        const key2 = `${rel.character_2_id}-${rel.character_1_id}`;

        if (handledPairs.has(key1) || handledPairs.has(key2)) {
            return; // Already handled this pair
        }
        
        if (rel.is_bidirectional) {
            processedRels.push(rel);
            handledPairs.add(key1);
            handledPairs.add(key2);
        } else {
            // Check for a reverse relationship
            const reverseRel = relationshipData.find(
                r => r.character_1_id === rel.character_2_id && 
                     r.character_2_id === rel.character_1_id &&
                     !r.is_bidirectional // ensure we don't match with another non-bidirectional
            );

            if (reverseRel) {
                // Found a pair, create a synthetic bidirectional relationship for display
                const combinedRel = {
                    ...rel, // Take properties from the first one
                    id: `${rel.id}-${reverseRel.id}`,
                    relationship_type: `${rel.relationship_type} / ${reverseRel.relationship_type}`,
                    is_bidirectional: true,
                };
                processedRels.push(combinedRel);
                handledPairs.add(key1);
                handledPairs.add(key2);
            } else {
                // No reverse relationship, just add it as is
                processedRels.push(rel);
            }
        }
    });

    return processedRels;
}

async function loadData(timelineId, focusCharacterId) {
    showLoading(true);
    try {
        const characterData = await window.api.invoke('get-all-characters-for-timeline', timelineId);
        relationshipData = await window.api.invoke('get-all-character-relationships-for-timeline', timelineId);

        if (!characterData || !characterData.success || !relationshipData || !relationshipData.success) {
            console.error("Failed to load data:", 
                (characterData ? characterData.error : "characterData is undefined or null"), 
                (relationshipData ? relationshipData.error : "relationshipData is undefined or null")
            );
            showLoading(false);
            return;
        }

        nodes = characterData.characters.map(c => new CharacterNode(c));
        nodeMap = new Map(nodes.map(n => [n.id, n]));
        
        const processedRels = processRelationshipsForBidirectional(relationshipData.relationships, characterData.characters);
        
        connections = processedRels
            .map(rel => {
                const fromNode = nodeMap.get(rel.character_1_id);
                const toNode = nodeMap.get(rel.character_2_id);
                if (fromNode && toNode) {
                    return new RelationshipConnection(rel, fromNode, toNode);
                }
                return null;
            })
            .filter(c => c !== null);

        if (focusCharacterId) {
            focusCharacter = nodeMap.get(focusCharacterId);
            selectedNode = focusCharacter;
            if (focusCharacter) {
                updateCharacterInfoPanel();
                centerOnCharacter(focusCharacter);
            }
        }
        
        updateFocusCharacterDisplay();
        
        // Initialize distance scale if not set
        if (!window.nodeDistanceScale) {
            window.nodeDistanceScale = 1.0;
        }
        updateDistanceDisplay();
        applyLayout();

    } catch (error) {
        console.error("Error loading data:", error);
    } finally {
        showLoading(false);
        updateStatusBar();
    }
}

async function loadFilteredData(data) {
    showLoading(true);
    try {
        console.log("Loading filtered data:", data);
        
        // The data structure is: { timelineId, focusCharacterId, characterGroup: { success: true, group: [...] } }
        const characterGroupData = data.characterGroup;
        if (!characterGroupData || !characterGroupData.success || !Array.isArray(characterGroupData.group)) {
            console.error("Invalid character group data structure:", characterGroupData);
            showLoading(false);
            return;
        }

        const characterGroupArray = characterGroupData.group;
        console.log("Character group array:", characterGroupArray);

        // Extract characters from the group data
        const characters = characterGroupArray.map(item => item.character);
        
        // We need to get the actual relationships from the database since the group data 
        // contains relationship metadata but not the full relationship objects
        const characterIds = characters.map(c => c.id);
        
        // Get all relationships between these characters
        const relationshipData = await window.api.invoke('get-all-character-relationships-for-timeline', data.timelineId);
        
        if (!relationshipData || !relationshipData.success) {
            console.error("Failed to load relationship data:", relationshipData);
            showLoading(false);
            return;
        }
        
        // Filter relationships to only include those between characters in our group
        const filteredRelationships = relationshipData.relationships.filter(rel => 
            characterIds.includes(rel.character_1_id) && characterIds.includes(rel.character_2_id)
        );

        console.log("Filtered characters:", characters.length);
        console.log("Filtered relationships:", filteredRelationships.length);

        // Create nodes from filtered characters
        nodes = characters.map(c => new CharacterNode(c));
        nodeMap = new Map(nodes.map(n => [n.id, n]));
        
        // Process relationships
        const processedRels = processRelationshipsForBidirectional(filteredRelationships, characters);
        
        connections = processedRels
            .map(rel => {
                const fromNode = nodeMap.get(rel.character_1_id);
                const toNode = nodeMap.get(rel.character_2_id);
                if (fromNode && toNode) {
                    return new RelationshipConnection(rel, fromNode, toNode);
                }
                return null;
            })
            .filter(c => c !== null);

        // Set focus character
        if (data.focusCharacterId) {
            focusCharacter = nodeMap.get(data.focusCharacterId);
            selectedNode = focusCharacter;
            if (focusCharacter) {
                updateCharacterInfoPanel();
                centerOnCharacter(focusCharacter);
            }
        }
        
        updateFocusCharacterDisplay();
        
        // Initialize distance scale if not set
        if (!window.nodeDistanceScale) {
            window.nodeDistanceScale = 1.0;
        }
        updateDistanceDisplay();
        applyLayout();

    } catch (error) {
        console.error("Error loading filtered data:", error);
    } finally {
        showLoading(false);
        updateStatusBar();
    }
}

function updateFocusCharacterDisplay() {
    const focusDisplay = document.getElementById('focus-character-display');
    if (focusDisplay) {
        if (focusCharacter) {
            focusDisplay.textContent = `Focus: ${focusCharacter.name}`;
        } else {
            focusDisplay.textContent = 'Focus: None';
        }
    }
}

function showLoading(show) {
    const overlay = document.getElementById('loading-overlay');
    overlay.classList.toggle('hidden', !show);
}

// --- Actions from Context Menu ---

function editCharacter(characterNode) {
    window.api.send('open-edit-character-window', characterNode.character);
}

function addCharacter() {
    const timelineId = new URLSearchParams(window.location.search).get('timelineId');
    window.api.send('open-add-character-window', timelineId);
}

function addRelationship(characterNode) {
    const relationshipData = {
        character1Id: characterNode.id,
        character1Name: characterNode.name,
        timelineId: new URLSearchParams(window.location.search).get('timelineId')
    };
    window.api.send('open-relationship-editor-window', relationshipData);
}

function addRelationshipBetween(character1, character2) {
    const relationshipData = {
        character1: character1.character, // Use the full character object
        character2: character2.character, // Use the full character object
        timelineId: new URLSearchParams(window.location.search).get('timelineId'),
        isEdit: false
    };
    window.api.send('open-relationship-editor-window', relationshipData);
}

function deleteCharacter(characterNode) {
    // Confirmation dialog could be added here
    window.api.invoke('delete-character', characterNode.id).then(result => {
        if (result.success) {
            // Reload data
            const timelineId = new URLSearchParams(window.location.search).get('timelineId');
            loadData(timelineId, null);
        } else {
            console.error("Failed to delete character:", result.error);
        }
    });
}

function refreshCanvas() {
    // Store current layout and focus character
    const currentLayoutType = currentLayout;
    const currentFocusCharacter = focusCharacter;
    
    // Reload data without changing layout
    const timelineId = new URLSearchParams(window.location.search).get('timelineId');
    const focusCharacterId = currentFocusCharacter ? currentFocusCharacter.id : null;
    
    loadData(timelineId, focusCharacterId).then(() => {
        // Restore layout type (loadData might reset it)
        currentLayout = currentLayoutType;
        // Layout will be applied automatically in loadData
    });
}

function closeWindow() {
    window.close();
}

// ===== Render Loop =====

function render() {
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw layout-specific background elements
    if (currentLayout === 'family-forest') {
        drawGroupBoundaries(window.visualizerGroups || []);
    }
    if (currentLayout === 'radiating') {
        drawRadiatingRings();
    }

    // Draw connections
    connections.forEach(conn => {
        if (!conn.isDimmed) {
            conn.draw(ctx, viewport);
        }
    });

    // Draw nodes
    nodes.forEach(node => {
        if (!node.isDimmed) {
            node.update(0.1); // Simple fixed delta time
            node.draw(ctx, viewport);
        }
    });

    // Draw selection rectangle
    if (isSelecting) {
        drawSelectionRectangle();
    }
    
    // Draw canvas breadcrumb
    drawCanvasBreadcrumb(ctx);
    
    updateStatusBar();

    requestAnimationFrame(render);
}

function drawGroupBoundaries(groups) {
    if (!ctx || !groups || groups.length === 0 || !showGroupBoundaries) return;

    // Draw boundaries for each group
    groups.forEach(group => {
        if (!group.center || group.members.length < 2 || !isFinite(group.radius) || group.radius <= 0) return;

        const screenPos = worldToScreen(group.center.x, group.center.y);
        if (!isPointInViewport(screenPos, group.radius * viewport.zoom + 50)) return;

        const screenRadius = group.radius * viewport.zoom;

        ctx.save();
        if (group.type === 'family') {
            ctx.strokeStyle = 'rgba(0, 150, 255, 0.6)';
            ctx.lineWidth = 3;
            ctx.setLineDash([10, 10]);
            ctx.beginPath();
            ctx.arc(screenPos.x, screenPos.y, screenRadius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        } else if (group.type === 'acquaintance') {
            ctx.fillStyle = 'rgba(128, 128, 128, 0.15)'; // A neutral, semi-transparent fill
            ctx.beginPath();
            ctx.arc(screenPos.x, screenPos.y, screenRadius, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    });
}

function drawRadiatingRings() {
    if (currentLayout !== 'radiating' || !selectedNode) return;
    // Implementation to draw concentric circles for the radiating layout tiers
    // This is visual sugar and can be implemented if desired.
}

// Utility to convert world coordinates to screen coordinates
function worldToScreen(worldX, worldY) {
    return {
        x: (worldX - viewport.x) * viewport.zoom + canvas.width / 2,
        y: (worldY - viewport.y) * viewport.zoom + canvas.height / 2,
    };
}

// Utility to check if a point is within the visible canvas area
function isPointInViewport(point, buffer = 0) {
    return (
        point.x >= -buffer &&
        point.x <= canvas.width + buffer &&
        point.y >= -buffer &&
        point.y <= canvas.height + buffer
    );
}

function drawSelectionRectangle() {
    if (!ctx) return;
    
    const rect = getSelectionRect();
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 150, 255, 0.8)';
    ctx.fillStyle = 'rgba(0, 150, 255, 0.1)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    
    const width = rect.right - rect.left;
    const height = rect.bottom - rect.top;
    
    ctx.fillRect(rect.left, rect.top, width, height);
    ctx.strokeRect(rect.left, rect.top, width, height);
    
    ctx.restore();
}

// Entry point
document.addEventListener('DOMContentLoaded', initializeVisualizer);