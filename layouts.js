/**
 * layouts.js
 * 
 * Separate layout classes for the relationship visualizer.
 * This modular approach prevents breaking functionality during fixes.
 */

// Base Layout Class
class BaseLayout {
    constructor() {
        this.name = 'base';
    }

    static isFamilyRelationshipType(relType) {
        const familyTypes = ['parent', 'child', 'sibling', 'spouse', 'partner', 'grandparent', 'grandchild', 'uncle', 'aunt', 'cousin', 'nephew', 'niece'];
        return familyTypes.includes(relType);
    }
    
    static isRomanticRelationshipType(relType) {
        const romanticTypes = ['romantic', 'ex-romantic'];
        return romanticTypes.includes(relType);
    }
}

// Force Layout Class
class ForceLayout extends BaseLayout {
    constructor() {
        super();
        this.name = 'force';
    }

    static apply(nodes, connections, iterations = 100) {
        const canvas = document.getElementById('relationship-canvas');
        if (!canvas) return;

        const distanceScale = window.nodeDistanceScale || 1.0;
        const k = Math.sqrt(canvas.width * canvas.height / nodes.length) * distanceScale; // Optimal distance with scaling
        const stiffness = 0.05; // Spring stiffness
        const repulsion = 0.2; // Repulsion strength
        const damping = 0.9; // Damping factor

        for (let i = 0; i < iterations; i++) {
            // Calculate repulsive forces
            for (const node1 of nodes) {
                node1.dx = 0;
                node1.dy = 0;
                for (const node2 of nodes) {
                    if (node1 !== node2) {
                        const dx = node1.x - node2.x;
                        const dy = node1.y - node2.y;
                        const distance = Math.hypot(dx, dy) || 1;
                        const force = (k * k * repulsion) / distance;
                        node1.dx += (dx / distance) * force;
                        node1.dy += (dy / distance) * force;
                    }
                }
            }

            // Calculate attractive forces (springs)
            for (const conn of connections) {
                const source = conn.fromNode;
                const target = conn.toNode;
                const dx = target.x - source.x;
                const dy = target.y - source.y;
                const distance = Math.hypot(dx, dy) || 1;
                const force = (distance - k) * stiffness;
                const fx = (dx / distance) * force;
                const fy = (dy / distance) * force;
                source.dx += fx;
                target.dx -= fx;
                source.dy += fy;
                target.dy -= fy;
            }

            // Apply forces
            for (const node of nodes) {
                node.x += node.dx * damping;
                node.y += node.dy * damping;
                node.targetX = node.x;
                node.targetY = node.y;
            }
        }
    }
}

// Circular Layout Class
class CircularLayout extends BaseLayout {
    constructor() {
        super();
        this.name = 'circular';
    }

    static apply(nodes, centerX = 0, centerY = 0, radius = 200) {
        const distanceScale = window.nodeDistanceScale || 1.0;
        const scaledRadius = radius * distanceScale;
        const angleStep = (2 * Math.PI) / nodes.length;
        nodes.forEach((node, index) => {
            node.targetX = centerX + scaledRadius * Math.cos(angleStep * index);
            node.targetY = centerY + scaledRadius * Math.sin(angleStep * index);
        });
    }
}

// Grid Layout Class
class GridLayout extends BaseLayout {
    constructor() {
        super();
        this.name = 'grid';
    }

    static apply(nodes, cols = null) {
        const distanceScale = window.nodeDistanceScale || 1.0;
        const numNodes = nodes.length;
        if (!cols) {
            cols = Math.ceil(Math.sqrt(numNodes));
        }
        const rows = Math.ceil(numNodes / cols);
        const cellWidth = 150 * distanceScale;
        const cellHeight = 150 * distanceScale;

        nodes.forEach((node, index) => {
            const row = Math.floor(index / cols);
            const col = index % cols;
            node.targetX = col * cellWidth;
            node.targetY = row * cellHeight;
        });
    }
}

// Hierarchical Layout Class
class HierarchicalLayout extends BaseLayout {
    constructor() {
        super();
        this.name = 'hierarchical';
    }

    static apply(nodes, connections, focusNode = null) {
        if (!focusNode && nodes.length > 0) {
            focusNode = nodes[0];
        }
        if (!focusNode) return;

        const { characterRanks } = this.calculateCharacterRanks(nodes, connections, focusNode);
        const tiers = this.groupRanksIntoTiers(characterRanks, nodes);
        this.positionCharactersByTiers(nodes, tiers, connections);
    }
    
