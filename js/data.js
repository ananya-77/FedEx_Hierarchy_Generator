/**
 * Data handling functions for the FedEx Hierarchy Generator
 * This file contains functions for processing employee data, building hierarchies,
 * and managing datasets.
 */

// Global variables to store application data
let employeeData = [];
let currentDepartment = '';
let currentManager = '';
let currentLocation = '';
let hierarchyData = null;
let originalHierarchyData = null;
let nodePositions = {};
let nextNodeId = 0;
let datasets = {};
let currentDataset = '';
let pendingFileData = null;

/**
 * Handles file upload and processes the data
 * @param {Event} event - The file input change event
 */
function handleFileUpload(event) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    let filesProcessed = 0;
    let allData = [];

    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv')) {
                    // Process Excel file
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet);

                    // Standardize column names
                    const standardizedData = jsonData.map(row => {
                        const standardizedRow = {};
                        for (const key in row) {
                            const lowerKey = key.toLowerCase().trim();

                            if (lowerKey.includes('department') || lowerKey === 'dept') {
                                standardizedRow['Department'] = row[key];
                            } else if ((lowerKey.includes('employee') && lowerKey.includes('name')) ||
                                      lowerKey === 'name' ||
                                      lowerKey === 'full name') {
                                standardizedRow['Employee Name'] = row[key];
                            } else if ((lowerKey.includes('job') && lowerKey.includes('profile')) ||
                                      lowerKey.includes('title') ||
                                      lowerKey.includes('position')) {
                                standardizedRow['Job Profile'] = row[key];
                            } else if (lowerKey.includes('location') || lowerKey === 'office') {
                                standardizedRow['Location'] = row[key];
                            } else if ((lowerKey.includes('reporting') && lowerKey.includes('manager')) ||
                                      lowerKey.includes('manager') ||
                                      lowerKey.includes('supervisor')) {
                                standardizedRow['Reporting Manager'] = row[key];
                            } else if ((lowerKey.includes('employee') && lowerKey.includes('id')) ||
                                      lowerKey.includes('staff id') ||
                                      lowerKey.includes('emp id')) {
                                standardizedRow['Employee ID'] = row[key];
                            } else if (lowerKey.includes('email') || lowerKey.includes('mail')) {
                                standardizedRow['Email'] = row[key];
                            } else if (lowerKey.includes('phone') || lowerKey.includes('mobile') || lowerKey.includes('contact')) {
                                standardizedRow['Phone'] = row[key];
                            }
                        }
                        return standardizedRow;
                    });

                    allData = allData.concat(standardizedData);
                } else {
                    // Process JSON file
                    const jsonData = JSON.parse(e.target.result);
                    const parsedData = Array.isArray(jsonData) ? jsonData : [jsonData];

                    // Ensure JSON data has required fields
                    const standardizedData = parsedData.map(emp => {
                        return {
                            'Department': emp.Department || emp.department || emp.Dept || emp.dept || 'Unknown',
                            'Employee Name': emp['Employee Name'] || emp.employeeName || emp.name || emp.fullName || 'Unknown',
                            'Job Profile': emp['Job Profile'] || emp.jobProfile || emp.title || emp.position || 'Unknown',
                            'Location': emp.Location || emp.location || emp.office || 'Unknown',
                            'Reporting Manager': emp['Reporting Manager'] || emp.reportingManager || emp.manager || emp.supervisor || '',
                            'Employee ID': emp['Employee ID'] || emp.employeeID || emp.staffID || emp.id || '',
                            'Email': emp.Email || emp.email || emp.mail || '',
                            'Phone': emp.Phone || emp.phone || emp.mobile || emp.contact || ''
                        };
                    });

                    allData = allData.concat(standardizedData);
                }

                filesProcessed++;
                if (filesProcessed === files.length) {
                    // All files processed
                    pendingFileData = allData;
                    showDatasetNameModal();
                }
            } catch (error) {
                showStatus(`Error parsing file ${file.name}. Please check the format.`, 'error');
                console.error(error);
            }
        };
        reader.onerror = function() {
            showStatus(`Error reading file ${file.name}.`, 'error');
        };

        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv')) {
            reader.readAsArrayBuffer(file);
        } else {
            reader.readAsText(file);
        }
    });
}

/**
 * Populates the department select dropdown with unique department names
 */
function populateDepartmentSelect() {
    const departments = [...new Set(employeeData.map(emp => emp.Department))].filter(Boolean);
    const select = document.getElementById('departmentSelect');

    select.innerHTML = '<option value="">Choose a department...</option>';
    departments.forEach(dept => {
        const option = document.createElement('option');
        option.value = dept;
        option.textContent = dept;
        select.appendChild(option);
    });

    document.getElementById('departmentSelectDiv').style.display = 'block';
}

