/**
 * Fleet Vehicle Onboarding Checklist
 * 
 * This application helps manage the onboarding process for new fleet vehicles.
 * It features progress tracking, localStorage backup, and the ability to save progress to a GitHub repository.
 */

// === CONFIGURATION ===
const API_BASE_URL = ''; // Use a relative path for the API
const LOCAL_STORAGE_KEY = 'fleetChecklists';

// === GLOBAL DATA ===
let activeChecklistId = null; // The registration of the currently active checklist
let checklists = {}; // Holds all checklist data, keyed by registration
let tasks = []; // Template tasks loaded from checklist-data.json
let phaseGroups = {};
let emailTemplates = {};
let isBusy = false;

// === INITIALIZATION ===

/**
 * Main initialization function that runs when the page loads.
 */
window.onload = async function() {
    await initChecklist();
    setupEventListeners();
};

/**
 * Initializes the checklist system.
 */
async function initChecklist() {
    await Promise.all([loadTasks(), loadEmailTemplates()]);
    groupTasksByPhase();
    restoreFromLocalStorage();

    // If no checklists are loaded, create a default one
    if (Object.keys(checklists).length === 0) {
        createNewChecklist('NEW_VEHICLE_1');
    } else {
        // Otherwise, set the first checklist as active
        activeChecklistId = Object.keys(checklists)[0];
    }

    populateChecklistSelector();
    renderActiveChecklist();
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
        alertMessage += 'Please ensure the application is running correctly and that the file "checklist-data.json" exists in the project root.';
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
 * Restores all checklists from the browser's localStorage.
 */
function restoreFromLocalStorage() {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
        checklists = JSON.parse(saved);
    }
}

/**
 * Saves the entire checklists object to localStorage.
 */
function saveToLocalStorage() {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(checklists));
}


/**
 * Sets up event listeners for all interactive elements.
 */
function setupEventListeners() {
    // Checklist management
    document.getElementById('checklist-select').addEventListener('change', (e) => {
        switchChecklist(e.target.value);
    });
    document.getElementById('new-checklist-btn').addEventListener('click', () => {
        const reg = prompt('Enter new vehicle registration:');
        if (reg) createNewChecklist(reg.toUpperCase());
    });
    document.getElementById('delete-checklist-btn').addEventListener('click', deleteActiveChecklist);

    // Header fields
    document.getElementById('registration').addEventListener('change', (e) => handleRegistrationChange(e.target.value));
    document.getElementById('make-model').addEventListener('change', (e) => updateHeader('makeModel', e.target.value));
    document.getElementById('seller-email').addEventListener('change', (e) => updateHeader('sellerEmail', e.target.value));
    document.getElementById('driver-name').addEventListener('change', (e) => updateHeader('driverName', e.target.value));
    document.getElementById('driver-email').addEventListener('change', (e) => updateHeader('driverEmail', e.target.value));
    document.getElementById('driver-start-date').addEventListener('change', (e) => updateHeader('driverStartDate', e.target.value));
    document.getElementById('location').addEventListener('change', (e) => updateHeader('location', e.target.value));
    document.getElementById('tax-status').addEventListener('change', (e) => updateHeader('taxStatus', e.target.value));

    // Action buttons
    document.getElementById('load-file-btn').addEventListener('click', () => document.getElementById('load-file').click());
    document.getElementById('load-file').addEventListener('change', (e) => loadFromFile(e.target.files[0]));
    document.getElementById('save-server-btn').addEventListener('click', saveToServer);
    document.getElementById('pdf-btn').addEventListener('click', generatePdf);
    document.getElementById('reset-btn').addEventListener('click', resetChecklist);
}


/**
 * Finds URLs in a string and converts them to clickable HTML anchor tags.
 * @param {string} text - The text to parse for URLs.
 * @returns {string} The text with URLs converted to HTML.
 */
function linkify(text) {
    const urlRegex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
    // Add onclick to stop the expander's click event from firing when a link is clicked.
    return text.replace(urlRegex, function(url) {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">${url}</a>`;
    });
}


// === FORM RENDERING ===

/**
 * Renders the form for the currently active checklist.
 */
