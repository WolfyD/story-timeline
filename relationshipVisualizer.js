/**
 * Relationship Visualizer
 * 
 * A canvas-based interactive relationship visualization system for characters.
 * Features:
 * - Infinite 2D canvas with pan and zoom
 * - Multiple layout algorithms (force, circular, hierarchical, grid)
 * - Interactive character nodes with drag and drop
 * - Relationship connections with different styles
 * - Context menus and character info panels
 * - Search and filtering capabilities
 */

// ===== Global State =====
let canvas, ctx;
let timelineId = null;
let focusCharacterId = null;

// Viewport state
let viewport = {
    x: 0,
    y: 0,
    zoom: 1,
    width: 0,
    height: 0
};

// Data
let characters = [];
let relationships = [];
let filteredCharacters = [];
let filteredRelationships = [];

// Interaction state
let isDragging = false;
let dragTarget = null;
let lastMousePos = { x: 0, y: 0 };
let selectedCharacter = null;
let hoveredCharacter = null;
let highlightedPath = [];
let breadcrumbPath = [];

// Layout state
let currentLayout = 'force';
let layoutAnimating = false;
let animationFrame = null;
let nodeDistanceScale = 1.0;
let isDarkMode = false;

// UI elements
let contextMenu, characterInfoPanel, loadingOverlay;

// ===== Character Node Class =====
class CharacterNode {
    constructor(character) {
        this.character = character;
        this.id = character.id;
        this.name = character.name;
        this.x = Math.random() * 800 + 100;
        this.y = Math.random() * 600 + 100;
        this.targetX = this.x;
        this.targetY = this.y;
        this.vx = 0;
        this.vy = 0;
        this.radius = this.calculateRadius();
        this.color = character.color || this.generateColor();
        this.selected = false;
        this.hovered = false;
        this.isInitiating = false;
        this.connections = [];
    }

    calculateRadius() {
        const baseRadius = 25;
        const importance = this.character.importance || 5;
        return baseRadius + (importance - 5) * 3;
    }

