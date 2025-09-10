# 🚛 FleetClean - Vehicle Onboarding Checklist

FleetClean is a comprehensive web application designed to streamline and manage the onboarding process for new fleet vehicles. It provides a detailed, multi-phase checklist to ensure all administrative, legal, and physical preparation tasks are completed for DVSA compliance and safe vehicle handover.

## ✨ Features

-   **Multi-Phase Checklist**: Organizes tasks into logical phases, from initial setup and ordering to driver handover and post-delivery administration.
-   **Progress Tracking**: A visual progress bar and per-phase summaries show completion status at a glance. 
-   **Automated Email Notifications**: Automatically sends pre-configured emails for key tasks, such as notifying insurance providers or welcoming drivers.
-   **Persistent Local Storage**: Automatically saves your progress to the browser's local storage, so you can close the tab and resume later.
-   **PDF Report Generation**: Create a clean, printable PDF summary of the entire checklist, including vehicle details and task statuses.
-   **File-Based Backup**: Save and load your progress using local JSON files.
-   **Dynamic & Configurable**: The checklist tasks and email templates are loaded from external JSON files, making them easy to customize without changing the application code.

## 🛠️ Setup and Installation

Follow these steps to get the FleetClean application running on your local machine.

### Prerequisites

-   [Node.js](https://nodejs.org/) (v18 or later recommended)
-   [npm](https://www.npmjs.com/) (comes with Node.js)

### 1. Clone the Repository

Clone this repository to your local machine:
```sh
git clone https://github.com/davidparadine/fleet-checklist-app.git
cd fleet-checklist-app
```

### 2. Install Dependencies

Install the necessary Node.js packages for the backend server:
```sh
npm install
```

### 3. Configure Environment Variables

The application uses a `.env` file to manage secret keys for sending emails.

1.  **Create a `.env` file**: In the root of the project, create a file named `.env`.
2.  **Add Environment Variables**: Add the following keys to the file.
    -   `RESEND_API_KEY`: Your API key from Resend for sending emails.

    ```
    RESEND_API_KEY=re_your_api_key_here
    ```

> **Security Note**: The `.gitignore` file is configured to prevent the `.env` file from being committed to the repository. Never commit your secret keys.

## 🚀 Running Locally

The application is now configured to run with a single command.

1.  **Start the Server:**
    In your terminal, from the project root, run:
    ```sh
    npm start
    ```
    This single command starts the Node.js server, which handles both the backend API and serves the frontend files.

2.  **Open the Application:**
    Open your web browser and navigate to `http://localhost:3000`.

### Using the Application

-   **Fill in Details**: Start by entering the Vehicle Registration, Make & Model, and Driver details at the top.
-   **Complete Tasks**: Expand each phase and update the status of tasks. The progress bar will update automatically.
-   **Load from File**: Use the "Load Progress from File" button to restore a previously saved checklist.
-   **Generate PDF**: Click "Generate PDF Report" to download a printable summary of the checklist.
-   **Reset**: Use the "Reset Checklist" button to clear all progress and start over.

## 🔧 Customization

-   **Tasks**: To add, remove, or modify checklist tasks, edit the `checklist-data.json` file.
-   **Email Templates**: To change the content of automated emails, edit the `email-templates.json` file.

## 💻 Technologies Used

-   **Frontend**: HTML5, CSS3, Vanilla JavaScript
-   **Backend**: Node.js, Express
-   **Email**: Resend
-   **PDF Generation**: jsPDF, jspdf-autotable