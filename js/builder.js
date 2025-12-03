import { Card } from './models/Card.js';
import { Deck } from './models/Deck.js';
import { StorageManager } from './utils/StorageManager.js';

// DOM Elements
const cardForm = document.getElementById('card-form');
const libraryList = document.getElementById('library-list');
const searchInput = document.getElementById('search-cards');
const filterTagsInput = document.getElementById('filter-tags');
const bulkImportBtn = document.getElementById('import-btn');
const bulkImportText = document.getElementById('bulk-import');
const removeByIdsInput = document.getElementById('remove-by-ids');
const removeByIdsBtn = document.getElementById('remove-by-ids-btn');

const addByIdsInput = document.getElementById('add-by-ids');
const addByIdsBtn = document.getElementById('add-by-ids-btn');
const modal = document.getElementById('card-preview-modal');
const closeModal = document.querySelector('.close-modal');
const previewContainer = document.getElementById('preview-container');
const toastContainer = document.getElementById('toast-container');




function handleRemoveByIds() {
    const input = removeByIdsInput.value;
    if (!input) return;

    if (!confirm('Are you sure you want to delete these cards? This cannot be undone.')) return;

    const allCards = StorageManager.getCards();
    const idsToRemove = new Set();

    // Parse input: "1, 3-5, 8"
    const parts = input.split(',');
    parts.forEach(part => {
        part = part.trim();
        if (part.includes('-')) {
            const range = part.split('-').map(n => parseInt(n.trim()));
            if (range.length === 2 && !isNaN(range[0]) && !isNaN(range[1])) {
                for (let i = range[0]; i <= range[1]; i++) {
                    idsToRemove.add(i);
                }
            }
        } else {
            const num = parseInt(part);
            if (!isNaN(num)) {
                idsToRemove.add(num);
            }
        }
    });

    let removedCount = 0;
    idsToRemove.forEach(displayId => {
        const card = allCards.find(c => c.displayId === displayId);
        if (card) {
            StorageManager.deleteCard(card.id);
            removedCount++;
        }
    });

    renderLibrary();
    removeByIdsInput.value = '';
    showToast(`Removed ${removedCount} cards`, true);
}

const deckNameInput = document.getElementById('deck-name');
const createDeckBtn = document.getElementById('create-deck-btn');
const currentDeckSelect = document.getElementById('current-deck-select');
const currentDeckList = document.getElementById('current-deck-list');
const saveDeckBtn = document.getElementById('save-deck-btn');

let currentDeck = null;

// Initialization
function init() {
    migrateCards();
    renderLibrary();
    renderDeckSelect();
    setupEventListeners();
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
    cardForm.addEventListener('submit', handleCreateCard);
    searchInput.addEventListener('input', renderLibrary);
    filterTagsInput.addEventListener('input', renderLibrary);
    bulkImportBtn.addEventListener('click', handleBulkImport);

    createDeckBtn.addEventListener('click', handleCreateDeck);
    currentDeckSelect.addEventListener('change', handleDeckSelect);
    saveDeckBtn.addEventListener('click', handleSaveDeck);

    addByIdsBtn.addEventListener('click', handleAddByIds);
    removeByIdsBtn.addEventListener('click', handleRemoveByIds);
    closeModal.addEventListener('click', () => modal.classList.add('hidden'));
    window.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.add('hidden');
    });
}

// Card Logic
function handleCreateCard(e) {
    e.preventDefault();
    const name = document.getElementById('card-name').value;
    const mechText = document.getElementById('card-mech-text').value;
    const flavorText = document.getElementById('card-flavor-text').value;
    const tags = document.getElementById('card-tags').value.split(',').map(t => t.trim()).filter(t => t);

    const newCard = new Card(null, name, mechText, flavorText, tags);
    StorageManager.saveCard(newCard);

    cardForm.reset();
    renderLibrary();
    showToast(`Created card: ${name}`);
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
    renderLibrary();
    showToast(`Imported ${count} cards`);
}