function renderActiveChecklist() {
    if (!activeChecklistId || !checklists[activeChecklistId]) {
        console.error("No active checklist to render.");
        return;
    }

    const form = document.getElementById('checklist-form');
    form.innerHTML = ''; // Clear previous content

    Object.keys(phaseGroups).forEach(phase => {
        const phaseDiv = document.createElement('div');
        phaseDiv.className = 'phase collapsed';

        const phaseHeader = document.createElement('h3');
        phaseHeader.className = 'phase-header';
        phaseHeader.textContent = phase;
        
        const taskContainer = document.createElement('div');
        taskContainer.className = 'phase-tasks';
        taskContainer.style.display = 'none';

        phaseHeader.addEventListener('click', () => {
            phaseDiv.classList.toggle('collapsed');
            taskContainer.style.display = phaseDiv.classList.contains('collapsed') ? 'none' : 'block';
        });

        phaseDiv.appendChild(phaseHeader);

        // Use the tasks from the active checklist
        const checklistTasks = checklists[activeChecklistId].tasks;
        phaseGroups[phase].forEach(templateTask => {
            // Find the corresponding task in the active checklist
            const task = checklistTasks.find(t => t.taskId === templateTask.taskId);
            if (task) {
                const taskDiv = createTaskElement(task, checklistTasks.indexOf(task));
                taskContainer.appendChild(taskDiv);
            }
        });
        
        phaseDiv.appendChild(taskContainer);
        form.appendChild(phaseDiv);
    });

    updateHeaderFields();
    updateProgress();
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
    
    // Convert any URLs in the task description to clickable links
    const linkedTaskText = linkify(task.task);
    const statusColor = getStatusColor(task.status);

    taskDiv.innerHTML = `
        <div class="expander">
            ▼ ${task.taskId}: ${linkedTaskText} 
            <span style="color: ${statusColor};">- Status: ${task.status}</span>
            ${task.requiresEmail ? ' 📧' : ''}
        </div>
        <div class="task-content" id="content-${index}" style="display: none;">
            <label>Status:</label>
            <select class="status-select" id="status-select-${index}"></select>
            <br>
            <label>Date Actioned:</label>
            <input type="date" class="date-input" id="date-${index}" value="${task.dateActioned || ''}">
            ${customInputHtml}
            ${task.requiresEmail ? '<p style="color: #2196f3; font-size: 12px;"><em>📧 This task will trigger an automated email when marked complete.</em></p>' : ''}
        </div>
    `;

    // Set initial values and add event listeners
    const statusSelect = taskDiv.querySelector(`#status-select-${index}`);

    // Populate status options
    const statusOptions = task.availableStatuses || ['Pending', 'Actioned', 'Skipped'];
    statusOptions.forEach(option => {
        const optionEl = document.createElement('option');
        optionEl.value = option;
        optionEl.textContent = option;
        statusSelect.appendChild(optionEl);
    });
    statusSelect.value = task.status;

    const dateInput = taskDiv.querySelector(`#date-${index}`);

    const handleUpdate = async () => {
        await updateTask(index, statusSelect.value);
    };

    statusSelect.addEventListener('change', handleUpdate);

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
            // Ensure we're modifying the task in the active checklist
            checklists[activeChecklistId].tasks[index].customValue = customSelect.value;
            saveToLocalStorage();
        });
    }

    return taskDiv;
}

// === STATE MANAGEMENT ===

/**
 * Updates a task in the active checklist.
 * @param {number} taskIndex - The index of the task in the checklist's task array.
 * @param {string} status - The new status.
 */
async function updateTask(taskIndex, status) {
    setBusy(true);
    const checklist = checklists[activeChecklistId];
    if (checklist && checklist.tasks[taskIndex]) {
        const task = checklist.tasks[taskIndex];
        const previousStatus = task.status;
        task.status = status;

        if (previousStatus === 'Pending' && status !== 'Pending') {
            task.dateActioned = new Date().toISOString().split('T')[0];
            document.getElementById(`date-${taskIndex}`).value = task.dateActioned;
        }

        if (previousStatus === 'Pending' && status === 'Actioned' && task.requiresEmail) {
            await triggerEmailNotification(task);
        }
        
        saveToLocalStorage();
        updateProgress(); // This will re-render progress based on the active checklist
    }
    setBusy(false);
}

/**
 * Updates a header field in the active checklist.
 * @param {string} key - The header field key.
 * @param {string} value - The new value.
 */
function updateHeader(key, value) {
    if (checklists[activeChecklistId]) {
        checklists[activeChecklistId].header[key] = value;
        saveToLocalStorage();
    }
}

// === UI UPDATES ===

/**
 * Populates the checklist selector dropdown.
 */