/**
 * Populates the manager select dropdown based on the selected department
 * @param {string} department - The selected department
 */
function populateManagerSelect(department) {
    const deptEmployees = employeeData.filter(emp => emp.Department === department);
    const managerStructure = buildManagerStructure(deptEmployees);

    const select = document.getElementById('managerSelect');
    select.innerHTML = '<option value="">Show full department hierarchy</option>';

    // Add all managers who have employees reporting to them
    managerStructure.forEach((data, managerName) => {
        const option = document.createElement('option');
        option.value = data.manager['Employee Name'];
        option.textContent = `${data.manager['Employee Name']} (${data.employees.length} employees)`;
        select.appendChild(option);
    });

    document.getElementById('managerSelectDiv').style.display = 'block';

    // Prevent the management modal from opening when selecting a manager
    select.addEventListener('click', function(e) {
        e.stopPropagation();
    });
}

/**
 * Populates the location select dropdown based on the selected department
 * @param {string} department - The selected department
 */
function populateLocationSelect(department) {
    const deptEmployees = employeeData.filter(emp => emp.Department === department);
    const locations = [...new Set(deptEmployees.map(emp => emp['Location']))].filter(Boolean);
    const select = document.getElementById('locationSelect');

    select.innerHTML = '<option value="">All Locations</option>';
    locations.forEach(location => {
        const option = document.createElement('option');
        option.value = location;
        option.textContent = location;
        select.appendChild(option);
    });

    // Also populate the fullscreen location filter
    const fsSelect = document.getElementById('fsLocationSelect');
    fsSelect.innerHTML = '<option value="">All Locations</option>';
    locations.forEach(location => {
        const option = document.createElement('option');
        option.value = location;
        option.textContent = location;
        fsSelect.appendChild(option);
    });

    document.getElementById('locationFilter').style.display = 'block';
}

/**
 * Handles department selection change
 * @param {Event} event - The select change event
 */
function handleDepartmentChange(event) {
    currentDepartment = event.target.value;
    if (currentDepartment) {
        populateManagerSelect(currentDepartment);
        populateLocationSelect(currentDepartment);
        generateHierarchyTables();
        saveCurrentDataset();
    } else {
        document.getElementById('managerSelectDiv').style.display = 'none';
        document.getElementById('locationFilter').style.display = 'none';
        document.getElementById('resultsSection').style.display = 'none';
    }
}

/**
 * Handles manager selection change
 * @param {Event} event - The select change event
 */
function handleManagerChange(event) {
    currentManager = event.target.value;
    if (currentDepartment) {
        generateHierarchyTables();
        saveCurrentDataset();
    }
}

/**
 * Handles location selection change
 * @param {Event} event - The select change event
 */
function handleLocationChange(event) {
    currentLocation = event.target.value;
    if (currentDepartment) {
        generateHierarchyTables();
        saveCurrentDataset();
    }
}

/**
 * Builds a manager-employee structure from employee data
 * @param {Array} employees - Array of employee objects
 * @returns {Map} A map of managers and their direct reports
 */
function buildManagerStructure(employees) {
    const managerMap = new Map();
    const employeeMap = new Map();

    // First create a map of all employees with normalized names for matching
    employees.forEach(emp => {
        const normalizedName = normalizeName(emp['Employee Name']);
        employeeMap.set(normalizedName, emp);
    });

    // Group employees by their reporting manager with enhanced fuzzy matching
    employees.forEach(emp => {
        const managerName = emp['Reporting Manager'];
        if (managerName && managerName.trim() !== '') {
            const normalizedManagerName = normalizeName(managerName);

            // Try to find the manager in the employee list
            let managerDetails = employeeMap.get(normalizedManagerName);

            // If manager not found, try to find a close match
            if (!managerDetails) {
                managerDetails = findBestMatch(managerName, employees);
            }

            // If manager still not found, create a placeholder
            if (!managerDetails) {
                managerDetails = {
                    'Employee Name': managerName,
                    'Job Profile': 'Manager (Details not found)',
                    'Location': 'N/A',
                    'Department': currentDepartment,
                    'Reporting Manager': ''
                };
                const normalizedManagerName = normalizeName(managerName);
                employeeMap.set(normalizedManagerName, managerDetails);
            }

            // Find or create manager entry
            const normalizedKey = normalizeName(managerDetails['Employee Name']);
            if (!managerMap.has(normalizedKey)) {
                managerMap.set(normalizedKey, {
                    manager: managerDetails,
                    employees: []
                });
            }

            managerMap.get(normalizedKey).employees.push(emp);
        }
    });

    return managerMap;
}

