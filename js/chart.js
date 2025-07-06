/**
 * Chart rendering functions for the FedEx Hierarchy Generator
 * This file contains functions for rendering the organizational chart
 */

// Global variables for chart configuration
let currentLayout = 'vertical';
let isEditMode = false;
let nodeToDelete = null;
let customLayoutSettings = {
    horizontalSpacing: 300,
    verticalSpacing: 200,
    elbowLength: 80,
    nodeSize: 150,
    horizontalSpacingSlider: 100
};
let lastClickTime = 0;
const doubleClickThreshold = 300; // milliseconds for double-tap detection

/**
 * Renders the combined flow chart using D3.js
 * @param {Object} data - The hierarchy data to render
 */
function renderCombinedFlowChart(data) {
    const container = d3.select('#flowchartContainer');
    container.selectAll("*").remove();

    // Calculate required dimensions based on hierarchy depth and breadth
    const hierarchyDepth = getHierarchyDepth(data);
    const hierarchyBreadth = getHierarchyBreadth(data);

    // Set very large dimensions to accommodate big hierarchies
    const width = Math.max(3000, hierarchyBreadth * customLayoutSettings.horizontalSpacing);
    const height = Math.max(3000, hierarchyDepth * customLayoutSettings.verticalSpacing);
    const margin = { top: 40, right: 120, bottom: 40, left: 120 };

    const svg = container.append('svg')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .call(d3.zoom()
            .scaleExtent([0.1, 5])
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
                updateLinks(); // Update links when zooming/panning
            }))
        .on('dblclick.zoom', null); // Disable double-click zoom

    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // Create hierarchical layout
    const root = d3.stratify()
        .id(d => d.id)
        .parentId(d => {
            const link = data.links.find(l => l.target === d.id);
            return link ? link.source : null;
        })(data.nodes);

    // Custom tree layout with dynamic spacing
    const treeLayout = d3.tree()
        .size([width - margin.left - margin.right, height - margin.top - margin.bottom])
        .separation((a, b) => (a.parent === b.parent ? 1 : 1.5) / a.depth);

    const treeData = treeLayout(root);

    // Apply saved positions if they exist
    treeData.each(d => {
        if (nodePositions[d.data.id]) {
            d.x = nodePositions[d.data.id].x;
            d.y = nodePositions[d.data.id].y;
        }
    });

    // Create elbow links
    const links = g.selectAll('.link')
        .data(treeData.links().filter(d => !d.target.data.hidden))
        .enter().append('path')
        .attr('class', 'link')
        .style('fill', 'none')
        .style('stroke', '#94A3B8')
        .style('opacity', 0.8)
        .style('stroke-width', 1.5);

    // Update links initially
    updateLinks();

    // Calculate node dimensions based on size slider (1-200 to actual pixel values)
    const nodeBaseSize = 180 + (customLayoutSettings.nodeSize * 2); // 180-580px
    const nodeDimensions = {
        department: { width: nodeBaseSize * 2.5, height: nodeBaseSize * 1.5, fontSize: nodeBaseSize * 0.2 },
        manager: { width: nodeBaseSize * 1.8, height: nodeBaseSize * 1.2, fontSize: nodeBaseSize * 0.18 },
        'job-role': { width: nodeBaseSize * 1.5, height: nodeBaseSize, fontSize: nodeBaseSize * 0.16 },
        'top-level-role': { width: nodeBaseSize * 1.5, height: nodeBaseSize, fontSize: nodeBaseSize * 0.16 },
        'employee': { width: nodeBaseSize * 1.2, height: nodeBaseSize * 0.9, fontSize: nodeBaseSize * 0.14 },
        'location': { width: nodeBaseSize * 1.6, height: nodeBaseSize, fontSize: nodeBaseSize * 0.16 }
    };

    // Create nodes with double-tap functionality
    const node = g.selectAll('.node')
        .data(treeData.descendants().filter(d => !d.data.hidden))
        .enter().append('g')
        .attr('class', d => `node ${d.data.type}-node ${d.data.expanded ? 'expanded' : ''}`)
        .attr('transform', d => `translate(${d.x},${d.y})`)
        .call(d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended))
        .on('click', function(event, d) {
            const now = Date.now();
            const isDoubleClick = (now - lastClickTime) < doubleClickThreshold;
            lastClickTime = now;

            if (isEditMode) {
                // In edit mode, don't process clicks for expansion
                return;
            }

            if (isDoubleClick && (d.data.type === 'manager' || d.data.type === 'job-role' || d.data.type === 'top-level-role' || d.data.type === 'location')) {
                // Double-click on manager or job role - show all employees directly
                d3.select(this).classed('highlight', true);
                setTimeout(() => d3.select(this).classed('highlight', false), 500);

                // Collect all employees under this node
                let allEmployees = [];
                if (d.data.type === 'manager') {
                    hierarchyData.nodes.forEach(n => {
                        if ((n.type === 'location' || n.type === 'job-role' || n.type === 'employee') && n.managerId === d.data.id) {
                            allEmployees.push(...n.employees);
                        }
                    });
                } else {
                    allEmployees = d.data.employees || [];
                }

                // Show in modal
                showEmployeeModal({
                    name: d.data.name,
                    type: d.data.type,
                    count: allEmployees.length,
                    employees: allEmployees,
                    fullName: `All employees under ${d.data.name}`
                });
            } else if (d.data.type === 'manager' || d.data.type === 'job-role' || d.data.type === 'top-level-role' || d.data.type === 'location') {
                // Single click - toggle expansion of children
                const wasExpanded = d.data.expanded;
                d.data.expanded = !wasExpanded;

                // For managers, toggle employees visibility
                if (d.data.type === 'manager') {
                    hierarchyData.nodes.forEach(n => {
                        if (n.type === 'employee' && n.managerId === d.data.id) {
                            n.hidden = !d.data.expanded;
                        }
                    });
                }
                // For job roles, toggle employees visibility
                else if (d.data.type === 'job-role' || d.data.type === 'top-level-role' || d.data.type === 'location') {
                    hierarchyData.nodes.forEach(n => {
                        if (n.type === 'employee' && hierarchyData.links.some(l => l.source === d.data.id && l.target === n.id)) {
                            n.hidden = !d.data.expanded;
                        }
                    });
                }

                renderCombinedFlowChart(hierarchyData);
            } else if (d.data.type === 'employee') {
                // Single click on employee - show employee details
                showEmployeeModal(d.data);
            }
        })
        .on('mouseover', function(event, d) {
            if (!isEditMode) showTooltip(event, d.data);
        })
        .on('mouseout', function() {
            hideTooltip();
        });

    // Add rectangles for nodes with scaled dimensions
    node.append('rect')
        .attr('width', d => nodeDimensions[d.data.type].width)
        .attr('height', d => nodeDimensions[d.data.type].height)
        .attr('x', d => -nodeDimensions[d.data.type].width / 2)
        .attr('y', d => -nodeDimensions[d.data.type].height / 2)
        .style('stroke', d => {
            switch(d.data.type) {
                case 'department': return '#4B0082';
                case 'manager': return d.data.expanded ? '#4B0082' : '#7C3AED';
                case 'job-role': return '#2563EB';
                case 'employee': return '#0284C7';
                case 'top-level-role': return '#0284C7';
                case 'location': return '#FF6600';
                default: return '#94A3B8';
            }
        })
        .style('stroke-width', d => d.data.expanded ? '2px' : '1.5px')
        .style('fill', 'white')
        .style('fill-opacity', 0.9);

    // Add text containers with wrapped text
    node.each(function(d) {
        const g = d3.select(this);
        const width = nodeDimensions[d.data.type].width * 0.9; // 90% of node width
        const height = nodeDimensions[d.data.type].height * 0.9; // 90% of node height
        const fontSize = nodeDimensions[d.data.type].fontSize;

        // Create foreignObject for HTML content
        const fo = g.append('foreignObject')
            .attr('width', width)
            .attr('height', height)
            .attr('x', -width / 2)
            .attr('y', -height / 2);

        // Create div container for text
        const div = fo.append('xhtml:div')
            .attr('class', 'text-container')
            .style('width', width + 'px')
            .style('height', height + 'px')
            .style('font-size', fontSize + 'px')
            .style('padding', '8px')
            .style('box-sizing', 'border-box');

        // Add main text
        div.append('div')
            .attr('class', 'main-text')
            .style('font-weight', '600')
            .style('margin-bottom', '4px')
            .style('word-break', 'break-word')
            .text(d.data.name);

        // Add count if applicable
        if (d.data.type === 'manager' || d.data.type === 'top-level-role' || d.data.type === 'job-role' || d.data.type === 'location') {
            div.append('div')
                .attr('class', 'count-text')
                .style('font-size', '0.85em')
                .style('color', '#64748B')
                .text(`(${d.data.count} employees)`);
        }

        // Add description if available
        if (d.data.description) {
            div.append('div')
                .attr('class', 'description-text')
                .style('font-size', '0.75em')
                .style('color', '#64748B')
                .style('margin-top', '4px')
                .text(d.data.description);
        }

        // Add delete button (only visible in edit mode)
        if (isEditMode) {
            g.append('foreignObject')
                .attr('width', 24)
                .attr('height', 24)
                .attr('x', nodeDimensions[d.data.type].width / 2 - 12)
                .attr('y', -nodeDimensions[d.data.type].height / 2 - 12)
                .append('xhtml:button')
                .attr('class', 'delete-btn')
                .text('×')
                .on('click', function(event) {
                    event.stopPropagation();
                    nodeToDelete = d.data.id;
                    document.getElementById('deleteConfirmationModal').style.display = 'flex';
                });
        }
    });

    /**
     * Updates the link paths when nodes are moved
     */
    function updateLinks() {
        links.attr('d', d => {
            const sourceX = d.source.x;
            const sourceY = d.source.y;
            const targetX = d.target.x;
            const targetY = d.target.y;

            const elbowLength = customLayoutSettings.elbowLength;

            return `M${sourceX},${sourceY}
                    V${sourceY + elbowLength}
                    H${targetX}
                    V${targetY}`;
        });
    }

    /**
     * Handles drag start event
     */
    function dragstarted(event, d) {
        if (!isEditMode) return;
        d3.select(this).raise().classed("active", true);
    }

    /**
     * Handles drag event
     */
    function dragged(event, d) {
        if (!isEditMode) return;
        d.x = event.x;
        d.y = event.y;
        d3.select(this).attr("transform", `translate(${d.x},${d.y})`);

        // Save the position
        nodePositions[d.data.id] = { x: d.x, y: d.y };
        saveCurrentData();

        updateLinks();
    }

    /**
     * Handles drag end event
     */
    function dragended(event, d) {
        if (!isEditMode) return;
        d3.select(this).classed("active", false);
    }
}