    static calculateCharacterRanks(nodes, connections, focusNode) {
        const characterRanks = new Map();
        
        // Focus character gets maximum rank
        if (focusNode) {
            characterRanks.set(focusNode.id, 999999999);
        }
        
        // Calculate ranks for all other characters
        nodes.forEach(node => {
            if (node.id === focusNode?.id) return; // Skip focus character
            
            let rank = 0;
            let directConnectionToFocus = false;
            
            // Count all relationships for this character
            connections.forEach(conn => {
                let isThisCharacter = false;
                let otherCharacter = null;
                let relationshipType = conn.type;
                let importance = 1; // Default importance if not specified
                
                if (conn.fromNode.id === node.id) {
                    isThisCharacter = true;
                    otherCharacter = conn.toNode;
                    importance = conn.relationship?.importance || 1;
                } else if (conn.toNode.id === node.id) {
                    isThisCharacter = true;
                    otherCharacter = conn.fromNode;
                    importance = conn.relationship?.importance || 1;
                }
                
                if (isThisCharacter) {
                    // Check if this is a direct connection to focus character
                    if (otherCharacter.id === focusNode?.id) {
                        directConnectionToFocus = true;
                    }
                    
                    // Base relationship value = 1
                    let relationshipValue = 1;
                    
                    // Apply relationship type multipliers
                    if (this.isFamilyRelationshipType(relationshipType)) {
                        relationshipValue *= 3; // Family x3
                    } else if (this.isRomanticRelationshipType(relationshipType)) {
                        relationshipValue *= 2; // Romantic x2
                    }
                    // Other relationships stay x1
                    
                    // Multiply by importance (1-100 scale)
                    relationshipValue *= Math.max(1, Math.min(100, importance));
                    
                    rank += relationshipValue;
                }
            });
            
            // Apply 2x multiplier for direct connection to focus character
            if (directConnectionToFocus) {
                rank *= 2;
            }
            
            characterRanks.set(node.id, rank);
        });
        
        // Handle disconnected characters (no relationships)
        nodes.forEach(node => {
            if (!characterRanks.has(node.id)) {
                characterRanks.set(node.id, 0); // Minimum rank for disconnected characters
            }
        });

        return { characterRanks };
    }

    static groupRanksIntoTiers(characterRanks, nodes) {
        // Separate focus character from others
        const focusNodes = [];
        const regularNodes = [];
        
        nodes.forEach(node => {
            const rank = characterRanks.get(node.id);
            if (rank === 999999999) {
                focusNodes.push(node);
            } else {
                regularNodes.push({ node, rank });
            }
        });
        
        if (regularNodes.length === 0) {
            return focusNodes.length > 0 ? [focusNodes] : [];
        }
        
        // Extract ranks for clustering (excluding focus character)
        const ranks = regularNodes.map(item => item.rank).filter(r => r > 0);
        
        if (ranks.length === 0) {
            // Only disconnected characters and focus
            const tiers = [];
            if (focusNodes.length > 0) tiers.push(focusNodes);
            if (regularNodes.length > 0) tiers.push(regularNodes.map(item => item.node));
            return tiers;
        }
        
        // Determine optimal number of tiers (5-15 range)
        const maxTiers = Math.min(15, Math.max(5, Math.ceil(ranks.length / 3)));
        const numTiers = Math.min(maxTiers, ranks.length);
        
        // Use Jenks Natural Breaks for smart clustering
        const breaks = this.jenksNaturalBreaks(ranks.sort((a, b) => b - a), numTiers); // Sort descending for hierarchy
        
        // Create tiers array
        const tiers = [];
        
        // Add focus character tier first (highest priority)
        if (focusNodes.length > 0) {
            tiers.push(focusNodes);
        }
        
        // Group regular nodes into tiers based on breaks
        const tierGroups = Array.from({ length: numTiers }, () => []);
        
        regularNodes.forEach(({ node, rank }) => {
            if (rank === 0) {
                // Handle disconnected characters separately (lowest tier)
                return;
            }
            
            // Find appropriate tier based on rank
            let tierIndex = 0;
            for (let i = 0; i < breaks.length; i++) {
                if (rank >= breaks[i]) {
                    tierIndex = i;
                    break;
                }
            }
            tierGroups[tierIndex].push(node);
        });
        
        // Add non-empty tier groups to tiers (in descending rank order)
        tierGroups.forEach(group => {
            if (group.length > 0) {
                tiers.push(group);
            }
        });
        
        // Add disconnected characters as the lowest tier
        const disconnectedNodes = regularNodes.filter(item => item.rank === 0).map(item => item.node);
        if (disconnectedNodes.length > 0) {
            tiers.push(disconnectedNodes);
        }
        
        return tiers;
    }

    static jenksNaturalBreaks(data, numClasses) {
        if (data.length <= numClasses) {
            // If we have fewer data points than classes, return each unique value as a break
            return [...new Set(data)].sort((a, b) => b - a);
        }
        
        // Ensure data is sorted in descending order for hierarchical display
        data.sort((a, b) => b - a);
        
        const n = data.length;
        const matrices = {
            lower: Array(n + 1).fill(0).map(() => Array(numClasses + 1).fill(0)),
            variance: Array(n + 1).fill(0).map(() => Array(numClasses + 1).fill(0)),
        };

        // Initialize first class
        for (let i = 1; i <= n; i++) {
            matrices.lower[i][1] = 1;
            matrices.variance[i][1] = 0;
            
            // Calculate variance for single class containing elements 0 to i-1
            if (i > 1) {
                const slice = data.slice(0, i);
                const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
                matrices.variance[i][1] = slice.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0);
            }
        }