/**
 * Groups employees by their job role
 * @param {Array} employees - Array of employee objects
 * @returns {Map} A map of job roles and employees in those roles
 */
function groupEmployeesByJobRole(employees) {
    const jobRoleGroups = new Map();

    employees.forEach(emp => {
        const jobRole = emp['Job Profile'] || 'Unknown Role';
        // Exclude first 7 characters from job role name for display
        const displayJobRole = jobRole.length > 7 ? jobRole.substring(7) : jobRole;
        if (!jobRoleGroups.has(displayJobRole)) {
            jobRoleGroups.set(displayJobRole, []);
        }
        jobRoleGroups.get(displayJobRole).push(emp);
    });

    return jobRoleGroups;
}

/**
 * Generates the hierarchy tables and charts based on current selections
 */
function generateHierarchyTables() {
    const deptEmployees = employeeData.filter(emp => emp.Department === currentDepartment);

    // Apply location filter if selected
    const filteredEmployees = currentLocation ?
        deptEmployees.filter(emp => emp['Location'] === currentLocation) :
        deptEmployees;

    if (filteredEmployees.length === 0) {
        showStatus('No employees found matching the selected criteria.', 'error');
        return;
    }

    // Build manager-employee structure
    const managerStructure = buildManagerStructure(filteredEmployees);

    // Generate summary stats
    generateSummaryStats(filteredEmployees, managerStructure);

    // Generate combined flow chart first
    if (currentManager) {
        // Find the selected manager in the structure
        const normalizedManagerName = normalizeName(currentManager);
        const managerData = managerStructure.get(normalizedManagerName);

        if (managerData) {
            // Build hierarchy for this manager and their chain
            hierarchyData = buildManagerHierarchyData(managerData.manager, filteredEmployees);
        } else {
            showStatus('Selected manager not found in department.', 'error');
            return;
        }
    } else {
        // Show full department hierarchy with proper nested structure
        hierarchyData = buildFullDepartmentHierarchy(managerStructure, filteredEmployees);
    }

    // Store original hierarchy data for reset
    originalHierarchyData = JSON.parse(JSON.stringify(hierarchyData));

    document.getElementById('flowchartSection').style.display = 'block';
    renderCombinedFlowChart(hierarchyData);

    document.getElementById('resultsSection').style.display = 'block';
}

/**
 * Builds the full department hierarchy structure
 * @param {Map} managerStructure - Map of managers and their direct reports
 * @param {Array} allEmployees - All employees in the department
 * @returns {Object} Hierarchy data with nodes and links
 */