/**
 * Renders the hierarchy view as a collapsible tree
 */
function renderHierarchyView() {
    if (!hierarchyData) return;

    const hierarchyContainer = document.getElementById('hierarchyTree');
    hierarchyContainer.innerHTML = '';

    // Find root node (either department or top manager)
    let rootNode;
    if (currentManager) {
        // Find the selected manager node
        rootNode = hierarchyData.nodes.find(node =>
            node.type === 'manager' &&
            node.name === currentManager
        );
    } else {
        // Find department node
        rootNode = hierarchyData.nodes.find(node => node.type === 'department');
    }

    if (!rootNode) return;

    // Recursive function to build hierarchy HTML
    const buildHierarchyHTML = (node, level = 0) => {
        const nodeElement = document.createElement('div');
        nodeElement.className = `hierarchy-node ${node.type}`;

        const titleElement = document.createElement('div');
        titleElement.className = 'hierarchy-node-title';
        titleElement.innerHTML = `
            <span>${node.name}</span>
            ${node.count ? `<span class="hierarchy-node-count">${node.count}</span>` : ''}
        `;

        nodeElement.appendChild(titleElement);

        // Add click handler to expand/collapse
        if (node.type !== 'employee') {
            nodeElement.addEventListener('click', (e) => {
                // Don't toggle if clicking on a child element
                if (e.target !== nodeElement && e.target !== titleElement) return;

                const childrenContainer = nodeElement.querySelector('.hierarchy-children');
                if (childrenContainer) {
                    childrenContainer.style.display = childrenContainer.style.display === 'none' ? 'block' : 'none';
                } else {
                    // First click - load children
                    loadChildren(node, nodeElement);
                }
            });
        }

        return nodeElement;
    };

    // Function to load children nodes
    const loadChildren = (parentNode, parentElement) => {
        const childrenLinks = hierarchyData.links.filter(link => link.source === parentNode.id);
        const childrenNodes = childrenLinks.map(link =>
            hierarchyData.nodes.find(node => node.id === link.target)
        ).filter(node => node && !node.hidden);

        if (childrenNodes.length === 0) return;

        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'hierarchy-children';

        childrenNodes.forEach(childNode => {
            const childElement = buildHierarchyHTML(childNode);
            childrenContainer.appendChild(childElement);
        });

        parentElement.appendChild(childrenContainer);
    };

    // Build the root node
    const rootElement = buildHierarchyHTML(rootNode);
    hierarchyContainer.appendChild(rootElement);

    // Load first level of children by default
    loadChildren(rootNode, rootElement);
}