        // Fill matrices for multiple classes
        for (let j = 2; j <= numClasses; j++) {
            for (let i = j; i <= n; i++) {
                let minVariance = Infinity;
                let bestK = 0;
                
                for (let k = j - 1; k < i; k++) {
                    // Calculate sum of squared deviations for elements k to i-1
                    const slice = data.slice(k, i);
                    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
                    const ssm = slice.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0);
                    
                    const totalVariance = matrices.variance[k][j - 1] + ssm;
                    if (totalVariance < minVariance) {
                        minVariance = totalVariance;
                        bestK = k;
                    }
                }
                
                matrices.variance[i][j] = minVariance;
                matrices.lower[i][j] = bestK + 1;
            }
        }

        // Extract break points
        const breaks = [];
        let k = n;
        for (let j = numClasses; j > 1; j--) {
            const breakIndex = matrices.lower[k][j] - 1;
            if (breakIndex > 0 && breakIndex < data.length) {
                breaks.unshift(data[breakIndex]);
            }
            k = matrices.lower[k][j] - 1;
        }
        
        // Add the highest value as the first break
        if (breaks.length > 0 && breaks[0] !== data[0]) {
            breaks.unshift(data[0]);
        }
        
        return breaks;
    }

    static positionCharactersByTiers(nodes, tiers, connections) {
        const nodeDistanceScale = window.nodeDistanceScale || 1.0;
        const tierSpacing = 180 * nodeDistanceScale; // Increased spacing for better hierarchy visibility
        const nodeSpacing = 140 * nodeDistanceScale; // Increased horizontal spacing
        
        const centerX = 0;
        let currentY = -(tiers.length - 1) * tierSpacing / 2; // Center the entire hierarchy vertically

        tiers.forEach((tier, tierIndex) => {
            if (tier.length === 0) return;

            // Sort nodes within tier by importance and name for consistent positioning
            tier.sort((a, b) => {
                const importanceA = a.character.importance || 5;
                const importanceB = b.character.importance || 5;
                if (importanceA !== importanceB) {
                    return importanceB - importanceA; // Higher importance first
                }
                return a.name.localeCompare(b.name); // Then alphabetical
            });

            // Special handling for focus character tier (should be centered and prominent)
            if (tierIndex === 0 && tier.length === 1 && tier[0].character.importance === undefined) {
                // This is likely the focus character tier
                tier[0].targetX = centerX;
                tier[0].targetY = currentY;
            } else {
                // Calculate total width needed for this tier
                const totalWidth = Math.max(0, (tier.length - 1) * nodeSpacing);
                let currentX = centerX - totalWidth / 2;

                tier.forEach((node, nodeIndex) => {
                    node.targetX = currentX;
                    node.targetY = currentY;
                    currentX += nodeSpacing;
                });
            }

            currentY += tierSpacing;
        });

        // Apply fine-tuning to reduce overlaps and improve readability
        this.optimizeHierarchicalPositions(nodes, tiers, connections, nodeSpacing, tierSpacing);
    }

    static optimizeHierarchicalPositions(nodes, tiers, connections, nodeSpacing, tierSpacing) {
        // Fine-tune positions to avoid overlaps and improve visual flow
        tiers.forEach((tier, tierIndex) => {
            if (tier.length <= 1) return;

            // Adjust positions based on connections to previous tier (if exists)
            if (tierIndex > 0) {
                const previousTier = tiers[tierIndex - 1];
                this.alignWithConnectedNodes(tier, previousTier, connections, nodeSpacing);
            }

            // Check for nodes that might be too close due to varying name lengths or importance
            for (let i = 0; i < tier.length - 1; i++) {
                const node1 = tier[i];
                const node2 = tier[i + 1];
                const minDistance = Math.max(nodeSpacing, (node1.name.length + node2.name.length) * 8);
                
                const currentDistance = Math.abs(node2.targetX - node1.targetX);
                if (currentDistance < minDistance) {
                    const adjustment = (minDistance - currentDistance) / 2;
                    node1.targetX -= adjustment;
                    node2.targetX += adjustment;
                }
            }
        });
    }

    static alignWithConnectedNodes(currentTier, previousTier, connections, nodeSpacing) {
        // Create a map of connections between tiers
        const tierConnections = new Map();
        
        currentTier.forEach(node => {
            const connectedParents = [];
            connections.forEach(conn => {
                if (conn.fromNode.id === node.id && previousTier.includes(conn.toNode)) {
                    connectedParents.push(conn.toNode);
                } else if (conn.toNode.id === node.id && previousTier.includes(conn.fromNode)) {
                    connectedParents.push(conn.fromNode);
                }
            });
            tierConnections.set(node.id, connectedParents);
        });

        // Try to position nodes closer to their connected parents
        currentTier.forEach(node => {
            const connectedParents = tierConnections.get(node.id) || [];
            if (connectedParents.length > 0) {
                // Calculate the average X position of connected parents
                const avgParentX = connectedParents.reduce((sum, parent) => sum + parent.targetX, 0) / connectedParents.length;
                
                // Adjust node position towards the average parent position, but maintain minimum spacing
                const currentIndex = currentTier.indexOf(node);
                const leftNeighbor = currentIndex > 0 ? currentTier[currentIndex - 1] : null;
                const rightNeighbor = currentIndex < currentTier.length - 1 ? currentTier[currentIndex + 1] : null;
                
                let newX = avgParentX;
                
                // Ensure minimum spacing with neighbors
                if (leftNeighbor) {
                    newX = Math.max(newX, leftNeighbor.targetX + nodeSpacing * 0.8);
                }
                if (rightNeighbor) {
                    newX = Math.min(newX, rightNeighbor.targetX - nodeSpacing * 0.8);
                }
                
                // Apply a weighted adjustment (don't move too drastically)
                const weight = 0.6; // How much to move towards connected parents
                node.targetX = node.targetX * (1 - weight) + newX * weight;
            }
        });

        // Final pass to ensure no overlaps
        for (let i = 1; i < currentTier.length; i++) {
            const prevNode = currentTier[i - 1];
            const currentNode = currentTier[i];
            const minDistance = nodeSpacing * 0.8;
            
            if (currentNode.targetX - prevNode.targetX < minDistance) {
                currentNode.targetX = prevNode.targetX + minDistance;
            }
        }
    }
}