function buildFullDepartmentHierarchy(managerStructure, allEmployees) {
    const nodes = [];
    const links = [];
    nextNodeId = 0;

    // Create a map of all employees for quick lookup (with normalized names)
    const employeeMap = new Map();
    allEmployees.forEach(emp => {
        const normalizedName = normalizeName(emp['Employee Name']);
        employeeMap.set(normalizedName, emp);
    });

    // Add department root node
    const rootNode = {
        id: nextNodeId++,
        name: `${currentDepartment} Department`,
        type: 'department',
        count: allEmployees.length,
        expanded: false
    };
    nodes.push(rootNode);

    // Create a map to track which employees have been processed
    const processedEmployees = new Set();

    // Function to recursively build manager hierarchy
    const buildManagerHierarchy = (managerName, parentNodeId) => {
        const normalizedManagerName = normalizeName(managerName);

        if (processedEmployees.has(normalizedManagerName)) return null; // Prevent cycles

        processedEmployees.add(normalizedManagerName);

        const managerData = managerStructure.get(normalizedManagerName);
        const managerDetails = managerData ? managerData.manager :
            employeeMap.get(normalizedManagerName) || {
                'Employee Name': managerName,
                'Job Profile': 'Manager (Details not found)',
                'Location': 'N/A',
                'Department': currentDepartment,
                'Reporting Manager': ''
            };

        // Create manager node
        const managerNode = {
            id: nextNodeId++,
            name: managerDetails['Employee Name'] || 'Unknown',
            type: 'manager',
            count: managerData ? managerData.employees.length : 0,
            employees: [managerDetails],
            fullName: `${managerDetails['Employee Name']} - ${managerDetails['Job Profile']}`,
            expanded: false
        };
        nodes.push(managerNode);

        // Link to parent node
        if (parentNodeId !== undefined) {
            links.push({
                source: parentNodeId,
                target: managerNode.id
            });
        } else {
            // Link to department root if no parent
            links.push({
                source: rootNode.id,
                target: managerNode.id
            });
        }

        // Process this manager's employees (only one level down)
        if (managerData) {
            // First group by location
            const locationGroups = new Map();
            managerData.employees.forEach(emp => {
                const location = emp['Location'] || 'Unknown Location';
                if (!locationGroups.has(location)) {
                    locationGroups.set(location, []);
                }
                locationGroups.get(location).push(emp);
            });

            // Then for each location, group by job role
            locationGroups.forEach((locationEmployees, location) => {
                const locationNode = {
                    id: nextNodeId++,
                    name: location,
                    type: 'location',
                    count: locationEmployees.length,
                    employees: locationEmployees,
                    managerId: managerNode.id,
                    hidden: false,
                    fullName: `${location} (${locationEmployees.length} employees)`,
                    expanded: false
                };
                nodes.push(locationNode);

                links.push({
                    source: managerNode.id,
                    target: locationNode.id
                });

                const jobRoleGroups = groupEmployeesByJobRole(locationEmployees);

                jobRoleGroups.forEach((employees, jobRole) => {
                    const jobRoleNode = {
                        id: nextNodeId++,
                        name: jobRole,
                        type: 'job-role',
                        count: employees.length,
                        employees: employees,
                        managerId: managerNode.id,
                        hidden: false,
                        fullName: `${jobRole} (${employees.length} employees)`,
                        expanded: false
                    };
                    nodes.push(jobRoleNode);

                    links.push({
                        source: locationNode.id,
                        target: jobRoleNode.id
                    });
                });
            });
        }

        return managerNode;
    };

    // First process all employees without managers
    const employeesWithoutManagers = allEmployees.filter(emp =>
        !emp['Reporting Manager'] || emp['Reporting Manager'].trim() === ''
    );

    if (employeesWithoutManagers.length > 0) {
        // Group top-level employees by location first
        const locationGroups = new Map();
        employeesWithoutManagers.forEach(emp => {
            const location = emp['Location'] || 'Unknown Location';
            if (!locationGroups.has(location)) {
                locationGroups.set(location, []);
            }
            locationGroups.get(location).push(emp);
        });

        locationGroups.forEach((locationEmployees, location) => {
            const locationNode = {
                id: nextNodeId++,
                name: location,
                type: 'location',
                count: locationEmployees.length,
                employees: locationEmployees,
                fullName: `${location} (Top Level)`,
                expanded: false
            };
            nodes.push(locationNode);

            links.push({
                source: rootNode.id,
                target: locationNode.id
            });

            const jobRoleGroups = groupEmployeesByJobRole(locationEmployees);

            jobRoleGroups.forEach((employees, jobRole) => {
                const jobRoleNode = {
                    id: nextNodeId++,
                    name: jobRole,
                    type: 'top-level-role',
                    count: employees.length,
                    employees: employees,
                    fullName: `${jobRole} (Top Level)`,
                    expanded: false
                };
                nodes.push(jobRoleNode);

                links.push({
                    source: locationNode.id,
                    target: jobRoleNode.id
                });
            });
        });
    }

    // Then process all managers who don't report to anyone in this department (top-level managers)
    managerStructure.forEach((data, normalizedManagerName) => {
        const manager = data.manager;
        const reportingManager = manager['Reporting Manager'];

        if (!reportingManager || reportingManager.trim() === '' ||
            !employeeMap.has(normalizeName(reportingManager))) {

            if (!processedEmployees.has(normalizedManagerName)) {
                buildManagerHierarchy(manager['Employee Name'], rootNode.id);
            }
        }
    });

    // Then process all other managers in the hierarchy
    managerStructure.forEach((data, normalizedManagerName) => {
        if (!processedEmployees.has(normalizedManagerName)) {
            const manager = data.manager;
            const reportingManager = manager['Reporting Manager'];

            if (reportingManager && reportingManager.trim() !== '') {
                const normalizedReportingManagerName = normalizeName(reportingManager);

                // Check if the reporting manager exists in our structure
                if (managerStructure.has(normalizedReportingManagerName)) {
                    // Find the reporting manager node
                    const reportingManagerNode = nodes.find(n =>
                        n.type === 'manager' &&
                        normalizeName(n.name) === normalizedReportingManagerName
                    );

                    // If the reporting manager node exists, place under it
                    if (reportingManagerNode) {
                        buildManagerHierarchy(manager['Employee Name'], reportingManagerNode.id);
                    } else {
                        // If not found, place under department root
                        buildManagerHierarchy(manager['Employee Name'], rootNode.id);
                    }
                } else {
                    // If reporting manager not found in structure, place under department root
                    buildManagerHierarchy(manager['Employee Name'], rootNode.id);
                }
            }
        }
    });

    return { nodes, links };
}