/**
 * Calculates the depth of the hierarchy
 * @param {Object} data - The hierarchy data
 * @returns {number} The maximum depth of the hierarchy
 */
function getHierarchyDepth(data) {
    let maxDepth = 0;
    const nodeMap = new Map();

    // Build node map
    data.nodes.forEach(node => {
        nodeMap.set(node.id, { ...node, depth: 0, children: [] });
    });

    // Build tree structure
    data.links.forEach(link => {
        const parent = nodeMap.get(link.source);
        const child = nodeMap.get(link.target);
        if (parent && child) {
            parent.children.push(child);
        }
    });

    // Calculate depths
    const calculateDepth = (node, depth) => {
        node.depth = depth;
        maxDepth = Math.max(maxDepth, depth);
        node.children.forEach(child => calculateDepth(child, depth + 1));
    };

    // Start from root (assuming first node is root)
    if (data.nodes.length > 0) {
        calculateDepth(nodeMap.get(data.nodes[0].id), 0);
    }

    return maxDepth + 1; // Add 1 because depth starts at 0
}

/**
 * Calculates the breadth (width) of the hierarchy
 * @param {Object} data - The hierarchy data
 * @returns {number} The maximum breadth at any level
 */
function getHierarchyBreadth(data) {
    let maxBreadth = 0;
    const nodeMap = new Map();

    // Build node map
    data.nodes.forEach(node => {
        nodeMap.set(node.id, { ...node, breadth: 0, children: [] });
    });

    // Build tree structure
    data.links.forEach(link => {
        const parent = nodeMap.get(link.source);
        const child = nodeMap.get(link.target);
        if (parent && child) {
            parent.children.push(child);
        }
    });

    // Calculate breadth at each level
    const levelMap = new Map();

    const calculateBreadth = (node, level) => {
        if (!levelMap.has(level)) {
            levelMap.set(level, 0);
        }
        levelMap.set(level, levelMap.get(level) + 1);
        maxBreadth = Math.max(maxBreadth, levelMap.get(level));
        node.children.forEach(child => calculateBreadth(child, level + 1));
    };

    // Start from root (assuming first node is root)
    if (data.nodes.length > 0) {
        calculateBreadth(nodeMap.get(data.nodes[0].id), 0);
    }

    return maxBreadth;
}