function populateChecklistSelector() {
    const select = document.getElementById('checklist-select');
    select.innerHTML = '';
    Object.keys(checklists).forEach(reg => {
        const option = document.createElement('option');
        option.value = reg;
        option.textContent = reg;
        select.appendChild(option);
    });
    select.value = activeChecklistId;
}


/**
 * Updates the progress displays for the active checklist.
 */
function updateProgress() {
    const checklist = checklists[activeChecklistId];
    if (!checklist) return;

    const totalTasks = checklist.tasks.length;
    const completedTasks = checklist.tasks.filter(t => t.status !== 'Pending').length;
    const percent = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    document.getElementById('progress-fill').style.width = `${percent}%`;
    document.getElementById('progress-text').textContent = `${completedTasks}/${totalTasks} tasks completed (${percent.toFixed(1)}%)`;

    const phaseProgresses = document.getElementById('phase-progresses');
    phaseProgresses.innerHTML = '';
    Object.keys(phaseGroups).forEach(phase => {
        const phaseTemplateTasks = phaseGroups[phase];
        const phaseChecklistTasks = checklist.tasks.filter(t => phaseTemplateTasks.some(pt => pt.taskId === t.taskId));
        const completedInPhase = phaseChecklistTasks.filter(t => t.status !== 'Pending').length;
        const phasePercent = phaseChecklistTasks.length > 0 ? (completedInPhase / phaseChecklistTasks.length) * 100 : 0;

        const phaseDiv = document.createElement('div');
        phaseDiv.className = 'phase-progress';
        phaseDiv.innerHTML = `<strong>${phase}:</strong> ${completedInPhase}/${phaseChecklistTasks.length} (${phasePercent.toFixed(1)}%)`;
        phaseProgresses.appendChild(phaseDiv);
    });
}

/**
 * Updates the header input fields from the active checklist's header data.
 */
function updateHeaderFields() {
    const header = checklists[activeChecklistId].header;
    document.getElementById('registration').value = header.registration;
    document.getElementById('make-model').value = header.makeModel;
    document.getElementById('seller-email').value = header.sellerEmail || '';
    document.getElementById('driver-name').value = header.driverName;
    document.getElementById('driver-email').value = header.driverEmail;
    document.getElementById('driver-start-date').value = header.driverStartDate;
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
    const activeHeader = checklists[activeChecklistId].header;

    let subject = template.subject;
    let body = template.body;

    // Replace placeholders
    const replacements = {
        '{{registration}}': activeHeader.registration || '[Vehicle Registration]',
        '{{makeModel}}': activeHeader.makeModel || '[Make/Model]',
        '{{sellerEmail}}': activeHeader.sellerEmail || '[Seller Email]',
        '{{driverName}}': activeHeader.driverName || '[Driver Name]',
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
    const from = 'fleet@paradine.org.uk';
    const activeHeader = checklists[activeChecklistId].header;
    
    // Resolve placeholders
    const recipients = (task.emailRecipients || []).map(rcp =>
        rcp.replace('{{driverEmail}}', activeHeader.driverEmail || '')
           .replace('{{sellerEmail}}', activeHeader.sellerEmail || '')
    ).filter(Boolean);

    // Use the resolved recipients, or a fallback if the list is empty.
    const to = recipients.length > 0 ? recipients : ['d.paradinejr@gmail.com'];
    
    const { subject, body } = getEmailContent(task.emailTemplate, task);

    showStatus('📧 Sending email via Resend...', 'warning');

    try {
        // This makes a request to the backend server endpoint we created.
        const response = await fetch(`${API_BASE_URL}/api/send-email`, {
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

/**
 * Gets the currently active checklist object.
 * @returns {object|null} The active checklist or null if not found.
 */
function getActiveChecklist() {
    return checklists[activeChecklistId] || null;
}


/**
 * Saves the active checklist to the server.
 */
async function saveToServer() {
    const activeChecklist = getActiveChecklist();
    if (!activeChecklist) {
        showStatus('❌ No active checklist to save.', 'error');
        return;
    }

    try {
        const filename = `FleetClean_Progress_${activeChecklist.header.registration || 'NEW'}_${new Date().toISOString().split('T')[0]}.json`;
        showStatus('☁️ Saving progress to server...', 'warning', 0);

        const response = await fetch(`${API_BASE_URL}/api/save-progress`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ filename, data: activeChecklist }),
        });

        if (!response.ok) {
            const errorResult = await response.json().catch(() => ({ message: 'Failed to save to server. An unknown error occurred.' }));
            throw new Error(errorResult.message);
        }

        showStatus(`✅ Progress saved to server in <strong>progress_files/${filename}</strong>`, 'success');

    } catch (error) {
        console.error('Server save error:', error);
        showStatus(`❌ Failed to save to server: ${error.message}`, 'error');
    }
}

/**
 * Loads progress from a user-selected JSON file.
 * @param {File} file - The file to load.
 */
function loadFromFile(file) {
    if (isBusy) {
        showStatus('Please wait for the current operation to finish before loading a file.', 'warning');
        return;
    }

    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            applyState(data, file.name);
        } catch (error) {
            showStatus(`❌ Error parsing file: ${error.message}`, 'error');
        }
    };
    reader.readAsText(file);
}

