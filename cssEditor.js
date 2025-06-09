/**
 * Enhanced CSS Editor
 * 
 * A vanilla JavaScript CSS editor with:
 * - Syntax highlighting for selectors, properties, values, comments
 * - Property and value autocomplete
 * - Selector suggestions from DOM
 * - Current style insertion for selected elements
 * - Live preview functionality
 */

class EnhancedCSSEditor {
    constructor(textareaId, options = {}) {
        this.textarea = document.getElementById(textareaId);
        this.options = {
            enableAutoComplete: true,
            enableSelectorHelper: true,
            ...options
        };
        
        this.suggestionBox = null;
        this.currentSuggestions = [];
        this.selectedSuggestion = -1;
        
        this.init();
    }

    init() {
        if (!this.textarea) {
            console.error('CSS Editor: Textarea not found');
            return;
        }

        this.setupContainer();
        
        if (this.options.enableSelectorHelper) {
            this.createSelectorHelper();
        }
        
        if (this.options.enableAutoComplete) {
            this.setupAutoComplete();
        }

        this.setupEventListeners();
    }

    setupContainer() {
        const container = document.createElement('div');
        container.className = 'css-editor-container';
        this.textarea.parentNode.insertBefore(container, this.textarea);
        container.appendChild(this.textarea);
        this.container = container;
    }

    createSelectorHelper() {
        const helper = document.createElement('div');
        helper.className = 'css-selector-helper';
        helper.innerHTML = `
            <div class="selector-input-group">
                <input type="text" 
                       id="css-selector-input" 
                       placeholder="Type or select a CSS selector (e.g., .timeline-item-box)"
                       list="css-selectors-datalist"
                       autocomplete="off">
                <datalist id="css-selectors-datalist"></datalist>
                <button type="button" id="css-load-styles-btn" class="css-helper-button">
                    Insert Current Styles
                </button>
                <button type="button" id="css-refresh-selectors-btn" class="css-helper-button" title="Refresh selector list">
                    ↻
                </button>
            </div>
            <div class="css-current-styles-preview" id="css-styles-preview" style="display: none;">
                <div class="css-preview-header">Current Styles:</div>
                <div class="css-styles-grid" id="css-styles-grid"></div>
            </div>
        `;
        
        this.container.insertBefore(helper, this.textarea);
        this.setupSelectorHelperEvents();
        this.populateSelectors();
    }

