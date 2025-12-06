import { Card } from './models/Card.js';
import { Deck } from './models/Deck.js';
import { StorageManager } from './utils/StorageManager.js';
import { FileUtils } from './utils/FileUtils.js';

// DOM Elements
const navCreate = document.getElementById('nav-create');
const navLibrary = document.getElementById('nav-library');
const navDeckBuilder = document.getElementById('nav-deck-builder');

const viewCreate = document.getElementById('view-create');
const viewLibrary = document.getElementById('view-library');
const viewDeckBuilder = document.getElementById('view-deck-builder');

// Create View Elements
const cardForm = document.getElementById('card-form');
const editingCardIdInput = document.getElementById('editing-card-id');
const createBtn = document.getElementById('create-btn');
const editButtons = document.getElementById('edit-buttons');
const overwriteBtn = document.getElementById('overwrite-btn');
const saveAsNewBtn = document.getElementById('save-as-new-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const bulkImportBtn = document.getElementById('import-btn');
const bulkImportText = document.getElementById('bulk-import');

// Library View Elements
const libraryList = document.getElementById('library-list');
const searchInput = document.getElementById('search-cards');
const filterTagsInput = document.getElementById('filter-tags');
const tagSuggestions = document.getElementById('tag-suggestions');
const deleteSelectedBtn = document.getElementById('delete-selected-btn');
const addToDeckSelect = document.getElementById('add-to-deck-select');
const addSelectedBtn = document.getElementById('add-selected-btn');
const bulkTagInput = document.getElementById('bulk-tag-input');
const bulkAddTagBtn = document.getElementById('bulk-add-tag-btn');
const bulkRemoveTagBtn = document.getElementById('bulk-remove-tag-btn');
const exportLibraryBtn = document.getElementById('export-library-btn');
const importLibraryBtn = document.getElementById('import-library-btn');
const importLibraryFile = document.getElementById('import-library-file');

// Deck Builder View Elements
const deckNameInput = document.getElementById('deck-name');
const createDeckBtn = document.getElementById('create-deck-btn');
const exportDecksBtn = document.getElementById('export-decks-btn');
const importDecksBtn = document.getElementById('import-decks-btn');
const importDecksFile = document.getElementById('import-decks-file');
const deckList = document.getElementById('deck-list');
const activeDeckView = document.getElementById('active-deck-view');

// Modal Elements
const modal = document.getElementById('card-preview-modal');
const closeModal = document.querySelector('.close-modal');
const previewContainer = document.getElementById('preview-container');
const toastContainer = document.getElementById('toast-container');

// State
let selectedCards = new Set();
let selectedDeckId = null;

// Initialization
function init() {
    migrateCards();
    setupEventListeners();

    // Initial render
    renderLibrary();
    renderDeckList();
    updateDeckSelects();
}

function migrateCards() {
    const cards = StorageManager.getCards();
    let maxId = cards.reduce((max, c) => Math.max(max, c.displayId || 0), 0);
    let migratedCount = 0;

    cards.forEach(card => {
        if (!card.displayId) {
            maxId++;
            card.displayId = maxId;
            migratedCount++;
        }
    });

    if (migratedCount > 0) {
        localStorage.setItem('card_system_cards', JSON.stringify(cards));
        showToast(`Migrated ${migratedCount} legacy cards`);
    }
}

function setupEventListeners() {
    // Navigation
    navCreate.addEventListener('click', () => switchView('create'));
    navLibrary.addEventListener('click', () => switchView('library'));
    navDeckBuilder.addEventListener('click', () => switchView('deck-builder'));

    // Create View
    cardForm.addEventListener('submit', handleCreateCard);
    overwriteBtn.addEventListener('click', () => handleEditAction('overwrite'));
    saveAsNewBtn.addEventListener('click', () => handleEditAction('new'));
    cancelEditBtn.addEventListener('click', exitEditMode);
    bulkImportBtn.addEventListener('click', handleBulkImport);

    // Library View
    searchInput.addEventListener('input', renderLibrary);
    filterTagsInput.addEventListener('input', (e) => {
        renderLibrary();
        handleTagAutocomplete(e.target.value);
    });
    filterTagsInput.addEventListener('focus', (e) => handleTagAutocomplete(e.target.value));
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.autocomplete-wrapper')) {
            tagSuggestions.classList.add('hidden');
        }
    });

    deleteSelectedBtn.addEventListener('click', handleDeleteSelected);
    addSelectedBtn.addEventListener('click', handleAddSelectedToDeck);
    bulkAddTagBtn.addEventListener('click', () => handleBulkTag('add'));
    bulkRemoveTagBtn.addEventListener('click', () => handleBulkTag('remove'));

    exportLibraryBtn.addEventListener('click', handleExportLibrary);
    importLibraryBtn.addEventListener('click', () => importLibraryFile.click());
    importLibraryFile.addEventListener('change', handleImportLibrary);

    // Deck Builder View
    createDeckBtn.addEventListener('click', handleCreateDeck);
    exportDecksBtn.addEventListener('click', handleExportDecks);
    importDecksBtn.addEventListener('click', () => importDecksFile.click());
    importDecksFile.addEventListener('change', handleImportDecks);

    // Modal
    closeModal.addEventListener('click', () => modal.classList.add('hidden'));
    window.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.add('hidden');
    });
}