    generateColor() {
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];
        return colors[Math.abs(this.name.charCodeAt(0)) % colors.length];
    }

    update(deltaTime) {
        // Smooth movement towards target position
        const ease = 0.1;
        this.vx += (this.targetX - this.x) * ease;
        this.vy += (this.targetY - this.y) * ease;
        
        // Apply velocity with damping
        this.vx *= 0.8;
        this.vy *= 0.8;
        
        this.x += this.vx * deltaTime;
        this.y += this.vy * deltaTime;
    }

    draw(ctx, viewport) {
        const screenX = (this.x - viewport.x) * viewport.zoom;
        const screenY = (this.y - viewport.y) * viewport.zoom;
        const screenRadius = this.radius * viewport.zoom;

        // Skip if outside viewport
        if (screenX < -screenRadius || screenX > viewport.width + screenRadius ||
            screenY < -screenRadius || screenY > viewport.height + screenRadius) {
            return;
        }

        ctx.save();

        // Draw initiating character highlight
        if (this.isInitiating) {
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(screenX, screenY, screenRadius + 8, 0, Math.PI * 2);
            ctx.stroke();
            
            // Add golden glow
            ctx.shadowColor = '#FFD700';
            ctx.shadowBlur = 20;
        }

        // Draw selection ring
        if (this.selected && !this.isInitiating) {
            ctx.strokeStyle = '#4a90e2';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(screenX, screenY, screenRadius + 5, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Draw hover effect
        if (this.hovered && !this.isInitiating) {
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 15;
        }

        // Draw character circle
        ctx.fillStyle = this.color;
        ctx.strokeStyle = this.pathHighlighted ? '#FF4500' : '#4b2e2e';
        ctx.lineWidth = this.pathHighlighted ? 3 : 2;
        ctx.beginPath();
        ctx.arc(screenX, screenY, screenRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Draw character image if available
        if (this.character.image_path) {
            // TODO: Load and draw character image
        }

        // Draw character name
        ctx.fillStyle = '#4b2e2e';
        ctx.font = `${Math.max(12, 14 * viewport.zoom)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Draw name with background for readability
        const textY = screenY + screenRadius + 20;
        const textWidth = ctx.measureText(this.name).width;
        
        ctx.fillStyle = 'rgba(255, 248, 239, 0.9)';
        ctx.fillRect(screenX - textWidth/2 - 4, textY - 8, textWidth + 8, 16);
        
        ctx.fillStyle = '#4b2e2e';
        ctx.fillText(this.name, screenX, textY);

        ctx.restore();
    }

    containsPoint(x, y) {
        const dx = x - this.x;
        const dy = y - this.y;
        return dx * dx + dy * dy <= this.radius * this.radius;
    }

    getScreenPosition(viewport) {
        return {
            x: (this.x - viewport.x) * viewport.zoom,
            y: (this.y - viewport.y) * viewport.zoom
        };
    }
}

// ===== Relationship Connection Class =====
class RelationshipConnection {
    constructor(relationship, fromNode, toNode) {
        this.relationship = relationship;
        this.fromNode = fromNode;
        this.toNode = toNode;
        this.type = relationship.relationship_type;
        this.strength = relationship.strength || 5;
        this.bidirectional = relationship.bidirectional || false;
        this.color = this.getTypeColor();
        this.width = Math.max(1, this.strength / 2);
        this.modifiers = relationship.modifiers || [];
        this.notes = relationship.notes || '';
    }

    getTypeColor() {
        const typeColors = {
            'family': '#FF6B6B',
            'romantic': '#E17055',
            'friendship': '#00B894',
            'professional': '#0984E3',
            'antagonistic': '#D63031',
            'mentor': '#A29BFE',
            'default': '#636E72'
        };
        return typeColors[this.type] || typeColors.default;
    }

    draw(ctx, viewport) {
        const fromScreen = this.fromNode.getScreenPosition(viewport);
        const toScreen = this.toNode.getScreenPosition(viewport);

        ctx.save();
        
        // Enhanced styling based on strength and highlighting
        const baseColor = this.fromNode.color || this.color;
        ctx.strokeStyle = this.pathHighlighted ? '#FF4500' : baseColor;
        
        // Width based on relationship strength (1-10 scale)
        const strengthWidth = Math.max(1, Math.min(8, this.strength));
        ctx.lineWidth = (this.pathHighlighted ? strengthWidth + 2 : strengthWidth) * viewport.zoom;
        
        ctx.globalAlpha = this.pathHighlighted ? 0.9 : 0.7;

        // Check if we need to curve the arrow to avoid nodes
        const shouldCurve = this.shouldCurveAroundNodes();
        
        if (shouldCurve) {
            this.drawCurvedConnection(ctx, fromScreen, toScreen, viewport.zoom);
        } else {
            this.drawStraightConnection(ctx, fromScreen, toScreen, viewport.zoom);
        }

        // Draw relationship type label for important relationships
        if (this.strength >= 7 || this.pathHighlighted) {
            this.drawRelationshipLabel(ctx, fromScreen, toScreen, viewport.zoom);
        }

        ctx.restore();
    }

    shouldCurveAroundNodes() {
        // Simple check: if there are other nodes near the line, curve around them
        const lineLength = Math.sqrt(
            Math.pow(this.toNode.x - this.fromNode.x, 2) + 
            Math.pow(this.toNode.y - this.fromNode.y, 2)
        );
        
        // Only curve for longer connections
        return lineLength > 150;
    }

    drawStraightConnection(ctx, fromScreen, toScreen, zoom) {
        // Calculate arrow position (offset from node edge)
        const dx = toScreen.x - fromScreen.x;
        const dy = toScreen.y - fromScreen.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length === 0) return;
        
        const unitX = dx / length;
        const unitY = dy / length;
        
        // Offset from node edges
        const fromRadius = this.fromNode.radius * zoom;
        const toRadius = this.toNode.radius * zoom;
        
        const startX = fromScreen.x + unitX * fromRadius;
        const startY = fromScreen.y + unitY * fromRadius;
        const endX = toScreen.x - unitX * toRadius;
        const endY = toScreen.y - unitY * toRadius;

        // Draw line
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // Draw arrow head
        this.drawArrowHead(ctx, endX, endY, unitX, unitY, zoom);
        
        // Draw bidirectional arrow if needed
        if (this.bidirectional) {
            this.drawArrowHead(ctx, startX, startY, -unitX, -unitY, zoom);
        }
    }

    drawCurvedConnection(ctx, fromScreen, toScreen, zoom) {
        // Calculate control point for curve
        const midX = (fromScreen.x + toScreen.x) / 2;
        const midY = (fromScreen.y + toScreen.y) / 2;
        
        // Perpendicular offset for curve
        const dx = toScreen.x - fromScreen.x;
        const dy = toScreen.y - fromScreen.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length === 0) return;
        
        // Curve offset (perpendicular to the line)
        const curveOffset = Math.min(50, length * 0.2);
        const perpX = -dy / length * curveOffset;
        const perpY = dx / length * curveOffset;
        
        const controlX = midX + perpX;
        const controlY = midY + perpY;
        
        // Calculate start and end points (offset from node edges)
        const unitX = dx / length;
        const unitY = dy / length;
        
        const fromRadius = this.fromNode.radius * zoom;
        const toRadius = this.toNode.radius * zoom;
        
        const startX = fromScreen.x + unitX * fromRadius;
        const startY = fromScreen.y + unitY * fromRadius;
        const endX = toScreen.x - unitX * toRadius;
        const endY = toScreen.y - unitY * toRadius;

        // Draw curved line
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo(controlX, controlY, endX, endY);
        ctx.stroke();

        // Calculate arrow direction at the end of the curve
        const t = 0.9; // Point near the end for direction calculation
        const curveEndX = (1-t)*(1-t)*startX + 2*(1-t)*t*controlX + t*t*endX;
        const curveEndY = (1-t)*(1-t)*startY + 2*(1-t)*t*controlY + t*t*endY;
        
        const arrowDx = endX - curveEndX;
        const arrowDy = endY - curveEndY;
        const arrowLength = Math.sqrt(arrowDx * arrowDx + arrowDy * arrowDy);
        
        if (arrowLength > 0) {
            const arrowUnitX = arrowDx / arrowLength;
            const arrowUnitY = arrowDy / arrowLength;
            this.drawArrowHead(ctx, endX, endY, arrowUnitX, arrowUnitY, zoom);
        }
        
        // Draw bidirectional arrow if needed
        if (this.bidirectional) {
            const t2 = 0.1; // Point near the start for direction calculation
            const curveStartX = (1-t2)*(1-t2)*startX + 2*(1-t2)*t2*controlX + t2*t2*endX;
            const curveStartY = (1-t2)*(1-t2)*startY + 2*(1-t2)*t2*controlY + t2*t2*endY;
            
            const arrowDx2 = startX - curveStartX;
            const arrowDy2 = startY - curveStartY;
            const arrowLength2 = Math.sqrt(arrowDx2 * arrowDx2 + arrowDy2 * arrowDy2);
            
            if (arrowLength2 > 0) {
                const arrowUnitX2 = arrowDx2 / arrowLength2;
                const arrowUnitY2 = arrowDy2 / arrowLength2;
                this.drawArrowHead(ctx, startX, startY, arrowUnitX2, arrowUnitY2, zoom);
            }
        }
    }

    drawArrowHead(ctx, x, y, dirX, dirY, zoom) {
        const arrowLength = this.bidirectional ? 18 * zoom : 15 * zoom; // Slightly larger for bidirectional
        const arrowAngle = Math.PI / 6;
        const angle = Math.atan2(dirY, dirX);

        ctx.save();
        
        // Make bidirectional arrows slightly thicker
        if (this.bidirectional) {
            ctx.lineWidth = ctx.lineWidth * 1.2;
        }

        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(
            x - arrowLength * Math.cos(angle - arrowAngle),
            y - arrowLength * Math.sin(angle - arrowAngle)
        );
        ctx.moveTo(x, y);
        ctx.lineTo(
            x - arrowLength * Math.cos(angle + arrowAngle),
            y - arrowLength * Math.sin(angle + arrowAngle)
        );
        ctx.stroke();
        
        ctx.restore();
    }

    drawRelationshipLabel(ctx, fromScreen, toScreen, zoom) {
        const midX = (fromScreen.x + toScreen.x) / 2;
        const midY = (fromScreen.y + toScreen.y) / 2;
        
        ctx.save();
        ctx.fillStyle = this.pathHighlighted ? '#FF4500' : '#4b2e2e';
        ctx.font = `${Math.max(10, 12 * zoom)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Add bidirectional indicator to text
        const text = this.bidirectional ? `↔ ${this.type}` : this.type;
        const textWidth = ctx.measureText(text).width;
        const padding = 4;
        
        // Use different background color for bidirectional relationships
        const bgColor = this.bidirectional ? 'rgba(255, 235, 200, 0.95)' : 'rgba(255, 248, 239, 0.9)';
        ctx.fillStyle = bgColor;
        ctx.fillRect(midX - textWidth/2 - padding, midY - 8, textWidth + padding*2, 16);
        
        // Use different text color for bidirectional relationships
        const textColor = this.bidirectional ? 
            (this.pathHighlighted ? '#FF4500' : '#8B4513') : 
            (this.pathHighlighted ? '#FF4500' : '#4b2e2e');
        ctx.fillStyle = textColor;
        ctx.fillText(text, midX, midY);
        
        ctx.restore();
    }

    drawArrow(ctx, from, to, zoom) {
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        const arrowLength = 15 * zoom;
        const arrowAngle = Math.PI / 6;

        const endX = to.x - Math.cos(angle) * (this.toNode.radius * zoom + 5);
        const endY = to.y - Math.sin(angle) * (this.toNode.radius * zoom + 5);

        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(
            endX - arrowLength * Math.cos(angle - arrowAngle),
            endY - arrowLength * Math.sin(angle - arrowAngle)
        );
        ctx.moveTo(endX, endY);
        ctx.lineTo(
            endX - arrowLength * Math.cos(angle + arrowAngle),
            endY - arrowLength * Math.sin(angle + arrowAngle)
        );
        ctx.stroke();
    }
}

// ===== Layout Algorithms =====
class LayoutManager {
    static applyForceLayout(nodes, connections, iterations = 100) {
        const repulsionStrength = 1000 * nodeDistanceScale;
        const attractionStrength = 0.1;
        const damping = 0.9;

        for (let iter = 0; iter < iterations; iter++) {
            // Apply repulsion between all nodes
            for (let i = 0; i < nodes.length; i++) {
                for (let j = i + 1; j < nodes.length; j++) {
                    const dx = nodes[j].x - nodes[i].x;
                    const dy = nodes[j].y - nodes[i].y;
                    const distance = Math.sqrt(dx * dx + dy * dy) || 1;
                    
                    const force = repulsionStrength / (distance * distance);
                    const fx = (dx / distance) * force;
                    const fy = (dy / distance) * force;
                    
                    nodes[i].vx -= fx;
                    nodes[i].vy -= fy;
                    nodes[j].vx += fx;
                    nodes[j].vy += fy;
                }
            }

            // Apply attraction along connections
            connections.forEach(conn => {
                const dx = conn.toNode.x - conn.fromNode.x;
                const dy = conn.toNode.y - conn.fromNode.y;
                const distance = Math.sqrt(dx * dx + dy * dy) || 1;
                
                const force = distance * attractionStrength;
                const fx = (dx / distance) * force;
                const fy = (dy / distance) * force;
                
                conn.fromNode.vx += fx;
                conn.fromNode.vy += fy;
                conn.toNode.vx -= fx;
                conn.toNode.vy -= fy;
            });

            // Update positions
            nodes.forEach(node => {
                node.x += node.vx;
                node.y += node.vy;
                node.vx *= damping;
                node.vy *= damping;
            });
        }

        // Set target positions
        nodes.forEach(node => {
            node.targetX = node.x;
            node.targetY = node.y;
        });
    }

    static applyCircularLayout(nodes, centerX = 400, centerY = 300, radius = 200) {
        const angleStep = (Math.PI * 2) / nodes.length;
        const scaledRadius = radius * nodeDistanceScale;
        
        nodes.forEach((node, index) => {
            const angle = index * angleStep;
            node.targetX = centerX + Math.cos(angle) * scaledRadius;
            node.targetY = centerY + Math.sin(angle) * scaledRadius;
        });
    }

    static applyGridLayout(nodes, cols = null) {
        if (!cols) {
            cols = Math.ceil(Math.sqrt(nodes.length));
        }
        
        const spacing = 150 * nodeDistanceScale;
        const startX = 100;
        const startY = 100;
        
        nodes.forEach((node, index) => {
            const row = Math.floor(index / cols);
            const col = index % cols;
            node.targetX = startX + col * spacing;
            node.targetY = startY + row * spacing;
        });
    }

    static applyHierarchicalLayout(nodes, connections, focusNode = null) {
        if (!focusNode && nodes.length > 0) {
            focusNode = nodes[0];
        }
        
        if (!focusNode) return;

        const levels = new Map();
        const visited = new Set();
        
        // BFS to assign levels
        const queue = [{ node: focusNode, level: 0 }];
        levels.set(focusNode.id, 0);
        visited.add(focusNode.id);
        
        while (queue.length > 0) {
            const { node, level } = queue.shift();
            
            // Find connected nodes
            connections.forEach(conn => {
                let nextNode = null;
                if (conn.fromNode === node && !visited.has(conn.toNode.id)) {
                    nextNode = conn.toNode;
                } else if (conn.toNode === node && !visited.has(conn.fromNode.id)) {
                    nextNode = conn.fromNode;
                }
                
                if (nextNode) {
                    levels.set(nextNode.id, level + 1);
                    visited.add(nextNode.id);
                    queue.push({ node: nextNode, level: level + 1 });
                }
            });
        }
        
        // Position nodes by level
        const levelGroups = new Map();
        nodes.forEach(node => {
            const level = levels.get(node.id) || 0;
            if (!levelGroups.has(level)) {
                levelGroups.set(level, []);
            }
            levelGroups.get(level).push(node);
        });
        
        const levelSpacing = 200 * nodeDistanceScale;
        const nodeSpacing = 150 * nodeDistanceScale;
        
        levelGroups.forEach((levelNodes, level) => {
            const y = 100 + level * levelSpacing;
            const totalWidth = (levelNodes.length - 1) * nodeSpacing;
            const startX = 400 - totalWidth / 2;
            
            levelNodes.forEach((node, index) => {
                node.targetX = startX + index * nodeSpacing;
                node.targetY = y;
            });
        });
    }

    static applyFamilyForestLayout(nodes, connections) {
        const familyTypes = ['parent', 'child', 'sibling', 'spouse', 'grandparent', 'grandchild', 'uncle', 'aunt', 'cousin', 'nephew', 'niece'];
        
        // Group characters into family clusters
        const familyClusters = [];
        const visited = new Set();
        
        nodes.forEach(node => {
            if (visited.has(node.id)) return;
            
            const cluster = [];
            const queue = [node];
            const clusterVisited = new Set([node.id]);
            
            while (queue.length > 0) {
                const current = queue.shift();
                cluster.push(current);
                visited.add(current.id);
                
                // Find family connections
                connections.forEach(conn => {
                    if (!familyTypes.includes(conn.type)) return;
                    
                    let nextNode = null;
                    if (conn.fromNode === current && !clusterVisited.has(conn.toNode.id)) {
                        nextNode = conn.toNode;
                    } else if (conn.toNode === current && !clusterVisited.has(conn.fromNode.id)) {
                        nextNode = conn.fromNode;
                    }
                    
                    if (nextNode) {
                        clusterVisited.add(nextNode.id);
                        queue.push(nextNode);
                    }
                });
            }
            
            if (cluster.length > 0) {
                familyClusters.push(cluster);
            }
        });
        
        // Position each family cluster
        const clusterSpacing = 300 * nodeDistanceScale;
        const nodeSpacing = 120 * nodeDistanceScale;
        let currentX = 100;
        
        familyClusters.forEach((cluster, clusterIndex) => {
            if (cluster.length === 1) {
                // Single character
                cluster[0].targetX = currentX;
                cluster[0].targetY = 300;
            } else {
                // Apply hierarchical layout within the cluster
                this.layoutFamilyCluster(cluster, connections, currentX, 100);
            }
            
            // Calculate cluster width for next cluster positioning
            const clusterWidth = Math.max(nodeSpacing * 2, cluster.length * nodeSpacing);
            currentX += clusterWidth + clusterSpacing;
        });
    }
    
    static layoutFamilyCluster(cluster, connections, startX, startY) {
        // Find the oldest generation (grandparents, etc.)
        const generations = new Map();
        const familyTypes = ['parent', 'child', 'sibling', 'spouse', 'grandparent', 'grandchild'];
        
        // Simple generation assignment based on relationship types
        cluster.forEach(node => {
            let generation = 0;
            
            connections.forEach(conn => {
                if (!familyTypes.includes(conn.type)) return;
                
                if (conn.fromNode === node) {
                    if (conn.type === 'parent') generation = Math.max(generation, 1);
                    if (conn.type === 'grandparent') generation = Math.max(generation, 2);
                } else if (conn.toNode === node) {
                    if (conn.type === 'child') generation = Math.max(generation, -1);
                    if (conn.type === 'grandchild') generation = Math.max(generation, -2);
                }
            });
            
            generations.set(node.id, generation);
        });
        
        // Group by generation
        const generationGroups = new Map();
        cluster.forEach(node => {
            const gen = generations.get(node.id) || 0;
            if (!generationGroups.has(gen)) {
                generationGroups.set(gen, []);
            }
            generationGroups.get(gen).push(node);
        });
        
        // Position nodes by generation
        const generationSpacing = 150;
        const nodeSpacing = 100;
        
        // Sort generations (oldest first)
        const sortedGenerations = Array.from(generationGroups.keys()).sort((a, b) => b - a);
        
        sortedGenerations.forEach((gen, index) => {
            const genNodes = generationGroups.get(gen);
            const y = startY + index * generationSpacing;
            const totalWidth = (genNodes.length - 1) * nodeSpacing;
            const genStartX = startX - totalWidth / 2;
            
            genNodes.forEach((node, nodeIndex) => {
                node.targetX = genStartX + nodeIndex * nodeSpacing;
                node.targetY = y;
            });
        });
    }
}

// ===== Initialization =====
function initializeVisualizer() {
    canvas = document.getElementById('relationship-canvas');
    ctx = canvas.getContext('2d');
    
    // Get UI elements
    contextMenu = document.getElementById('context-menu');
    characterInfoPanel = document.getElementById('character-info-panel');
    loadingOverlay = document.getElementById('loading-overlay');
    
    // Set up canvas
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Set up event listeners
    setupEventListeners();
    
    // Initialize viewport
    viewport.width = canvas.width;
    viewport.height = canvas.height;
    
    console.log('Relationship visualizer initialized');
}

function resizeCanvas() {
    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    viewport.width = canvas.width;
    viewport.height = canvas.height;
}

// ===== Event Handlers =====
function setupEventListeners() {
    // Canvas mouse events
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('wheel', handleWheel);
    canvas.addEventListener('contextmenu', handleContextMenu);
    
    // UI controls
    document.getElementById('zoom-in-btn').addEventListener('click', () => zoomIn());
    document.getElementById('zoom-out-btn').addEventListener('click', () => zoomOut());
    document.getElementById('reset-view-btn').addEventListener('click', () => resetView());
    document.getElementById('center-focus-btn').addEventListener('click', () => centerOnFocus());
    document.getElementById('apply-layout-btn').addEventListener('click', () => applyLayout());
    document.getElementById('close-btn').addEventListener('click', () => closeWindow());
    
    // Distance controls
    document.getElementById('increase-distance-btn').addEventListener('click', () => increaseDistance());
    document.getElementById('decrease-distance-btn').addEventListener('click', () => decreaseDistance());
    
    // Dark mode toggle
    document.getElementById('dark-mode-toggle').addEventListener('click', () => toggleDarkMode());
    
    // Layout selector
    document.getElementById('layout-select').addEventListener('change', (e) => {
        currentLayout = e.target.value;
    });
    
    // Search and filter
    document.getElementById('search-characters').addEventListener('input', handleSearch);
    document.getElementById('relationship-filter').addEventListener('change', handleFilter);
    
    // Character info panel
    document.getElementById('close-info-panel').addEventListener('click', () => {
        characterInfoPanel.classList.add('hidden');
    });
    
    // Global events
    document.addEventListener('click', handleGlobalClick);
    document.addEventListener('keydown', handleKeyDown);
}

function handleMouseDown(e) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Convert to world coordinates
    const worldX = viewport.x + mouseX / viewport.zoom;
    const worldY = viewport.y + mouseY / viewport.zoom;
    
    // Check for character selection
    const clickedCharacter = findCharacterAt(worldX, worldY);
    
    if (clickedCharacter) {
        if (e.button === 0) { // Left click
            selectCharacter(clickedCharacter);
            dragTarget = clickedCharacter;
            isDragging = true;
        }
    } else {
        // Start panning
        if (e.button === 0) {
            isDragging = true;
            dragTarget = null;
            selectedCharacter = null;
            updateCharacterInfoPanel();
        }
    }
    
    lastMousePos = { x: mouseX, y: mouseY };
    e.preventDefault();
}

function handleMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    if (isDragging) {
        const deltaX = mouseX - lastMousePos.x;
        const deltaY = mouseY - lastMousePos.y;
        
        if (dragTarget) {
            // Drag character
            dragTarget.x += deltaX / viewport.zoom;
            dragTarget.y += deltaY / viewport.zoom;
            dragTarget.targetX = dragTarget.x;
            dragTarget.targetY = dragTarget.y;
        } else {
            // Pan viewport
            viewport.x -= deltaX / viewport.zoom;
            viewport.y -= deltaY / viewport.zoom;
        }
    } else {
        // Handle hover
        const worldX = viewport.x + mouseX / viewport.zoom;
        const worldY = viewport.y + mouseY / viewport.zoom;
        
        const hoveredChar = findCharacterAt(worldX, worldY);
        
        if (hoveredChar !== hoveredCharacter) {
            if (hoveredCharacter) {
                hoveredCharacter.hovered = false;
            }
            hoveredCharacter = hoveredChar;
            if (hoveredCharacter) {
                hoveredCharacter.hovered = true;
                canvas.style.cursor = 'pointer';
            } else {
                canvas.style.cursor = 'grab';
            }
        }
    }
    
    lastMousePos = { x: mouseX, y: mouseY };
    updateStatusBar();
}

function handleMouseUp(e) {
    isDragging = false;
    dragTarget = null;
    canvas.style.cursor = hoveredCharacter ? 'pointer' : 'grab';
}

function handleWheel(e) {
    e.preventDefault();
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(5, viewport.zoom * zoomFactor));
    
    // Zoom towards mouse position
    const worldX = viewport.x + mouseX / viewport.zoom;
    const worldY = viewport.y + mouseY / viewport.zoom;
    
    viewport.zoom = newZoom;
    
    viewport.x = worldX - mouseX / viewport.zoom;
    viewport.y = worldY - mouseY / viewport.zoom;
    
    updateStatusBar();
}

