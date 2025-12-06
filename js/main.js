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
let connectionLayer = null; // SVG layer for connections

// State
let activeDecks = [];
let scale = 1;

function init() {
    setupConnectionLayer();
    renderDeckSelect();
    setupEventListeners();

    // Animation loop for updating lines
    requestAnimationFrame(updateConnections);
}

function setupConnectionLayer() {
    connectionLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    connectionLayer.style.position = 'absolute';
    connectionLayer.style.top = '0';
    connectionLayer.style.left = '0';
    connectionLayer.style.width = '100%';
    connectionLayer.style.height = '100%';
    connectionLayer.style.pointerEvents = 'none'; // Click-through
    connectionLayer.style.zIndex = '0'; // Behind everything
    tableContent.insertBefore(connectionLayer, tableContent.firstChild);
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
        // Scale background
        table.style.backgroundSize = `${baseBackgroundSize * scale}px`;
    });

    // Card Drop on Deck
    tableContent.addEventListener('card-dropped-on-deck', handleCardDroppedOnDeck);
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

    // Check for Finite Special Cards and spawn side decks
    spawnSideDecksIfNeeded(deck, deckEl);
}

function spawnSideDecksIfNeeded(sourceDeck, sourceDeckEl) {
    const decks = StorageManager.getDecks();

    sourceDeck.cardIds.forEach(cardId => {
        if (typeof cardId === 'string' && cardId.startsWith('SPECIAL:RANDOM:') && cardId.includes(':FINITE')) {
            const parts = cardId.split(':');
            const targetDeckId = parts[2];

            // Check if target deck is already on table
            // We need a way to identify if a deck on table IS this specific instance
            // But here we want a NEW instance for this specific source deck relationship?
            // User said: "draw from the same instance of the selected deck".
            // If multiple cards point to the same deck, they should share it.
            // So we check if we already spawned a deck with this ID *linked* to this game session?
            // Or just check if ANY deck with this ID exists?
            // "visible as a smaller deck"

            let targetDeckInstance = activeDecks.find(d => d.deck.id === targetDeckId);

            if (!targetDeckInstance) {
                const targetDeckData = decks.find(d => d.id === targetDeckId);
                if (targetDeckData) {
                    // Spawn it
                    const sourceRect = sourceDeckEl.getBoundingClientRect(); // Screen coords
                    // We need table coords. 
                    const sourceX = parseFloat(sourceDeckEl.style.left);
                    const sourceY = parseFloat(sourceDeckEl.style.top);

                    // Position it nearby (e.g., 200px to the right)
                    const targetX = sourceX + 250;
                    const targetY = sourceY;

                    const newDeckInstance = Deck.fromJSON(JSON.parse(JSON.stringify(targetDeckData)));
                    renderDeckOnTable(newDeckInstance, targetX, targetY);

                    // Find the element we just added
                    targetDeckInstance = activeDecks[activeDecks.length - 1];

                    // Style it as "Side Deck"
                    targetDeckInstance.element.classList.add('side-deck');
                    targetDeckInstance.element.style.transform = 'scale(0.8)';
                    targetDeckInstance.element.style.border = '2px dashed #fff';
                }
            }

            // Register connection
            if (targetDeckInstance) {
                registerConnection(sourceDeckEl, targetDeckInstance.element);
            }
        }
    });
}

const activeConnections = [];

function registerConnection(sourceEl, targetEl) {
    // Avoid duplicates
    if (activeConnections.some(c => c.source === sourceEl && c.target === targetEl)) return;

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('stroke', 'rgba(255, 255, 255, 0.3)');
    line.setAttribute('stroke-width', '2');
    line.setAttribute('stroke-dasharray', '5,5');
    connectionLayer.appendChild(line);

    activeConnections.push({ source: sourceEl, target: targetEl, line });
}

function updateConnections() {
    activeConnections.forEach(conn => {
        // We need coordinates relative to the table-content container
        // Since the SVG is inside table-content, we can use the element's style.left/top
        // BUT, elements might be dragged, so we should use their current position.
        // Elements use style.left/top for position.

        const x1 = parseFloat(conn.source.style.left) + conn.source.offsetWidth / 2;
        const y1 = parseFloat(conn.source.style.top) + conn.source.offsetHeight / 2;
        const x2 = parseFloat(conn.target.style.left) + conn.target.offsetWidth / 2;
        const y2 = parseFloat(conn.target.style.top) + conn.target.offsetHeight / 2;

        conn.line.setAttribute('x1', x1);
        conn.line.setAttribute('y1', y1);
        conn.line.setAttribute('x2', x2);
        conn.line.setAttribute('y2', y2);
    });

    requestAnimationFrame(updateConnections);
}