function switchView(viewName) {
    // Update Nav
    navCreate.classList.remove('active');
    navLibrary.classList.remove('active');
    navDeckBuilder.classList.remove('active');

    if (viewName === 'create') navCreate.classList.add('active');
    if (viewName === 'library') navLibrary.classList.add('active');
    if (viewName === 'deck-builder') navDeckBuilder.classList.add('active');

    // Update Views
    viewCreate.classList.add('hidden');
    viewLibrary.classList.add('hidden');
    viewDeckBuilder.classList.add('hidden');

    if (viewName === 'create') viewCreate.classList.remove('hidden');
    if (viewName === 'library') {
        viewLibrary.classList.remove('hidden');
        renderLibrary(); // Refresh library when entering
        updateDeckSelects();
    }
    if (viewName === 'deck-builder') {
        viewDeckBuilder.classList.remove('hidden');
        renderDeckList(); // Refresh decks when entering
    }
}

// --- Create View Logic ---

function handleCreateCard(e) {
    e.preventDefault();
    // Default submit is "Create New" if not in edit mode
    if (editingCardIdInput.value) {
        // If user hits enter in edit mode, default to Overwrite? Or prevent?
        // Let's assume Enter = Overwrite for convenience, or just do nothing and force button click.
        // For now, let's treat it as Save as New to be safe, or just Overwrite.
        // Actually, let's just delegate to handleEditAction('overwrite')
        handleEditAction('overwrite');
    } else {
        createCardFromForm();
    }
}

function createCardFromForm(existingId = null, keepDisplayId = false) {
    const name = document.getElementById('card-name').value;
    const mechText = document.getElementById('card-mech-text').value;
    const flavorText = document.getElementById('card-flavor-text').value;
    const tags = document.getElementById('card-tags').value.split(',').map(t => t.trim()).filter(t => t);

    const newCard = new Card(existingId, name, mechText, flavorText, tags);

    // If overwriting, we need to preserve the displayId manually or let StorageManager handle it.
    // StorageManager handles displayId preservation if ID exists.

    StorageManager.saveCard(newCard);
    return newCard;
}

function handleEditAction(action) {
    const editingId = editingCardIdInput.value;
    if (!editingId) return;

    if (action === 'overwrite') {
        createCardFromForm(editingId);
        showToast('Card overwritten');
        exitEditMode();
    } else if (action === 'new') {
        createCardFromForm(null); // Null ID forces new creation
        showToast('Saved as new card');
        exitEditMode();
    }
}

function exitEditMode() {
    editingCardIdInput.value = '';
    cardForm.reset();
    createBtn.classList.remove('hidden');
    editButtons.classList.add('hidden');
    document.querySelector('#card-creator h2').textContent = 'Create New Card';
}

function handleBulkImport() {
    const text = bulkImportText.value;
    const lines = text.split('\n').filter(l => l.trim());
    let count = 0;

    lines.forEach(line => {
        // Format: Name | Mechanical Text | Flavor Text | Tags
        const parts = line.split('|');
        const name = parts[0] ? parts[0].trim() : '';
        const mechText = parts[1] ? parts[1].trim() : '';
        const flavorText = parts[2] ? parts[2].trim() : '';
        const tags = parts[3] ? parts[3].split(',').map(t => t.trim()) : [];

        if (name) {
            const newCard = new Card(null, name, mechText, flavorText, tags);
            StorageManager.saveCard(newCard);
            count++;
        }
    });

    bulkImportText.value = '';
    showToast(`Imported ${count} cards`);
}