function handleContextMenu(e) {
    e.preventDefault();
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const worldX = viewport.x + mouseX / viewport.zoom;
    const worldY = viewport.y + mouseY / viewport.zoom;
    
    const clickedCharacter = findCharacterAt(worldX, worldY);
    
    showContextMenu(e.clientX, e.clientY, clickedCharacter);
}

function handleGlobalClick(e) {
    // Hide context menu if clicking outside
    if (!contextMenu.contains(e.target)) {
        contextMenu.classList.add('hidden');
    }
}

function handleKeyDown(e) {
    switch (e.key) {
        case 'Escape':
            selectedCharacter = null;
            characterInfoPanel.classList.add('hidden');
            contextMenu.classList.add('hidden');
            break;
        case 'Delete':
            if (selectedCharacter) {
                // TODO: Implement character deletion
                console.log('Delete character:', selectedCharacter.name);
            }
            break;
        case 'f':
        case 'F':
            if (selectedCharacter) {
                centerOnCharacter(selectedCharacter);
            }
            break;
    }
}

// ===== Utility Functions =====
function findCharacterAt(x, y) {
    for (let i = filteredCharacters.length - 1; i >= 0; i--) {
        if (filteredCharacters[i].containsPoint(x, y)) {
            return filteredCharacters[i];
        }
    }
    return null;
}