function drawCard(deck, deckEl) {
    if (deck.cardIds.length === 0) {
        alert('Deck is empty!');
        return;
    }

    const cardId = deck.cardIds.shift();
    updateDeckCount(deckEl, deck);

    // Handle Special Cards
    if (typeof cardId === 'string' && cardId.startsWith('SPECIAL:RANDOM:')) {
        const parts = cardId.split(':');
        const targetDeckId = parts[2];
        const isFinite = cardId.includes(':FINITE');

        if (isFinite) {
            // Finite Mode: Draw from the linked side deck instance
            const targetDeckInstance = activeDecks.find(d => d.deck.id === targetDeckId && d.element.classList.contains('side-deck'));

            if (targetDeckInstance && targetDeckInstance.deck.cardIds.length > 0) {
                // Draw from side deck
                const drawnCardId = targetDeckInstance.deck.cardIds.shift();
                updateDeckCount(targetDeckInstance.element, targetDeckInstance.deck);

                // Render the card at the SOURCE deck's position (as if drawn from it)
                const allCards = StorageManager.getCards();
                const realCardData = allCards.find(c => c.id === drawnCardId);

                if (realCardData) {
                    renderCardAtDeck(realCardData, deckEl, targetDeckInstance.deck.color);
                }
            } else {
                alert('Linked side deck is empty!');
            }
            return;
        }

        // Infinite Mode: Random copy
        const targetDeck = StorageManager.getDecks().find(d => d.id === targetDeckId);

        if (targetDeck && targetDeck.cardIds.length > 0) {
            // Pick random card from target
            const randomIndex = Math.floor(Math.random() * targetDeck.cardIds.length);
            const randomCardId = targetDeck.cardIds[randomIndex];

            // Resolve to actual card
            // Note: If the random card is ALSO a special card, should we recurse?
            // For now, let's assume one level of indirection or simple recursion.
            // But 'cardId' here was shifted from the deck. The random one is just LOOKED UP, not removed from target (assumed copying/referencing).
            // Wait, "random card from another deck" -> Does it REMOVE it from that deck?
            // Usually in digital TCGs "create a random card" implies a copy. "Steal" implies remove.
            // The requirement said "add a special card... which will be a random card from another deck".
            // I'll assume COPY behavior (create instance) because modifying the source deck from here (Tabletop) might be unexpected if it's not on the table.

            // We need to fetch the actual card data
            const allCards = StorageManager.getCards();
            let realCardData = allCards.find(c => c.id === randomCardId);

            // If the random target is itself special, we might need to handle it.
            // But simpler to just handle standard cards for now.
            if (randomCardId.startsWith && randomCardId.startsWith('SPECIAL:')) {
                // If we picked a special card, we might want to re-roll or just fail gracefully.
                // Let's just alert for now to avoid infinite loops if target deck is all special cards pointing to each other.
                alert('Randomly drew another special card! Recursion not supported yet.');
                return;
            }

            if (realCardData) {
                renderCardAtDeck(realCardData, deckEl, deck.color);
            }
        } else {
            alert('Target deck for random card is missing or empty! Drawing next card...');
            // Draw next card immediately
            drawCard(deck, deckEl);
        }
        return;
    }

    const allCards = StorageManager.getCards();
    const cardData = allCards.find(c => c.id === cardId);

    if (cardData) {
        renderCardAtDeck(cardData, deckEl, deck.color);
    }
}

function renderCardAtDeck(cardData, deckEl, color) {
    const rect = deckEl.getBoundingClientRect();
    // We need to account for scale when positioning
    // The rect is screen coordinates, but we append to tableContent which is scaled.
    // Actually, `activeDecks` stores `element.style.left` which is in table coordinates.
    // So we can calculate relative to that.

    const deckX = parseFloat(deckEl.style.left);
    const deckY = parseFloat(deckEl.style.top);

    const x = deckX + 160;
    const y = deckY;

    renderCardOnTable(cardData, x, y, color);
}

function updateDeckCount(deckEl, deck) {
    const countSpan = deckEl.querySelector('.card-count');
    if (countSpan) {
        countSpan.textContent = `${deck.cardIds.length} cards`;
    }
}

