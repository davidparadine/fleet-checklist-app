/**
 * Fleet Vehicle Onboarding Checklist
 * 
 * This application helps manage the onboarding process for new fleet vehicles.
 * It features progress tracking, localStorage backup, and the ability to save progress to a GitHub repository.
 */

// === CONFIGURATION ===
const REPO_OWNER = 'davidparadine';
const REPO_NAME = 'fleet-checklist-app';

// === GLOBAL DATA ===
let header = {
    registration: '',
    makeModel: '',
    driverName: '',
    driverEmail: '',
    location: 'Office',
    taxStatus: 'None Personal Use'
};
let tasks = [];
let phaseGroups = {};
let emailTemplates = {};

// === INITIALIZATION ===

/**
 * Main initialization function that runs when the page loads.
 */
window.onload = async function() {
    // Prompt for GitHub PAT if not in sessionStorage for better security
    let pat = sessionStorage.getItem('github_pat');
    if (!pat) {
        pat = prompt('Enter your GitHub Personal Access Token (PAT) for saving progress. This will be stored for the session only.');
        if (pat) {
            sessionStorage.setItem('github_pat', pat);
        } else {
            alert('A PAT is required for saving progress to GitHub. The save button will be disabled. Please refresh to try again.');
        }
    }
    
    await initChecklist();
    setupEventListeners();
};

/**
 * Initializes the checklist by loading tasks, restoring progress, and rendering the form.
 */
async function initChecklist() {
    await Promise.all([
        loadTasks(),
        loadEmailTemplates()
    ]);
    groupTasksByPhase();
    restoreFromLocalStorage();
    renderForm();
    updateHeaderFields();
    updateProgress();
}

/**
 * Loads the checklist tasks from the `checklist-data.json` file.
 */
async function loadTasks() {
    try {
        const response = await fetch('checklist-data.json');
        // Check if the server found the file (e.g., not a 404 error)
        if (!response.ok) {
            throw new Error(`Failed to fetch checklist-data.json. Server responded with status: ${response.status} (${response.statusText})`);
        }
        tasks = await response.json();

    } catch (error) {
        console.error("Could not load tasks:", error);
        // Provide a more detailed alert to the user
        let alertMessage = `Error loading checklist data: ${error.message}\n\n`;
        alertMessage += 'Please check the following:\n';
        alertMessage += '1. Is the http-server running in the correct project directory?\n';
        alertMessage += '2. Is the file named exactly "checklist-data.json"?\n';
        alert(alertMessage);
    }
}

/**
 * Loads the email templates from the `email-templates.json` file.
 */
async function loadEmailTemplates() {
    try {
        const response = await fetch('email-templates.json');
        if (!response.ok) {
            throw new Error(`Failed to fetch email-templates.json. Status: ${response.status}`);
        }
        emailTemplates = await response.json();
    } catch (error) {
        console.error("Could not load email templates:", error);
        alert(`Error loading email templates: ${error.message}\n\nThe application may not be able to send emails correctly.`);
        emailTemplates = {}; // Fallback to an empty object
    }
}

/**
 * Groups the loaded tasks by their phase.
 */
function groupTasksByPhase() {
    phaseGroups = {}; // Clear existing groups
    tasks.forEach(task => {
        if (!phaseGroups[task.phase]) {
            phaseGroups[task.phase] = [];
        }
        phaseGroups[task.phase].push(task);
    });
}

/**
 * Restores the checklist progress from the browser's localStorage.
 */
function restoreFromLocalStorage() {
    const saved = sessionStorage.getItem('checklistProgress');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            // Create a new header object by merging defaults with saved data
            const newHeader = {
                location: 'Office',
                makeModel: '',
                taxStatus: 'None Personal Use',
                ...data.header
            };
            Object.assign(header, newHeader);
            if (data.tasks && Array.isArray(data.tasks)) {
                tasks.forEach((task, index) => {
                    if (data.tasks[index]) {
                        // Restore only the properties we care about, explicitly ignoring 'notes'
                        const savedTask = data.tasks[index];
                        if (savedTask) {
                            task.status = savedTask.status;
                            task.dateActioned = savedTask.dateActioned;
                            if (savedTask.customValue) {
                                task.customValue = savedTask.customValue;
                            }
                        }
                    }
                });

            }
            groupTasksByPhase(); // Re-group tasks after restoring progress
        } catch (error) {
            console.error('Error loading saved progress from localStorage:', error);
        }
    }
}

