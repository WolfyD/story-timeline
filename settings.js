/**
 * Settings Window Module
 * 
 * This module handles the creation and management of the Settings window.
 * It provides a form interface for configuring application settings and communicates
 * with the main process to save the changes.
 * 
 * Key Features:
 * - Form for editing application settings
 * - Settings categories (General, Timeline, Appearance)
 * - Form validation
 * - Communication with main process
 * - Window management
 * 
 * Main Functions:
 * - initializeForm(): Sets up the form and its event listeners
 * - validateForm(): Validates form input before submission
 * - handleSubmit(): Handles form submission and settings update
 * - closeWindow(): Closes the settings window
 * 
 * Settings Categories:
 * - General: Application-wide settings
 * - Timeline: Timeline-specific settings
 * - Appearance: UI and visual settings
 * 
 * IPC Communication:
 * - Sends 'save-settings' message to main process with updated settings
 * - Listens for 'settings-saved' confirmation from main process
 */

// ... rest of existing code ... 