/**
 * Builds hierarchy data for a specific manager
 * @param {Object} manager - The manager object
 * @param {Array} allEmployees - All employees in the department
 * @returns {Object} Hierarchy data with nodes and links
 */
function buildManagerHierarchyData(manager, allEmployees) {
    const nodes = [];
    const links = [];

    // Reset nextNodeId when building new hierarchy
    nextNodeId = 0;

    // Create a map of all employees for quick lookup (with normalized names)
    const employeeMap = new Map();
    allEmployees.forEach(emp => {
        const normalizedName = normalizeName(emp['Employee Name']);
        employeeMap.set(normalizedName, emp);
    });

    // Create manager structure
    const managerStructure = buildManagerStructure(allEmployees);

    // Function to recursively build the chain of command upwards
    const buildUpwardHierarchy = (employee, processed) => {
        const normalizedName = normalizeName(employee['Employee Name']);
        if (processed.has(normalizedName)) return null;

        processed.add(normalizedName);

        // Create node for this employee
        const isManager = managerStructure.has(normalizedName);
        const nodeType = isManager ? 'manager' : 'employee';
        const node = {
            id: nextNodeId++,
            name: employee['Employee Name'] || 'Unknown',
            type: nodeType,
            count: isManager ? managerStructure.get(normalizedName).employees.length : 1,
            employees: [employee],
            fullName: `${employee['Employee Name']} - ${employee['Job Profile']}`,
            expanded: false
        };
        nodes.push(node);

        // Process reporting manager
        const managerName = employee['Reporting Manager'];
        if (managerName && managerName.trim() !== '') {
            const normalizedManagerName = normalizeName(managerName);
            let upperManager = employeeMap.get(normalizedManagerName);

            // If manager not found, try to find a close match
            if (!upperManager) {
                upperManager = findBestMatch(managerName, allEmployees);
            }

            // If manager still not found, create a placeholder
            if (!upperManager) {
                upperManager = {
                    'Employee Name': managerName,
                    'Job Profile': 'Manager (Details not found)',
                    'Location': 'N/A',
                    'Department': currentDepartment,
                    'Reporting Manager': ''
                };
            }

            const managerNode = buildUpwardHierarchy(upperManager, processed);
            if (managerNode) {
                links.push({
                    source: managerNode.id,
                    target: node.id
                });
            }
        }

        return node;
    };

    // Function to build the chain of command downwards (only one level)
    const buildDownwardHierarchy = (managerName, parentNodeId) => {
        const normalizedManagerName = normalizeName(managerName);
        const managerData = managerStructure.get(normalizedManagerName);
        if (!managerData) return;

        // Create manager node if not already created
        let managerNode = nodes.find(n =>
            n.type === 'manager' &&
            normalizeName(n.name) === normalizedManagerName
        );

        if (!managerNode) {
            managerNode = {
                id: nextNodeId++,
                name: managerData.manager['Employee Name'] || 'Unknown',
                type: 'manager',
                count: managerData.employees.length,
                employees: [managerData.manager],
                fullName: `${managerData.manager['Employee Name']} - ${managerData.manager['Job Profile']}`,
                expanded: false
            };
            nodes.push(managerNode);

            // Link to parent if provided
            if (parentNodeId !== undefined) {
                links.push({
                    source: parentNodeId,
                    target: managerNode.id
                });
            }
        }

        // Process this manager's employees (only one level down)
        if (managerData) {
            // First group by location
            const locationGroups = new Map();
            managerData.employees.forEach(emp => {
                const location = emp['Location'] || 'Unknown Location';
                if (!locationGroups.has(location)) {
                    locationGroups.set(location, []);
                }
                locationGroups.get(location).push(emp);
            });

            // Then for each location, group by job role
            locationGroups.forEach((locationEmployees, location) => {
                const locationNode = {
                    id: nextNodeId++,
                    name: location,
                    type: 'location',
                    count: locationEmployees.length,
                    employees: locationEmployees,
                    managerId: managerNode.id,
                    hidden: false,
                    fullName: `${location} (${locationEmployees.length} employees)`,
                    expanded: false
                };
                nodes.push(locationNode);

                links.push({
                    source: managerNode.id,
                    target: locationNode.id
                });

                const jobRoleGroups = groupEmployeesByJobRole(locationEmployees);

                jobRoleGroups.forEach((employees, jobRole) => {
                    const jobRoleNode = {
                        id: nextNodeId++,
                        name: jobRole,
                        type: 'job-role',
                        count: employees.length,
                        employees: employees,
                        managerId: managerNode.id,
                        hidden: false,
                        fullName: `${jobRole} (${employees.length} employees)`,
                        expanded: false
                    };
                    nodes.push(jobRoleNode);

                    links.push({
                        source: locationNode.id,
                        target: jobRoleNode.id
                    });
                });
            });
        }
    };

    // Build upward hierarchy first (managers above the selected manager)
    const processed = new Set();
    buildUpwardHierarchy(manager, processed);

    // Then build downward hierarchy (employees below the selected manager)
    buildDownwardHierarchy(manager['Employee Name']);

    return { nodes, links };
}

