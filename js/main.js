import { StorageManager } from './utils/StorageManager.js';
import { DragManager } from './ui/DragManager.js';
import { Card } from './models/Card.js';
import { Deck } from './models/Deck.js';
import { FileUtils } from './utils/FileUtils.js';

// DOM Elements
const table = document.getElementById('table');
const tableContent = document.getElementById('table-content'); // New container
const deckSelect = document.getElementById('deck-select');
const addDeckBtn = document.getElementById('add-deck-btn');
const resetTableBtn = document.getElementById('reset-table');
const exportTableBtn = document.getElementById('export-table-btn');
const importTableBtn = document.getElementById('import-table-btn');
const importTableFile = document.getElementById('import-table-file');

const dragManager = new DragManager('table-content'); // Use inner container

// State
let activeDecks = [];
let scale = 1;

function init() {
    renderDeckSelect();
    setupEventListeners();
}

function setupEventListeners() {
    addDeckBtn.addEventListener('click', handleAddDeck);
    resetTableBtn.addEventListener('click', handleResetTable);
    exportTableBtn.addEventListener('click', handleExportTable);
    importTableBtn.addEventListener('click', () => importTableFile.click());
    importTableFile.addEventListener('change', handleImportTable);

    // Zoom Logic
    const baseBackgroundSize = 300; // Match CSS default

    table.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY * -0.001;
        const newScale = Math.min(Math.max(0.5, scale + delta), 2); // Limit zoom 0.5x to 2x

        scale = newScale;
        tableContent.style.transform = `scale(${scale})`;
        dragManager.setScale(scale);

        // Scale background
        table.style.backgroundSize = `${baseBackgroundSize * scale}px`;
    });
}

function renderDeckSelect() {
    const decks = StorageManager.getDecks();
    deckSelect.innerHTML = '<option value="">Select a Deck to Add</option>';
    decks.forEach(deck => {
        const option = document.createElement('option');
        option.value = deck.id;
        option.textContent = deck.name;
        deckSelect.appendChild(option);
    });
}

function handleAddDeck() {
    const deckId = deckSelect.value;
    if (!deckId) return;

    const deckData = StorageManager.getDecks().find(d => d.id === deckId);
    if (!deckData) return;

    // Create a deep copy of the deck for the table instance
    // We want to be able to modify the in-play deck without affecting the stored one immediately
    // (though for this simple version, maybe we just use the ID list)
    const deckInstance = Deck.fromJSON(JSON.parse(JSON.stringify(deckData)));

    // Random position
    const x = 50 + Math.random() * 200;
    const y = 50 + Math.random() * 200;

    renderDeckOnTable(deckInstance, x, y);
}

function renderDeckOnTable(deck, x, y) {
    const deckEl = document.createElement('div');
    deckEl.className = 'deck draggable';
    deckEl.style.left = `${x}px`;
    deckEl.style.top = `${y}px`;
    deckEl.style.zIndex = DragManager.getNextZIndex();
    if (deck.color) {
        deckEl.style.backgroundColor = deck.color;
    }
    deckEl.innerHTML = `
        <div style="text-align: center;">
            <strong>${deck.name}</strong><br>
            <span class="card-count">${deck.cardIds.length} cards</span>
        </div>
        <div class="deck-controls">
            <button class="deck-btn draw-btn">Draw</button>
            <button class="deck-btn shuffle-btn">Shuffle</button>
        </div>
    `;

    // Event Listeners for Controls
    const drawBtn = deckEl.querySelector('.draw-btn');
    const shuffleBtn = deckEl.querySelector('.shuffle-btn');

    drawBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent drag start
        drawCard(deck, deckEl);
    });

    shuffleBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent drag start
        deck.shuffle();

        // Visual feedback
        const originalText = shuffleBtn.textContent;
        shuffleBtn.textContent = 'Done!';
        setTimeout(() => {
            shuffleBtn.textContent = originalText;
            updateDeckCount(deckEl, deck);
        }, 500);
    });

    // Remove old hidden interactions
    // deckEl.addEventListener('dblclick', ...) - REMOVED
    // deckEl.addEventListener('contextmenu', ...) - REMOVED

    tableContent.appendChild(deckEl);
    activeDecks.push({ deck, element: deckEl });
}

function drawCard(deck, deckEl) {
    if (deck.cardIds.length === 0) {
        alert('Deck is empty!');
        return;
    }

    const cardId = deck.cardIds.shift();
    updateDeckCount(deckEl, deck);

    const allCards = StorageManager.getCards();
    const cardData = allCards.find(c => c.id === cardId);

    if (cardData) {
        // Place card near the deck
        const rect = deckEl.getBoundingClientRect();
        const x = rect.left + 160; // To the right of the deck
        const y = rect.top;

        renderCardOnTable(cardData, x, y);
    }
}

function updateDeckCount(deckEl, deck) {
    const countSpan = deckEl.querySelector('.card-count');
    if (countSpan) {
        countSpan.textContent = `${deck.cardIds.length} cards`;
    }
}