/**
 * Deletes a single node from the hierarchy
 */
function deleteSingleNode() {
    if (!nodeToDelete || !hierarchyData) return;

    // Find the node to delete
    const nodeIndex = hierarchyData.nodes.findIndex(n => n.id === nodeToDelete);
    if (nodeIndex === -1) return;

    const nodeToRemove = hierarchyData.nodes[nodeIndex];

    // Find all links connected to this node
    const connectedLinks = hierarchyData.links.filter(link =>
        link.source === nodeToDelete || link.target === nodeToDelete
    );

    // Find the parent node (if any)
    const parentLink = hierarchyData.links.find(link => link.target === nodeToDelete);
    const parentNode = parentLink ? hierarchyData.nodes.find(n => n.id === parentLink.source) : null;

    // Find child nodes (if any)
    const childLinks = hierarchyData.links.filter(link => link.source === nodeToDelete);
    const childNodes = childLinks.map(link =>
        hierarchyData.nodes.find(n => n.id === link.target)
    ).filter(node => node);

    // If this node has children and we're not deleting them, we need to connect them to the parent
    if (childNodes.length > 0 && parentNode) {
        childNodes.forEach(childNode => {
            // Create a new link from parent to child
            hierarchyData.links.push({
                source: parentNode.id,
                target: childNode.id
            });
        });
    }

    // Remove all links connected to this node
    hierarchyData.links = hierarchyData.links.filter(link =>
        link.source !== nodeToDelete && link.target !== nodeToDelete
    );

    // Remove the node
    hierarchyData.nodes.splice(nodeIndex, 1);

    // Clear saved position if it exists
    delete nodePositions[nodeToDelete];

    // Save data
    saveCurrentData();

    // Re-render the chart
    if (document.getElementById('hierarchyView').style.display === 'block') {
        renderHierarchyView();
    } else {
        renderCombinedFlowChart(hierarchyData);
    }

    // Close the modal and reset
    document.getElementById('deleteConfirmationModal').style.display = 'none';
    nodeToDelete = null;
}

