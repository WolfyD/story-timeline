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
        
        // Add input validation with visual feedback
        selectorInput.addEventListener('input', (e) => {
            const selector = e.target.value.trim();
            if (selector) {
                // Provide visual feedback for selector validity
                if (this.isValidCSSSelector(selector)) {
                    e.target.style.borderColor = '#28a745'; // Green for valid
                    e.target.style.backgroundColor = '#f8fff9';
                } else {
                    e.target.style.borderColor = '#dc3545'; // Red for invalid
                    e.target.style.backgroundColor = '#fff8f8';
                }
            } else {
                // Reset to default colors
                e.target.style.borderColor = '';
                e.target.style.backgroundColor = '';
            }
        });
        
        // Reset colors when input loses focus
        selectorInput.addEventListener('blur', (e) => {
            setTimeout(() => {
                e.target.style.borderColor = '';
                e.target.style.backgroundColor = '';
            }, 200);
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
        
        // Add common timeline selectors that we know exist
        const commonTimelineSelectors = [
            '#app', '#timeline', '#timeline-canvas', '#timeline-container', '#center-line',
            '.timeline-item-box', '.timeline-item-box:hover', '.timeline-item-title', 
            '.timeline-item-date', '.timeline-item-line',
            '.timeline-period-item', '.timeline-period-item:hover', 
            '.timeline-age-item', '.timeline-age-item:hover',
            '.timeline-picture-box', '.timeline-picture-box img',
            '.timeline-note-box', '.timeline-note-box:hover',
            '.timeline-bookmark-line', '.timeline-bookmark-dot',
            '.timeline-start-marker-triangle', '.timeline-end-marker-triangle',
            '.main_title', '.main_subtitle', '.settings_container',
            '.cascading-image', '.cascading-image.main', '.cascading-image.secondary',
            '.center-note', '.center-note h1', '.center-note h2', '.center-note p',
            '.center-age', '.center-age h1', '.center-age p',
            '.item-viewer-modal', '.modal-content', '.modal-header', '.modal-body',
            '.global-hover-bubble', '.info-bubble', '.period-hover-bubble', '.age-hover-bubble',
            'body', 'html'
        ];
        
        commonTimelineSelectors.forEach(sel => selectors.add(sel));
        
        // Get selectors from existing stylesheets
        try {
            for (let sheet of document.styleSheets) {
                try {
                    // Check if stylesheet is accessible
                    if (sheet.href && !sheet.href.startsWith(window.location.origin) && !sheet.href.startsWith('file://')) {
                        continue; // Skip external stylesheets that might cause CORS issues
                    }
                    
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
                        
                        // Handle nested rules (like @media queries)
                        if (rule.cssRules) {
                            for (let nestedRule of rule.cssRules) {
                                if (nestedRule.selectorText) {
                                    nestedRule.selectorText.split(',').forEach(sel => {
                                        const cleaned = sel.trim();
                                        if (cleaned && !cleaned.includes('@')) {
                                            selectors.add(cleaned);
                                        }
                                    });
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.warn('Could not access stylesheet:', sheet.href, e);
                    continue;
                }
            }
        } catch (e) {
            console.warn('Could not access stylesheets:', e);
        }
        
        // Get classes and IDs from DOM elements
        document.querySelectorAll('*').forEach(el => {
            // Add classes with common pseudo-selectors
            if (el.className && typeof el.className === 'string') {
                el.className.split(' ').forEach(cls => {
                    const cleaned = cls.trim();
                    if (cleaned && !cleaned.includes(' ')) {
                        selectors.add(`.${cleaned}`);
                        // Add common pseudo-selectors
                        selectors.add(`.${cleaned}:hover`);
                        selectors.add(`.${cleaned}:focus`);
                        selectors.add(`.${cleaned}:active`);
                        selectors.add(`.${cleaned}::before`);
                        selectors.add(`.${cleaned}::after`);
                    }
                });
            }
            
            // Add IDs with common pseudo-selectors
            if (el.id) {
                selectors.add(`#${el.id}`);
                selectors.add(`#${el.id}:hover`);
                selectors.add(`#${el.id}:focus`);
                selectors.add(`#${el.id}:active`);
                selectors.add(`#${el.id}::before`);
                selectors.add(`#${el.id}::after`);
            }
        });
        
        // Add element selectors for common HTML elements
        const commonElements = ['body', 'html', 'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 
                               'button', 'input', 'textarea', 'select', 'a', 'img', 'canvas', 'svg'];
        commonElements.forEach(el => {
            selectors.add(el);
            selectors.add(`${el}:hover`);
            selectors.add(`${el}:focus`);
            selectors.add(`${el}:active`);
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

    // Helper function to validate CSS selector
    isValidCSSSelector(selector) {
        try {
            // Try to use the selector with querySelector - this checks basic syntax
            document.querySelector(selector);
            
            // Additional validation: check if it's a meaningful selector
            return this.isMeaningfulSelector(selector);
        } catch (e) {
            // If it throws an error, it's not a valid selector
            return false;
        }
    }
    
    // Check if the selector is meaningful (not just random text)
    isMeaningfulSelector(selector) {
        const trimmed = selector.trim();
        
        // Empty selector is invalid
        if (!trimmed) return false;
        
        // List of known HTML elements
        const knownElements = [
            'html', 'head', 'body', 'div', 'span', 'p', 'a', 'img', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'tfoot', 'caption', 'colgroup', 'col',
            'form', 'input', 'textarea', 'button', 'select', 'option', 'optgroup', 'label', 'fieldset', 'legend',
            'nav', 'header', 'footer', 'main', 'section', 'article', 'aside', 'details', 'summary', 'dialog',
            'canvas', 'svg', 'video', 'audio', 'source', 'track', 'embed', 'object', 'param', 'picture',
            'iframe', 'script', 'noscript', 'style', 'link', 'meta', 'title', 'base',
            'strong', 'b', 'em', 'i', 'mark', 's', 'del', 'ins', 'sub', 'sup', 'small', 'cite', 'q',
            'abbr', 'dfn', 'time', 'code', 'var', 'samp', 'kbd', 'pre', 'blockquote', 'hr', 'br', 'wbr',
            'area', 'map', 'figure', 'figcaption', 'meter', 'progress', 'output', 'ruby', 'rt', 'rp'
        ];
        
        // Check different types of selectors
        if (trimmed.startsWith('#')) {
            // ID selectors: #id-name
            const idName = trimmed.substring(1);
            return /^[\w-]+$/.test(idName) && idName.length >= 1;
            
        } else if (trimmed.startsWith('.')) {
            // Class selectors: .class-name
            const className = trimmed.substring(1);
            return /^[\w-]+$/.test(className) && className.length >= 1;
            
        } else if (/^\*/.test(trimmed)) {
            // Universal selector: *
            return true;
            
        } else if (/^[>+~]/.test(trimmed)) {
            // Combinators: >, +, ~
            return true;
            
        } else if (/::[\w-]+/.test(trimmed)) {
            // Pseudo-elements: ::before, ::after
            return true;
            
        } else if (/:[\w-]+/.test(trimmed)) {
            // Pseudo-classes: :hover, :focus, :nth-child(), etc.
            return true;
            
        } else if (/\[[\w-]+/.test(trimmed)) {
            // Attribute selectors: [type="text"], [data-value]
            return true;
            
        } else if (/^[\w-]+$/.test(trimmed)) {
            // Simple element selectors - check against known HTML elements
            return knownElements.includes(trimmed.toLowerCase());
            
        } else {
            // Complex selectors (combinations, etc.)
            // For complex selectors, check if they exist in DOM or known selectors
            const existsInDOM = document.querySelectorAll(selector).length > 0;
            const existsInKnownSelectors = this.getAllAvailableSelectors().includes(selector);
            return existsInDOM || existsInKnownSelectors;
        }
    }

    insertCurrentStyles() {
        const selectorInput = document.getElementById('css-selector-input');
        const selector = selectorInput.value.trim();
        
        if (!selector) {
            if (window.showWarning) {
                window.showWarning('Please enter a CSS selector');
            } else {
                console.warn('Please enter a CSS selector');
            }
            return;
        }
        
        // Validate the CSS selector
        if (!this.isValidCSSSelector(selector)) {
            if (window.showError) {
                window.showError(`Invalid CSS selector: "${selector}". Please enter a valid CSS selector like:\n• .class-name (for classes)\n• #element-id (for IDs)\n• element (for HTML tags)\n• .timeline-item:hover (for pseudo-classes)`);
            } else {
                console.error(`Invalid CSS selector: "${selector}"`);
            }
            return;
        }
        
        // Handle pseudo-selectors specially
        let baseSelector = selector;
        let pseudoSelector = '';
        let isPseudoSelector = false;
        
        // Check for pseudo-classes and pseudo-elements
        const pseudoMatch = selector.match(/^(.+?)(::|:)([^:]+)$/);
        if (pseudoMatch) {
            baseSelector = pseudoMatch[1];
            pseudoSelector = pseudoMatch[2] + pseudoMatch[3];
            isPseudoSelector = true;
            
            // Validate the base selector for pseudo-selectors
            if (!this.isValidCSSSelector(baseSelector)) {
                if (window.showError) {
                    window.showError(`Invalid base selector in "${selector}". The base selector "${baseSelector}" is not valid.`);
                } else {
                    console.error(`Invalid base selector: "${baseSelector}"`);
                }
                return;
            }
        }
        
        let currentStyles = null;
        let cssRule = '';
        
        if (isPseudoSelector) {
            // For pseudo-selectors, try to get styles from the base element
            try {
                const baseElements = document.querySelectorAll(baseSelector);
                if (baseElements.length > 0) {
                    const computed = getComputedStyle(baseElements[0]);
                    const relevantStyles = {};
                    
                    // Get base styles and suggest common pseudo-selector properties
                    const baseProperties = ['color', 'background-color', 'font-size', 'font-family', 'font-weight'];
                    baseProperties.forEach(prop => {
                        const value = computed.getPropertyValue(prop);
                        if (value && value !== 'initial' && value !== 'auto' && value !== 'normal') {
                            if (!(prop === 'color' && value === 'rgb(0, 0, 0)') &&
                                !(prop === 'background-color' && value === 'rgba(0, 0, 0, 0)')) {
                                relevantStyles[prop] = value;
                            }
                        }
                    });
                    
                    // Add common pseudo-selector properties based on type
                    if (pseudoSelector === ':hover') {
                        relevantStyles['cursor'] = 'pointer';
                        if (!relevantStyles['background-color']) {
                            relevantStyles['background-color'] = '#f0f0f0';
                        }
                    } else if (pseudoSelector === ':focus') {
                        relevantStyles['outline'] = '2px solid #007cba';
                        relevantStyles['outline-offset'] = '2px';
                    } else if (pseudoSelector === ':active') {
                        relevantStyles['transform'] = 'scale(0.98)';
                    } else if (pseudoSelector === '::before' || pseudoSelector === '::after') {
                        relevantStyles['content'] = '""';
                        relevantStyles['display'] = 'block';
                        relevantStyles['position'] = 'absolute';
                    }
                    
                    if (Object.keys(relevantStyles).length > 0) {
                        cssRule = this.generateCSSRule(selector, relevantStyles);
                        currentStyles = relevantStyles;
                    }
                } else {
                    // Base element not found, provide a basic template
                    const templateStyles = {};
                    if (pseudoSelector === ':hover') {
                        templateStyles['cursor'] = 'pointer';
                        templateStyles['background-color'] = '#f0f0f0';
                    } else if (pseudoSelector === ':focus') {
                        templateStyles['outline'] = '2px solid #007cba';
                    } else if (pseudoSelector === '::before' || pseudoSelector === '::after') {
                        templateStyles['content'] = '""';
                        templateStyles['display'] = 'block';
                    }
                    
                    cssRule = this.generateCSSRule(selector, templateStyles);
                    currentStyles = templateStyles;
                }
            } catch (e) {
                // Provide a basic template for the pseudo-selector
                const templateStyles = { '/* Add your styles here */': '' };
                cssRule = this.generateCSSRule(selector, templateStyles);
            }
        } else {
            // Regular selector - try to get current styles
            currentStyles = this.getCurrentStylesForSelector(selector);
            if (currentStyles && Object.keys(currentStyles).length > 0) {
                cssRule = this.generateCSSRule(selector, currentStyles);
            } else {
                // Element not found or no styles, provide a basic template
                const templateStyles = {
                    'color': '#333',
                    'background-color': 'transparent',
                    '/* Add more styles here */': ''
                };
                cssRule = this.generateCSSRule(selector, templateStyles);
                currentStyles = templateStyles;
            }
        }
        
        // Always insert at the bottom of the textarea with proper spacing
        const currentValue = this.textarea.value;
        let newValue = currentValue;
        
        // Add spacing if there's existing content
        if (currentValue.trim()) {
            // Check if the last line is empty, if not add two newlines for spacing
            const lines = currentValue.split('\n');
            const lastLine = lines[lines.length - 1];
            if (lastLine.trim()) {
                newValue += '\n\n';
            } else if (lines.length > 1 && lines[lines.length - 2].trim()) {
                newValue += '\n';
            }
        }
        
        // Add the CSS rule
        newValue += cssRule;
        
        // Set the new value and position cursor at the end
        this.textarea.value = newValue;
        this.textarea.setSelectionRange(newValue.length, newValue.length);
        this.textarea.focus();
        
        // Show preview of current styles if available
        if (currentStyles && Object.keys(currentStyles).length > 0) {
            this.showCurrentStylesPreview(selector, currentStyles);
        }
        
        // Show success message
        if (window.showSuccess) {
            window.showSuccess(`Added CSS rule for "${selector}"`);
        }
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
        const textareaRect = this.textarea.getBoundingClientRect();
        const textareaStyles = window.getComputedStyle(this.textarea);
        
        // Create a temporary div to measure text position
        const div = document.createElement('div');
        
        // Copy textarea styles to div
        div.style.position = 'absolute';
        div.style.visibility = 'hidden';
        div.style.top = '-9999px';
        div.style.left = '-9999px';
        div.style.whiteSpace = 'pre-wrap';
        div.style.wordWrap = 'break-word';
        div.style.fontFamily = textareaStyles.fontFamily;
        div.style.fontSize = textareaStyles.fontSize;
        div.style.lineHeight = textareaStyles.lineHeight;
        div.style.letterSpacing = textareaStyles.letterSpacing;
        div.style.wordSpacing = textareaStyles.wordSpacing;
        div.style.textIndent = textareaStyles.textIndent;
        div.style.paddingLeft = textareaStyles.paddingLeft;
        div.style.paddingTop = textareaStyles.paddingTop;
        div.style.paddingRight = textareaStyles.paddingRight;
        div.style.paddingBottom = textareaStyles.paddingBottom;
        div.style.borderLeft = textareaStyles.borderLeft;
        div.style.borderTop = textareaStyles.borderTop;
        div.style.borderRight = textareaStyles.borderRight;
        div.style.borderBottom = textareaStyles.borderBottom;
        div.style.width = textareaStyles.width;
        div.style.boxSizing = textareaStyles.boxSizing;
        div.style.overflowWrap = textareaStyles.overflowWrap;
        div.style.tabSize = textareaStyles.tabSize;
        
        document.body.appendChild(div);
        
        // Get text up to cursor position
        const textBeforeCursor = this.textarea.value.substring(0, this.textarea.selectionStart);
        
        // Replace the last character with a span to measure its position
        if (textBeforeCursor.length > 0) {
            div.textContent = textBeforeCursor.slice(0, -1);
            const span = document.createElement('span');
            span.textContent = textBeforeCursor.slice(-1) || ' ';
            div.appendChild(span);
        } else {
            // If there's no text before cursor, create a span with a space
            const span = document.createElement('span');
            span.textContent = ' ';
            div.appendChild(span);
        }
        
        // Measure the position of the span (which represents cursor position)
        const span = div.querySelector('span');
        const spanRect = span.getBoundingClientRect();
        const divRect = div.getBoundingClientRect();
        
        // Calculate relative position within the div
        const relativeX = spanRect.left - divRect.left + span.offsetWidth;
        const relativeY = spanRect.top - divRect.top;
        
        document.body.removeChild(div);
        
        // Convert to absolute position accounting for textarea position and scroll
        const paddingLeft = parseFloat(textareaStyles.paddingLeft) || 0;
        const paddingTop = parseFloat(textareaStyles.paddingTop) || 0;
        const borderLeft = parseFloat(textareaStyles.borderLeftWidth) || 0;
        const borderTop = parseFloat(textareaStyles.borderTopWidth) || 0;
        
        return {
            x: textareaRect.left + paddingLeft + borderLeft + relativeX - this.textarea.scrollLeft,
            y: textareaRect.top + paddingTop + borderTop + relativeY - this.textarea.scrollTop
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