/**
 * Shows the management modal for a manager
 * @param {Object} manager - The manager object
 * @param {Array} allEmployees - All employees in the department
 * @param {Array} directReports - Direct reports of the manager
 */
function showManagementModal(manager, allEmployees, directReports) {
    const modal = document.getElementById('managementModal');
    const modalTitle = document.getElementById('managementModalTitle');
    const modalContent = document.getElementById('managementModalContent');

    modalTitle.textContent = `Management Structure: ${manager['Employee Name']}`;

    let modalHTML = `
        <div class="management-section">
            <h3>Direct Reports</h3>
            <ul class="management-list" id="directReportsList"></ul>
        </div>

        <div class="management-section">
            <h3>Management Levels Above</h3>
            <ul class="management-list" id="managementAboveList"></ul>
        </div>
    `;

    modalContent.innerHTML = modalHTML;

    // Populate direct reports
    const jobRoleGroups = groupEmployeesByJobRole(directReports);
    const directReportsList = document.getElementById('directReportsList');

    if (directReports.length === 0) {
        directReportsList.innerHTML = '<li style="padding: 12px; color: #64748B; text-align: center;">No direct reports</li>';
    } else {
        Array.from(jobRoleGroups.entries()).forEach(([jobRole, employees]) => {
            const li = document.createElement('li');
            li.className = 'management-item';
            li.innerHTML = `
                <div class="management-info">
                    <strong>${jobRole}</strong>
                    <span>${employees.length} employees</span>
                </div>
                <button class="management-action-btn" onclick="showEmployeeModal({
                    name: '${jobRole}',
                    type: 'job-role',
                    count: ${employees.length},
                    employees: ${JSON.stringify(employees)},
                    fullName: '${jobRole} (${employees.length} employees)'
                }, true)">View</button>
            `;
            directReportsList.appendChild(li);
        });
    }

    // Populate management above
    const managementAboveList = document.getElementById('managementAboveList');
    const managersAbove = getManagersAbove(manager, allEmployees);

    if (managersAbove.length === 0) {
        managementAboveList.innerHTML = '<li style="padding: 12px; color: #64748B; text-align: center;">No management levels above</li>';
    } else {
        managersAbove.reverse().forEach((manager, index) => {
            const li = document.createElement('li');
            li.className = 'management-item';
            li.innerHTML = `
                <div class="management-info">
                    <strong>${manager['Employee Name']}</strong>
                    <span>${manager['Job Profile']} (Level ${index + 1})</span>
                </div>
                <button class="management-action-btn" onclick="showEmployeeModal({
                    name: '${manager['Employee Name']}',
                    type: 'manager',
                    count: 1,
                    employees: [${JSON.stringify(manager)}],
                    fullName: '${manager['Employee Name']} - ${manager['Job Profile']}'
                })">View</button>
            `;
            managementAboveList.appendChild(li);
        });
    }

    modal.classList.add('active');
}

/**
 * Gets all managers above a given employee in the hierarchy
 * @param {Object} employee - The employee object
 * @param {Array} allEmployees - All employees in the department
 * @returns {Array} Array of managers above the employee
 */
function getManagersAbove(employee, allEmployees) {
    const managersAbove = [];
    const employeeMap = new Map();

    allEmployees.forEach(emp => {
        const normalizedName = normalizeName(emp['Employee Name']);
        employeeMap.set(normalizedName, emp);
    });

    let currentManager = employee;

    while (currentManager && currentManager['Reporting Manager']) {
        const managerName = currentManager['Reporting Manager'];
        const normalizedManagerName = normalizeName(managerName);
        let upperManager = employeeMap.get(normalizedManagerName);

        if (!upperManager) {
            upperManager = findBestMatch(managerName, allEmployees);
        }

        if (upperManager) {
            managersAbove.push(upperManager);
            currentManager = upperManager;
        } else {
            break;
        }
    }

    return managersAbove;
}

/**
 * Generates summary statistics cards
 * @param {Array} employees - Array of employee objects
 * @param {Map} managerStructure - Map of managers and their direct reports
 */