// --- Library View Logic ---

function renderLibrary() {
    const cards = StorageManager.getCards().sort((a, b) => (a.displayId || 0) - (b.displayId || 0));
    const decks = StorageManager.getDecks();
    const searchTerm = searchInput.value.toLowerCase();
    const filterTag = filterTagsInput.value.toLowerCase();

    libraryList.innerHTML = '';

    const filteredCards = cards.filter(card => {
        const matchesSearch = card.name.toLowerCase().includes(searchTerm);
        const matchesTag = !filterTag || card.tags.some(t => t.toLowerCase().includes(filterTag));
        return matchesSearch && matchesTag;
    });

    filteredCards.forEach(card => {
        // Calculate deck usage
        const inDecks = decks.filter(d => d.cardIds.includes(card.id));
        const deckUsageText = inDecks.length > 0
            ? `In ${inDecks.length} deck(s)`
            : 'Not in any deck';

        const item = document.createElement('div');
        item.className = `grid-item ${selectedCards.has(card.id) ? 'selected' : ''}`;

        item.innerHTML = `
            <input type="checkbox" class="select-checkbox" ${selectedCards.has(card.id) ? 'checked' : ''}>
            <button class="delete-btn" title="Delete Card">🗑️</button>
            <div class="card-preview">
                <strong>#${card.displayId || '?'} ${card.name}</strong><br>
                <small>${card.tags.join(', ')}</small><br>
                <p>${card.mechanicalText}</p>
            </div>
            <div class="card-meta">
                <span>${deckUsageText}</span>
                <button class="edit-btn">Edit</button>
            </div>
        `;

        // Event Listeners
        const checkbox = item.querySelector('.select-checkbox');
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                selectedCards.add(card.id);
                item.classList.add('selected');
            } else {
                selectedCards.delete(card.id);
                item.classList.remove('selected');
            }
        });

        const deleteBtn = item.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            StorageManager.deleteCard(card.id);
            renderLibrary();
            showToast('Card deleted');
        });

        const editBtn = item.querySelector('.edit-btn');
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            loadCardForEdit(card);
        });

        // Click on item to preview (unless clicking controls)
        item.addEventListener('click', (e) => {
            if (e.target !== checkbox && e.target !== deleteBtn && e.target !== editBtn) {
                showPreview(card);
            }
        });

        libraryList.appendChild(item);
    });
}

function loadCardForEdit(card) {
    // Populate create form
    document.getElementById('card-name').value = card.name;
    document.getElementById('card-mech-text').value = card.mechanicalText;
    document.getElementById('card-flavor-text').value = card.flavorText;
    document.getElementById('card-tags').value = card.tags.join(', ');
    editingCardIdInput.value = card.id;

    // Switch UI to Edit Mode
    createBtn.classList.add('hidden');
    editButtons.classList.remove('hidden');
    document.querySelector('#card-creator h2').textContent = `Editing #${card.displayId}`;

    switchView('create');
    showToast('Card loaded for editing');
}

function handleDeleteSelected() {
    if (selectedCards.size === 0) return showToast('No cards selected', true);

    selectedCards.forEach(id => StorageManager.deleteCard(id));
    selectedCards.clear();
    renderLibrary();
    showToast('Selected cards deleted');
}

function handleAddSelectedToDeck() {
    const deckId = addToDeckSelect.value;
    if (!deckId) return showToast('Select a deck first', true);
    if (selectedCards.size === 0) return showToast('No cards selected', true);

    const decks = StorageManager.getDecks();
    const deck = decks.find(d => d.id === deckId);
    if (!deck) return;

    let count = 0;
    selectedCards.forEach(id => {
        deck.addCard(id);
        count++;
    });

    StorageManager.saveDeck(deck);
    selectedCards.clear();
    renderLibrary(); // To update selection UI
    showToast(`Added ${count} cards to ${deck.name}`);
}