function renderCardOnTable(card, x, y) {
    const cardEl = document.createElement('div');
    cardEl.className = 'card draggable';
    cardEl.dataset.id = card.id;
    cardEl.style.left = `${x}px`;
    cardEl.style.top = `${y}px`;
    cardEl.style.zIndex = DragManager.getNextZIndex();

    cardEl.innerHTML = `
        <div class="card-header">${card.name}</div>
        <div class="card-body">${card.mechanicalText}</div>
        ${card.flavorText ? `<div class="card-flavor">${card.flavorText}</div>` : ''}
        <div class="card-tags">${card.tags.join(', ')}</div>
    `;

    tableContent.appendChild(cardEl);
}

function handleResetTable() {
    tableContent.innerHTML = '';
    activeDecks = [];
}

function handleExportTable() {
    // Capture Table State
    const tableState = {
        decks: [],
        cards: []
    };

    // Decks on table
    activeDecks.forEach(item => {
        const rect = item.element.getBoundingClientRect();
        // Calculate relative position to table content (considering zoom/pan if any, but for now simple)
        // Actually, we stored them with left/top style.
        tableState.decks.push({
            x: parseFloat(item.element.style.left),
            y: parseFloat(item.element.style.top),
            deckId: item.deck.id, // Original Deck ID
            remainingCardIds: [...item.deck.cardIds], // Current state of deck
            color: item.deck.color,
            name: item.deck.name
        });
    });

    // Cards on table (loose cards)
    const cards = document.querySelectorAll('.card.draggable');
    cards.forEach(cardEl => {
        // We need to associate the element with the card data. 
        // Currently we don't store the card object on the element.
        // We should probably attach it or parse it. 
        // Parsing is risky. Let's attach data-id to the element when rendering.
        // Wait, we didn't add data-id to renderCardOnTable. We need to fix that first.
        // Assuming we fix renderCardOnTable to add data-id:
        const id = cardEl.dataset.id;
        if (id) {
            tableState.cards.push({
                x: parseFloat(cardEl.style.left),
                y: parseFloat(cardEl.style.top),
                cardId: id
            });
        }
    });

    // Definitions
    const definitions = {
        cards: StorageManager.getCards(),
        decks: StorageManager.getDecks()
    };

    const exportData = {
        timestamp: Date.now(),
        tableState,
        definitions
    };

    FileUtils.downloadJSON(exportData, `table_state_${Date.now()}.json`);
}

async function handleImportTable(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const data = await FileUtils.readJSONFile(file);

        // 1. Import Definitions
        if (data.definitions) {
            StorageManager.importLibrary({ cards: data.definitions.cards });
            StorageManager.importDecks({ decks: data.definitions.decks });
        }

        // 2. Clear Table
        handleResetTable();

        // 3. Restore State
        if (data.tableState) {
            // Restore Decks
            data.tableState.decks.forEach(dState => {
                // We reconstruct the deck instance
                // We can use the definition from storage or the state data
                // State data has the *current* cards, which is what we want for the table instance
                const deck = new Deck(dState.deckId, dState.name, dState.remainingCardIds, dState.color);
                renderDeckOnTable(deck, dState.x, dState.y);
            });

            // Restore Cards
            const allCards = StorageManager.getCards();
            data.tableState.cards.forEach(cState => {
                const card = allCards.find(c => c.id === cState.cardId);
                if (card) {
                    renderCardOnTable(card, cState.x, cState.y);
                }
            });
        }

        alert('Table state imported successfully!');

    } catch (err) {
        console.error(err);
        alert('Failed to import table state');
    }
    e.target.value = '';
}



// --- Help System ---

const helpBtn = document.getElementById('help-btn');
const helpModal = document.getElementById('help-modal');
const closeHelpModal = helpModal.querySelector('.close-modal');
const helpContent = document.getElementById('help-content');

function setupHelp() {
    helpBtn.addEventListener('click', () => {
        helpContent.innerHTML = `
            <h3>Controls</h3>
            <ul>
                <li><strong>Drag & Drop:</strong> Move cards and decks freely.</li>
                <li><strong>Zoom:</strong> Use mouse wheel to zoom in/out.</li>
                <li><strong>Draw:</strong> Click "Draw" on a deck to reveal a card.</li>
                <li><strong>Shuffle:</strong> Click "Shuffle" to randomize a deck.</li>
            </ul>
            <h3>Interactions</h3>
            <ul>
                <li><strong>Stacking:</strong> Drag a card over another to stack them.</li>
                <li><strong>Moving Stacks:</strong> Drag the bottom card to move the stack.</li>
                <li><strong>Separating:</strong> Drag the top card to separate it.</li>
            </ul>
            <h3>Data</h3>
            <ul>
                <li><strong>Export Table:</strong> Save your current game setup (cards, decks, positions) to a file.</li>
                <li><strong>Import Table:</strong> Restore a saved game setup.</li>
            </ul>
        `;
        helpModal.classList.remove('hidden');
    });

    closeHelpModal.addEventListener('click', () => helpModal.classList.add('hidden'));
    window.addEventListener('click', (e) => {
        if (e.target === helpModal) helpModal.classList.add('hidden');
    });
}

setupHelp();

init();