function generateSummaryStats(employees, managerStructure) {
    let totalEmployees = employees.length;
    let managersCount = managerStructure.size;
    let reportingToManager = 0;
    let managerChain = 0;

    if (currentManager) {
        // Find the selected manager in the structure
        const normalizedManagerName = normalizeName(currentManager);
        const managerData = managerStructure.get(normalizedManagerName);

        if (managerData) {
            reportingToManager = managerData.employees.length;

            // Calculate chain of command above this manager
            let current = managerData.manager;
            while (current && current['Reporting Manager']) {
                managerChain++;
                const normalizedName = normalizeName(current['Reporting Manager']);
                const upperManager = managerStructure.get(normalizedName);
                current = upperManager ? upperManager.manager : null;
            }
        }
    }

    const summaryHTML = `
        <div class="stat-card" onclick="showAllEmployees()">
            <span class="stat-number">${totalEmployees}</span>
            <span class="stat-label">Total Employees</span>
        </div>
        ${currentManager ? `
        <div class="stat-card" onclick="showManagementModalForCurrentManager()">
            <span class="stat-number">${reportingToManager}</span>
            <span class="stat-label">Direct Reports</span>
        </div>
        <div class="stat-card" onclick="showManagementModalForCurrentManager()">
            <span class="stat-number">${managerChain}</span>
            <span class="stat-label">Management Levels Above</span>
        </div>
        ` : `
        <div class="stat-card" onclick="showAllManagers()">
            <span class="stat-number">${managersCount}</span>
            <span class="stat-label">Managers in Department</span>
        </div>
        `}
    `;

    document.getElementById('summaryStats').innerHTML = summaryHTML;
}

/**
 * Shows all employees in the current department in a modal
 */
function showAllEmployees() {
    const deptEmployees = employeeData.filter(emp => emp.Department === currentDepartment);
    showEmployeeModal({
        name: `All Employees in ${currentDepartment}`,
        type: 'department',
        count: deptEmployees.length,
        employees: deptEmployees,
        fullName: `All ${deptEmployees.length} employees in ${currentDepartment}`
    }, true);
}

/**
 * Shows all managers in the current department in a modal
 */
function showAllManagers() {
    const deptEmployees = employeeData.filter(emp => emp.Department === currentDepartment);
    const managerStructure = buildManagerStructure(deptEmployees);

    const managers = Array.from(managerStructure.values()).map(data => data.manager);

    showEmployeeModal({
        name: `All Managers in ${currentDepartment}`,
        type: 'managers',
        count: managers.length,
        employees: managers,
        fullName: `All ${managers.length} managers in ${currentDepartment}`
    }, true);
}

/**
 * Shows the management modal for the currently selected manager
 */
function showManagementModalForCurrentManager() {
    if (!currentManager) return;

    const deptEmployees = employeeData.filter(emp => emp.Department === currentDepartment);
    const managerStructure = buildManagerStructure(deptEmployees);

    const normalizedManagerName = normalizeName(currentManager);
    const managerData = managerStructure.get(normalizedManagerName);

    if (managerData) {
        showManagementModal(managerData.manager, deptEmployees, managerData.employees);
    }
}

/**
 * Populates the dataset select dropdown
 */
function populateDatasetSelect() {
    const select = document.getElementById('datasetSelect');
    select.innerHTML = '';

    Object.keys(datasets).forEach(datasetName => {
        const option = document.createElement('option');
        option.value = datasetName;
        option.textContent = datasetName;
        if (datasetName === currentDataset) {
            option.selected = true;
        }
        select.appendChild(option);
    });
}

/**
 * Shows the dataset name modal
 */
function showDatasetNameModal() {
    document.getElementById('datasetNameModal').classList.add('active');
    document.getElementById('datasetName').focus();
}

/**
 * Closes the dataset name modal
 */
function closeDatasetNameModal() {
    document.getElementById('datasetNameModal').classList.remove('active');
    document.getElementById('datasetNameForm').reset();
    pendingFileData = null;
}

/**
 * Saves the dataset with the provided name
 * @param {Event} event - The form submit event
 */