/**
 * Sets up event listeners for the header input fields.
 */
function setupEventListeners() {
    document.getElementById('registration').addEventListener('change', function() { updateHeader('registration', this.value.toUpperCase()); });
    document.getElementById('make-model').addEventListener('change', function() { updateHeader('makeModel', this.value); });
    document.getElementById('driver-name').addEventListener('change', function() { updateHeader('driverName', this.value); });
    document.getElementById('driver-email').addEventListener('change', function() { updateHeader('driverEmail', this.value); });
    document.getElementById('location').addEventListener('change', function() { updateHeader('location', this.value); });
    document.getElementById('tax-status').addEventListener('change', function() { updateHeader('taxStatus', this.value); });

    // Attach listeners for action buttons
    document.getElementById('save-btn').addEventListener('click', saveToGitHub);
    document.getElementById('load-github-btn').addEventListener('click', showGitHubLoadModal);
    document.getElementById('load-file').addEventListener('change', (event) => loadFromFile(event.target.files[0]));
    document.getElementById('pdf-btn').addEventListener('click', generatePdf);
    document.getElementById('reset-btn').addEventListener('click', resetChecklist);

    // Modal listeners
    document.querySelector('.close-button').addEventListener('click', () => document.getElementById('github-load-modal').style.display = 'none');
}


// === FORM RENDERING ===

/**
 * Renders the entire checklist form.
 */
function renderForm() {
    const form = document.getElementById('checklist-form');
    form.innerHTML = '';

    Object.keys(phaseGroups).forEach(phase => {
        const phaseDiv = document.createElement('div');
        phaseDiv.className = 'phase collapsed'; // Start as collapsed

        const phaseHeader = document.createElement('h3');
        phaseHeader.className = 'phase-header';
        phaseHeader.textContent = phase;
        
        const taskContainer = document.createElement('div');
        taskContainer.className = 'phase-tasks';
        taskContainer.style.display = 'none'; // Start hidden

        phaseHeader.addEventListener('click', () => {
            phaseDiv.classList.toggle('collapsed');
            taskContainer.style.display = phaseDiv.classList.contains('collapsed') ? 'none' : 'block';
        });

        phaseDiv.appendChild(phaseHeader);
        phaseGroups[phase].forEach(task => {
            const globalIndex = tasks.indexOf(task);
            const taskDiv = createTaskElement(task, globalIndex);
            taskContainer.appendChild(taskDiv);
        });
        
        phaseDiv.appendChild(taskContainer);
        form.appendChild(phaseDiv);
    });
}

/**
 * Creates the HTML element for a single task.
 * @param {object} task - The task object.
 * @param {number} index - The index of the task in the global tasks array.
 * @returns {HTMLElement} The task element.
 */
function createTaskElement(task, index) {
    let customInputHtml = '';
    if (task.customInput && task.customInput.type === 'select') {
        const { label, options, id } = task.customInput;
        const optionsHtml = options.map(opt => 
            `<option value="${opt}" ${task.customValue === opt ? 'selected' : ''}>${opt}</option>`
        ).join('');
        customInputHtml = `
            <br>
            <label>${label}:</label>
            <select class="custom-input" id="${id}-${index}">${optionsHtml}</select>
        `;
    }

    const taskDiv = document.createElement('div');
    taskDiv.className = 'task';

    const statusColor = getStatusColor(task.status);

    taskDiv.innerHTML = `
        <div class="expander">
            ▼ ${task.taskId}: ${task.task} 
            <span style="color: ${statusColor};">- Status: ${task.status}</span>
            ${task.requiresEmail ? ' 📧' : ''}
        </div>
        <div class="task-content" id="content-${index}" style="display: none;">
            <label>Status:</label>
            <select class="status-select" id="status-select-${index}">
                <option value="Pending">Pending</option>
                <option value="Actioned">Actioned</option>
                <option value="Skipped">Skipped</option>
            </select>
            <br>
            <label>Date Actioned:</label>
            <input type="date" class="date-input" id="date-${index}" value="${task.dateActioned || ''}">
            ${customInputHtml}
            ${task.requiresEmail ? '<p style="color: #2196f3; font-size: 12px;"><em>📧 This task will trigger an automated email when marked complete.</em></p>' : ''}
        </div>
    `;

    // Set initial values and add event listeners
    const statusSelect = taskDiv.querySelector(`#status-select-${index}`);
    statusSelect.value = task.status;

    const dateInput = taskDiv.querySelector(`#date-${index}`);

    statusSelect.addEventListener('change', async () => {
        await updateTask(index, statusSelect.value, dateInput.value);
    });

    dateInput.addEventListener('change', async () => await updateTask(index, statusSelect.value, dateInput.value));

    // Add click listener for the expander
    const expander = taskDiv.querySelector('.expander');
    const content = taskDiv.querySelector('.task-content');
    expander.style.cursor = 'pointer'; // Make it look clickable
    expander.addEventListener('click', () => {
        content.style.display = content.style.display === 'none' ? 'block' : 'none';
    });

    // Add event listener for the custom input if it exists
    if (task.customInput && task.customInput.type === 'select') {
        const customSelect = taskDiv.querySelector(`#${task.customInput.id}-${index}`);
        customSelect.addEventListener('change', () => {
            task.customValue = customSelect.value;
            saveToLocalStorage();
        });
    }

    return taskDiv;
}

