/**
 * Utility functions for the FedEx Hierarchy Generator
 * This file contains helper functions used throughout the application
 */

/**
 * Normalizes a name for consistent comparison
 * @param {string} name - The name to normalize
 * @returns {string} The normalized name
 */
function normalizeName(name) {
    if (!name) return '';

    // Convert to lowercase and remove extra spaces
    let normalized = name.toString().trim().toLowerCase()
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .replace(/[^a-z\s]/g, ''); // Remove special characters

    // Split into parts and sort alphabetically to handle name order variations
    const parts = normalized.split(' ').sort();
    return parts.join(' ');
}

/**
 * Calculates similarity between two names (0 to 1)
 * @param {string} name1 - First name
 * @param {string} name2 - Second name
 * @returns {number} Similarity score (0-1)
 */
function nameSimilarity(name1, name2) {
    const normalized1 = normalizeName(name1);
    const normalized2 = normalizeName(name2);

    if (normalized1 === normalized2) return 1.0;

    // Split into parts
    const parts1 = normalized1.split(' ');
    const parts2 = normalized2.split(' ');

    // Count matching parts
    let matches = 0;
    for (const part1 of parts1) {
        for (const part2 of parts2) {
            if (part1 === part2) {
                matches++;
                break;
            }
        }
    }

    // Calculate similarity score
    const maxLength = Math.max(parts1.length, parts2.length);
    return matches / maxLength;
}

/**
 * Finds the best matching employee for a manager name
 * @param {string} managerName - The manager name to match
 * @param {Array} employees - Array of employee objects
 * @returns {Object|null} The best matching employee or null
 */
function findBestMatch(managerName, employees) {
    let bestMatch = null;
    let bestScore = 0.7; // Minimum similarity threshold

    for (const emp of employees) {
        const score = nameSimilarity(managerName, emp['Employee Name']);
        if (score > bestScore) {
            bestScore = score;
            bestMatch = emp;
        }
    }

    return bestMatch;
}

/**
 * Shows a status message
 * @param {string} message - The message to display
 * @param {string} type - The type of message ('success' or 'error')
 */
function showStatus(message, type) {
    const statusDiv = document.getElementById('status');
    statusDiv.innerHTML = message;
    statusDiv.className = `status ${type}`;
}

/**
 * Shows the employee modal with details
 * @param {Object} nodeData - The node data to display
 * @param {boolean} showTable - Whether to show as table view
 */