/**
 * Deletes a node and all its children from the hierarchy
 */
function deleteWithChildren() {
    if (!nodeToDelete || !hierarchyData) return;

    // Find all child nodes to delete
    const nodesToDelete = new Set();
    nodesToDelete.add(nodeToDelete);

    // Recursively find all children
    const findChildren = (parentId) => {
        hierarchyData.links.forEach(link => {
            if (link.source === parentId) {
                nodesToDelete.add(link.target);
                findChildren(link.target);
            }
        });
    };

    findChildren(nodeToDelete);

    // Remove all nodes to delete
    hierarchyData.nodes = hierarchyData.nodes.filter(n => !nodesToDelete.has(n.id));

    // Remove all links connected to these nodes
    hierarchyData.links = hierarchyData.links.filter(link =>
        !nodesToDelete.has(link.source) && !nodesToDelete.has(link.target)
    );

    // Clear saved positions for deleted nodes
    nodesToDelete.forEach(id => delete nodePositions[id]);

    // Save data
    saveCurrentData();

    // Re-render the chart
    if (document.getElementById('hierarchyView').style.display === 'block') {
        renderHierarchyView();
    } else {
        renderCombinedFlowChart(hierarchyData);
    }

    // Close the modal and reset
    document.getElementById('deleteConfirmationModal').style.display = 'none';
    nodeToDelete = null;
}

/**
 * Cancels the delete operation
 */
function cancelDelete() {
    nodeToDelete = null;
    document.getElementById('deleteConfirmationModal').style.display = 'none';
}

/**
 * Toggles between chart view and hierarchy view
 * @param {string} viewType - The view type to show ('chart' or 'hierarchy')
 */