// Radiating Layout Class
class RadiatingLayout extends BaseLayout {
    constructor() {
        super();
        this.name = 'radiating';
    }

    static apply(nodes, connections, focusNode = null) {
        console.log('Starting Radiating layout...');
        if (!focusNode && nodes.length > 0) {
            focusNode = nodes[0];
        }
        if (!focusNode) return;

        const rings = this.findLongestPaths(focusNode, nodes, connections);
        const centerX = 0;
        const centerY = 0;
        let currentRadius = 0;
        
        // This will hold the nodes of the previously placed ring to inform grouping
        let previousRingNodes = null;

        const distanceScale = window.nodeDistanceScale || 1.0;
        
        rings.forEach((ring, index) => {
            const ringRadius = (150 + (ring.nodes.length * 5)) * distanceScale; // Base radius + per-node spacing, scaled
            currentRadius += ringRadius;

            if (index === 0) {
                // Center the focus node
                focusNode.targetX = centerX;
                focusNode.targetY = centerY;
            } else {
                // Position subsequent rings
                // Use the grouped positioning for more structure
                this.positionRingGrouped(ring.nodes, previousRingNodes, centerX, centerY, currentRadius, connections);
            }
            
            previousRingNodes = ring.nodes;
        });

        // Store paths for highlighting connections
        window.radiatingPaths = new Set();
        rings.forEach(ring => {
            ring.paths.forEach(path => {
                for (let i = 0; i < path.length - 1; i++) {
                    const key1 = `${path[i]}-${path[i+1]}`;
                    const key2 = `${path[i+1]}-${path[i]}`;
                    window.radiatingPaths.add(key1);
                    window.radiatingPaths.add(key2);
                }
            });
        });
    }
    
    static findLongestPaths(focusNode, nodes, connections) {
        const nodeMap = new Map(nodes.map(n => [n.id, n]));
        const distances = new Map();
        const paths = new Map();
        nodes.forEach(node => {
            distances.set(node.id, Infinity);
            paths.set(node.id, []);
        });

        distances.set(focusNode.id, 0);
        paths.set(focusNode.id, [focusNode.id]);
        
        // Using a simplified Bellman-Ford-like approach to find longest paths (by edge count)
        // In an unweighted graph, this is equivalent to a BFS.
        const queue = [focusNode];
        const visited = new Set([focusNode.id]);

        while(queue.length > 0) {
            const u = queue.shift();
            
            connections.forEach(conn => {
                let v = null;
                if (conn.fromNode.id === u.id && !visited.has(conn.toNode.id)) {
                    v = conn.toNode;
                } else if (conn.toNode.id === u.id && !visited.has(conn.fromNode.id)) {
                    v = conn.fromNode;
                }

                if (v) {
                    visited.add(v.id);
                    // In our case, we just count edges, so distance increases by 1
                    distances.set(v.id, distances.get(u.id) + 1);
                    const newPath = [...paths.get(u.id), v.id];
                    paths.set(v.id, newPath);
                    queue.push(v);
                }
            });
        }
        
        // Group nodes by their distance (ring index)
        const rings = [];
        distances.forEach((dist, nodeId) => {
            if (dist !== Infinity) {
                while (rings.length <= dist) {
                    rings.push({ nodes: [], paths: [] });
                }
                const node = nodeMap.get(nodeId);
                if (node) {
                    rings[dist].nodes.push(node);
                    rings[dist].paths.push(paths.get(nodeId));
                }
            }
        });
        
        return rings;
    }
    
    static positionRingEvenly(ringNodes, centerX, centerY, radius) {
        const angleStep = (2 * Math.PI) / ringNodes.length;
        ringNodes.forEach((node, index) => {
            const angle = angleStep * index;
            node.targetX = centerX + radius * Math.cos(angle);
            node.targetY = centerY + radius * Math.sin(angle);
        });
    }

    static positionRingGrouped(ringNodes, previousRingNodes, centerX, centerY, radius, connections) {
        if (!previousRingNodes || previousRingNodes.length === 0) {
            // If there's no previous ring, position evenly
            this.positionRingEvenly(ringNodes, centerX, centerY, radius);
            return;
        }

        const nodeMap = new Map();
        // Create clusters based on connections to the previous ring
        const clusters = new Map();
        previousRingNodes.forEach(pNode => {
            clusters.set(pNode.id, []);
            nodeMap.set(pNode.id, pNode);
        });

        ringNodes.forEach(cNode => {
            let parentInRing = null;
            // Find which node in the previous ring this node connects to
            for (const conn of connections) {
                const p1 = conn.fromNode.id;
                const p2 = conn.toNode.id;
                if ((p1 === cNode.id && clusters.has(p2))) {
                    parentInRing = nodeMap.get(p2);
                    break;
                }
                if ((p2 === cNode.id && clusters.has(p1))) {
                    parentInRing = nodeMap.get(p1);
                    break;
                }
            }
            if (parentInRing) {
                clusters.get(parentInRing.id).push(cNode);
            }
        });

        // Position clusters
        const angleStep = (2 * Math.PI) / previousRingNodes.length;
        previousRingNodes.forEach((pNode, index) => {
            const children = clusters.get(pNode.id);
            if (children && children.length > 0) {
                const parentAngle = angleStep * index;
                
                if (children.length === 1) {
                    // Place single child directly out
                    children[0].targetX = centerX + radius * Math.cos(parentAngle);
                    children[0].targetY = centerY + radius * Math.sin(parentAngle);
                } else {
                    // Arc children around the parent's angle
                    const arcAngle = Math.PI / (children.length + 1) / 8; // Small arc
                    children.forEach((child, cIndex) => {
                        const childAngle = parentAngle + (cIndex - (children.length - 1) / 2) * arcAngle;
                        child.targetX = centerX + radius * Math.cos(childAngle);
                        child.targetY = centerY + radius * Math.sin(childAngle);
                    });
                }
            }
        });
    }
}