function handleBulkTag(action) {
    const tag = bulkTagInput.value.trim();
    if (!tag) return showToast('Please enter a tag', true);
    if (selectedCards.size === 0) return showToast('No cards selected', true);

    const allCards = StorageManager.getCards();
    let updatedCount = 0;

    selectedCards.forEach(id => {
        const card = allCards.find(c => c.id === id);
        if (card) {
            if (action === 'add') {
                if (!card.tags.includes(tag)) {
                    card.tags.push(tag);
                    updatedCount++;
                }
            } else if (action === 'remove') {
                const index = card.tags.indexOf(tag);
                if (index > -1) {
                    card.tags.splice(index, 1);
                    updatedCount++;
                }
            }
            StorageManager.saveCard(card);
        }
    });

    renderLibrary();
    showToast(`${action === 'add' ? 'Added' : 'Removed'} tag "${tag}" for ${updatedCount} cards`);
    bulkTagInput.value = '';
}

function handleTagAutocomplete(input) {
    const cards = StorageManager.getCards();
    const allTags = new Set();
    cards.forEach(c => c.tags.forEach(t => allTags.add(t)));

    const suggestions = Array.from(allTags).filter(t => t.toLowerCase().includes(input.toLowerCase()));

    tagSuggestions.innerHTML = '';
    if (suggestions.length > 0 && input) {
        tagSuggestions.classList.remove('hidden');
        suggestions.forEach(tag => {
            const div = document.createElement('div');
            div.className = 'autocomplete-suggestion';
            div.textContent = tag;
            div.addEventListener('click', () => {
                filterTagsInput.value = tag;
                tagSuggestions.classList.add('hidden');
                renderLibrary();
            });
            tagSuggestions.appendChild(div);
        });
    } else {
        tagSuggestions.classList.add('hidden');
    }
}

function handleExportLibrary() {
    const data = StorageManager.exportLibrary();
    FileUtils.downloadJSON(data, `card_library_${Date.now()}.json`);
    showToast('Library exported');
}

async function handleImportLibrary(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const data = await FileUtils.readJSONFile(file);
        const count = StorageManager.importLibrary(data);
        renderLibrary();
        showToast(`Imported ${count} cards`);
    } catch (err) {
        console.error(err);
        showToast('Failed to import library', true);
    }
    e.target.value = ''; // Reset input
}

function updateDeckSelects() {
    const decks = StorageManager.getDecks();
    addToDeckSelect.innerHTML = '<option value="">Add Selected to Deck...</option>';
    decks.forEach(deck => {
        const option = document.createElement('option');
        option.value = deck.id;
        option.textContent = deck.name;
        addToDeckSelect.appendChild(option);
    });
}

// --- Deck Builder View Logic ---

function handleCreateDeck() {
    const name = deckNameInput.value;
    if (!name) return alert('Please enter a deck name');

    const newDeck = new Deck(null, name, [], generateRandomColor()); // Random color
    StorageManager.saveDeck(newDeck);

    deckNameInput.value = '';
    renderDeckList();
    showToast(`Created deck: ${name}`);
}

function handleExportDecks() {
    const data = StorageManager.exportDecks();
    FileUtils.downloadJSON(data, `decks_${Date.now()}.json`);
    showToast('Decks exported');
}

async function handleImportDecks(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const data = await FileUtils.readJSONFile(file);
        const count = StorageManager.importDecks(data);
        renderDeckList();
        showToast(`Imported ${count} decks`);
    } catch (err) {
        console.error(err);
        showToast('Failed to import decks', true);
    }
    e.target.value = '';
}



// --- Help System ---

const helpBtn = document.getElementById('help-btn');
const helpModal = document.getElementById('help-modal');
const closeHelpModal = helpModal.querySelector('.close-modal'); // Note: might conflict if multiple modals share class. 
// Actually, querySelector finds the first one. We have two modals now. 
// Let's be specific or use IDs. The builder.html has two modals with close-modal class.
// We should probably scope it.
const helpContent = document.getElementById('help-content');

function setupHelp() {
    // Scope close button to help modal
    const closeBtn = helpModal.querySelector('.close-modal');

    helpBtn.addEventListener('click', () => {
        const activeView = getActiveViewName();
        helpContent.innerHTML = getHelpContent(activeView);
        helpModal.classList.remove('hidden');
    });

    closeBtn.addEventListener('click', () => helpModal.classList.add('hidden'));
    window.addEventListener('click', (e) => {
        if (e.target === helpModal) helpModal.classList.add('hidden');
    });
}