function selectCharacter(character) {
    if (selectedCharacter) {
        selectedCharacter.selected = false;
    }
    selectedCharacter = character;
    character.selected = true;
    
    // Find path from initiating character to selected character
    const initiatingChar = characters.find(c => c.isInitiating);
    if (initiatingChar && character !== initiatingChar) {
        const path = findShortestPath(initiatingChar, character);
        highlightPath(path);
        updateBreadcrumb(path);
    } else {
        clearPathHighlight();
        clearBreadcrumb();
    }
    
    updateCharacterInfoPanel();
    updateStatusBar();
}

// ===== Path Finding =====
function findShortestPath(startNode, endNode) {
    if (startNode === endNode) return [startNode];
    
    const queue = [[startNode]];
    const visited = new Set([startNode.id]);
    
    while (queue.length > 0) {
        const path = queue.shift();
        const currentNode = path[path.length - 1];
        
        // Get connected characters
        const connections = relationships.filter(rel => 
            rel.fromNode === currentNode || rel.toNode === currentNode
        );
        
        for (const connection of connections) {
            const nextNode = connection.fromNode === currentNode ? connection.toNode : connection.fromNode;
            
            if (nextNode === endNode) {
                return [...path, nextNode];
            }
            
            if (!visited.has(nextNode.id)) {
                visited.add(nextNode.id);
                queue.push([...path, nextNode]);
            }
        }
    }
    
    return []; // No path found
}