// Family Forest Layout Class
class FamilyForestLayout extends BaseLayout {
    constructor() {
        super();
        this.name = 'family-forest';
    }

    static apply(nodes, connections) {
        console.log("=== NEW HIERARCHICAL FAMILY FOREST LAYOUT ===");
        console.log(`Input: ${nodes.length} nodes, ${connections.length} connections`);

        // --- Step 1: Identify Groups ---
        console.log('Identifying groups...');
        const familyTypes = ['parent', 'child', 'sibling', 'spouse', 'partner', 'grandparent', 'grandchild', 'uncle', 'aunt', 'cousin', 'nephew', 'niece', 'step-parent', 'step-child', 'step-sibling', 'half-sibling', 'adoptive-parent', 'adoptive-child'];
        const familyGroups = this.identifyFamilyGroups(nodes, connections, familyTypes);
        const acquaintanceGroups = this.identifyAcquaintanceGroups(nodes, connections, familyTypes, 2);
        const individuals = this.identifySmallGroups(nodes, connections, familyTypes);
        console.log(`Groups identified: ${familyGroups.length} family, ${acquaintanceGroups.length} acquaintance, ${individuals.length} individual.`);

        // This will store the final positions and radii of all placed groups
        const placedGroups = [];

        // --- Step 2 & 3: Position and Adjust Family Groups ---
        this.positionMajorGroups(familyGroups, placedGroups, null, 'family', connections);
        this.adjustGroupSpacing(placedGroups, 2, 50); // Adjust spacing (2 units)

        // --- Step 4 & 5: Position and Adjust Acquaintance Groups ---
        this.positionMajorGroups(acquaintanceGroups, placedGroups, familyGroups, 'acquaintance', connections);
        this.adjustGroupSpacing(placedGroups, 2, 50); // Readjust all spacing

        // --- Step 6: Position Individuals ---
        this.positionIndividuals(individuals, placedGroups, connections);
        this.adjustGroupSpacing(placedGroups, 1.5, 50); // Final adjustment

        // --- Final Layout Within Groups ---
        // Apply the layout for members within each group based on their final center positions.
        console.log("Applying final layout within groups...");
        placedGroups.forEach(group => {
            const centerX = group.center.x;
            const centerY = group.center.y;
            const layoutMethod = group.type === 'family' ? this.layoutTightGroup : (group.type === 'acquaintance' ? this.layoutLooseGroup : this.layoutSmallGroup);
            layoutMethod.call(this, group.members, connections, centerX, centerY, group.type);
        });
        
        window.visualizerGroups = placedGroups;
        console.log("Layout calculation complete.");
    }

    static identifyFamilyGroups(nodes, connections, familyTypes) {
        const groups = [];
        const visited = new Set();

        for (const node of nodes) {
            if (!visited.has(node.id)) {
                const group = {
                    members: [],
                    connections: []
                };
                const queue = [node];
                visited.add(node.id);

                while (queue.length > 0) {
                    const currentNode = queue.shift();
                    group.members.push(currentNode);

                    connections.forEach(conn => {
                        const relType = conn.relationship.relationship_type;
                        if (familyTypes.includes(relType)) {
                            let neighborNode = null;
                            if (conn.fromNode.id === currentNode.id) {
                                neighborNode = conn.toNode;
                            } else if (conn.toNode.id === currentNode.id) {
                                neighborNode = conn.fromNode;
                            }

                            if (neighborNode && !visited.has(neighborNode.id)) {
                                visited.add(neighborNode.id);
                                queue.push(neighborNode);
                            }
                        }
                    });
                }
                if (group.members.length > 1) {
                    groups.push(group);
                }
            }
        }
        return groups;
    }

    static identifyAcquaintanceGroups(nodes, connections, familyTypes, minSize) {
        const familyNodes = new Set();
        this.identifyFamilyGroups(nodes, connections, familyTypes).forEach(g => g.members.forEach(m => familyNodes.add(m.id)));

        const groups = [];
        const visited = new Set(familyNodes);

        for (const node of nodes) {
            if (!visited.has(node.id)) {
                const group = {
                    members: []
                };
                const queue = [node];
                visited.add(node.id);

                while (queue.length > 0) {
                    const currentNode = queue.shift();
                    group.members.push(currentNode);

                    connections.forEach(conn => {
                        const relType = conn.relationship.relationship_type;
                        if (!familyTypes.includes(relType)) {
                             let neighborNode = null;
                            if (conn.fromNode.id === currentNode.id) {
                                neighborNode = conn.toNode;
                            } else if (conn.toNode.id === currentNode.id) {
                                neighborNode = conn.fromNode;
                            }

                            if (neighborNode && !visited.has(neighborNode.id)) {
                                visited.add(neighborNode.id);
                                queue.push(neighborNode);
                            }
                        }
                    });
                }
                if (group.members.length >= minSize) {
                    groups.push(group);
                }
            }
        }
        return groups;
    }