function toggleView(viewType) {
    if (viewType === 'chart') {
        document.getElementById('flowchartSection').style.display = 'block';
        document.getElementById('hierarchyView').style.display = 'none';
        document.getElementById('chartViewBtn').classList.add('active');
        document.getElementById('hierarchyViewBtn').classList.remove('active');
        if (hierarchyData) renderCombinedFlowChart(hierarchyData);
    } else if (viewType === 'hierarchy') {
        document.getElementById('flowchartSection').style.display = 'none';
        document.getElementById('hierarchyView').style.display = 'block';
        document.getElementById('chartViewBtn').classList.remove('active');
        document.getElementById('hierarchyViewBtn').classList.add('active');
        renderHierarchyView();
    }
}

/**
 * Toggles fullscreen mode for the chart
 */
function toggleFullscreen() {
    const flowchartSection = document.getElementById('flowchartSection');
    const isFullscreen = flowchartSection.classList.contains('fullscreen-chart');

    if (isFullscreen) {
        flowchartSection.classList.remove('fullscreen-chart');
        document.body.style.overflow = 'auto';
        document.getElementById('fullscreenControls').style.display = 'none';
        document.getElementById('fullscreenLocationFilter').style.display = 'none';
        document.getElementById('locationFilter').style.display = 'block';
    } else {
        flowchartSection.classList.add('fullscreen-chart');
        document.body.style.overflow = 'hidden';
        document.getElementById('fullscreenControls').style.display = 'flex';
        document.getElementById('fullscreenLocationFilter').style.display = 'block';
        document.getElementById('locationFilter').style.display = 'none';
    }

    // Recalculate dimensions after fullscreen change
    setTimeout(() => {
        if (hierarchyData) {
            renderCombinedFlowChart(hierarchyData);
        }
    }, 100);
}

/**
 * Toggles edit mode for the chart
 */
function toggleEditMode() {
    isEditMode = !isEditMode;
    const btn = document.getElementById('editModeBtn');
    const fsBtn = document.getElementById('fsEditModeBtn');
    btn.classList.toggle('edit-mode');
    fsBtn.classList.toggle('edit-mode');
    btn.textContent = isEditMode ? 'Exit Edit Mode' : 'Edit Mode';
    fsBtn.textContent = isEditMode ? 'Exit Edit Mode' : 'Edit Mode';

    // Toggle edit mode class on flowchart container
    document.getElementById('flowchartContainer').classList.toggle('edit-mode');

    if (hierarchyData) {
        if (document.getElementById('hierarchyView').style.display === 'block') {
            renderHierarchyView();
        } else {
            renderCombinedFlowChart(hierarchyData);
        }
    }
}

/**
 * Shows the add node modal
 */
function showAddNodeModal() {
    if (!isEditMode) {
        showStatus('Please enable Edit Mode first', 'error');
        return;
    }

    // Populate parent node dropdown
    const parentSelect = document.getElementById('parentNode');
    parentSelect.innerHTML = '<option value="">None (Top Level)</option>';

    if (hierarchyData && hierarchyData.nodes) {
        hierarchyData.nodes.forEach(node => {
            const option = document.createElement('option');
            option.value = node.id;
            option.textContent = `${node.name} (${node.type})`;
            parentSelect.appendChild(option);
        });
    }

    document.getElementById('addNodeModal').classList.add('active');
}

/**
 * Closes the add node modal
 */
function closeAddNodeModal() {
    document.getElementById('addNodeModal').classList.remove('active');
    document.getElementById('addNodeForm').reset();
}

/**
 * Handles adding a new node to the hierarchy
 * @param {Event} event - The form submit event
 */
