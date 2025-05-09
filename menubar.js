/**
 * MenuBar Module
 * 
 * This module handles the creation and management of the application's menu bar system.
 * It provides a clean API for creating Windows-style menu bars with dropdown menus.
 * 
 * Key Features:
 * - Creates and manages a fixed menu bar at the top of the window
 * - Supports dropdown menus with items, separators, and disabled states
 * - Handles menu positioning and click-outside behavior
 * - Ensures dropdowns stay within window bounds
 * 
 * Main Functions:
 * - addMenu(label, items): Creates a new menu button with dropdown items
 *   @param {string} label - The label for the main menu button
 *   @param {Array} items - Array of menu items with {label, action, disabled, separator} properties
 * 
 * - closeAllDropdowns(): Closes all open dropdown menus
 * 
 * Usage Example:
 * menubar.addMenu('File', [
 *   { label: 'New', action: () => console.log('New clicked') },
 *   { separator: true },
 *   { label: 'Exit', action: () => window.close() }
 * ]);
 */

class MenuBar {
    constructor() {
        this.menubar = document.createElement('div');
        this.menubar.className = 'menubar';
        document.body.insertBefore(this.menubar, document.body.firstChild);
        
        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.menubar')) {
                this.closeAllDropdowns();
            }
        });
    }

    /**
     * Add a main menu button with dropdown items
     * @param {string} label - The label for the main menu button
     * @param {Array} items - Array of menu items with {label, action, disabled, separator} properties
     */
    addMenu(label, items) {
        const button = document.createElement('button');
        button.className = 'menubar-button';
        button.textContent = label;
        
        const dropdown = document.createElement('div');
        dropdown.className = 'menubar-dropdown';
        
        items.forEach(item => {
            if (item.separator) {
                const separator = document.createElement('div');
                separator.className = 'menubar-dropdown-separator';
                dropdown.appendChild(separator);
            } else {
                const menuItem = document.createElement('a');
                menuItem.className = 'menubar-dropdown-item';
                if (item.disabled) menuItem.classList.add('disabled');
                menuItem.textContent = item.label;
                
                if (!item.disabled && item.action) {
                    menuItem.addEventListener('click', (e) => {
                        e.stopPropagation();
                        item.action();
                        this.closeAllDropdowns();
                    });
                }
                
                dropdown.appendChild(menuItem);
            }
        });
        
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeAllDropdowns();
            dropdown.classList.add('active');
            
            // Position the dropdown
            const rect = button.getBoundingClientRect();
            dropdown.style.left = rect.left + 'px';
            
            // Ensure dropdown doesn't go off screen
            const dropdownRect = dropdown.getBoundingClientRect();
            const rightEdge = dropdownRect.left + dropdownRect.width;
            if (rightEdge > window.innerWidth) {
                dropdown.style.left = (window.innerWidth - dropdownRect.width) + 'px';
            }
        });
        
        this.menubar.appendChild(button);
        document.body.appendChild(dropdown);
    }

    /**
     * Close all open dropdowns
     */
    closeAllDropdowns() {
        document.querySelectorAll('.menubar-dropdown.active').forEach(dropdown => {
            dropdown.classList.remove('active');
        });
    }
}

// Create and export a singleton instance
const menubar = new MenuBar();
export default menubar; 