    static identifySmallGroups(nodes, connections, familyTypes) {
        const groupedNodes = new Set();
        this.identifyFamilyGroups(nodes, connections, familyTypes).forEach(g => g.members.forEach(m => groupedNodes.add(m.id)));
        this.identifyAcquaintanceGroups(nodes, connections, familyTypes, 2).forEach(g => g.members.forEach(m => groupedNodes.add(m.id)));

        const smallGroups = [];
        const remainingNodes = nodes.filter(n => !groupedNodes.has(n.id));
        
        remainingNodes.forEach(node => {
            smallGroups.push({ members: [node] });
        });

        return smallGroups;
    }

    static calculateGroupLayoutRadius(members, groupType) {
        if (!members || members.length === 0) return 0;
        const nodeDistanceScale = window.nodeDistanceScale || 1.0;
        const baseRadius = 30; // Base radius for a single node.
        
        let spacing;
        if (groupType === 'family') {
            spacing = 70 * nodeDistanceScale;
        } else if (groupType === 'acquaintance') {
            spacing = 100 * nodeDistanceScale;
        } else {
            spacing = 60 * nodeDistanceScale;
        }

        // Estimate based on area: Area = N * pi * r_node^2. Then find radius of circle with that area.
        // A more direct approach: assume they form a rough circle, circumference is N * spacing.
        const circumference = members.length * spacing;
        const radius = circumference / (2 * Math.PI);
        return Math.max(baseRadius, radius) + 30; // Add padding
    }
    
    static positionMajorGroups(groupsToPlace, placedGroups, anchorGroups, groupType, connections) {
        console.log(`Positioning ${groupsToPlace.length} ${groupType} groups.`);
        groupsToPlace.sort((a, b) => b.members.length - a.members.length); // Place largest groups first

        groupsToPlace.forEach((group, index) => {
            const groupRadius = this.calculateGroupLayoutRadius(group.members, groupType);
            const unit = groupRadius * 2; // Diameter is the unit, as requested.
            let position;
            let anchorPoint = { x: 0, y: 0 };
            let gapMultiplier = 5;

            if (placedGroups.length === 0) {
                // Place the first group at the center
                position = { x: 0, y: 0 };
            } else {
                if (groupType === 'acquaintance' && anchorGroups && anchorGroups.length > 0) {
                    // Find the best family group to anchor to
                    const bestAnchor = this.findMostConnectedGroup(group, placedGroups.filter(g => g.type === 'family'), connections);
                    if (bestAnchor) {
                        anchorPoint = bestAnchor.center;
                        gapMultiplier = 2; // Place acquaintances closer to their anchor families
                    }
                } else {
                    // Default anchor for families is the last placed group to create a chain
                    anchorPoint = placedGroups[placedGroups.length - 1].center;
                }
                
                // Find a position using spiral logic
                position = this.findSpiralPosition(anchorPoint, groupRadius, placedGroups, gapMultiplier * unit);
            }
            
            placedGroups.push({
                ...group,
                center: position,
                radius: groupRadius,
                type: groupType
            });
        });
    }

    static positionIndividuals(individualsToPlace, placedGroups, connections) {
        console.log(`Positioning ${individualsToPlace.length} individuals/small groups.`);
        individualsToPlace.forEach(individualGroup => {
            const groupRadius = this.calculateGroupLayoutRadius(individualGroup.members, 'individual');
            let position;

            const bestAnchor = this.findMostConnectedGroup(individualGroup, placedGroups, connections);
            const anchorPoint = bestAnchor ? bestAnchor.center : { x: 0, y: 0 };
            const unit = bestAnchor ? bestAnchor.radius * 2 : 100;

            // Place individuals closer to their most connected group
            position = this.findSpiralPosition(anchorPoint, groupRadius, placedGroups, unit * 1.5);

            placedGroups.push({
                ...individualGroup,
                center: position,
                radius: groupRadius,
                type: 'individual'
            });
        });
    }
    
    static findMostConnectedGroup(group, potentialAnchors, connections) {
        let bestAnchor = null;
        let maxConnections = 0;

        const groupMemberIds = new Set(group.members.map(m => m.character.id));

        potentialAnchors.forEach(anchor => {
            let currentConnections = 0;
            const anchorMemberIds = new Set(anchor.members.map(m => m.character.id));

            connections.forEach(conn => {
                const rel = conn.relationship;
                if (!rel) return; // Safeguard

                const c1InGroup = groupMemberIds.has(rel.character_1_id);
                const c2InAnchor = anchorMemberIds.has(rel.character_2_id);
                const c2InGroup = groupMemberIds.has(rel.character_2_id);
                const c1InAnchor = anchorMemberIds.has(rel.character_1_id);

                if ((c1InGroup && c2InAnchor) || (c2InGroup && c1InAnchor)) {
                    currentConnections++;
                }
            });

            if (currentConnections > maxConnections) {
                maxConnections = currentConnections;
                bestAnchor = anchor;
            }
        });

        return bestAnchor;
    }