function renderCardOnTable(card, x, y, color = null) {
    const cardEl = document.createElement('div');
    cardEl.className = 'card draggable';
    cardEl.dataset.id = card.id;
    if (color) {
        cardEl.dataset.color = color;
    }
    cardEl.style.left = `${x}px`;
    cardEl.style.top = `${y}px`;
    cardEl.style.zIndex = DragManager.getNextZIndex();

    const headerStyle = color ? `style="background-color: ${color}; color: white; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);"` : '';

    cardEl.innerHTML = `
        <div class="card-header" ${headerStyle}>${card.name}</div>
        <div class="card-body">${card.mechanicalText}</div>
        ${card.flavorText ? `<div class="card-flavor">${card.flavorText}</div>` : ''}
        <div class="card-tags">${card.tags.join(', ')}</div>
        <button class="create-deck-btn" title="Create Deck from Stack"></button>
    `;

    // Add Create Deck listener
    const createDeckBtn = cardEl.querySelector('.create-deck-btn');
    createDeckBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent drag
        handleCreateDeck(cardEl, card);
    });

    tableContent.appendChild(cardEl);
}

function handleCreateDeck(topCardEl, topCardData) {
    // User requested: "Take cards BELOW".
    // In our Right+Down cascade, "Below" visually means Higher Z-index (on top physically).
    // So we want the clicked card and everything stacked ON TOP of it (visually cascading down).

    const allCards = Array.from(document.querySelectorAll('.card.draggable'));

    // Sort all cards by Z-index ascending (Bottom to Top)
    allCards.sort((a, b) => parseInt(a.style.zIndex || 0) - parseInt(b.style.zIndex || 0));

    // Find index of the clicked card
    const startIndex = allCards.indexOf(topCardEl);
    if (startIndex === -1) return;

    const stackCards = [topCardEl];

    // Iterate through cards with HIGHER Z-index (candidates for being "below" visually)
    for (let i = startIndex + 1; i < allCards.length; i++) {
        const candidate = allCards[i];

        // Check if candidate overlaps with ANY card currently in our stack
        // This ensures we catch the whole chain even if the first and last don't overlap directly
        const overlaps = stackCards.some(stackCard => isOverlapping(stackCard, candidate));

        if (overlaps) {
            stackCards.push(candidate);
        }
    }

    if (stackCards.length < 2) {
        // Optional: Allow single card decks?
        // Let's allow it, why not.
    }

    // Extract IDs
    const cardIds = stackCards.map(el => el.dataset.id);

    // Create new Deck
    // Name it based on the top card?
    const newDeck = new Deck(null, `Stack: ${topCardData.name} + ${cardIds.length - 1}`, cardIds, '#475569');

    // Remove card elements from table
    stackCards.forEach(el => el.remove());

    // Render new Deck at position of the CLICKED card (the "head" of the stack)
    const x = parseFloat(topCardEl.style.left);
    const y = parseFloat(topCardEl.style.top);

    renderDeckOnTable(newDeck, x, y);
}

function isOverlapping(el1, el2) {
    const rect1 = el1.getBoundingClientRect();
    const rect2 = el2.getBoundingClientRect();

    return !(rect1.right < rect2.left ||
        rect1.left > rect2.right ||
        rect1.bottom < rect2.top ||
        rect1.top > rect2.bottom);
}

function handleResetTable() {
    tableContent.innerHTML = '';
    activeDecks = [];
}

function handleCardDroppedOnDeck(e) {
    const { cardId, deckElement, droppedStack } = e.detail;

    // Find the deck object
    const activeDeck = activeDecks.find(d => d.element === deckElement);
    if (!activeDeck) return;

    const deck = activeDeck.deck;

    // Add all dropped cards to the deck
    // droppedStack contains elements. We need their IDs.

    const cardsToAdd = droppedStack || [{ dataset: { id: cardId } }];

    cardsToAdd.forEach(el => {
        const id = el.dataset.id;
        if (id) {
            deck.addCard(id);
            el.remove();
        }
    });

    // Update Deck UI
    updateDeckCount(deckElement, deck);
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
        const color = cardEl.dataset.color;
        if (id) {
            tableState.cards.push({
                x: parseFloat(cardEl.style.left),
                y: parseFloat(cardEl.style.top),
                cardId: id,
                color: color
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
                    renderCardOnTable(card, cState.x, cState.y, cState.color);
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
                <li><strong>Random Cards:</strong> Some decks may contain special cards that pull a random card from another deck. If "Finite", they draw from a visible side deck until it's empty.</li>
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