// === STATE MANAGEMENT ===

/**
 * Updates a task's data and saves it to localStorage.
 * @param {number} index - The index of the task to update.
 * @param {string} status - The new status.
 * @param {string} dateActioned - The new date actioned.
 */
async function updateTask(index, status, dateActioned = '') {
    const task = tasks[index];
    if (task) {
        const previousStatus = task.status;
        task.status = status;

        // If status changes from Pending, set date to today. User can still override it.
        if (previousStatus === 'Pending' && status !== 'Pending') {
            task.dateActioned = new Date().toISOString().split('T')[0];
        }

        // If task is actioned and requires an email, trigger it.
        if (previousStatus === 'Pending' && status === 'Actioned' && task.requiresEmail) {
            await triggerEmailNotification(task);
        }

        // Update the date input field in the UI
        const dateInput = document.getElementById(`date-${index}`);
        if (dateInput) {
            dateInput.value = tasks[index].dateActioned;
        }
        
        saveToLocalStorage();
        updateProgress();
    }
}

/**
 * Updates a header field and saves it to localStorage.
 * @param {string} key - The key of the header field to update.
 * @param {string} value - The new value.
 */
function updateHeader(key, value) {
    header[key] = value;
    saveToLocalStorage();
}

/**
 * Saves the current state of the checklist to localStorage.
 */
function saveToLocalStorage() {
    const dataToSave = { 
        header, 
        tasks: structuredClone(tasks) // Deep copy to avoid reference issues
    };
    sessionStorage.setItem('checklistProgress', JSON.stringify(dataToSave));
}

// === UI UPDATES ===

/**
 * Updates the overall and phase-specific progress displays.
 */
function updateProgress() {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status !== 'Pending').length;
    const percent = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
    
    // Update overall progress bar
    document.getElementById('progress-fill').style.width = percent + '%';
    document.getElementById('progress-text').textContent = `${completedTasks}/${totalTasks} tasks completed (${percent.toFixed(1)}%)`;
    
    // Update phase progress summary
    const phaseProgresses = document.getElementById('phase-progresses');
    phaseProgresses.innerHTML = '';
    
    Object.keys(phaseGroups).forEach(phase => {
        const phaseTasks = phaseGroups[phase];
        const phaseCompleted = phaseTasks.filter(t => t.status !== 'Pending').length;
        const phasePercent = phaseTasks.length > 0 ? (phaseCompleted / phaseTasks.length) * 100 : 0;
        const phaseDiv = document.createElement('div');
        phaseDiv.className = 'phase-progress';
        phaseDiv.innerHTML = `<strong>${phase}:</strong> ${phaseCompleted}/${phaseTasks.length} (${phasePercent.toFixed(1)}%)`;
        phaseProgresses.appendChild(phaseDiv);
    });
}

/**
 * Updates the header input fields from the global header object.
 */
function updateHeaderFields() {
    document.getElementById('registration').value = header.registration;
    document.getElementById('make-model').value = header.makeModel;
    document.getElementById('driver-name').value = header.driverName;
    document.getElementById('driver-email').value = header.driverEmail;
    document.getElementById('location').value = header.location;
    document.getElementById('tax-status').value = header.taxStatus;
}