    setupSelectorHelperEvents() {
        const selectorInput = document.getElementById('css-selector-input');
        const loadButton = document.getElementById('css-load-styles-btn');
        const refreshButton = document.getElementById('css-refresh-selectors-btn');
        
        loadButton.addEventListener('click', () => {
            this.insertCurrentStyles();
        });
        
        refreshButton.addEventListener('click', () => {
            this.populateSelectors();
        });

        selectorInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.insertCurrentStyles();
            }
        });
    }

    populateSelectors() {
        const selectors = this.getAllAvailableSelectors();
        const datalist = document.getElementById('css-selectors-datalist');
        
        if (datalist) {
            datalist.innerHTML = '';
            selectors.forEach(selector => {
                const option = document.createElement('option');
                option.value = selector;
                datalist.appendChild(option);
            });
        }
    }

    getAllAvailableSelectors() {
        const selectors = new Set();
        
        // Get selectors from existing stylesheets
        try {
            for (let sheet of document.styleSheets) {
                try {
                    const rules = sheet.cssRules || sheet.rules;
                    for (let rule of rules) {
                        if (rule.selectorText) {
                            rule.selectorText.split(',').forEach(sel => {
                                const cleaned = sel.trim();
                                if (cleaned && !cleaned.includes('@')) {
                                    selectors.add(cleaned);
                                }
                            });
                        }
                    }
                } catch (e) {
                    continue;
                }
            }
        } catch (e) {
            console.warn('Could not access some stylesheets');
        }
        
        // Get classes and IDs from DOM elements
        document.querySelectorAll('*').forEach(el => {
            // Add classes
            if (el.className && typeof el.className === 'string') {
                el.className.split(' ').forEach(cls => {
                    const cleaned = cls.trim();
                    if (cleaned && !cleaned.includes(' ')) {
                        selectors.add(`.${cleaned}`);
                    }
                });
            }
            
            // Add IDs
            if (el.id) {
                selectors.add(`#${el.id}`);
            }
        });
        
        return Array.from(selectors).sort();
    }

    getCurrentStylesForSelector(selector) {
        try {
            const elements = document.querySelectorAll(selector);
            if (elements.length === 0) return null;
            
            const computed = getComputedStyle(elements[0]);
            const relevantStyles = {};
            
            const commonProperties = [
                'color', 'background-color', 'background', 'font-size', 'font-family', 
                'font-weight', 'text-align', 'margin', 'padding', 'border', 'border-radius',
                'width', 'height', 'display', 'position', 'top', 'left', 'right', 'bottom',
                'z-index', 'opacity', 'transform', 'transition'
            ];
            
            commonProperties.forEach(prop => {
                const value = computed.getPropertyValue(prop);
                if (value && value !== 'initial' && value !== 'auto' && value !== 'normal') {
                    if (!(prop === 'color' && value === 'rgb(0, 0, 0)') &&
                        !(prop === 'background-color' && value === 'rgba(0, 0, 0, 0)')) {
                        relevantStyles[prop] = value;
                    }
                }
            });
            
            return relevantStyles;
        } catch (e) {
            console.error('Error getting styles for selector:', selector, e);
            return null;
        }
    }

    generateCSSRule(selector, styles) {
        let css = `${selector} {\n`;
        for (const [property, value] of Object.entries(styles)) {
            css += `    ${property}: ${value};\n`;
        }
        css += `}\n\n`;
        return css;
    }

    insertCurrentStyles() {
        const selectorInput = document.getElementById('css-selector-input');
        const selector = selectorInput.value.trim();
        
        if (!selector) {
            alert('Please enter a CSS selector');
            return;
        }
        
        const currentStyles = this.getCurrentStylesForSelector(selector);
        if (!currentStyles || Object.keys(currentStyles).length === 0) {
            alert(`No elements found or no relevant styles for selector: ${selector}`);
            return;
        }
        
        const cssRule = this.generateCSSRule(selector, currentStyles);
        
        // Insert the CSS rule at cursor position
        const start = this.textarea.selectionStart;
        const end = this.textarea.selectionEnd;
        const currentValue = this.textarea.value;
        
        this.textarea.value = currentValue.substring(0, start) + cssRule + currentValue.substring(end);
        
        // Position cursor after inserted text
        const newPosition = start + cssRule.length;
        this.textarea.setSelectionRange(newPosition, newPosition);
        this.textarea.focus();
        
        // Show preview of current styles
        this.showCurrentStylesPreview(selector, currentStyles);
    }

    showCurrentStylesPreview(selector, styles) {
        const preview = document.getElementById('css-styles-preview');
        const grid = document.getElementById('css-styles-grid');
        
        if (!preview || !grid) return;
        
        grid.innerHTML = '';
        for (const [prop, value] of Object.entries(styles)) {
            const item = document.createElement('div');
            item.className = 'css-style-item';
            item.innerHTML = `<span class="css-prop">${prop}:</span> <span class="css-val">${value}</span>`;
            grid.appendChild(item);
        }
        
        preview.style.display = 'block';
    }

    setupAutoComplete() {
        this.cssProperties = [
            'color', 'background', 'background-color', 'font-size', 'font-family',
            'margin', 'padding', 'border', 'border-radius', 'width', 'height',
            'display', 'position', 'top', 'left', 'right', 'bottom', 'z-index',
            'opacity', 'transform', 'transition', 'text-align', 'font-weight'
        ];

        this.cssValues = {
            'display': ['block', 'inline', 'inline-block', 'flex', 'grid', 'none'],
            'position': ['static', 'relative', 'absolute', 'fixed', 'sticky'],
            'text-align': ['left', 'center', 'right', 'justify'],
            'font-weight': ['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900']
        };

        this.createSuggestionBox();
    }

    createSuggestionBox() {
        this.suggestionBox = document.createElement('div');
        this.suggestionBox.className = 'css-suggestions';
        this.suggestionBox.style.display = 'none';
        this.container.appendChild(this.suggestionBox);
    }

    setupEventListeners() {
        this.textarea.addEventListener('input', () => {
            if (this.options.enableAutoComplete) {
                this.handleAutoComplete();
            }
        });

        this.textarea.addEventListener('keydown', (e) => {
            // Handle tab indentation
            if (e.key === 'Tab') {
                e.preventDefault();
                this.insertTab();
                return;
            }
            
            // Handle enter with auto-indentation
            if (e.key === 'Enter' && this.selectedSuggestion == -1) {
                e.preventDefault();
                this.insertNewlineWithIndentation();
                return;
            }
            
            // Handle autocomplete navigation
            if (this.options.enableAutoComplete && this.suggestionBox.style.display !== 'none') {
                this.handleSuggestionKeydown(e);
            }
        });

        this.textarea.addEventListener('blur', () => {
            setTimeout(() => {
                if (this.suggestionBox) {
                    this.suggestionBox.style.display = 'none';
                }
            }, 200);
        });

        // Update autocomplete position on scroll
        this.textarea.addEventListener('scroll', () => {
            if (this.suggestionBox && this.suggestionBox.style.display !== 'none') {
                this.positionSuggestionBox();
            }
        });
    }

    handleAutoComplete() {
        const cursor = this.textarea.selectionStart;
        const text = this.textarea.value;
        const context = this.getContextAtCursor(text, cursor);
        
        if (context.type === 'property' && context.partial.length > 0) {
            this.showPropertySuggestions(context.partial);
        } else if (context.type === 'value' && context.partial.length > 0) {
            this.showValueSuggestions(context.property, context.partial);
        } else {
            this.hideSuggestions();
        }
    }

    getContextAtCursor(text, cursor) {
        const beforeCursor = text.substring(0, cursor);
        const lines = beforeCursor.split('\n');
        const currentLine = lines[lines.length - 1];
        
        const colonIndex = currentLine.lastIndexOf(':');
        const semicolonIndex = currentLine.lastIndexOf(';');
        
        if (colonIndex > semicolonIndex) {
            const property = this.extractPropertyName(currentLine, colonIndex);
            const valueStart = colonIndex + 1;
            const partial = currentLine.substring(valueStart).trim();
            return { type: 'value', property, partial };
        } else {
            const propertyStart = Math.max(semicolonIndex, currentLine.lastIndexOf('{')) + 1;
            const partial = currentLine.substring(propertyStart).trim();
            return { type: 'property', partial };
        }
    }

    extractPropertyName(line, colonIndex) {
        const beforeColon = line.substring(0, colonIndex);
        const match = beforeColon.match(/(\w[\w-]*)$/);
        return match ? match[1] : '';
    }

    showPropertySuggestions(partial) {
        const filtered = this.cssProperties.filter(prop => 
            prop.toLowerCase().startsWith(partial.toLowerCase())
        );
        this.showSuggestions(filtered, partial);
    }

    showValueSuggestions(property, partial) {
        const values = this.cssValues[property] || [];
        const filtered = values.filter(value => 
            value.toLowerCase().startsWith(partial.toLowerCase())
        );
        this.showSuggestions(filtered, partial);
    }

    showSuggestions(suggestions, partial) {
        if (suggestions.length === 0) {
            this.hideSuggestions();
            return;
        }

        this.currentSuggestions = suggestions;
        this.currentPartial = partial;
        this.selectedSuggestion = -1;
        
        this.suggestionBox.innerHTML = '';
        suggestions.slice(0, 10).forEach((suggestion, index) => {
            const item = document.createElement('div');
            item.className = 'css-suggestion-item';
            item.textContent = suggestion;
            item.addEventListener('click', () => {
                this.insertSuggestion(suggestion, partial);
            });
            this.suggestionBox.appendChild(item);
        });
        
        this.positionSuggestionBox();
        this.suggestionBox.style.display = 'block';
    }

    hideSuggestions() {
        if (this.suggestionBox) {
            this.suggestionBox.style.display = 'none';
        }
    }

    positionSuggestionBox() {
        const cursorPos = this.getCursorPixelPosition();
        this.suggestionBox.style.left = cursorPos.x + 'px';
        this.suggestionBox.style.top = (cursorPos.y + 20) + 'px';
        this.suggestionBox.style.position = 'fixed';
    }

    getCursorPixelPosition() {
        // Create a temporary div to measure text position
        const div = document.createElement('div');
        const textareaStyles = window.getComputedStyle(this.textarea);
        
        // Copy textarea styles to div
        div.style.position = 'absolute';
        div.style.visibility = 'hidden';
        div.style.whiteSpace = 'pre-wrap';
        div.style.wordWrap = 'break-word';
        div.style.fontFamily = textareaStyles.fontFamily;
        div.style.fontSize = textareaStyles.fontSize;
        div.style.lineHeight = textareaStyles.lineHeight;
        div.style.letterSpacing = textareaStyles.letterSpacing;
        div.style.padding = textareaStyles.padding;
        div.style.border = textareaStyles.border;
        div.style.width = textareaStyles.width;
        div.style.boxSizing = textareaStyles.boxSizing;
        
        // Position the div at the same location as the textarea
        const textareaRect = this.textarea.getBoundingClientRect();
        div.style.left = textareaRect.left + 'px';
        div.style.top = textareaRect.top + 'px';
        
        document.body.appendChild(div);
        
        // Get text up to cursor
        const textBeforeCursor = this.textarea.value.substring(0, this.textarea.selectionStart);
        div.textContent = textBeforeCursor;
        
        // Add a span for the cursor position
        const span = document.createElement('span');
        span.textContent = '|';
        div.appendChild(span);
        
        // Get the span's position relative to the viewport
        const spanRect = span.getBoundingClientRect();
        
        document.body.removeChild(div);
        
        // Calculate final position accounting for scroll
        return {
            x: spanRect.left - this.textarea.scrollLeft,
            y: spanRect.top - this.textarea.scrollTop
        };
    }

    insertTab() {
        const start = this.textarea.selectionStart;
        const end = this.textarea.selectionEnd;
        const value = this.textarea.value;
        
        // Insert tab character(s) - using 4 spaces for better compatibility
        const tabString = '    ';
        this.textarea.value = value.substring(0, start) + tabString + value.substring(end);
        
        // Move cursor to after the inserted tab
        this.textarea.selectionStart = this.textarea.selectionEnd = start + tabString.length;
        
        // Trigger input event for autocomplete
        this.textarea.dispatchEvent(new Event('input'));
    }

    insertNewlineWithIndentation() {
        const start = this.textarea.selectionStart;
        const value = this.textarea.value;
        
        // Find the start of the current line
        const lineStart = value.lastIndexOf('\n', start - 1) + 1;
        const currentLine = value.substring(lineStart, start);
        
        // Extract leading whitespace from current line
        const indentMatch = currentLine.match(/^(\s*)/);
        const currentIndent = indentMatch ? indentMatch[1] : '';
        
        // Check if we're inside a CSS rule (between { and })
        const textBeforeCursor = value.substring(0, start);
        const openBraces = (textBeforeCursor.match(/\{/g) || []).length;
        const closeBraces = (textBeforeCursor.match(/\}/g) || []).length;
        const insideRule = openBraces > closeBraces;
        
        // Check if current line ends with { (opening a new rule)
        const trimmedLine = currentLine.trim();
        const opensNewRule = trimmedLine.endsWith('{');
        
        // Determine new indentation
        let newIndent = currentIndent;
        if (opensNewRule) {
            newIndent += '    '; // Add one level of indentation
        } else if (insideRule && !currentIndent) {
            newIndent = '    '; // Add indentation if we're inside a rule but current line isn't indented
        }
        
        // Insert newline with appropriate indentation
        const newText = '\n' + newIndent;
        this.textarea.value = value.substring(0, start) + newText + value.substring(start);
        
        // Move cursor to end of inserted text
        this.textarea.selectionStart = this.textarea.selectionEnd = start + newText.length;
        
        // Trigger input event for autocomplete
        this.textarea.dispatchEvent(new Event('input'));
    }

    handleSuggestionKeydown(e) {
        const items = this.suggestionBox.querySelectorAll('.css-suggestion-item');
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.selectedSuggestion = Math.min(this.selectedSuggestion + 1, items.length - 1);
            this.updateSuggestionSelection(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.selectedSuggestion = Math.max(this.selectedSuggestion - 1, -1);
            this.updateSuggestionSelection(items);
        } else if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            if (this.selectedSuggestion >= 0) {
                const suggestion = this.currentSuggestions[this.selectedSuggestion];
                // Get the current partial text that should be replaced
                const partial = this.currentPartial || '';
                this.insertSuggestion(suggestion, partial);
            }
        } else if (e.key === 'Escape') {
            this.hideSuggestions();
        }
    }

    updateSuggestionSelection(items) {
        items.forEach((item, index) => {
            item.classList.toggle('selected', index === this.selectedSuggestion);
        });
    }

    insertSuggestion(suggestion, partial = '') {
        const cursor = this.textarea.selectionStart;
        const text = this.textarea.value;
        
        const replaceStart = cursor - partial.length;
        const beforeReplace = text.substring(0, replaceStart);
        const afterReplace = text.substring(cursor);
        
        this.textarea.value = beforeReplace + suggestion + afterReplace;
        
        const newPosition = replaceStart + suggestion.length;
        this.textarea.setSelectionRange(newPosition, newPosition);
        this.textarea.focus();
        
        this.hideSuggestions();
    }

    getValue() {
        return this.textarea.value;
    }

    setValue(value) {
        this.textarea.value = value;
    }

    focus() {
        this.textarea.focus();
    }

    destroy() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.insertBefore(this.textarea, this.container);
            this.container.parentNode.removeChild(this.container);
        }
    }
}

// Utility function for debouncing
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EnhancedCSSEditor;
} 