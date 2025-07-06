/**
 * Main application logic for the FedEx Hierarchy Generator
 * This file contains the initialization code and event listeners
 */

// Initialize event listeners when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Check for saved data on page load
    const savedData = localStorage.getItem('fedexEmployeeData');
    if (savedData) {
        try {
            const parsedData = JSON.parse(savedData);
            datasets = parsedData.datasets || {};
            currentDataset = parsedData.currentDataset || '';
            nextNodeId = parsedData.nextNodeId || 0;

            if (Object.keys(datasets).length > 0) {
                document.getElementById('datasetControls').style.display = 'block';
                populateDatasetSelect();

                if (currentDataset && datasets[currentDataset]) {
                    loadDataset(currentDataset);
                }
            }
        } catch (error) {
            showStatus('Error loading saved data', 'error');
            console.error(error);
        }
    }

    // Set up event listeners
    document.getElementById('fileInput').addEventListener('change', handleFileUpload);
    document.getElementById('departmentSelect').addEventListener('change', handleDepartmentChange);
    document.getElementById('managerSelect').addEventListener('change', handleManagerChange);
    document.getElementById('locationSelect').addEventListener('change', handleLocationChange);
    document.getElementById('fullscreenBtn').addEventListener('click', toggleFullscreen);
    document.getElementById('saveChartBtn').addEventListener('click', saveChartAsImage);
    document.getElementById('copyChartBtn').addEventListener('click', copyChartToClipboard);
    document.getElementById('chartViewBtn').addEventListener('click', () => toggleView('chart'));
    document.getElementById('hierarchyViewBtn').addEventListener('click', () => toggleView('hierarchy'));
    document.getElementById('editModeBtn').addEventListener('click', toggleEditMode);
    document.getElementById('addNodeBtn').addEventListener('click', showAddNodeModal);
    document.getElementById('saveLayoutBtn').addEventListener('click', saveCurrentLayout);
    document.getElementById('nodeSizeSlider').addEventListener('input', updateNodeSizeValue);
    document.getElementById('horizontalSpacingSlider').addEventListener('input', updateHorizontalSpacingValue);
    document.getElementById('resetLayoutBtn').addEventListener('click', resetLayout);
    document.getElementById('nodeSizeSlider').addEventListener('change', applyNodeSizeAndSpacing);
    document.getElementById('horizontalSpacingSlider').addEventListener('change', applyNodeSizeAndSpacing);
    document.getElementById('fsExitBtn').addEventListener('click', toggleFullscreen);
    document.getElementById('fsScreenshotBtn').addEventListener('click', saveChartAsImage);
    document.getElementById('fsCopyChartBtn').addEventListener('click', copyChartToClipboard);
    document.getElementById('fsEditModeBtn').addEventListener('click', toggleEditMode);
    document.getElementById('fsSaveLayoutBtn').addEventListener('click', saveCurrentLayout);
    document.getElementById('fsNodeSizeSlider').addEventListener('input', function() {
        document.getElementById('nodeSizeSlider').value = this.value;
        updateNodeSizeValue();
        applyNodeSizeAndSpacing();
    });
    document.getElementById('fsHorizontalSpacingSlider').addEventListener('input', function() {
        document.getElementById('horizontalSpacingSlider').value = this.value;
        updateHorizontalSpacingValue();
        applyNodeSizeAndSpacing();
    });
    document.getElementById('fsLocationSelect').addEventListener('change', function() {
        document.getElementById('locationSelect').value = this.value;
        handleLocationChange({ target: { value: this.value } });
    });
    document.getElementById('deleteSingleBtn').addEventListener('click', deleteSingleNode);
    document.getElementById('deleteWithChildrenBtn').addEventListener('click', deleteWithChildren);
    document.getElementById('cancelDelete').addEventListener('click', cancelDelete);
    document.getElementById('addNodeForm').addEventListener('submit', handleAddNode);
    document.getElementById('datasetNameForm').addEventListener('submit', saveDatasetWithName);
    document.getElementById('datasetSelect').addEventListener('change', switchDataset);
    document.getElementById('closeEmployeeModal').addEventListener('click', closeEmployeeModal);
    document.getElementById('closeManagementModal').addEventListener('click', closeManagementModal);
    document.getElementById('closeAddNodeModal').addEventListener('click', closeAddNodeModal);
    document.getElementById('closeDatasetNameModal').addEventListener('click', closeDatasetNameModal);
    document.getElementById('cancelAddNode').addEventListener('click', closeAddNodeModal);

    // Make functions available globally for HTML onclick handlers
    window.toggleGroup = toggleGroup;
    window.expandAllGroups = expandAllGroups;
    window.collapseAllGroups = collapseAllGroups;
    window.showSingleEmployee = showSingleEmployee;
    window.closeEmployeeModal = closeEmployeeModal;
    window.closeManagementModal = closeManagementModal;
    window.showAllEmployees = showAllEmployees;
    window.showAllManagers = showAllManagers;
    window.showManagementModalForCurrentManager = showManagementModalForCurrentManager;
});