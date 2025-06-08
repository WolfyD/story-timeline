/**
 * Image Library Component
 * 
 * This component provides functionality for browsing and selecting existing images
 * from the current timeline's media collection.
 */

class ImageLibrary {
    constructor() {
        this.images = [];
        this.filteredImages = [];
        this.onImageSelect = null;
        this.onMultiImageSelect = null;
        this.searchQuery = '';
        this.currentTimeline = null;
        this.modal = null;
        this.selectedImages = new Set();
        this.multiSelectMode = false;
        this.init();
    }

    init() {
        this.createModal();
        this.setupEventListeners();
    }

    createModal() {
        // Create modal HTML
        const modalHTML = `
            <div id="imageLibraryModal" class="image-library-modal hidden">
                <div class="image-library-content">
                    <div class="image-library-header">
                        <h3>Select Existing Image</h3>
                        <button class="image-library-close" id="closeImageLibrary">&times;</button>
                    </div>
                    
                    <div class="image-library-search">
                        <input type="text" id="imageLibrarySearch" placeholder="Search images..." />
                        <div class="image-library-stats">
                            <span id="imageCount">0 images</span>
                        </div>
                    </div>
                    
                    <div class="image-library-grid" id="imageLibraryGrid">
                        <!-- Images will be populated here -->
                    </div>
                    
                    <div class="image-library-footer">
                        <div class="footer-left">
                            <div class="selection-info" id="selectionInfo"></div>
                            <button class="btn-add-selected" id="addSelectedImages">Add Selected Images</button>
                        </div>
                        <div class="footer-right">
                            <button class="btn-secondary" id="cancelImageSelect">Cancel</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modal = document.getElementById('imageLibraryModal');
    }

    setupEventListeners() {
        // Close button
        document.getElementById('closeImageLibrary').addEventListener('click', () => {
            this.hide();
        });

        // Cancel button
        document.getElementById('cancelImageSelect').addEventListener('click', () => {
            this.hide();
        });

        // Add selected images button
        document.getElementById('addSelectedImages').addEventListener('click', () => {
            this.addSelectedImages();
        });

        // Search functionality
        document.getElementById('imageLibrarySearch').addEventListener('input', (e) => {
            this.searchQuery = e.target.value.toLowerCase();
            this.filterImages();
            this.renderImages();
        });

        // Close on outside click
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.hide();
            }
        });

        // Listen for API responses
        window.api.receive('media', (media) => {
            this.images = media || [];
            this.filterImages();
            this.renderImages();
            this.updateStats();
        });
    }

    async show(onSelectCallback, multiSelectCallback = null) {
        this.onImageSelect = onSelectCallback;
        this.onMultiImageSelect = multiSelectCallback;
        this.multiSelectMode = !!multiSelectCallback;
        
        // Reset selection state
        this.selectedImages.clear();
        this.updateSelectionInfo();
        
        // Get current timeline ID
        this.currentTimeline = await window.api.getCurrentTimelineId();
        
        // Load images for current timeline
        window.api.send('getAllMedia');
        
        // Show modal
        this.modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        
        // Focus search input
        document.getElementById('imageLibrarySearch').focus();
    }

    hide() {
        this.modal.classList.add('hidden');
        document.body.style.overflow = '';
        this.onImageSelect = null;
        this.onMultiImageSelect = null;
        this.selectedImages.clear();
        this.multiSelectMode = false;
        
        // Clear search
        document.getElementById('imageLibrarySearch').value = '';
        this.searchQuery = '';
        this.updateSelectionInfo();
    }

    filterImages() {
        this.filteredImages = this.images.filter(image => {
            // Filter by search query
            if (this.searchQuery) {
                const searchText = [
                    image.title || '',
                    image.description || '',
                    image.file_name || ''
                ].join(' ').toLowerCase();
                
                if (!searchText.includes(this.searchQuery)) {
                    return false;
                }
            }
            
            return true;
        });
    }

    renderImages() {
        const grid = document.getElementById('imageLibraryGrid');
        
        if (this.filteredImages.length === 0) {
            grid.innerHTML = `
                <div class="no-images">
                    <p>No images found</p>
                    ${this.searchQuery ? '<p>Try adjusting your search terms</p>' : '<p>Add some images to your timeline to see them here</p>'}
                </div>
            `;
            return;
        }

        grid.innerHTML = this.filteredImages.map(image => {
            const isOrphaned = !image.linked_items;
            const fileSize = this.formatFileSize(image.file_size);
            const dimensions = image.width && image.height ? `${image.width}×${image.height}` : '';
            const isSelected = this.selectedImages.has(image.id);
            
            return `
                <div onclick="document.getElementById('image-checkbox-${image.id}').checked = !document.getElementById('image-checkbox-${image.id}').checked; imageLibrary.toggleImageSelection(${image.id}, document.getElementById('image-checkbox-${image.id}').checked)" class="image-library-item ${isOrphaned ? 'orphaned' : ''} ${isSelected ? 'selected' : ''}" data-image-id="${image.id}">
                    <div class="image-thumbnail">
                        <input type="checkbox" id="image-checkbox-${image.id}" class="image-checkbox" ${isSelected ? 'checked' : ''} 
                               onchange="imageLibrary.toggleImageSelection(${image.id}, this.checked)">
                        
                        <img src="file://${image.file_path}" alt="${image.title || image.file_name}" 
                             onerror="this.parentElement.classList.add('broken-image')">
                    </div>
                    <div class="image-info">
                        <div class="image-title">${image.title || image.file_name}</div>
                        <div class="image-details">
                            ${dimensions ? `<span class="dimensions">${dimensions}</span>` : ''}
                            <span class="file-size">${fileSize}</span>
                        </div>
                        ${image.description ? `<div class="image-description">${image.description}</div>` : ''}
                        ${isOrphaned ? '<div class="orphaned-label">Unused</div>' : ''}
                        <button class="quick-select-btn" onclick="imageLibrary.selectImage(${image.id})" title="Select this image">
                            <i class="ri-check-line"></i>
                        </button>
                        ${image.usage_count > 0 ? `<div class="usage-info">Used in ${image.usage_count} item${image.usage_count !== 1 ? 's' : ''}</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    toggleImageSelection(imageId, isSelected) {
        if (isSelected) {
            this.selectedImages.add(imageId);
        } else {
            this.selectedImages.delete(imageId);
        }
        
        // Update the visual state of the item
        const itemElement = document.querySelector(`[data-image-id="${imageId}"]`);
        if (itemElement) {
            itemElement.classList.toggle('selected', isSelected);
        }
        
        this.updateSelectionInfo();
    }

    updateSelectionInfo() {
        const selectionInfo = document.getElementById('selectionInfo');
        const addButton = document.getElementById('addSelectedImages');
        
        if (this.selectedImages.size > 0) {
            selectionInfo.textContent = `${this.selectedImages.size} image${this.selectedImages.size !== 1 ? 's' : ''} selected`;
            addButton.classList.add('visible');
        } else {
            selectionInfo.textContent = '';
            addButton.classList.remove('visible');
        }
    }

    selectImage(imageId) {
        const image = this.images.find(img => img.id === imageId);
        if (image && this.onImageSelect) {
            this.onImageSelect(image);
            this.hide();
        }
    }

    addSelectedImages() {
        if (this.selectedImages.size > 0 && this.onMultiImageSelect) {
            const selectedImageObjects = Array.from(this.selectedImages).map(id => 
                this.images.find(img => img.id === id)
            ).filter(Boolean);

            console.log('Selected image objects');
            console.log(selectedImageObjects);
            
            this.onMultiImageSelect(selectedImageObjects);
            this.hide();
        }
    }

    updateStats() {
        const count = this.filteredImages.length;
        const total = this.images.length;
        const countText = this.searchQuery && count !== total 
            ? `${count} of ${total} images` 
            : `${total} image${total !== 1 ? 's' : ''}`;
        
        document.getElementById('imageCount').textContent = countText;
    }

    formatFileSize(bytes) {
        if (!bytes) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// Create global instance
const imageLibrary = new ImageLibrary(); 