function saveDatasetWithName(event) {
    event.preventDefault();

    const datasetName = document.getElementById('datasetName').value.trim();
    if (!datasetName) {
        showStatus('Please enter a dataset name', 'error');
        return;
    }

    if (datasets[datasetName]) {
        showStatus('Dataset with this name already exists', 'error');
        return;
    }

    // Create new dataset with the pending file data
    datasets[datasetName] = {
        employeeData: pendingFileData,
        currentDepartment: '',
        currentManager: '',
        currentLocation: '',
        nodePositions: {},
        customLayoutSettings: {
            horizontalSpacing: 300,
            verticalSpacing: 200,
            elbowLength: 80,
            nodeSize: 150,
            horizontalSpacingSlider: 100
        }
    };

    currentDataset = datasetName;
    saveCurrentData();
    populateDatasetSelect();
    document.getElementById('datasetSelect').value = datasetName;

    // Process the data
    employeeData = pendingFileData;
    pendingFileData = null;

    document.getElementById('datasetControls').style.display = 'block';
    populateDepartmentSelect();

    closeDatasetNameModal();
    showStatus(`Dataset "${datasetName}" created and loaded`, 'success');
}

/**
 * Switches to the selected dataset
 * @param {Event} event - The select change event
 */
function switchDataset(event) {
    const datasetName = event.target.value;
    if (!datasetName || !datasets[datasetName]) return;

    currentDataset = datasetName;
    saveCurrentData();
    loadDataset(datasetName);
}

/**
 * Loads a dataset by name
 * @param {string} datasetName - The name of the dataset to load
 */
function loadDataset(datasetName) {
    const dataset = datasets[datasetName];
    if (!dataset) return;

    employeeData = dataset.employeeData || [];
    currentDepartment = dataset.currentDepartment || '';
    currentManager = dataset.currentManager || '';
    currentLocation = dataset.currentLocation || '';
    nodePositions = dataset.nodePositions || {};
    customLayoutSettings = dataset.customLayoutSettings || {
        horizontalSpacing: 300,
        verticalSpacing: 200,
        elbowLength: 80,
        nodeSize: 150,
        horizontalSpacingSlider: 100
    };

    // Update sliders to match loaded settings
    document.getElementById('nodeSizeSlider').value = customLayoutSettings.nodeSize;
    document.getElementById('horizontalSpacingSlider').value = customLayoutSettings.horizontalSpacingSlider;
    document.getElementById('fsNodeSizeSlider').value = customLayoutSettings.nodeSize;
    document.getElementById('fsHorizontalSpacingSlider').value = customLayoutSettings.horizontalSpacingSlider;
    updateNodeSizeValue();
    updateHorizontalSpacingValue();

    if (employeeData.length > 0) {
        document.getElementById('departmentSelectDiv').style.display = 'block';
        populateDepartmentSelect();

        if (currentDepartment) {
            document.getElementById('departmentSelect').value = currentDepartment;
            populateManagerSelect(currentDepartment);
            populateLocationSelect(currentDepartment);

            if (currentManager) {
                document.getElementById('managerSelect').value = currentManager;
            }

            if (currentLocation) {
                document.getElementById('locationSelect').value = currentLocation;
                document.getElementById('fsLocationSelect').value = currentLocation;
            }

            generateHierarchyTables();
        }
    } else {
        document.getElementById('departmentSelectDiv').style.display = 'none';
        document.getElementById('managerSelectDiv').style.display = 'none';
        document.getElementById('locationFilter').style.display = 'none';
        document.getElementById('resultsSection').style.display = 'none';
    }

    showStatus(`Loaded dataset "${datasetName}"`, 'success');
}

/**
 * Saves the current dataset to localStorage
 */
function saveCurrentData() {
    const dataToSave = {
        datasets,
        currentDataset,
        nextNodeId
    };
    localStorage.setItem('fedexEmployeeData', JSON.stringify(dataToSave));
}

/**
 * Saves the current dataset state
 */
function saveCurrentDataset() {
    if (!currentDataset) return;

    datasets[currentDataset] = {
        ...datasets[currentDataset],
        employeeData,
        currentDepartment,
        currentManager,
        currentLocation,
        nodePositions,
        customLayoutSettings
    };

    saveCurrentData();
}

/**
 * Saves the current layout settings
 */
function saveCurrentLayout() {
    if (!currentDataset || !hierarchyData) return;

    // Save the current layout to the dataset
    datasets[currentDataset].nodePositions = JSON.parse(JSON.stringify(nodePositions));
    datasets[currentDataset].customLayoutSettings = JSON.parse(JSON.stringify(customLayoutSettings));

    saveCurrentData();
    showStatus(`Layout saved for ${currentManager || currentDepartment}`, 'success');
}

/**
 * Shows a single employee in a modal
 * @param {Event} event - The click event
 * @param {Object} emp - The employee object
 */
function showSingleEmployee(event, emp) {
    event.stopPropagation();
    showEmployeeModal({
        name: emp['Employee Name'],
        type: 'employee',
        count: 1,
        employees: [emp],
        fullName: `${emp['Employee Name']} - ${emp['Job Profile']} (${emp['Employee ID'] || 'N/A'})`
    });
}