function highlightPath(path) {
    // Clear previous highlights
    clearPathHighlight();
    
    if (path.length < 2) return;
    
    // Highlight characters in path
    path.forEach(char => {
        if (!char.isInitiating) {
            char.pathHighlighted = true;
        }
    });
    
    // Highlight relationships in path
    for (let i = 0; i < path.length - 1; i++) {
        const fromChar = path[i];
        const toChar = path[i + 1];
        
        const connection = relationships.find(rel => 
            (rel.fromNode === fromChar && rel.toNode === toChar) ||
            (rel.fromNode === toChar && rel.toNode === fromChar)
        );
        
        if (connection) {
            connection.pathHighlighted = true;
        }
    }
    
    highlightedPath = path;
}

function clearPathHighlight() {
    characters.forEach(char => char.pathHighlighted = false);
    relationships.forEach(rel => rel.pathHighlighted = false);
    highlightedPath = [];
}

function updateBreadcrumb(path) {
    const breadcrumbElement = document.getElementById('breadcrumb-path');
    if (path.length > 1) {
        const breadcrumbText = path.map(char => char.name).join(' → ');
        breadcrumbElement.textContent = breadcrumbText;
        breadcrumbElement.style.display = 'block';
    } else {
        clearBreadcrumb();
    }
    breadcrumbPath = path;
}