/**
 * Gets the color associated with a task status.
 * @param {string} status - The task status.
 * @returns {string} The color code.
 */
function getStatusColor(status) {
    const colors = {
        'Pending': '#ff9800',
        'Actioned': '#4caf50',
        'Skipped': '#9e9e9e'
    };
    return colors[status] || '#000';
}

/**
 * Generates email content based on a template name.
 * @param {string} templateName - The name of the email template.
 * @param {object} task - The task object.
 * @returns {{subject: string, body: string}} The email subject and body.
 */
function getEmailContent(templateName, task) {
    const template = emailTemplates[templateName] || emailTemplates['default'] || { subject: '', body: '' };

    let subject = template.subject;
    let body = template.body;

    // Replace placeholders
    const replacements = {
        '{{registration}}': header.registration || '[Vehicle Registration]',
        '{{makeModel}}': header.makeModel || '[Make/Model]',
        '{{driverName}}': header.driverName || '[Driver Name]',
        '{{taskName}}': task.task || '[Task Name]'
    };

    Object.entries(replacements).forEach(([placeholder, value]) => {
        subject = subject.replace(new RegExp(placeholder, 'g'), value);
        body = body.replace(new RegExp(placeholder, 'g'), value);
    });

    return { subject, body };
}

/**
 * Triggers a mailto link to open the user's default email client.
 * @param {object} task - The task that requires an email.
 */
async function triggerEmailNotification(task) {
    // Hardcoded from and to addresses as requested.
    const from = 'fleet@paradine.org.uk';
    const to = ['d.paradinejr@gmail.com'];
    
    const { subject, body } = getEmailContent(task.emailTemplate, task);

    showStatus('📧 Sending email via Resend...', 'warning');

    try {
        // This makes a request to the backend server endpoint we created.
        const response = await fetch('/api/send-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ from, to, subject, body }),
        });

        if (!response.ok) {
            const errorResult = await response.json().catch(() => ({ message: 'Failed to send email. Server returned an error.' }));
            throw new Error(errorResult.message);
        }

        showStatus('✅ Email sent successfully!', 'success');
    } catch (error) {
        console.error('Email sending error:', error);
        showStatus(`❌ Failed to send email: ${error.message}`, 'error');
    }
}

// === SAVE/LOAD FUNCTIONS ===

/**
 * Saves the current progress to a file in the GitHub repository.
 */