function renderLibrary() {
    const cards = StorageManager.getCards().sort((a, b) => (a.displayId || 0) - (b.displayId || 0));
    const searchTerm = searchInput.value.toLowerCase();
    const filterTag = filterTagsInput.value.toLowerCase();

    libraryList.innerHTML = '';

    cards.filter(card => {
        const matchesSearch = card.name.toLowerCase().includes(searchTerm);
        const matchesTag = !filterTag || card.tags.some(t => t.toLowerCase().includes(filterTag));
        return matchesSearch && matchesTag;
    }).forEach(card => {
        const item = document.createElement('div');
        item.className = 'list-item';
        item.innerHTML = `
            <span><strong>#${card.displayId || '?'}</strong> ${card.name}</span>
            <div>
                <button class="preview-btn" data-id="${card.id}">View</button>
                <button class="add-to-deck-btn" data-id="${card.id}">Add</button>
            </div>
        `;

        item.querySelector('.preview-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            showPreview(card);
        });
        item.querySelector('.add-to-deck-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            addToDeck(card.id);
        });

        // Also preview on click of the item itself
        item.addEventListener('click', () => showPreview(card));

        libraryList.appendChild(item);
    });
}

function showPreview(card) {
    previewContainer.innerHTML = '';

    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    cardEl.style.position = 'relative'; // Reset absolute positioning for preview
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

// Deck Logic
function handleCreateDeck() {
    const name = deckNameInput.value;
    if (!name) return alert('Please enter a deck name');

    const newDeck = new Deck(null, name, []);
    StorageManager.saveDeck(newDeck);

    deckNameInput.value = '';
    renderDeckSelect();
    selectDeck(newDeck.id);
    showToast(`Created deck: ${name}`);
}

function renderDeckSelect() {
    const decks = StorageManager.getDecks();
    currentDeckSelect.innerHTML = '<option value="">Select Deck to Edit</option>';
    decks.forEach(deck => {
        const option = document.createElement('option');
        option.value = deck.id;
        option.textContent = deck.name;
        currentDeckSelect.appendChild(option);
    });

    if (currentDeck) {
        currentDeckSelect.value = currentDeck.id;
    }
}

function handleDeckSelect() {
    const deckId = currentDeckSelect.value;
    selectDeck(deckId);
}

function selectDeck(deckId) {
    if (!deckId) {
        currentDeck = null;
        renderCurrentDeck();
        return;
    }

    const decks = StorageManager.getDecks();
    currentDeck = decks.find(d => d.id === deckId);
    renderCurrentDeck();
}

function addToDeck(cardId) {
    if (!currentDeck) return showToast('Please select a deck first', true);

    currentDeck.addCard(cardId);
    renderCurrentDeck();
    showToast('Card added to deck');
}

function handleAddByIds() {
    if (!currentDeck) return showToast('Please select a deck first', true);

    const input = addByIdsInput.value;
    if (!input) return;

    const allCards = StorageManager.getCards();
    const idsToAdd = new Set();

    // Parse input: "1, 3-5, 8"
    const parts = input.split(',');
    parts.forEach(part => {
        part = part.trim();
        if (part.includes('-')) {
            const range = part.split('-').map(n => parseInt(n.trim()));
            if (range.length === 2 && !isNaN(range[0]) && !isNaN(range[1])) {
                for (let i = range[0]; i <= range[1]; i++) {
                    idsToAdd.add(i);
                }
            }
        } else {
            const num = parseInt(part);
            if (!isNaN(num)) {
                idsToAdd.add(num);
            }
        }
    });

    let addedCount = 0;
    idsToAdd.forEach(displayId => {
        const card = allCards.find(c => c.displayId === displayId);
        if (card) {
            currentDeck.addCard(card.id);
            addedCount++;
        }
    });

    renderCurrentDeck();
    addByIdsInput.value = '';
    showToast(`Added ${addedCount} cards to deck`);
}

function removeFromDeck(index) {
    if (!currentDeck) return;

    currentDeck.cardIds.splice(index, 1);
    renderCurrentDeck();
}

function renderCurrentDeck() {
    currentDeckList.innerHTML = '';
    if (!currentDeck) return;

    const allCards = StorageManager.getCards();

    currentDeck.cardIds.forEach((cardId, index) => {
        const card = allCards.find(c => c.id === cardId);
        if (!card) return; // Card might have been deleted

        const item = document.createElement('div');
        item.className = 'list-item';
        item.innerHTML = `
            <span>#${card.displayId || '?'} ${card.name}</span>
            <button class="remove-from-deck-btn">Remove</button>
        `;

        item.querySelector('.remove-from-deck-btn').addEventListener('click', () => removeFromDeck(index));

        currentDeckList.appendChild(item);
    });
}

function handleSaveDeck() {
    if (!currentDeck) return;
    StorageManager.saveDeck(currentDeck);
    showToast('Deck saved!');
}

function showToast(message, isError = false) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    if (isError) toast.style.backgroundColor = '#e74c3c';
    toast.textContent = message;

    toastContainer.appendChild(toast);

    // Trigger reflow
    toast.offsetHeight;

    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

init();