function clearBreadcrumb() {
    const breadcrumbElement = document.getElementById('breadcrumb-path');
    breadcrumbElement.textContent = '';
    breadcrumbElement.style.display = 'none';
    breadcrumbPath = [];
}

function centerOnCharacter(character) {
    viewport.x = character.x - viewport.width / (2 * viewport.zoom);
    viewport.y = character.y - viewport.height / (2 * viewport.zoom);
}

function centerOnFocus() {
    if (focusCharacterId) {
        const focusChar = filteredCharacters.find(c => c.id === focusCharacterId);
        if (focusChar) {
            centerOnCharacter(focusChar);
        }
    }
}

function zoomIn() {
    viewport.zoom = Math.min(5, viewport.zoom * 1.2);
    updateStatusBar();
}

function zoomOut() {
    viewport.zoom = Math.max(0.1, viewport.zoom / 1.2);
    updateStatusBar();
}

function resetView() {
    viewport.x = 0;
    viewport.y = 0;
    viewport.zoom = 1;
    updateStatusBar();
}

function increaseDistance() {
    nodeDistanceScale = Math.min(3.0, nodeDistanceScale + 0.2);
    updateDistanceDisplay();
    applyLayout();
}

function decreaseDistance() {
    nodeDistanceScale = Math.max(0.2, nodeDistanceScale - 0.2);
    updateDistanceDisplay();
    applyLayout();
}

function updateDistanceDisplay() {
    const percentage = Math.round(nodeDistanceScale * 100);
    document.getElementById('distance-display').textContent = `${percentage}%`;
}

function toggleDarkMode() {
    isDarkMode = !isDarkMode;
    document.body.classList.toggle('dark-mode', isDarkMode);
    
    // Update the icon
    const icon = document.querySelector('#dark-mode-toggle i');
    if (isDarkMode) {
        icon.className = 'ri-sun-line';
    } else {
        icon.className = 'ri-moon-line';
    }
}

function applyLayout() {
    const layoutSelect = document.getElementById('layout-select');
    const layout = layoutSelect.value;
    
            switch (layout) {
        case 'force':
            LayoutManager.applyForceLayout(filteredCharacters, filteredRelationships);
            break;
        case 'circular':
            LayoutManager.applyCircularLayout(filteredCharacters, 400, 300, 200);
            break;
        case 'grid':
            LayoutManager.applyGridLayout(filteredCharacters);
            break;
        case 'hierarchical':
            const focusNode = focusCharacterId ? 
                filteredCharacters.find(c => c.id === focusCharacterId) : null;
            LayoutManager.applyHierarchicalLayout(filteredCharacters, filteredRelationships, focusNode);
            break;
        case 'family-forest':
            LayoutManager.applyFamilyForestLayout(filteredCharacters, filteredRelationships);
            break;
    }
}

function handleSearch(e) {
    const query = e.target.value.toLowerCase();
    filterData(query, document.getElementById('relationship-filter').value);
}

function handleFilter(e) {
    const relationshipType = e.target.value;
    const searchQuery = document.getElementById('search-characters').value.toLowerCase();
    filterData(searchQuery, relationshipType);
}

function filterData(searchQuery, relationshipType) {
    // Filter characters
    filteredCharacters = characters.filter(char => {
        return !searchQuery || char.name.toLowerCase().includes(searchQuery);
    });
    
    // Filter relationships
    filteredRelationships = relationships.filter(rel => {
        let typeMatch = true;
        
        if (relationshipType !== 'all') {
            // Map relationship types to categories
            const relType = rel.type.toLowerCase();
            switch (relationshipType) {
                case 'family':
                    typeMatch = ['parent', 'child', 'sibling', 'spouse', 'grandparent', 'grandchild', 
                               'uncle', 'aunt', 'cousin', 'nephew', 'niece'].some(t => relType.includes(t));
                    break;
                case 'romantic':
                    typeMatch = ['spouse', 'partner', 'lover', 'romantic', 'boyfriend', 'girlfriend', 
                               'husband', 'wife'].some(t => relType.includes(t));
                    break;
                case 'friendship':
                    typeMatch = ['friend', 'ally', 'companion', 'buddy', 'pal'].some(t => relType.includes(t));
                    break;
                case 'professional':
                    typeMatch = ['colleague', 'boss', 'employee', 'mentor', 'student', 'teacher', 
                               'coworker', 'business'].some(t => relType.includes(t));
                    break;
                case 'antagonistic':
                    typeMatch = ['enemy', 'rival', 'antagonist', 'opponent', 'foe', 'nemesis'].some(t => relType.includes(t));
                    break;
                default:
                    typeMatch = rel.type === relationshipType;
            }
        }
        
        const charMatch = filteredCharacters.some(c => c.id === rel.fromNode.id) &&
                         filteredCharacters.some(c => c.id === rel.toNode.id);
        return typeMatch && charMatch;
    });
    
    updateStatusBar();
}

