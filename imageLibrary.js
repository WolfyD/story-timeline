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
        this.searchQuery = '';
        this.currentTimeline = null;
        this.modal = null;
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
                        <button class="btn-secondary" id="cancelImageSelect">Cancel</button>
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

    async show(onSelectCallback) {
        this.onImageSelect = onSelectCallback;
        
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
        
        // Clear search
        document.getElementById('imageLibrarySearch').value = '';
        this.searchQuery = '';
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
            const isOrphaned = !image.item_id;
            const fileSize = this.formatFileSize(image.file_size);
            const dimensions = image.width && image.height ? `${image.width}×${image.height}` : '';
            
            return `
                <div class="image-library-item ${isOrphaned ? 'orphaned' : ''}" data-image-id="${image.id}">
                    <div class="image-thumbnail">
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
                    </div>
                    <div class="image-actions">
                        <button class="btn-primary select-image" onclick="imageLibrary.selectImage(${image.id})">
                            Select
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    selectImage(imageId) {
        const image = this.images.find(img => img.id === imageId);
        if (image && this.onImageSelect) {
            this.onImageSelect(image);
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