function getActiveViewName() {
    if (navCreate.classList.contains('active')) return 'Create';
    if (navLibrary.classList.contains('active')) return 'Library';
    if (navDeckBuilder.classList.contains('active')) return 'Deck Builder';
    return 'Builder';
}

function getHelpContent(viewName) {
    switch (viewName) {
        case 'Create':
            return `
                <h3>Create Card</h3>
                <ul>
                    <li><strong>Fill Fields:</strong> Enter Name, Mechanical Text, Flavor Text, and Tags.</li>
                    <li><strong>Create:</strong> Click "Create Card" to save.</li>
                    <li><strong>Bulk Import:</strong> Paste pipe-separated data to create multiple cards at once.</li>
                </ul>
                <h3>Editing</h3>
                <ul>
                    <li>When editing a card, you can <strong>Overwrite</strong> it or <strong>Save as New</strong>.</li>
                </ul>
                <h3>Variable Substitution</h3>
                <ul>
                    <li>Use <strong>{VARIABLE}</strong> in text to draw from a <strong>referenced deck</strong> with that variable name.</li>
                    <li>Example: "You find a {ITEM}." draws from a deck where Variable Name is "ITEM".</li>
                    <li>Use indices like <strong>{ITEM:1}</strong> and <strong>{ITEM:2}</strong> to draw different cards.</li>
                    <li><em>Note: The referenced deck must be on the table for this to work.</em></li>
                    <li><strong>Clickable:</strong> In the game, players can click the highlighted variable name to spawn the actual card.</li>
                </ul>
            `;
        case 'Library':
            return `
                <h3>Library Management</h3>
                <ul>
                    <li><strong>Grid View:</strong> See all your created cards.</li>
                    <li><strong>Search & Filter:</strong> Find cards by name or tag (with autocomplete).</li>
                    <li><strong>Selection:</strong> Click checkboxes to select multiple cards.</li>
                </ul>
                <h3>Bulk Actions</h3>
                <ul>
                    <li><strong>Delete Selected:</strong> Remove multiple cards.</li>
                    <li><strong>Add to Deck:</strong> Add selected cards to a chosen deck.</li>
                    <li><strong>Bulk Tagging:</strong> Add or remove tags from selected cards.</li>
                    <li><strong>Export/Import:</strong> Backup or restore your card library.</li>
                </ul>
            `;
        case 'Deck Builder':
            return `
                <h3>Deck Management</h3>
                <ul>
                    <li><strong>Create Deck:</strong> Enter a name and click create.</li>
                    <li><strong>Edit Deck:</strong> Expand a deck to change its name, <strong>Color</strong>, or <strong>Variable Name</strong>.</li>
                    <li><strong>Manage Cards:</strong> Remove individual cards from the list.</li>
                    <li><strong>Special Cards:</strong> Add a "Random Card" that pulls from another deck. Check "Finite" to make it draw from a shared, depletable pile.</li>
                    <li><strong>Variable Substitution:</strong> refer to decks by handle (e.g. {ITEM}) in card text to auto-draw cards. Use {ITEM:1}, {ITEM:2} for unique draws.</li>
                    <li><strong>Export/Import:</strong> Backup or restore your decks.</li>
                </ul>
            `;
        default:
            return '<p>Select a view to see specific help.</p>';
    }
}

setupHelp();

function renderDeckList() {
    const decks = StorageManager.getDecks();
    deckList.innerHTML = '';

    if (decks.length === 0) {
        deckList.innerHTML = '<div style="color:var(--text-light); text-align:center; padding:10px;">No decks created</div>';
        return;
    }

    decks.forEach(deck => {
        const item = document.createElement('div');
        item.className = `deck-item-simple ${selectedDeckId === deck.id ? 'active' : ''}`;
        item.style.padding = '10px';
        item.style.cursor = 'pointer';
        item.style.marginBottom = '5px';
        item.style.borderRadius = 'var(--radius-md)';
        item.style.backgroundColor = selectedDeckId === deck.id ? 'rgba(0, 242, 255, 0.1)' : 'var(--card-bg)';
        item.style.border = `1px solid ${selectedDeckId === deck.id ? 'var(--primary-color)' : 'var(--border-color)'}`;

        item.innerHTML = `
            <div style="display:flex; align-items:center;">
                <span style="display:inline-block; width:12px; height:12px; background-color:${deck.color || '#34495e'}; margin-right:8px; border-radius:2px;"></span>
                <strong>${deck.name}</strong>
            </div>
            <div style="font-size:0.8em; color:var(--text-light); margin-top:2px; margin-left:20px;">
                ${deck.cardIds.length} cards
            </div>
        `;

        item.addEventListener('click', () => {
            selectedDeckId = deck.id;
            renderDeckList(); // Re-render to update active state
            renderActiveDeck();
        });

        deckList.appendChild(item);
    });

    // Also update the active view
    renderActiveDeck();
}