function handleAddNode(event) {
    event.preventDefault();

    const nodeName = document.getElementById('nodeName').value;
    const nodeType = document.getElementById('nodeType').value;
    const parentNodeId = document.getElementById('parentNode').value;
    const employeeCount = parseInt(document.getElementById('employeeCount').value) || 0;
    const nodeDescription = document.getElementById('nodeDescription').value;

    if (!nodeName) {
        showStatus('Node name is required', 'error');
        return;
    }

    // Create new node
    const newNode = {
        id: nextNodeId++,
        name: nodeName,
        type: nodeType,
        description: nodeDescription,
        count: employeeCount,
        employees: [],
        expanded: false,
        hidden: false
    };

    // Add to hierarchy data
    if (!hierarchyData) {
        hierarchyData = { nodes: [], links: [] };
    }

    hierarchyData.nodes.push(newNode);

    // If parent node is selected, create the link
    if (parentNodeId) {
        hierarchyData.links.push({
            source: parseInt(parentNodeId),
            target: newNode.id
        });
    }

    // Save positions if needed
    nodePositions[newNode.id] = {
        x: window.innerWidth / 2 - 100,
        y: window.innerHeight / 2 - 50
    };

    // Save data
    saveCurrentData();

    // Re-render
    renderCombinedFlowChart(hierarchyData);
    closeAddNodeModal();
}

/**
 * Updates the node size value display
 */
function updateNodeSizeValue() {
    document.getElementById('nodeSizeValue').textContent = document.getElementById('nodeSizeSlider').value;
    document.getElementById('fsNodeSizeSlider').value = document.getElementById('nodeSizeSlider').value;
    customLayoutSettings.nodeSize = parseInt(document.getElementById('nodeSizeSlider').value);
}

/**
 * Updates the horizontal spacing value display
 */
function updateHorizontalSpacingValue() {
    document.getElementById('horizontalSpacingValue').textContent = document.getElementById('horizontalSpacingSlider').value;
    document.getElementById('fsHorizontalSpacingSlider').value = document.getElementById('horizontalSpacingSlider').value;
    customLayoutSettings.horizontalSpacingSlider = parseInt(document.getElementById('horizontalSpacingSlider').value);
}

/**
 * Applies node size and spacing settings to the chart
 */
function applyNodeSizeAndSpacing() {
    const nodeSize = parseInt(document.getElementById('nodeSizeSlider').value);
    const horizontalSpacing = parseInt(document.getElementById('horizontalSpacingSlider').value);

    customLayoutSettings.nodeSize = nodeSize;
    customLayoutSettings.horizontalSpacingSlider = horizontalSpacing;

    // Scale spacing values based on the slider (1-200 to actual pixel values)
    customLayoutSettings.horizontalSpacing = 150 + (horizontalSpacing * 2.5); // Increased multiplier for better spacing
    customLayoutSettings.verticalSpacing = 120 + (horizontalSpacing * 1.2);
    customLayoutSettings.elbowLength = 60 + (horizontalSpacing * 0.8);

    // Re-render the chart if we have data
    if (hierarchyData) {
        if (document.getElementById('hierarchyView').style.display === 'block') {
            renderHierarchyView();
        } else {
            renderCombinedFlowChart(hierarchyData);
        }
    }
}

/**
 * Resets the layout to default settings
 */
function resetLayout() {
    // Reset to original hierarchy data
    if (originalHierarchyData) {
        hierarchyData = JSON.parse(JSON.stringify(originalHierarchyData));
        nodePositions = {};
        nextNodeId = Math.max(...hierarchyData.nodes.map(n => n.id)) + 1;
    }

    // Reset layout settings to defaults
    customLayoutSettings = {
        horizontalSpacing: 300,
        verticalSpacing: 200,
        elbowLength: 80,
        nodeSize: 150,
        horizontalSpacingSlider: 100
    };

    // Update sliders
    document.getElementById('nodeSizeSlider').value = customLayoutSettings.nodeSize;
    document.getElementById('horizontalSpacingSlider').value = customLayoutSettings.horizontalSpacingSlider;
    document.getElementById('fsNodeSizeSlider').value = customLayoutSettings.nodeSize;
    document.getElementById('fsHorizontalSpacingSlider').value = customLayoutSettings.horizontalSpacingSlider;
    updateNodeSizeValue();
    updateHorizontalSpacingValue();

    // Save data
    saveCurrentData();

    if (hierarchyData) {
        if (document.getElementById('hierarchyView').style.display === 'block') {
            renderHierarchyView();
        } else {
            renderCombinedFlowChart(hierarchyData);
        }
    }
}