    static findSpiralPosition(startPoint, newGroupRadius, placedGroups, minGap) {
        let angle = Math.random() * 2 * Math.PI;
        let distance = minGap; // Start at the minimum distance
        let position = { x: 0, y: 0 };
        let attempts = 0;

        while (attempts < 500) { // Safety break
            position.x = startPoint.x + Math.cos(angle) * distance;
            position.y = startPoint.y + Math.sin(angle) * distance;

            let overlaps = false;
            for (const existingGroup of placedGroups) {
                const distBetweenCenters = Math.hypot(position.x - existingGroup.center.x, position.y - existingGroup.center.y);
                if (distBetweenCenters < existingGroup.radius + newGroupRadius + minGap) {
                    overlaps = true;
                    break;
                }
            }

            if (!overlaps) {
                return position;
            }

            // Increase angle and distance to spiral outwards
            angle += Math.PI / 8; 
            distance += 10;
            attempts++;
        }
        console.warn("Could not find a non-overlapping position after 500 attempts. Placing at last attempted position.");
        return position; // Fallback
    }
    
    static adjustGroupSpacing(allGroups, unitMultiplier, iterations) {
        if (!allGroups || allGroups.length < 2) return;
        console.log(`Adjusting spacing for ${allGroups.length} groups over ${iterations} iterations.`);
        for (let i = 0; i < iterations; i++) {
            for (let j = 0; j < allGroups.length; j++) {
                for (let k = j + 1; k < allGroups.length; k++) {
                    const groupA = allGroups[j];
                    const groupB = allGroups[k];

                    const dx = groupB.center.x - groupA.center.x;
                    const dy = groupB.center.y - groupA.center.y;
                    const distance = Math.hypot(dx, dy) || 1; // Avoid division by zero

                    const unitA = groupA.radius * 2;
                    const desiredGap = unitMultiplier * unitA;
                    const minDistance = groupA.radius + groupB.radius + desiredGap;

                    if (distance < minDistance) {
                        const overlap = minDistance - distance;
                        const adjustX = (dx / distance) * overlap * 0.2; // Adjust by a factor
                        const adjustY = (dy / distance) * overlap * 0.2;

                        groupA.center.x -= adjustX;
                        groupA.center.y -= adjustY;
                        groupB.center.x += adjustX;
                        groupB.center.y += adjustY;
                    }
                }
            }
        }
    }

    static layoutTightGroup(members, connections, centerX, centerY, groupType) {
        // More robust, simplified hierarchical layout for family groups
        const nodeDistanceScale = window.nodeDistanceScale || 1.0;
        const parentChildDist = 100 * nodeDistanceScale; // Increased from 60
        const siblingDist = 80 * nodeDistanceScale; // Increased from 40

        // Find root nodes (no parents in this group)
        const memberIds = new Set(members.map(m => m.id));
        const childrenIds = new Set();
        connections.forEach(conn => {
            if (memberIds.has(conn.fromNode.id) && memberIds.has(conn.toNode.id)) {
                if (['child', 'adoptive-child', 'step-child'].includes(conn.relationship.relationship_type)) {
                    childrenIds.add(conn.fromNode.id); // fromNode is the child
                } else if (['parent', 'adoptive-parent', 'step-parent'].includes(conn.relationship.relationship_type)) {
                    childrenIds.add(conn.toNode.id); // toNode is the child
                }
            }
        });
        
        const roots = members.filter(m => !childrenIds.has(m.id));
        if (roots.length === 0 && members.length > 0) {
            // Fallback for cycles or all-child groups: pick the oldest or first as root
            roots.push(members.reduce((a, b) => (a.character.birth_year < b.character.birth_year ? a : b)));
        }

        const processed = new Set();
        let currentY = centerY;

        function positionNodes(nodes, x, y) {
            const totalWidth = (nodes.length - 1) * siblingDist;
            let currentX = x - totalWidth / 2;
            nodes.forEach(node => {
                if (!processed.has(node.id)) {
                    node.targetX = currentX;
                    node.targetY = y;
                    processed.add(node.id);
                    currentX += siblingDist;

                    // Find and position children of this node
                    const children = [];
                    connections.forEach(conn => {
                        if (conn.fromNode.id === node.id && ['parent', 'adoptive-parent', 'step-parent'].includes(conn.relationship.relationship_type) && memberIds.has(conn.toNode.id)) {
                             children.push(conn.toNode);
                        } else if (conn.toNode.id === node.id && ['child', 'adoptive-child', 'step-child'].includes(conn.relationship.relationship_type) && memberIds.has(conn.fromNode.id)) {
                            children.push(conn.fromNode);
                        }
                    });

                    if (children.length > 0) {
                        positionNodes(children, node.targetX, y + parentChildDist);
                    }
                }
            });
        }
        
        positionNodes(roots, centerX, currentY);

        // Position any remaining orphan nodes
        const orphans = members.filter(m => !processed.has(m.id));
        if (orphans.length > 0) {
            console.log("Positioning orphan nodes in tight group:", orphans.map(o=>o.name));
            let currentX = centerX - (orphans.length - 1) * siblingDist / 2;
            const y = centerY + parentChildDist * 2; // Place them below
             orphans.forEach(node => {
                node.targetX = currentX;
                node.targetY = y;
                currentX += siblingDist;
            });
        }

        this.adjustSpousePositions(members, connections, centerX, centerY);
    }
    
    static layoutLooseGroup(members, connections, centerX, centerY, groupType) {
        const nodeDistanceScale = window.nodeDistanceScale || 1.0;
        // Acquaintance members: Increased spacing
        const unitSize = 80;
        const acquaintanceSpacing = unitSize * 2.0 * nodeDistanceScale; // Slightly reduced spacing
        const maxRadius = Math.max(acquaintanceSpacing * 1.2, acquaintanceSpacing * members.length / (2 * Math.PI));

        this.randomPlacementWithConstraints(members, centerX, centerY, maxRadius, acquaintanceSpacing);
    }
    