// --- Shared Logic ---

function showPreview(card) {
    previewContainer.innerHTML = '';

    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    cardEl.style.position = 'relative';
    cardEl.style.transform = 'scale(1.5)';
    cardEl.style.transformOrigin = 'center';

    cardEl.innerHTML = `
        <div class="card-header">#${card.displayId || '?'} ${card.name}</div>
        <div class="card-body">${card.mechanicalText}</div>
        ${card.flavorText ? `<div class="card-flavor">${card.flavorText}</div>` : ''}
        <div class="card-tags">${card.tags.join(', ')}</div>
    `;

    previewContainer.appendChild(cardEl);
    modal.classList.remove('hidden');
}

function showToast(message, isError = false) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    if (isError) toast.style.backgroundColor = '#e74c3c';
    toast.textContent = message;

    toastContainer.appendChild(toast);
    toast.offsetHeight; // Trigger reflow
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

init();

function generateRandomColor() {
    const h = Math.floor(Math.random() * 360);
    const s = 70;
    const l = 45; // HSL lightness roughly maps to Value but is easier in CSS/JS usually. 
    // User asked for HSV S and V same. 
    // Let's use HSL for CSS compatibility or convert HSV to Hex.
    // Requirement: "HSV, where S and V are same and H is random".
    // Let's assume S=0.7, V=0.9.

    return hsvToHex(h, 0.7, 0.4);
}