function showEmployeeModal(nodeData, showTable = false) {
    const modal = document.getElementById('employeeModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalContent = document.getElementById('modalContent');

    modalTitle.textContent = nodeData.fullName || `${nodeData.name} - Employee Details`;

    // Create expand/collapse controls if showing multiple employees
    let controlsHTML = '';
    if (nodeData.employees.length > 1) {
        controlsHTML = `
            <div style="margin-bottom: 16px; display: flex; gap: 8px;">
                <button onclick="expandAllGroups()" style="padding: 6px 12px; background: #4B0082; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">Expand All</button>
                <button onclick="collapseAllGroups()" style="padding: 6px 12px; background: #64748B; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">Collapse All</button>
            </div>
        `;
    }

    // Group employees by job role if showing multiple employees
    let employeeCardsHTML = '';
    if (nodeData.employees.length > 1) {
        if (nodeData.type === 'manager') {
            // Show manager details at the top
            const manager = nodeData.employees[0]; // First employee is the manager
            employeeCardsHTML += `
                <div class="employee-card" style="margin-bottom: 20px;">
                    <h4>👨‍💼 Manager Details</h4>
                    <p><strong>Name:</strong> ${manager['Employee Name'] || 'N/A'}</p>
                    <p><strong>Employee ID:</strong> <span class="employee-id">${manager['Employee ID'] || 'N/A'}</span></p>
                    <p><strong>Job Profile:</strong> ${manager['Job Profile'] || 'N/A'}</p>
                    <p><strong>Department:</strong> ${manager['Department'] || 'N/A'}</p>
                    <p><strong>Location:</strong> <span class="employee-location">${manager['Location'] || 'N/A'}</span></p>
                    ${manager['Email'] ? `<p><strong>Email:</strong> ${manager['Email']}</p>` : ''}
                    ${manager['Phone'] ? `<p><strong>Phone:</strong> ${manager['Phone']}</p>` : ''}
                </div>
            `;
        }

        // Group by job role
        const jobRoleGroups = groupEmployeesByJobRole(nodeData.employees.filter(e => e !== nodeData.employees[0] || nodeData.type !== 'manager'));

        Array.from(jobRoleGroups.entries()).forEach(([jobRole, employees]) => {
            employeeCardsHTML += `
                <div class="job-role-group">
                    <div class="job-role-group-header" onclick="toggleGroup(this)">
                        <h4>${jobRole}</h4>
                        <div style="display: flex; align-items: center;">
                            <span style="margin-right: 12px; font-size: 13px; color: #64748B;">Location: ${getMostCommonLocation(employees)}</span>
                            <span class="toggle-icon" style="font-size: 0.8em;">▶</span>
                        </div>
                    </div>
                    <div class="job-role-group-content">
                        <ul class="employee-list">
                            ${employees.map(emp => `
                                <li class="employee-item">
                                    <div class="employee-info">
                                        <strong>${emp['Employee Name'] || 'N/A'}</strong>
                                        <span>${emp['Employee ID'] || 'N/A'} | ${emp['Location'] || 'N/A'}</span>
                                    </div>
                                    <div class="employee-actions">
                                        <button class="employee-action-btn" onclick="showSingleEmployee(event, ${JSON.stringify(emp).replace(/"/g, '&quot;')})">View</button>
                                    </div>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                </div>
            `;
        });
    } else if (nodeData.employees.length === 1) {
        // Single employee view
        const emp = nodeData.employees[0];
        employeeCardsHTML = `
            <div class="employee-card">
                <h4>${emp['Employee Name'] || 'N/A'}</h4>
                <p><strong>Employee ID:</strong> <span class="employee-id">${emp['Employee ID'] || 'N/A'}</span></p>
                <p><strong>Job Profile:</strong> ${emp['Job Profile'] || 'N/A'}</p>
                <p><strong>Department:</strong> ${emp['Department'] || 'N/A'}</p>
                <p><strong>Location:</strong> <span class="employee-location">${emp['Location'] || 'N/A'}</span></p>
                <p><strong>Reporting Manager:</strong> ${emp['Reporting Manager'] || 'None'}</p>
                ${emp['Email'] ? `<p><strong>Email:</strong> ${emp['Email']}</p>` : ''}
                ${emp['Phone'] ? `<p><strong>Phone:</strong> ${emp['Phone']}</p>` : ''}
            </div>
        `;
    }

    modalContent.innerHTML = controlsHTML + employeeCardsHTML;
    modal.classList.add('active');
}

/**
 * Toggles a group's expanded/collapsed state
 * @param {HTMLElement} header - The group header element
 */
function toggleGroup(header) {
    const group = header.parentElement;
    const isExpanded = group.classList.contains('expanded');
    group.classList.toggle('expanded');
    const content = group.querySelector('.job-role-group-content');
    const icon = group.querySelector('.toggle-icon');

    if (isExpanded) {
        content.style.maxHeight = '0';
        icon.textContent = '▶';
    } else {
        content.style.maxHeight = content.scrollHeight + 'px';
        icon.textContent = '▼';
    }
}

/**
 * Expands all groups in the modal
 */
function expandAllGroups() {
    document.querySelectorAll('.job-role-group').forEach(group => {
        group.classList.add('expanded');
        const content = group.querySelector('.job-role-group-content');
        const icon = group.querySelector('.toggle-icon');
        content.style.maxHeight = content.scrollHeight + 'px';
        icon.textContent = '▼';
    });
}

/**
 * Collapses all groups in the modal
 */
function collapseAllGroups() {
    document.querySelectorAll('.job-role-group').forEach(group => {
        group.classList.remove('expanded');
        const content = group.querySelector('.job-role-group-content');
        const icon = group.querySelector('.toggle-icon');
        content.style.maxHeight = '0';
        icon.textContent = '▶';
    });
}

/**
 * Gets the most common location among employees
 * @param {Array} employees - Array of employee objects
 * @returns {string} The most common location
 */
function getMostCommonLocation(employees) {
    const locationCounts = {};
    employees.forEach(emp => {
        const location = emp['Location'] || 'N/A';
        locationCounts[location] = (locationCounts[location] || 0) + 1;
    });

    return Object.keys(locationCounts).reduce((a, b) =>
        locationCounts[a] > locationCounts[b] ? a : b
    );
}

/**
 * Closes the employee modal
 */
function closeEmployeeModal() {
    document.getElementById('employeeModal').classList.remove('active');
}

/**
 * Closes the management modal
 */
function closeManagementModal() {
    document.getElementById('managementModal').classList.remove('active');
}

/**
 * Shows a tooltip with node information
 * @param {Event} event - The mouseover event
 * @param {Object} data - The node data
 */
function showTooltip(event, data) {
    const tooltip = document.getElementById('tooltip');
    tooltip.style.opacity = '1';
    tooltip.style.left = (event.pageX + 10) + 'px';
    tooltip.style.top = (event.pageY - 10) + 'px';

    let tooltipContent = `<strong>${data.fullName || data.name}</strong><br>`;
    tooltipContent += `Type: ${data.type.replace('-', ' ')}<br>`;

    if (data.count !== undefined) {
        tooltipContent += `Employees: ${data.count}<br>`;
    }

    if (data.employees && data.employees[0]) {
        const emp = data.employees[0];
        if (emp['Employee ID']) tooltipContent += `ID: ${emp['Employee ID']}<br>`;
        if (emp['Job Profile']) tooltipContent += `Job: ${emp['Job Profile']}<br>`;
        if (emp['Location']) tooltipContent += `Location: ${emp['Location']}<br>`;
        if (emp['Reporting Manager']) tooltipContent += `Manager: ${emp['Reporting Manager']}<br>`;
    }

    if (data.description) {
        tooltipContent += `<br>${data.description}`;
    }

    tooltip.innerHTML = tooltipContent;
}

/**
 * Hides the tooltip
 */
function hideTooltip() {
    document.getElementById('tooltip').style.opacity = '0';
}

/**
 * Saves the chart as an image
 */
function saveChartAsImage() {
    const chartContainer = document.getElementById('flowchartContainer');

    // Use html2canvas to capture the visible area of the chart container
    html2canvas(chartContainer, {
        ignoreElements: (element) => {
            // Ignore the fullscreen controls and location filter
            return element.id === 'fullscreenControls' || element.id === 'fullscreenLocationFilter';
        },
        scale: 2, // Higher quality
        logging: false,
        useCORS: true,
        allowTaint: true,
        scrollX: -window.scrollX,
        scrollY: -window.scrollY,
        windowWidth: document.documentElement.offsetWidth,
        windowHeight: document.documentElement.offsetHeight
    }).then(canvas => {
        // Create download link
        const link = document.createElement('a');
        link.download = `${currentDepartment.replace(/[^a-z0-9]/gi, '_')}_hierarchy.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }).catch(err => {
        console.error('Error capturing screenshot:', err);
        showStatus('Failed to capture screenshot', 'error');
    });
}

/**
 * Copies the chart to clipboard as an image
 */
function copyChartToClipboard() {
    const chartContainer = document.getElementById('flowchartContainer');

    // Use html2canvas to capture the visible area of the chart container
    html2canvas(chartContainer, {
        ignoreElements: (element) => {
            // Ignore the fullscreen controls and location filter
            return element.id === 'fullscreenControls' || element.id === 'fullscreenLocationFilter';
        },
        scale: 2, // Higher quality
        logging: false,
        useCORS: true,
        allowTaint: true,
        scrollX: -window.scrollX,
        scrollY: -window.scrollY,
        windowWidth: document.documentElement.offsetWidth,
        windowHeight: document.documentElement.offsetHeight
    }).then(canvas => {
        // Copy the canvas content to clipboard
        canvas.toBlob(function(blob) {
            navigator.clipboard.write([
                new ClipboardItem({
                    'image/png': blob
                })
            ]).then(function() {
                showStatus('Chart copied to clipboard!', 'success');
            }, function(error) {
                console.error('Failed to copy chart:', error);
                showStatus('Failed to copy chart to clipboard', 'error');
            });
        });
    }).catch(err => {
        console.error('Error capturing screenshot:', err);
        showStatus('Failed to capture screenshot', 'error');
    });
}