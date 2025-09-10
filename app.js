/**
 * Fleet Vehicle Onboarding Checklist
 * 
 * This application helps manage the onboarding process for new fleet vehicles.
 * It features progress tracking, localStorage backup, and the ability to save progress to a GitHub repository.
 */

// === CONFIGURATION ===
// The API base URL. For a local setup where the server serves the frontend,
// a relative path (empty string) is sufficient.
const API_BASE_URL = '';

// === GLOBAL DATA ===
let header = {
    registration: '',
    makeModel: '',
    sellerEmail: '',
    driverName: '',
    driverEmail: '',
    driverStartDate: '',
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
 * Restores the checklist progress from the browser's localStorage.
 */
function restoreFromLocalStorage() {
    const saved = localStorage.getItem('checklistProgress');
    if (saved) applyState(JSON.parse(saved), 'local');
}

/**
 * Sets up event listeners for the header input fields.
 */
function setupEventListeners() {
    document.getElementById('registration').addEventListener('change', function() { updateHeader('registration', this.value.toUpperCase()); });
    document.getElementById('make-model').addEventListener('change', function() { updateHeader('makeModel', this.value); });
    document.getElementById('seller-email').addEventListener('change', function() { updateHeader('sellerEmail', this.value); });
    document.getElementById('driver-name').addEventListener('change', function() { updateHeader('driverName', this.value); });
    document.getElementById('driver-email').addEventListener('change', function() { updateHeader('driverEmail', this.value); });
    document.getElementById('driver-start-date').addEventListener('change', function() { updateHeader('driverStartDate', this.value); });
    document.getElementById('location').addEventListener('change', function() { updateHeader('location', this.value); });
    document.getElementById('tax-status').addEventListener('change', function() { updateHeader('taxStatus', this.value); });

    // Attach listeners for action buttons
    document.getElementById('load-file-btn').addEventListener('click', () => document.getElementById('load-file').click());
    document.getElementById('load-file').addEventListener('change', (event) => loadFromFile(event.target.files[0]));
    document.getElementById('save-file-btn').addEventListener('click', saveToFile);
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

        // As requested, if status changes from Pending, always set the date to today.
        if (previousStatus === 'Pending' && status !== 'Pending') {
            task.dateActioned = new Date().toISOString().split('T')[0];
        }

        // If task is actioned and requires an email, trigger it.
        if (previousStatus === 'Pending' && status === 'Actioned' && task.requiresEmail) {
            await triggerEmailNotification(task);
        }

        // Update the date input field in the UI to reflect the new state
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
    localStorage.setItem('checklistProgress', JSON.stringify(dataToSave));
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

    let subject = template.subject;
    let body = template.body;

    // Replace placeholders
    const replacements = {
        '{{registration}}': header.registration || '[Vehicle Registration]',
        '{{makeModel}}': header.makeModel || '[Make/Model]',
        '{{sellerEmail}}': header.sellerEmail || '[Seller Email]',
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
    const from = 'fleet@paradine.org.uk'; // This can be configured in Resend
    
    // Resolve placeholders in the recipient list (e.g., '{{driverEmail}}')
    const recipients = (task.emailRecipients || []).map(recipient => 
        recipient.replace('{{driverEmail}}', header.driverEmail || '')
                 .replace('{{sellerEmail}}', header.sellerEmail || '')
    ).filter(Boolean); // Filter out any empty recipients

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
 * Saves the current checklist state to a JSON file and triggers a download.
 */
function saveToFile() {
    try {
        const dataToSave = {
            header,
            tasks: structuredClone(tasks)
        };
        const dataStr = JSON.stringify(dataToSave, null, 2); // Pretty-print the JSON
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `FleetClean_Progress_${header.registration || 'NEW'}_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showStatus('✅ Progress saved to file!', 'success');
    } catch (error) {
        showStatus(`❌ Failed to save file: ${error.message}`, 'error');
    }
}

/**
 * Loads progress from a user-selected JSON file.
 * @param {File} file - The file to load.
 */
function loadFromFile(file) {
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
 * Applies a state object (from a file, GitHub, or localStorage) to the application.
 * @param {object} data - The parsed JSON data.
 * @param {string} sourceName - The name of the file or source for status messages.
 */
function applyState(data, sourceName) {
    try {
        if (!data || !data.header || !Array.isArray(data.tasks)) {
            throw new Error('Invalid or corrupt data format.');
        }

        // 1. Apply Header Data (merging with defaults)
        Object.assign(header, { location: 'Office', taxStatus: 'None Personal Use', driverStartDate: '', sellerEmail: '', ...data.header });

        // 2. Apply Task Data by matching taskId for robustness
        const savedTasksMap = new Map(data.tasks.map(t => [t.taskId, t]));

        tasks.forEach(task => {
            const savedTask = savedTasksMap.get(task.taskId);
            if (savedTask) {
                // If a matching task is found in the loaded data, apply its state
                task.status = savedTask.status || 'Pending';
                task.dateActioned = savedTask.dateActioned || '';
                task.customValue = savedTask.customValue || task.customValue;
            }
            // If no matching task is found, it remains in its default 'Pending' state,
            // which correctly handles newly added tasks in checklist-data.json.
        });


        // 3. Re-render and update UI
        groupTasksByPhase();
        updateHeaderFields();
        renderForm();
        updateProgress();
        saveToLocalStorage();
        // Only show status if loading from a file, not from initial local storage restore.
        if (sourceName !== 'local') {
            showStatus(`✅ Progress loaded from <strong>${sourceName}</strong>!`, 'success');
        }
    } catch (error) {
        console.error('Error applying state:', error);
        showStatus(`❌ Error applying loaded data: ${error.message}`, 'error');
    }
}

/**
 * Resets the entire checklist to its initial state.
 */
function resetChecklist() {
    if (confirm('Are you sure you want to reset all progress? This will clear your current session and reload the application.')) {
        localStorage.removeItem('checklistProgress');
        showStatus('🔄 Checklist has been reset. Reloading...', 'info', 0); // Show indefinite message

        // Reload the page to get a completely fresh state from the source JSON files.
        // This is more robust than manually resetting state.
        window.location.reload();
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
        `Seller Email: ${header.sellerEmail || 'N/A'}`,
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