function hsvToHex(h, s, v) {
    let r, g, b;
    const i = Math.floor(h / 60);
    const f = h / 60 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);

    switch (i % 6) {
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }

    const toHex = x => {
        const hex = Math.round(x * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function renderActiveDeck() {
    activeDeckView.innerHTML = '';

    if (!selectedDeckId) {
        activeDeckView.innerHTML = `
            <div class="empty-state" style="display:flex; justify-content:center; align-items:center; height:100%; color:var(--text-light); flex-direction:column; gap:10px;">
                <div style="font-size:3em; opacity:0.3;">🗃️</div>
                <div>Select a deck to view and edit details</div>
            </div>`;
        return;
    }

    const decks = StorageManager.getDecks();
    const deck = decks.find(d => d.id === selectedDeckId);

    if (!deck) {
        selectedDeckId = null;
        renderDeckList();
        return;
    }

    const allCards = StorageManager.getCards();

    const container = document.createElement('div');
    container.style.padding = '10px';

    // Header / Controls
    const controls = document.createElement('div');
    controls.className = 'deck-edit-controls';
    controls.innerHTML = `
        <input type="text" value="${deck.name}" class="edit-name" placeholder="Deck Name">
        <input type="color" value="${deck.color || '#34495e'}" class="edit-color">
        <input type="text" value="${deck.variableName || ''}" class="edit-variable" placeholder="Variable (e.g. ITEM)" title="Variable name for text substitution (e.g. {ITEM})">
        <button class="save-deck-meta-btn">Update Details</button>
        <button class="delete-deck-btn danger-btn" style="margin-left:auto;">Delete Deck</button>
    `;

    // Add Special Card section
    const specialControls = document.createElement('div');
    specialControls.className = 'deck-edit-controls';
    specialControls.style.borderTop = 'none';
    specialControls.style.paddingTop = '10px';

    let deckOptions = '<option value="">Select Source Deck...</option>';
    decks.forEach(d => {
        deckOptions += `<option value="${d.id}">${d.name}</option>`;
    });

    specialControls.innerHTML = `
        <span style="align-self:center; font-size:0.9em; white-space:nowrap;">Add Random Card:</span>
        <select class="special-deck-select" style="flex:1;">${deckOptions}</select>
        <label style="display:flex; align-items:center; gap:4px; font-size:0.8em; cursor:pointer;" title="If checked, draws from a shared, finite pile on the table.">
            <input type="checkbox" class="finite-mode-checkbox"> Finite
        </label>
        <button class="add-special-btn">Add</button>
    `;

    // Valid Cards List
    const cardList = document.createElement('div');
    cardList.className = 'deck-card-list';
    // Remove max-height since active view scrolls itself, but keep grid
    cardList.style.maxHeight = 'none';
    cardList.style.overflowY = 'visible';

    deck.cardIds.forEach((cardId, index) => {
        let displayText = '';
        let isSpecial = false;

        if (typeof cardId === 'string' && cardId.startsWith('SPECIAL:RANDOM:')) {
            const targetDeckId = cardId.split(':')[2];
            const isFinite = cardId.includes(':FINITE');
            const targetDeck = decks.find(d => d.id === targetDeckId);
            const targetName = targetDeck ? targetDeck.name : 'Unknown Deck';
            displayText = `🎲 Random [${targetName}]${isFinite ? ' (Finite)' : ''}`;
            isSpecial = true;
        } else {
            const card = allCards.find(c => c.id === cardId);
            if (!card) return; // Skip if card missing
            displayText = `#${card.displayId} ${card.name}`;
        }

        const cardItem = document.createElement('div');
        cardItem.className = 'deck-card-item';
        if (isSpecial) cardItem.style.backgroundColor = 'rgba(0, 242, 255, 0.05)';

        cardItem.innerHTML = `
            <span>${displayText}</span>
            <button class="remove-card-btn" data-index="${index}">Remove</button>
        `;

        cardItem.querySelector('.remove-card-btn').addEventListener('click', () => {
            deck.cardIds.splice(index, 1);
            StorageManager.saveDeck(deck);
            renderDeckList(); // Update sidebar count
            renderActiveDeck(); // Update active view
        });

        cardList.appendChild(cardItem);
    });

    container.appendChild(controls);
    container.appendChild(specialControls);
    container.appendChild(document.createElement('br'));
    container.appendChild(cardList);
    activeDeckView.appendChild(container);

    // Event Listeners for controls
    const nameInput = controls.querySelector('.edit-name');
    const colorInput = controls.querySelector('.edit-color');
    const saveBtn = controls.querySelector('.save-deck-meta-btn');
    const deleteDeckBtn = controls.querySelector('.delete-deck-btn');

    // Auto-save color on change
    colorInput.addEventListener('input', () => {
        deck.color = colorInput.value;
        StorageManager.saveDeck(deck);
        renderDeckList();
    });

    controls.querySelector('.save-deck-meta-btn').addEventListener('click', () => {
        const newName = controls.querySelector('.edit-name').value;
        const newColor = controls.querySelector('.edit-color').value;
        const newVar = controls.querySelector('.edit-variable').value.trim();

        if (newName) {
            deck.name = newName;
            deck.color = newColor;
            deck.variableName = newVar || null; // Save or null
            StorageManager.saveDeck(deck);
            renderDeckList();
            showToast('Deck details updated');
        }
    });

    controls.querySelector('.delete-deck-btn').addEventListener('click', () => {
        if (confirm(`Delete deck "${deck.name}"?`)) {
            StorageManager.deleteDeck(deck.id);
            selectedDeckId = null;
            renderDeckList();
            renderActiveDeck();
            showToast('Deck deleted');
        }
    });

    const specialSelect = specialControls.querySelector('.special-deck-select');
    const addSpecialBtn = specialControls.querySelector('.add-special-btn');

    addSpecialBtn.addEventListener('click', () => {
        const targetId = specialSelect.value;
        const isFinite = specialControls.querySelector('.finite-mode-checkbox').checked;
        if (!targetId) return showToast('Please select a source deck', true);

        deck.addCard(`SPECIAL:RANDOM:${targetId}${isFinite ? ':FINITE' : ''}`);
        StorageManager.saveDeck(deck);
        renderDeckList(); // update count
        renderActiveDeck(); // update list
        showToast('Special card added');
    });
}