/**
/**
 * Applies a loaded state to the checklists data.
 * @param {object} data - The checklist data to apply.
 * @param {string} sourceName - The source of the data for display messages.
 */
function applyState(data, sourceName) {
    try {
        if (!data || !data.header || !data.header.registration || !Array.isArray(data.tasks)) {
            throw new Error('Invalid or corrupt data format. Missing registration or tasks.');
        }

        const reg = data.header.registration.toUpperCase();

        // Create a new checklist object from the template tasks
        const newChecklist = createNewChecklist(reg, false); // Create without switching

        // Merge header and task data
        Object.assign(newChecklist.header, data.header);
        const savedTasksMap = new Map(data.tasks.map(t => [t.taskId, t]));
        newChecklist.tasks.forEach(task => {
            const savedTask = savedTasksMap.get(task.taskId);
            if (savedTask) {
                Object.assign(task, savedTask);
            }
        });

        checklists[reg] = newChecklist;
        switchChecklist(reg);
        saveToLocalStorage();
        populateChecklistSelector();
        showStatus(`✅ Progress for <strong>${reg}</strong> loaded from <strong>${sourceName}</strong>!`, 'success');

    } catch (error) {
        console.error('Error applying state:', error);
        showStatus(`❌ Error applying loaded data: ${error.message}`, 'error');
    }
}

/**
 * Creates a new, blank checklist.
 * @param {string} registration - The registration for the new checklist.
 * @param {boolean} [switchNow=true] - Whether to switch to the new checklist immediately.
 * @returns {object} The newly created checklist object.
 */
function createNewChecklist(registration, switchNow = true) {
    const reg = registration.toUpperCase();
    if (checklists[reg]) {
        alert(`A checklist for "${reg}" already exists.`);
        return null;
    }

    // Deep clone the template tasks to create a new set for this checklist
    const newTasks = structuredClone(tasks);

    checklists[reg] = {
        header: {
            registration: reg,
            makeModel: '',
            sellerEmail: '',
            driverName: '',
            driverEmail: '',
            driverStartDate: '',
            location: 'Office',
            taxStatus: 'None Personal Use'
        },
        tasks: newTasks
    };

    if (switchNow) {
        switchChecklist(reg);
        populateChecklistSelector();
        showStatus(`✨ New checklist created for <strong>${reg}</strong>.`, 'success');
    }
    saveToLocalStorage();
    return checklists[reg];
}

/**
 * Switches the active checklist.
 * @param {string} registration - The registration of the checklist to switch to.
 */
function switchChecklist(registration) {
    if (checklists[registration]) {
        activeChecklistId = registration;
        renderActiveChecklist();
    }
}

/**
 * Deletes the currently active checklist.
 */
function deleteActiveChecklist() {
    if (!activeChecklistId) return;

    if (confirm(`Are you sure you want to delete the checklist for "${activeChecklistId}"? This cannot be undone.`)) {
        delete checklists[activeChecklistId];
        const remainingKeys = Object.keys(checklists);
        activeChecklistId = remainingKeys.length > 0 ? remainingKeys[0] : null;

        saveToLocalStorage();
        populateChecklistSelector();

        if (activeChecklistId) {
            renderActiveChecklist();
        } else {
            // If no checklists are left, create a new default one
            createNewChecklist('NEW_VEHICLE_1');
        }
        showStatus(`🗑️ Checklist for <strong>${activeChecklistId}</strong> deleted.`, 'info');
    }
}


/**
 * Resets the active checklist to its initial state.
 */
function resetChecklist() {
    if (confirm(`Are you sure you want to reset all progress for "${activeChecklistId}"?`)) {
        // Re-create the checklist from the template
        const reg = activeChecklistId;
        delete checklists[reg];
        createNewChecklist(reg);
        showStatus(`🔄 Checklist for <strong>${reg}</strong> has been reset.`, 'info');
    }
}

