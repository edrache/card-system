import { Card } from './models/Card.js';
import { Deck } from './models/Deck.js';
import { StorageManager } from './utils/StorageManager.js';

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

// Deck Builder View Elements
const deckNameInput = document.getElementById('deck-name');
const createDeckBtn = document.getElementById('create-deck-btn');
const deckList = document.getElementById('deck-list');

// Modal Elements
const modal = document.getElementById('card-preview-modal');
const closeModal = document.querySelector('.close-modal');
const previewContainer = document.getElementById('preview-container');
const toastContainer = document.getElementById('toast-container');

// State
let selectedCards = new Set();

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

    // Deck Builder View
    createDeckBtn.addEventListener('click', handleCreateDeck);

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

    const newDeck = new Deck(null, name, [], '#34495e'); // Default color
    StorageManager.saveDeck(newDeck);

    deckNameInput.value = '';
    renderDeckList();
    showToast(`Created deck: ${name}`);
}

function renderDeckList() {
    const decks = StorageManager.getDecks();
    const allCards = StorageManager.getCards();
    deckList.innerHTML = '';

    decks.forEach(deck => {
        const item = document.createElement('div');
        item.className = 'deck-item';

        // Header
        const header = document.createElement('div');
        header.className = 'deck-header';
        header.innerHTML = `
            <span>
                <span style="display:inline-block; width:12px; height:12px; background-color:${deck.color || '#34495e'}; margin-right:8px; border-radius:2px;"></span>
                <strong>${deck.name}</strong> (${deck.cardIds.length} cards)
            </span>
            <span>▼</span>
        `;

        // Content
        const content = document.createElement('div');
        content.className = 'deck-content';

        // Edit Controls
        const controls = document.createElement('div');
        controls.className = 'deck-edit-controls';
        controls.innerHTML = `
            <input type="text" value="${deck.name}" class="edit-name" placeholder="Deck Name">
            <input type="color" value="${deck.color || '#34495e'}" class="edit-color">
            <button class="save-deck-meta-btn">Update Details</button>
            <button class="delete-deck-btn danger-btn" style="margin-left:auto;">Delete Deck</button>
        `;

        // Card List
        const cardList = document.createElement('div');
        cardList.className = 'deck-card-list';

        deck.cardIds.forEach((cardId, index) => {
            const card = allCards.find(c => c.id === cardId);
            if (!card) return;

            const cardItem = document.createElement('div');
            cardItem.className = 'deck-card-item';
            cardItem.innerHTML = `
                <span>#${card.displayId} ${card.name}</span>
                <button class="remove-card-btn" data-index="${index}">Remove</button>
            `;

            cardItem.querySelector('.remove-card-btn').addEventListener('click', () => {
                deck.cardIds.splice(index, 1);
                StorageManager.saveDeck(deck);
                renderDeckList(); // Re-render to update list
            });

            cardList.appendChild(cardItem);
        });

        content.appendChild(controls);
        content.appendChild(cardList);
        item.appendChild(header);
        item.appendChild(content);

        // Logic
        header.addEventListener('click', () => {
            item.classList.toggle('expanded');
        });

        const nameInput = controls.querySelector('.edit-name');
        const colorInput = controls.querySelector('.edit-color');
        const saveBtn = controls.querySelector('.save-deck-meta-btn');
        const deleteDeckBtn = controls.querySelector('.delete-deck-btn');

        saveBtn.addEventListener('click', () => {
            deck.name = nameInput.value;
            deck.color = colorInput.value;
            StorageManager.saveDeck(deck);
            renderDeckList();
            showToast('Deck updated');
        });

        deleteDeckBtn.addEventListener('click', () => {
            StorageManager.deleteDeck(deck.id);
            renderDeckList();
            showToast('Deck deleted');
        });

        deckList.appendChild(item);
    });
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