async function saveToGitHub() {
    const pat = sessionStorage.getItem('github_pat');
    if (!pat) {
        showStatus('Error: GitHub PAT not found. Please refresh the page and enter your token to save.', 'error');
        return;
    }

    const saveBtn = document.getElementById('save-btn');
    const statusEl = document.getElementById('save-status');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    statusEl.innerHTML = '<div class="warning">🔄 Saving progress to GitHub...</div>';

    const progressData = {
        header,
        tasks: JSON.parse(JSON.stringify(tasks)),
        stats: {
            totalTasks: tasks.length,
            completed: tasks.filter(t => t.status !== 'Pending').length,
            progressPercent: (tasks.filter(t => t.status !== 'Pending').length / tasks.length) * 100,
            savedAt: new Date().toISOString(),
            savedBy: header.driverName || 'Unknown'
        }
    };

    const jsonStr = JSON.stringify(progressData, null, 2);
    const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const fileName = `progress/vehicle_${header.registration || 'NEW'}_${timestamp}.json`;

    let existingFileSha = null;

    try {
        // Step 1: Check if the file already exists to get its SHA for updating
        const getFileResponse = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${fileName}`, {
            method: 'GET',
            headers: {
                'Authorization': `token ${pat}`,
                'User-Agent': 'FleetChecklistApp/1.0'
            }
        });

        if (getFileResponse.ok) {
            const fileData = await getFileResponse.json();
            existingFileSha = fileData.sha;
        } else if (getFileResponse.status !== 404) {
            // Handle errors other than "Not Found"
            const errorData = await getFileResponse.json();
            throw new Error(`GitHub API Error (GET) ${getFileResponse.status}: ${errorData.message || getFileResponse.statusText}.`);
        }

        // Step 2: Create or update the file
        const requestBody = {
            message: `Fleet checklist update: ${header.registration || 'New Vehicle'}`,
            content: btoa(unescape(encodeURIComponent(jsonStr))), // UTF-8 safe base64 encoding
            branch: 'main'
        };

        if (existingFileSha) {
            requestBody.sha = existingFileSha;
        }

        const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${fileName}`, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${pat}`,
                'Content-Type': 'application/json',
                'User-Agent': 'FleetChecklistApp/1.0'
            },
            body: JSON.stringify(requestBody)
        });

        if (response.ok) {
            statusEl.innerHTML = `<div class="success">✅ Progress saved to GitHub! File: <strong>${fileName}</strong></div>`;
            saveToLocalStorage();
        } else {
            const errorData = await response.json();
            throw new Error(`GitHub API Error (PUT) ${response.status}: ${errorData.message || response.statusText}.`);
        }
    } catch (error) {
        console.error('Save error:', error);
        statusEl.innerHTML = `<div class="error">❌ Save failed: ${error.message}</div>`;
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = '💾 Save Progress to GitHub';
    }
}

/**
 * Shows a modal with a list of saved files from the GitHub repository.
 */
async function showGitHubLoadModal() {
    const pat = sessionStorage.getItem('github_pat');
    if (!pat) {
        showStatus('Error: GitHub PAT not found. Please refresh and enter your token.', 'error');
        return;
    }

    const modal = document.getElementById('github-load-modal');
    const fileListDiv = document.getElementById('github-file-list');
    modal.style.display = 'block';
    fileListDiv.innerHTML = '<p>🔄 Loading files from GitHub...</p>';

    try {
        const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/progress`, {
            headers: {
                'Authorization': `token ${pat}`,
                'User-Agent': 'FleetChecklistApp/1.0'
            }
        });

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('The "progress" directory does not exist in the repository.');
            }
            const errorData = await response.json();
            throw new Error(`GitHub API Error: ${errorData.message}`);
        }

        const files = await response.json();
        fileListDiv.innerHTML = ''; // Clear loading message

        if (files.length === 0) {
            fileListDiv.innerHTML = '<p>No saved progress files found in the repository.</p>';
            return;
        }

        // Sort files by name descending (most recent first)
        files.sort((a, b) => b.name.localeCompare(a.name));

        files.forEach(file => {
            if (file.type === 'file' && file.name.endsWith('.json')) {
                const fileItem = document.createElement('a');
                fileItem.className = 'github-file-item';
                fileItem.textContent = file.name;
                fileItem.href = '#';
                fileItem.onclick = (e) => {
                    e.preventDefault();
                    if (confirm(`Are you sure you want to load progress from ${file.name}? This will overwrite your current unsaved changes.`)) {
                        loadFromGitHub(file.path);
                        modal.style.display = 'none';
                    }
                };
                fileListDiv.appendChild(fileItem);
            }
        });

    } catch (error) {
        console.error('Error fetching GitHub files:', error);
        fileListDiv.innerHTML = `<p class="error">❌ Failed to load files: ${error.message}</p>`;
    }
}

/**
 * Loads progress from a specific file path in the GitHub repository.
 * @param {string} filePath - The full path to the file in the repo (e.g., 'progress/vehicle_...json').
 */