/**
 * Shows a status message to the user.
 * @param {string} message - The message to show (can include HTML).
 * @param {string} type - The type of message (e.g., 'success', 'error', 'warning').
 * @param {number} [timeout=5000] - How long to display the message in ms. 0 for indefinite.
 */
function showStatus(message, type = 'info', timeout = 5000) {
    // Create status element if it doesn't exist
    let statusEl = document.getElementById('save-status');
    if (!statusEl) return; // Or create it dynamically if preferred
    // Clear any existing timeout to prevent it from clearing a new message prematurely.
    if (statusEl.timeoutId) {
        clearTimeout(statusEl.timeoutId);
    }
    statusEl.className = `status ${type}`;
    statusEl.innerHTML = message; // Use innerHTML to allow for bolding, etc.
    
    if (timeout > 0) {
        statusEl.timeoutId = setTimeout(() => { statusEl.innerHTML = ''; }, timeout);
    }
}

/**
 * Sets the busy state of the application and updates the UI accordingly.
 * @param {boolean} busy - True if the app is busy, false otherwise.
 */
function setBusy(busy) {
    isBusy = busy;
    const saveButton = document.getElementById('save-server-btn');
    if (saveButton) {
        saveButton.disabled = isBusy;
        saveButton.textContent = isBusy ? '⏳ Please Wait...' : '☁️ Save Progress to Server';
    }
}


/**
 * Handles changes to the registration input field.
 * This is complex because the registration is the key for the checklists map.
 * @param {string} newRegistration - The new registration value.
 */
function handleRegistrationChange(newRegistration) {
    const newReg = newRegistration.toUpperCase();
    const oldReg = activeChecklistId;

    if (newReg === oldReg) return; // No change

    if (checklists[newReg]) {
        alert(`Error: A checklist for "${newReg}" already exists. Cannot rename.`);
        // Revert the input field to the old registration
        document.getElementById('registration').value = oldReg;
        return;
    }

    // Update the key in the checklists object
    checklists[newReg] = checklists[oldReg];
    delete checklists[oldReg];

    // Update the header registration property
    checklists[newReg].header.registration = newReg;

    // Update the active checklist ID
    activeChecklistId = newReg;

    saveToLocalStorage();
    populateChecklistSelector(); // Re-populate to reflect the new name
    showStatus(`📝 Renamed checklist to <strong>${newReg}</strong>.`, 'info');
}


/**
 * Generates a PDF report for the active checklist.
 */
function generatePdf() {
    const { jsPDF } = window.jspdf;
    const checklist = getActiveChecklist();
    if (!jsPDF || !checklist) {
        alert('Error: PDF library not found or no active checklist.');
        return;
    }
    const doc = new jsPDF();

    const cazTask = checklist.tasks.find(t => t.taskId === '5');
    const cazStatus = cazTask?.customValue || 'N/A';

    doc.setFontSize(18);
    doc.text('Fleet Vehicle Onboarding Report', 14, 22);

    doc.setFontSize(11);
    doc.setTextColor(100);
    const header = checklist.header;
    doc.text([
        `Vehicle Registration: ${header.registration || 'N/A'}`,
        `Make & Model: ${header.makeModel || 'N/A'}`,
        `Seller Email: ${header.sellerEmail || 'N/A'}`,
        `Driver: ${header.driverName || 'N/A'}`,
        `Location: ${header.location}`,
        `Tax Status: ${header.taxStatus}`,
        `Clean Air Zone (CAZ) Status: ${cazStatus}`,
        `Report Generated: ${new Date().toLocaleString()}`
    ], 14, 32);

    const tableBody = [];
    Object.keys(phaseGroups).forEach(phase => {
        tableBody.push([{ content: phase, colSpan: 4, styles: { fontStyle: 'bold', fillColor: [230, 230, 230] } }]);
        const phaseTemplateTasks = phaseGroups[phase];
        phaseTemplateTasks.forEach(templateTask => {
            const task = checklist.tasks.find(t => t.taskId === templateTask.taskId);
            if (task) {
                let desc = task.task;
                if (task.customValue) desc += ` (${task.customValue})`;
                tableBody.push([task.taskId, desc, task.status, task.dateActioned || '']);
            }
        });
    });

    doc.autoTable({
        head: [['ID', 'Task Description', 'Status', 'Date Actioned']],
        body: tableBody,
        startY: 80
    });

    doc.save(`FleetClean_Report_${header.registration || 'NEW'}_${new Date().toISOString().split('T')[0]}.pdf`);
}