// ===== UI Updates =====
function updateStatusBar() {
    document.getElementById('character-count').textContent = `${filteredCharacters.length} characters`;
    document.getElementById('relationship-count').textContent = `${filteredRelationships.length} relationships`;
    document.getElementById('view-coordinates').textContent = `View: (${Math.round(viewport.x)}, ${Math.round(viewport.y)})`;
    document.getElementById('zoom-level').textContent = `Zoom: ${Math.round(viewport.zoom * 100)}%`;
    
    if (selectedCharacter) {
        document.getElementById('selected-info').textContent = `Selected: ${selectedCharacter.name}`;
    } else {
        document.getElementById('selected-info').textContent = 'No selection';
    }
}

function updateCharacterInfoPanel() {
    if (!selectedCharacter) {
        characterInfoPanel.classList.add('hidden');
        return;
    }
    
    const char = selectedCharacter.character;
    
    document.getElementById('panel-character-name').textContent = char.name;
    
    const detailsDiv = document.getElementById('panel-character-details');
    detailsDiv.innerHTML = `
        <div class="character-detail">
            <div class="detail-label">Race:</div>
            <div class="detail-value">${char.race || 'Unknown'}</div>
        </div>
        <div class="character-detail">
            <div class="detail-label">Importance:</div>
            <div class="detail-value">${char.importance || 5}/10</div>
        </div>
        <div class="character-detail">
            <div class="detail-label">Birth Year:</div>
            <div class="detail-value">${char.birth_year || 'Unknown'}</div>
        </div>
        <div class="character-detail">
            <div class="detail-label">Description:</div>
            <div class="detail-value">${char.description || 'No description available'}</div>
        </div>
    `;
    
    // Show relationships
    const relationshipsDiv = document.getElementById('panel-relationships');
    const charRelationships = relationships.filter(rel => 
        rel.fromNode.id === char.id || rel.toNode.id === char.id
    );
    
    if (charRelationships.length > 0) {
        relationshipsDiv.innerHTML = '<h4>Relationships</h4>' + 
            charRelationships.map(rel => {
                const otherChar = rel.fromNode.id === char.id ? rel.toNode : rel.fromNode;
                const bidirectionalIndicator = rel.bidirectional ? ' ↔' : '';
                const strengthIndicator = rel.strength ? ` (${rel.strength}/10)` : '';
                return `
                    <div class="relationship-item">
                        <div class="relationship-type">${rel.type}${bidirectionalIndicator}${strengthIndicator}</div>
                        <div class="relationship-target">${otherChar.name}</div>
                        ${rel.notes ? `<div class="relationship-notes">${rel.notes}</div>` : ''}
                    </div>
                `;
            }).join('');
    } else {
        relationshipsDiv.innerHTML = '<h4>Relationships</h4><p>No relationships found</p>';
    }
    
    characterInfoPanel.classList.remove('hidden');
}

function showContextMenu(x, y, character) {
    const menuItems = [];
    
    if (character) {
        menuItems.push(
            { icon: 'ri-information-line', text: 'View Details', action: () => selectCharacter(character) },
            { icon: 'ri-edit-line', text: 'Edit Character', action: () => editCharacter(character) },
            { icon: 'ri-focus-3-line', text: 'Center on Character', action: () => centerOnCharacter(character) },
            { separator: true },
            { icon: 'ri-links-line', text: 'Add Relationship', action: () => addRelationship(character) },
            { separator: true },
            { icon: 'ri-delete-bin-line', text: 'Delete Character', action: () => deleteCharacter(character) }
        );
    } else {
        menuItems.push(
            { icon: 'ri-add-line', text: 'Add Character', action: () => addCharacter() },
            { separator: true },
            { icon: 'ri-refresh-line', text: 'Apply Layout', action: () => applyLayout() },
            { icon: 'ri-focus-3-line', text: 'Reset View', action: () => resetView() }
        );
    }
    
    contextMenu.innerHTML = menuItems.map(item => {
        if (item.separator) {
            return '<div class="context-menu-separator"></div>';
        }
        return `
            <div class="context-menu-item" data-action="${item.text}">
                <i class="${item.icon}"></i>
                ${item.text}
            </div>
        `;
    }).join('');
    
    // Add click handlers
    contextMenu.querySelectorAll('.context-menu-item').forEach((item, index) => {
        const menuItem = menuItems.filter(m => !m.separator)[index];
        if (menuItem) {
            item.addEventListener('click', () => {
                menuItem.action();
                contextMenu.classList.add('hidden');
            });
        }
    });
    
    contextMenu.style.left = `${x}px`;
    contextMenu.style.top = `${y}px`;
    contextMenu.classList.remove('hidden');
}