async function loadFromGitHub(filePath) {
    const pat = sessionStorage.getItem('github_pat');
    showStatus('🔄 Loading file from GitHub...', 'warning');

    try {
        const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`, {
            headers: {
                'Authorization': `token ${pat}`,
                'User-Agent': 'FleetChecklistApp/1.0'
            }
        });

        if (!response.ok) throw new Error('Failed to fetch file content.');

        const fileData = await response.json();
        const jsonContent = atob(fileData.content); // Decode base64 content
        const data = JSON.parse(jsonContent);

        // Use the same logic as loadFromFile to apply the data
        applyLoadedData(data, filePath);

    } catch (error) {
        showStatus(`❌ Error loading from GitHub: ${error.message}`, 'error');
    }
}

/**
 * Loads progress from a user-selected JSON file.
 * @param {File} file - The file to load.
 */
function loadFromFile(file) {
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        applyLoadedData(JSON.parse(e.target.result), file.name);
    };
    reader.readAsText(file);
}

/**
 * Helper function to apply data from a loaded file (local or GitHub) to the application state.
 * @param {object} data - The parsed JSON data.
 * @param {string} sourceName - The name of the file or source for status messages.
 */
function applyLoadedData(data, sourceName) {
    try {
        const newHeader = {
            location: 'Office',
            makeModel: '',
            taxStatus: 'None Personal Use',
            ...data.header
        };
        Object.assign(header, newHeader);

        updateHeaderFields();
        
        if (data.tasks && Array.isArray(data.tasks)) {
            tasks.forEach((task, index) => {
                if (data.tasks[index]) {
                    const savedTask = data.tasks[index];
                    if (savedTask) {
                        task.status = savedTask.status;
                        task.dateActioned = savedTask.dateActioned;
                        if (savedTask.customValue) {
                            task.customValue = savedTask.customValue;
                        }
                    }
                }
            });
            groupTasksByPhase();
        }
        
        renderForm();
        updateProgress();
        saveToLocalStorage();
        showStatus(`✅ Progress loaded successfully from ${sourceName}!`, 'success');
    } catch (error) {
        showStatus(`❌ Error applying loaded data: ${error.message}`, 'error');
    }
}

/**
 * Resets the entire checklist to its initial state.
 */
function resetChecklist() {
    if (confirm('Are you sure you want to reset all progress? This action cannot be undone and will clear your local saves.')) {
        sessionStorage.removeItem('checklistProgress');
        Object.assign(header, { 
            registration: '', 
            makeModel: '',
            driverName: '', 
            driverEmail: '',
            location: 'Office',
            taxStatus: 'None Personal Use'
        });
        
        loadTasks().then(() => {
            groupTasksByPhase();
            updateHeaderFields();
            renderForm();
            updateProgress();
            showStatus('🔄 Checklist has been reset to its initial state.', 'warning');
        });
    }
}

/**
 * Shows a status message to the user.
 * @param {string} message - The message to show.
 * @param {string} type - The type of message (e.g., 'success', 'error', 'warning').
 */
function showStatus(message, type = 'info') {
    const statusEl = document.getElementById('save-status');
    statusEl.className = type;
    statusEl.textContent = message; // Use textContent to prevent XSS
    setTimeout(() => { statusEl.textContent = ''; }, 5000);
}

/**
 * Generates a PDF report of the current checklist state.
 */
function generatePdf() {
    const { jsPDF } = window.jspdf;
    if (!jsPDF) {
        alert('Error: jsPDF library not found. Cannot generate PDF.');
        return;
    }
    const doc = new jsPDF();

    // Find the CAZ task to get its status for the header
    const cazTask = tasks.find(t => t.taskId === '5');
    const cazStatus = cazTask && cazTask.customValue ? cazTask.customValue : 'N/A';

    // 1. Add Title
    doc.setFontSize(18);
    doc.text('Fleet Vehicle Onboarding Report', 14, 22);

    // 2. Add Header Details
    doc.setFontSize(11);
    doc.setTextColor(100);
    let headerText = [
        `Vehicle Registration: ${header.registration || 'N/A'}`,
        `Make & Model: ${header.makeModel || 'N/A'}`,
        `Driver: ${header.driverName || 'N/A'}`,
        `Location: ${header.location}`,
        `Tax Status: ${header.taxStatus}`,
        `Clean Air Zone (CAZ) Status: ${cazStatus}`,
        `Report Generated: ${new Date().toLocaleString()}`
    ];
    doc.text(headerText, 14, 32);

    // 3. Prepare data for the table
    const tableBody = [];
    const tableHead = [['ID', 'Task Description', 'Status', 'Date Actioned']];

    Object.keys(phaseGroups).forEach(phase => {
        // Add a row for the phase title
        tableBody.push([{ content: phase, colSpan: 4, styles: { fontStyle: 'bold', fillColor: [230, 230, 230] } }]);
        
        phaseGroups[phase].forEach(task => {
            // Append custom value to the task description if it exists
            let taskDescription = task.task;
            if (task.customInput && task.customValue) {
                taskDescription += ` (${task.customValue})`;
            }

            tableBody.push([
                task.taskId,
                taskDescription,
                task.status,
                task.dateActioned || ''
            ]);
        });
    });

    // 4. Create the table using jspdf-autotable
    doc.autoTable({ head: tableHead, body: tableBody, startY: 80 });

    // 5. Save the PDF
    doc.save(`FleetClean_Report_${header.registration || 'NEW'}_${new Date().toISOString().split('T')[0]}.pdf`);
}