    static layoutSmallGroup(members, connections, centerX, centerY) {
        const nodeDistanceScale = window.nodeDistanceScale || 1.0;
        // Small groups (1-2 members): tight placement
        const smallGroupSpacing = 60 * nodeDistanceScale;
        const maxRadius = members.length > 1 ? smallGroupSpacing : 0;
        this.randomPlacementWithConstraints(members, centerX, centerY, maxRadius, smallGroupSpacing);
    }

    static adjustSpousePositions(members, connections, centerX, centerY) {
        const spousePairs = new Set();

        // Find all spouse/partner pairs in the group
        connections.forEach(conn => {
            if (['spouse', 'partner'].includes(conn.relationship.relationship_type)) {
                const id1 = conn.fromNode.id;
                const id2 = conn.toNode.id;
                // Check if both members of the pair are in the current group
                if (members.find(m => m.id === id1) && members.find(m => m.id === id2)) {
                    // Create a unique key for the pair to avoid duplicates
                    const key = [id1, id2].sort().join('-');
                    spousePairs.add(key);
                }
            }
        });

        // Adjust positions for each pair
        spousePairs.forEach(key => {
            const [id1, id2] = key.split('-');
            const node1 = members.find(m => m.id === id1);
            const node2 = members.find(m => m.id === id2);

            if (node1 && node2) {
                // Average their y-positions to align them horizontally
                const avgY = (node1.targetY + node2.targetY) / 2;
                node1.targetY = avgY;
                node2.targetY = avgY;

                // Position them next to each other horizontally
                const spacing = 80 * (window.nodeDistanceScale || 1.0); // Increased from 40
                const avgX = (node1.targetX + node2.targetX) / 2;
                node1.targetX = avgX - spacing / 2;
                node2.targetX = avgX + spacing / 2;
            }
        });
    }

    static randomPlacementWithConstraints(members, centerX, centerY, maxRadius, minSpacing) {
        if (!members || members.length === 0) return;

        // Use Poisson-disc sampling for a more organic, non-overlapping distribution
        const positions = this.poissonDiskSample([], centerX, centerY, maxRadius, minSpacing);

        members.forEach((member, index) => {
            if (index < positions.length) {
                member.targetX = positions[index].x;
                member.targetY = positions[index].y;
            } else {
                // Fallback for when there are more members than generated positions (should be rare)
                const angle = Math.random() * 2 * Math.PI;
                const radius = Math.random() * maxRadius;
                member.targetX = centerX + Math.cos(angle) * radius;
                member.targetY = centerY + Math.sin(angle) * radius;
            }
        });
    }

    static poissonDiskSample(existingPositions, centerX, centerY, maxRadius, minSpacing) {
        const k = 30; // Number of attempts before rejecting a sample
        const active = [];
        const grid = [];
        const cellSize = minSpacing / Math.sqrt(2);
        const gridWidth = Math.ceil((maxRadius * 2) / cellSize);
        const gridHeight = Math.ceil((maxRadius * 2) / cellSize);

        for (let i = 0; i < gridWidth * gridHeight; i++) {
            grid[i] = undefined;
        }

        function toGridCoords(p) {
            return {
                x: Math.floor((p.x - (centerX - maxRadius)) / cellSize),
                y: Math.floor((p.y - (centerY - maxRadius)) / cellSize)
            };
        }

        function isValid(p) {
            const gridPos = toGridCoords(p);
            const startX = Math.max(0, gridPos.x - 2);
            const endX = Math.min(gridWidth - 1, gridPos.x + 2);
            const startY = Math.max(0, gridPos.y - 2);
            const endY = Math.min(gridHeight - 1, gridPos.y + 2);

            for (let y = startY; y <= endY; y++) {
                for (let x = startX; x <= endX; x++) {
                    const neighbor = grid[x + y * gridWidth];
                    if (neighbor) {
                        const d = Math.hypot(neighbor.x - p.x, neighbor.y - p.y);
                        if (d < minSpacing) return false;
                    }
                }
            }
            return true;
        }

        const p0 = { x: centerX, y: centerY };
        active.push(p0);
        const gridPos0 = toGridCoords(p0);
        grid[gridPos0.x + gridPos0.y * gridWidth] = p0;
        existingPositions.push(p0);

        while (active.length > 0) {
            const randIndex = Math.floor(Math.random() * active.length);
            const pos = active[randIndex];
            let found = false;

            for (let i = 0; i < k; i++) {
                const angle = Math.random() * 2 * Math.PI;
                const radius = Math.random() * minSpacing + minSpacing;
                const newPos = {
                    x: pos.x + Math.cos(angle) * radius,
                    y: pos.y + Math.sin(angle) * radius
                };

                if (Math.hypot(newPos.x - centerX, newPos.y - centerY) > maxRadius) continue;

                if (isValid(newPos)) {
                    existingPositions.push(newPos);
                    active.push(newPos);
                    const newGridPos = toGridCoords(newPos);
                    grid[newGridPos.x + newGridPos.y * gridWidth] = newPos;
                    found = true;
                }
            }

            if (!found) {
                active.splice(randIndex, 1);
            }
        }

        return existingPositions;
    }
}

// Export the layout classes
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        BaseLayout,
        ForceLayout,
        CircularLayout,
        GridLayout,
        HierarchicalLayout,
        RadiatingLayout,
        FamilyForestLayout
    };
} 