// ===== Relationship Processing =====
function processRelationshipsForBidirectional(relationshipData, characters) {
    const relationshipMap = new Map();
    const processedRelationships = [];
    
    // First pass: create a map of all relationships by character pairs
    relationshipData.forEach(rel => {
        const char1 = rel.character_1_id;
        const char2 = rel.character_2_id;
        
        // Create a consistent key for the character pair (smaller ID first)
        const pairKey = char1 < char2 ? `${char1}-${char2}` : `${char2}-${char1}`;
        
        if (!relationshipMap.has(pairKey)) {
            relationshipMap.set(pairKey, []);
        }
        relationshipMap.get(pairKey).push(rel);
    });
    
    // Second pass: process relationships and detect bidirectional ones
    const processedPairs = new Set();
    
    relationshipData.forEach(rel => {
        const char1 = rel.character_1_id;
        const char2 = rel.character_2_id;
        const pairKey = char1 < char2 ? `${char1}-${char2}` : `${char2}-${char1}`;
        
        // Skip if we've already processed this pair
        if (processedPairs.has(pairKey)) {
            return;
        }
        
        const fromNode = characters.find(c => c.id === char1);
        const toNode = characters.find(c => c.id === char2);
        
        if (!fromNode || !toNode) {
            return;
        }
        
        const pairRelationships = relationshipMap.get(pairKey);
        
        // Check if there are relationships in both directions
        const forwardRel = pairRelationships.find(r => r.character_1_id === char1 && r.character_2_id === char2);
        const reverseRel = pairRelationships.find(r => r.character_1_id === char2 && r.character_2_id === char1);
        
        if (forwardRel && reverseRel) {
            // Bidirectional relationship - create one connection with bidirectional flag
            const primaryRel = forwardRel; // Use the first one as primary
            primaryRel.bidirectional = true;
            
            // Combine notes if both have them
            if (reverseRel.notes && forwardRel.notes !== reverseRel.notes) {
                primaryRel.notes = `${forwardRel.notes} | ${reverseRel.notes}`;
            } else if (reverseRel.notes && !forwardRel.notes) {
                primaryRel.notes = reverseRel.notes;
            }
            
            // Use the higher strength if different
            if (reverseRel.strength && reverseRel.strength > (forwardRel.strength || 0)) {
                primaryRel.strength = reverseRel.strength;
            }
            
            processedRelationships.push(new RelationshipConnection(primaryRel, fromNode, toNode));
        } else {
            // Unidirectional relationship(s)
            pairRelationships.forEach(singleRel => {
                const relFromNode = characters.find(c => c.id === singleRel.character_1_id);
                const relToNode = characters.find(c => c.id === singleRel.character_2_id);
                
                if (relFromNode && relToNode) {
                    singleRel.bidirectional = false;
                    processedRelationships.push(new RelationshipConnection(singleRel, relFromNode, relToNode));
                }
            });
        }
        
        processedPairs.add(pairKey);
    });
    
    return processedRelationships;
}

// ===== Data Loading =====
async function loadData(timelineId, focusCharacterId) {
    showLoading(true);
    
    try {
        if (focusCharacterId) {
            // Load character group for focused character
            const groupResult = await window.api.invoke('get-character-group', focusCharacterId, {});
            if (groupResult.success) {
                // Extract characters from the group result
                const groupCharacters = groupResult.group.map(item => item.character);
                characters = groupCharacters.map(char => new CharacterNode(char));
                
                // Set the focus character as initiating node
                const focusNode = characters.find(c => c.id === focusCharacterId);
                if (focusNode) {
                    focusNode.isInitiating = true;
                    focusNode.selected = true;
                    selectedCharacter = focusNode;
                    document.getElementById('focus-character-display').textContent = `Focus: ${focusNode.name}`;
                    centerOnCharacter(focusNode);
                }
                
                // Load relationships between these characters
                const relationshipsResult = await window.api.invoke('get-all-character-relationships', timelineId);
                if (relationshipsResult.success) {
                    // Filter relationships to only include characters in our group
                    const characterIds = new Set(characters.map(c => c.id));
                    const filteredRelationships = relationshipsResult.relationships
                        .filter(rel => characterIds.has(rel.character_1_id) && characterIds.has(rel.character_2_id));
                    
                    // Process relationships and detect bidirectional ones
                    relationships = processRelationshipsForBidirectional(filteredRelationships, characters);
                }
            }
        } else {
            // Fallback to loading all characters if no focus
            const charactersResult = await window.api.invoke('get-all-characters', timelineId);
            if (charactersResult.success) {
                characters = charactersResult.characters.map(char => new CharacterNode(char));
            }
            
            const relationshipsResult = await window.api.invoke('get-all-character-relationships', timelineId);
            if (relationshipsResult.success) {
                // Process relationships and detect bidirectional ones
                relationships = processRelationshipsForBidirectional(relationshipsResult.relationships, characters);
            }
        }
        
        // Set initial filtered data
        filteredCharacters = [...characters];
        filteredRelationships = [...relationships];
        
        // Initialize distance display
        updateDistanceDisplay();
        
        // Apply initial layout
        applyLayout();
        updateStatusBar();
        
    } catch (error) {
        console.error('Error loading data:', error);
    } finally {
        showLoading(false);
    }
}

function showLoading(show) {
    if (show) {
        loadingOverlay.classList.remove('hidden');
    } else {
        loadingOverlay.classList.add('hidden');
    }
}

// ===== Character Actions =====
function editCharacter(characterNode) {
    window.api.send('open-edit-character-window', characterNode.character);
}

function addCharacter() {
    window.api.send('open-add-character-window', timelineId);
}

function addRelationship(characterNode) {
    // TODO: Implement relationship creation
    console.log('Add relationship for:', characterNode.name);
}

function deleteCharacter(characterNode) {
    // TODO: Implement character deletion
    console.log('Delete character:', characterNode.name);
}

function closeWindow() {
    window.close();
}

// ===== Render Loop =====
function render() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Update character positions
    filteredCharacters.forEach(char => char.update(1/60));
    
    // Draw relationships first (behind characters)
    filteredRelationships.forEach(rel => rel.draw(ctx, viewport));
    
    // Draw characters
    filteredCharacters.forEach(char => char.draw(ctx, viewport));
    
    // Continue animation loop
    animationFrame = requestAnimationFrame(render);
}

// ===== IPC Handlers =====
window.api.receive('initialize-visualizer', (data) => {
    timelineId = data.timelineId;
    focusCharacterId = data.focusCharacterId;
    
    loadData(timelineId, focusCharacterId);
});

// ===== Initialization =====
document.addEventListener('DOMContentLoaded', () => {
    initializeVisualizer();
    render();
});

// Cleanup on window close
window.addEventListener('beforeunload', () => {
    if (animationFrame) {
        cancelAnimationFrame(animationFrame);
    }
}); 