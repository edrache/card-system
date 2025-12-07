import { StorageManager } from './utils/StorageManager.js';
import { DragManager } from './ui/DragManager.js';
import { Card } from './models/Card.js';
import { Deck } from './models/Deck.js';
import { FileUtils } from './utils/FileUtils.js';
import { Pawn } from './models/Pawn.js';

// DOM Elements
const table = document.getElementById('table');
const tableContent = document.getElementById('table-content'); // New container
const deckSelect = document.getElementById('deck-select');
const addDeckBtn = document.getElementById('add-deck-btn');
const resetTableBtn = document.getElementById('reset-table');
const exportTableBtn = document.getElementById('export-table-btn');
const importTableBtn = document.getElementById('import-table-btn');
const addPawnBtn = document.getElementById('add-pawn-btn');
const importTableFile = document.getElementById('import-table-file');

const dragManager = new DragManager('table-content', 15); // 15px snap grid
let connectionLayer = null; // SVG layer for connections

// State
let activeDecks = [];
let activePawns = [];
let activeResources = [];
let scale = 1;

// Selection State
let isSelecting = false;
let selectionStart = { x: 0, y: 0 };
let selectionBox = null;

function init() {
    setupConnectionLayer();
    renderDeckSelect();
    setupEventListeners();

    // Try to load state or start fresh
    if (!loadTableState()) {
        console.log("No saved state found, starting fresh.");
    }

    // Animation loop for updating lines
    requestAnimationFrame(updateConnections);
}

// --- Auto-Save Logic ---
function captureFullState() {
    // Capture Table State
    const tableState = {
        decks: activeDecks.map(wrapper => ({
            deckId: wrapper.deck.id,
            name: wrapper.deck.name,
            remainingCardIds: [...wrapper.deck.cardIds],
            color: wrapper.deck.color,
            x: parseFloat(wrapper.element ? wrapper.element.style.left : 0),
            y: parseFloat(wrapper.element ? wrapper.element.style.top : 0),
            variableName: wrapper.deck.variableName,
            isFaceDownDefault: wrapper.element ? wrapper.element.dataset.isFaceDownDefault === 'true' : false,
            isFaceDownDefault: wrapper.element ? wrapper.element.dataset.isFaceDownDefault === 'true' : false,
            isSideDeck: wrapper.element ? wrapper.element.classList.contains('side-deck') : false,
            format: wrapper.deck.format || 'vertical'
        })),
        cards: Array.from(document.querySelectorAll('.card.draggable')).map(c => ({
            cardId: c.dataset.id,
            x: parseFloat(c.style.left),
            y: parseFloat(c.style.top),
            zIndex: c.style.zIndex,
            color: c.dataset.color || c.style.backgroundColor, // Prefer dataset if available from previous logic
            isFaceDown: c.classList.contains('face-down'),
            isStarred: c.classList.contains('starred'),
            format: c.dataset.format || 'vertical',
            deckName: c.dataset.deckName || c.querySelector('.card-header')?.innerText,
            resolvedVariables: c.dataset.resolvedVariables ? JSON.parse(c.dataset.resolvedVariables) : null
        })),
        pawns: activePawns.map(p => ({
            id: p.pawn.id,
            x: parseFloat(p.element.style.left),
            y: parseFloat(p.element.style.top),
            color: p.pawn.color,
            color: p.pawn.color,
            shape: p.pawn.shape
        })),
        resources: activeResources
    };

    // Definitions (Always include for unified format)
    const definitions = {
        cards: StorageManager.getCards(),
        decks: StorageManager.getDecks()
    };

    return {
        timestamp: Date.now(),
        tableState,
        definitions
    };
}

function autoSave() {
    const fullState = captureFullState();
    StorageManager.saveTableState(fullState);
}

function loadTableState() {
    const data = StorageManager.getTableState();
    if (!data || !data.tableState) return false;

    // Restore Decks
    activeDecks = []; // Clear current memory
    tableContent.innerHTML = ''; // Clear DOM
    setupConnectionLayer(); // Re-add layer

    if (data.tableState.decks) {
        data.tableState.decks.forEach(dState => {
            const deck = new Deck(dState.deckId, dState.name, dState.remainingCardIds, dState.color, dState.variableName);
            // Restore format
            if (dState.format) deck.format = dState.format;
            // Re-render
            renderDeckOnTable(deck, dState.x, dState.y, dState.isFaceDownDefault, dState.isSideDeck);
        });
    }

    // Restore Pawns
    if (data.tableState.pawns) {
        data.tableState.pawns.forEach(pState => {
            const pawn = new Pawn(pState.id, pState.x, pState.y, pState.color, pState.shape);
            renderPawnOnTable(pawn, pState.x, pState.y);
        });
    }

    if (data.tableState.resources) {
        activeResources = data.tableState.resources;
        renderResources();
    } else {
        activeResources = []; // Reset if not present
    }

    // Restore Cards
    if (data.tableState.cards) {
        const allCards = StorageManager.getCards();
        data.tableState.cards.forEach(cState => {
            const card = allCards.find(c => c.id === cState.cardId);
            if (card) {
                renderCardOnTable(card, cState.x, cState.y, cState.color, cState.isFaceDown, cState.isStarred, cState.deckName, cState.resolvedVariables, cState.format);
                // Fix Z
                const cardsOnTable = document.querySelectorAll('.card.draggable');
                const restoredCard = cardsOnTable[cardsOnTable.length - 1];
                if (restoredCard && cState.zIndex) {
                    restoredCard.style.zIndex = cState.zIndex;
                }
            }
        });
    }

    // Restore Zoom if we saved it? (Optional, maybe later)
    return true;
}

function setupConnectionLayer() {
    if (connectionLayer) connectionLayer.remove();
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
    addPawnBtn.addEventListener('click', handleAddPawn);
    exportTableBtn.addEventListener('click', handleExportTable);
    importTableBtn.addEventListener('click', () => importTableFile.click());
    importTableFile.addEventListener('change', handleImportTable);

    // Zoom Logic
    const baseBackgroundSize = 300; // Match CSS default

    table.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY * -0.001;
        const newScale = Math.min(Math.max(0.2, scale + delta), 3); // Limit zoom 0.2x to 3x

        scale = newScale;
        tableContent.style.transform = `scale(${scale})`;
        dragManager.setScale(scale);

        // Match CSS default for large grid (150px)
        const baseGridSize = 150;
        table.style.backgroundSize = `${15 * scale}px ${15 * scale}px, ${15 * scale}px ${15 * scale}px, ${baseGridSize * scale}px ${baseGridSize * scale}px, ${baseGridSize * scale}px ${baseGridSize * scale}px`;
    });

    // Card Drop on Deck
    tableContent.addEventListener('card-dropped-on-deck', (e) => {
        handleCardDroppedOnDeck(e);
        autoSave();
    });

    // Auto-Save on Drag End
    tableContent.addEventListener('drag-end', autoSave);

    // Interactive References (Text Links & Mini Cards)
    tableContent.addEventListener('click', (e) => {
        const target = e.target.closest('.ref-link');
        if (target) {
            e.stopPropagation();
            const cardId = target.dataset.cardId;
            if (cardId) {
                const allCards = StorageManager.getCards();
                const card = allCards.find(c => c.id === cardId);
                if (card) {
                    // Spawn near the click
                    // Account for scale
                    const rect = tableContent.getBoundingClientRect(); // Container rect
                    const clickX = (e.clientX - rect.left) / scale;
                    const clickY = (e.clientY - rect.top) / scale;

                    // Offset slightly so it doesn't appear exactly under cursor (though dragging handles that)
                    renderCardOnTable(card, clickX + 20, clickY + 20);
                }
            }
        }
    });

    // --- Box Selection Logic ---
    table.addEventListener('mousedown', (e) => {
        // Only start if clicking on the background (empty table)
        if (e.target === table || e.target === tableContent || e.target === connectionLayer) {
            if (e.button === 0) { // Left click only
                startSelection(e);
            }
        } else if (!e.target.closest('.draggable') && !e.target.closest('.nav-btn')) {
            if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT') {
                if (e.button === 0) startSelection(e);
            }
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (isSelecting) {
            updateSelection(e);
        }
    });

    document.addEventListener('mouseup', (e) => {
        if (isSelecting) {
            endSelection(e);
        }
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

    // Snap initial placement
    const snap = 15;
    const snappedX = Math.round(x / snap) * snap;
    const snappedY = Math.round(y / snap) * snap;

    renderDeckOnTable(deckInstance, snappedX, snappedY);
    autoSave();
}

function handleAddPawn() {
    // Random position near center
    const x = 300 + Math.random() * 100;
    const y = 200 + Math.random() * 100;

    // Snap
    const snap = 15;
    const snappedX = Math.round(x / snap) * snap;
    const snappedY = Math.round(y / snap) * snap;

    const pawn = new Pawn(null, snappedX, snappedY);
    renderPawnOnTable(pawn, snappedX, snappedY);
    autoSave();
}

function renderPawnOnTable(pawn, x, y) {
    const pawnEl = document.createElement('div');
    pawnEl.className = 'pawn draggable no-stack';
    pawnEl.style.left = `${x}px`;
    pawnEl.style.top = `${y}px`;
    pawnEl.style.backgroundColor = pawn.color;
    // Ensure pawns are always on top of everything else (decks/cards usually < 1000)
    pawnEl.style.zIndex = (DragManager.getNextZIndex() + 5000).toString();

    if (pawn.shape === 'circle') {
        pawnEl.style.borderRadius = '50%';
    } else {
        pawnEl.style.borderRadius = '4px';
    }

    // Pawn Controls (Simple UI)
    // We'll use a double-click to toggle shape and a right-click or small button for color?
    // User Requirement: "After adding pawn can change its shape... and color"

    // Let's add a small generic context menu or just click handlers.
    // Click: Shape Toggle
    pawnEl.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        pawn.shape = pawn.shape === 'square' ? 'circle' : 'square';
        pawnEl.style.borderRadius = pawn.shape === 'circle' ? '50%' : '4px';
        autoSave();
    });

    // Color: Use an invisible color input triggered by context menu
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = pawn.color;
    colorInput.style.position = 'absolute';
    colorInput.style.opacity = '0';
    colorInput.style.pointerEvents = 'none';
    pawnEl.appendChild(colorInput);

    colorInput.addEventListener('change', (e) => {
        pawn.color = e.target.value;
        pawnEl.style.backgroundColor = pawn.color;
        autoSave();
    });

    pawnEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Trigger color picker
        colorInput.click();
    });

    // Tooltip instructions
    pawnEl.title = "Drag to move. DblClick to change Shape. RightClick to change Color.";

    tableContent.appendChild(pawnEl);
    activePawns.push({ pawn, element: pawnEl });
    return pawnEl;
}

// --- HUD Resources ---
const addResourceBtn = document.getElementById('add-resource-btn');
const hudLayer = document.getElementById('hud-layer');

addResourceBtn.addEventListener('click', handleAddResource);

function handleAddResource() {
    const name = prompt('Resource Name (e.g. HP, Gold):', 'HP');
    if (!name) return;

    const initialValue = parseInt(prompt('Initial Value:', '10'), 10) || 0;

    const resource = {
        id: crypto.randomUUID(),
        name,
        value: initialValue
    };

    activeResources.push(resource);
    renderResources();
    autoSave();
}

function updateResource(id, delta) {
    const res = activeResources.find(r => r.id === id);
    if (res) {
        res.value += delta;
        renderResources();
        autoSave();
    }
}

function deleteResource(id) {
    if (confirm('Delete this resource?')) {
        activeResources = activeResources.filter(r => r.id !== id);
        renderResources();
        autoSave();
    }
}

function renderResources() {
    hudLayer.innerHTML = '';
    activeResources.forEach(res => {
        const widget = document.createElement('div');
        widget.className = 'resource-widget';

        const header = document.createElement('div');
        header.className = 'resource-header';

        const nameDisplay = document.createElement('span');
        nameDisplay.className = 'resource-name';
        nameDisplay.innerText = res.name;

        const removeBtn = document.createElement('button');
        removeBtn.className = 'resource-remove';
        removeBtn.innerHTML = '&times;';
        removeBtn.title = 'Remove Resource';
        removeBtn.onclick = () => deleteResource(res.id);

        header.appendChild(nameDisplay);
        // Remove button is now appended last in the main widget container OR in header if we want it there.
        // CSS says .resource-remove order: 10, so it can be anywhere in flex container if it's direct child?
        // Wait, I changed CSS to make widget flex-row.
        // So structure should be: [Header (Name)] [Controls (- Value +)] [Remove]

        const controls = document.createElement('div');
        controls.className = 'resource-controls';

        const minusBtn = document.createElement('button');
        minusBtn.className = 'resource-btn';
        minusBtn.innerText = '-';
        minusBtn.onclick = () => updateResource(res.id, -1);

        const valueDisplay = document.createElement('div');
        valueDisplay.className = 'resource-value';
        valueDisplay.innerText = res.value;

        const plusBtn = document.createElement('button');
        plusBtn.className = 'resource-btn';
        plusBtn.innerText = '+';
        plusBtn.onclick = () => updateResource(res.id, 1);

        controls.appendChild(minusBtn);
        controls.appendChild(valueDisplay);
        controls.appendChild(plusBtn);

        widget.appendChild(header);
        widget.appendChild(controls);
        widget.appendChild(removeBtn); // Add remove button at the end

        // Let's adjust CSS slightly for this structure if needed, but flex-row with order:10 on removeBtn works.
        // But header is flex-row too.

        hudLayer.appendChild(widget);
    });
}

function renderDeckOnTable(deck, x, y, isFaceDownDefault = false, isSideDeck = false) {
    const deckEl = document.createElement('div');
    deckEl.className = 'deck draggable';
    if (isSideDeck) {
        deckEl.classList.add('side-deck');
        deckEl.style.transform = 'scale(0.8)';
        deckEl.style.border = '2px dashed #fff';
    }
    deckEl.style.left = `${x}px`;
    deckEl.style.top = `${y}px`;
    deckEl.style.zIndex = DragManager.getNextZIndex();
    if (deck.color) {
        deckEl.style.backgroundColor = deck.color;
    }
    if (deck.format) {
        deckEl.classList.add(deck.format);
    }
    deckEl.innerHTML = `
        <div style="text-align: center; width:100%; padding:0 10px; box-sizing:border-box;">
            <input type="text" value="${deck.name}" class="deck-name-input" title="Rename deck on table">
            <span class="card-count" style="font-size: 0.8em; opacity: 0.8; display:block;">${deck.cardIds.length} cards</span>
        </div>
    `;

    // Add Rename Listener
    const nameInput = deckEl.querySelector('.deck-name-input');
    nameInput.addEventListener('change', (e) => {
        deck.name = e.target.value.trim() || 'Deck';
        autoSave();
    });
    // Prevent drag when editing
    nameInput.addEventListener('mousedown', (e) => e.stopPropagation());
    nameInput.addEventListener('click', (e) => e.stopPropagation());

    const deckControls = document.createElement('div');
    deckControls.className = 'deck-controls';

    // Format Toggle
    // Format Toggle
    const formatBtn = document.createElement('button');
    formatBtn.className = 'card-action-btn format-btn';
    formatBtn.title = 'Switch Format (Vertical/Horizontal/Square)';
    // Styles handled by CSS class .card-action-btn and .format-btn (with override for deck)
    formatBtn.innerHTML = '⬒';
    formatBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        cycleFormat(deckEl, deck);
        autoSave();
    });
    deckEl.appendChild(formatBtn);

    // Use a cleaner layout: Two rows or compact flex
    // Row 1: Draw | Shuffle
    // Row 2: Face Down Toggle (centered or full width)
    deckControls.innerHTML = `
        <div class="deck-btn-group">
            <button class="deck-btn draw-btn">Draw</button>
            <button class="deck-btn shuffle-btn">Shuffle</button>
        </div>
        <label class="face-down-label" title="Draw cards face down">
            <input type="checkbox" class="face-down-toggle" ${isFaceDownDefault ? 'checked' : ''}>
            <span class="face-down-text">Face Down</span>
        </label>
    `;

    deckEl.appendChild(deckControls);

    const drawBtn = deckControls.querySelector('.draw-btn');
    const shuffleBtn = deckControls.querySelector('.shuffle-btn');
    const faceDownToggle = deckControls.querySelector('.face-down-toggle');

    drawBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent drag start
        drawCard(deck, deckEl, faceDownToggle.checked);
        autoSave();
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

                    // Style directly applied in renderDeckOnTable via isSideDeck param
                    // but we used to do it manually here. Now we can rely on proper rendering if we updated usage.
                    // But here we're spawning a fresh instance.
                    // Let's call renderDeckOnTable with isSideDeck=true
                    renderDeckOnTable(newDeckInstance, targetX, targetY, false, true);

                    // Find the element we just added
                    targetDeckInstance = activeDecks[activeDecks.length - 1];
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

function drawCard(deck, deckEl, isFaceDown = false) {
    if (deck.cardIds.length === 0) {
        alert('Deck is empty!');
        return;
    }

    const cardId = deck.cardIds.shift();
    updateDeckCount(deckEl, deck);

    resolveCard(cardId, deckEl, deck.color, 0, isFaceDown, false, deck.name, deck.format);
}

function resolveCard(cardId, deckEl, sourceColor, depth, isFaceDown = false, isStarred = false, sourceDeckName = 'Deck', sourceFormat = 'vertical') {
    if (depth > 10) {
        alert('Max recursion depth reached! Possible infinite loop in special cards.');
        return;
    }

    // Handle Starred Cards from Decks
    if (typeof cardId === 'string' && cardId.endsWith(':STARRED')) {
        isStarred = true;
        cardId = cardId.replace(':STARRED', '');
    }

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

                // Recursively resolve the drawn card
                // Usually "Random card from X" implies it looks like a card from X.
                // So let's use targetDeckInstance.deck.color
                // If the random card is drawn, adhere to the face-down setting passed? 
                // Yes, inherit isFaceDown
                // Inherit format from source side-deck
                resolveCard(drawnCardId, deckEl, targetDeckInstance.deck.color, depth + 1, isFaceDown, isStarred, targetDeckInstance.deck.name, targetDeckInstance.deck.format);
            } else {
                alert('Linked side deck is empty!');
            }
            return;
        } else {
            // Infinite Mode: Random copy
            const targetDeck = StorageManager.getDecks().find(d => d.id === targetDeckId);

            if (targetDeck && targetDeck.cardIds.length > 0) {
                // Pick random card from target
                const randomIndex = Math.floor(Math.random() * targetDeck.cardIds.length);
                const randomCardId = targetDeck.cardIds[randomIndex];

                // Recursively resolve
                // Inherit from target deck
                resolveCard(randomCardId, deckEl, targetDeck.color, depth + 1, isFaceDown, isStarred, targetDeck.name, targetDeck.format);
            } else {
                alert('Target deck for random card is missing or empty!');
            }
            return;
        }
    }

    const allCards = StorageManager.getCards();
    const cardData = allCards.find(c => c.id === cardId);

    if (cardData) {
        renderCardAtDeck(cardData, deckEl, sourceColor, isFaceDown, isStarred, sourceDeckName, sourceFormat);
    }
}

function renderCardAtDeck(cardData, deckEl, color, isFaceDown = false, isStarred = false, deckName = 'Deck', format = 'vertical') {
    const rect = deckEl.getBoundingClientRect();
    // We need to account for scale when positioning
    // The rect is screen coordinates, but we append to tableContent which is scaled.
    // Actually, `activeDecks` stores `element.style.left` which is in table coordinates.
    // So we can calculate relative to that.

    const deckX = parseFloat(deckEl.style.left);
    const deckY = parseFloat(deckEl.style.top);

    // Draw to the RIGHT (Positive X)
    // Random Offset parameters
    const range = 150; // Max distance
    const min = 50;   // Min distance

    // Always positive X (Right side)
    const offsetX = min + Math.random() * (range - min);
    // Y can be up or down
    const offsetY = (Math.random() < 0.5 ? -1 : 1) * (Math.random() * range / 2); // Reduced Y range for better "row" feel

    let targetX = deckX + offsetX;
    let targetY = deckY + offsetY;

    // Snap target to Grid (15px)
    const snap = 15;
    targetX = Math.round(targetX / snap) * snap;
    targetY = Math.round(targetY / snap) * snap;

    // Initial Render at DECK position (for animation start)
    // We pass deckX, deckY as initial position to renderCardOnTable
    const cardEl = renderCardOnTable(cardData, deckX, deckY, color, isFaceDown, isStarred, deckName, null, format);

    // Animate to Target
    // We need a slight delay to allow browser to render initial position
    setTimeout(() => {
        cardEl.style.left = `${targetX}px`;
        cardEl.style.top = `${targetY}px`;
    }, 50);
}

function updateDeckCount(deckEl, deck) {
    const countSpan = deckEl.querySelector('.card-count');
    if (countSpan) {
        countSpan.textContent = `${deck.cardIds.length} cards`;
    }
}

function renderCardOnTable(card, x, y, color = null, isFaceDown = false, isStarred = false, deckName = 'Card', savedVariables = null, format = 'vertical') {
    const cardEl = document.createElement('div');
    cardEl.className = `card draggable${isFaceDown ? ' face-down' : ''}${isStarred ? ' starred' : ''}`;
    if (format && format !== 'vertical') {
        cardEl.classList.add(format);
    }
    cardEl.dataset.format = format || 'vertical';
    cardEl.dataset.id = card.id;
    if (color) {
        cardEl.dataset.color = color;
    }
    // Store deck name if face down needed later
    cardEl.dataset.deckName = deckName;

    cardEl.style.left = `${x}px`;
    cardEl.style.top = `${y}px`;
    cardEl.style.zIndex = DragManager.getNextZIndex();

    const headerStyle = color ? `style="background-color: ${color}; color: white; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);"` : '';

    // Context for variable resolution (shared across mech and flavor text for consistency)
    const resolutionContext = new Map();

    // Hydrate from saved state if available
    if (savedVariables && Array.isArray(savedVariables)) {
        const allCards = StorageManager.getCards();
        savedVariables.forEach(([key, cardId]) => {
            const resolvedCard = allCards.find(c => c.id === cardId);
            if (resolvedCard) {
                resolutionContext.set(key, { card: resolvedCard });
            }
        });
    }

    // Process Text for Variables
    const mechResult = processVariables(card.mechanicalText, resolutionContext);
    const flavorResult = processVariables(card.flavorText || '', resolutionContext);

    const finalMechText = mechResult.text;
    const finalFlavorText = flavorResult.text;

    // Collect all unique attachments from context to avoid duplicates if referenced multiple times
    const attachments = Array.from(resolutionContext.values()).map(v => v.card);

    // Persist resolution to DOM for auto-save
    // We save as array of [key, cardId]
    const variablesToSave = Array.from(resolutionContext.entries()).map(([key, val]) => [key, val.card.id]);

    cardEl.dataset.resolvedVariables = JSON.stringify(variablesToSave);

    cardEl.innerHTML = `
        <button class="card-action-btn format-btn" title="Toggle Format">⬒</button>
        <button class="card-action-btn star-btn ${isStarred ? 'active' : ''}" title="Toggle Star">★</button>
        <button class="card-action-btn flip-btn" title="Flip Card"></button>
        <div class="card-header" ${headerStyle}>${card.name}</div>
        <div class="card-body">${finalMechText}</div>
        ${finalFlavorText ? `<div class="card-flavor">${finalFlavorText}</div>` : ''}
        <div class="card-tags">${card.tags.join(', ')}</div>
        <button class="create-deck-btn" title="Create Deck from Stack"></button>
        <div class="card-attachments"></div>
        <div class="card-back-content">
            <div style="font-weight:bold; color:white; background:${color || '#555'}; padding:8px; border-radius:4px; box-shadow:0 0 5px rgba(0,0,0,0.5);">${deckName}</div>
        </div>
    `;

    // Add Flip Listener
    const flipBtn = cardEl.querySelector('.flip-btn');
    flipBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        flipCard(cardEl);
    });

    const starBtn = cardEl.querySelector('.star-btn');
    starBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        cardEl.classList.toggle('starred');
        starBtn.classList.toggle('active');
        autoSave();
    });

    const formatBtn = cardEl.querySelector('.format-btn');
    formatBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        cycleFormat(cardEl); // Logic handles persistence via dataset update, then save
        autoSave();
    });

    // Render attachments
    const attachmentContainer = cardEl.querySelector('.card-attachments');
    if (attachments.length > 0) {
        // Side positioning
        attachmentContainer.style.position = 'absolute';
        attachmentContainer.style.left = '100%';
        attachmentContainer.style.top = '0';
        attachmentContainer.style.display = 'flex';
        attachmentContainer.style.flexDirection = 'column'; // Stack vertically on the right
        attachmentContainer.style.gap = '5px';
        attachmentContainer.style.paddingLeft = '10px'; // Spacing from parent
        attachmentContainer.style.pointerEvents = 'auto';
        attachmentContainer.style.pointerEvents = 'auto';

        // Connector line style (visual only)
        // We can add a pseudo element or SVG later, for now just spacing

        attachments.forEach(attCard => {
            const attEl = document.createElement('div');
            attEl.className = 'mini-card ref-link'; // Add ref-link class
            attEl.dataset.cardId = attCard.id; // Add ID
            attEl.style.border = '1px solid #7f8c8d';
            attEl.style.borderRadius = '4px';
            attEl.style.padding = '4px';
            attEl.style.backgroundColor = 'var(--card-bg)';
            attEl.style.fontSize = '0.7em';
            attEl.style.width = '80px';
            attEl.style.boxShadow = '2px 2px 4px rgba(0,0,0,0.3)';
            attEl.style.position = 'relative';
            attEl.style.cursor = 'pointer'; // Show pointer
            attEl.title = 'Click to spawn card';

            // Visual connector to parent
            const connector = document.createElement('div');
            connector.style.position = 'absolute';
            connector.style.top = '10px';
            connector.style.left = '-10px';
            connector.style.width = '10px';
            connector.style.height = '1px';
            connector.style.backgroundColor = '#ccc';
            attEl.appendChild(connector);

            attEl.innerHTML += `<strong>${attCard.name}</strong><br><span style="font-size:0.9em">${attCard.mechanicalText}</span>`;
            attachmentContainer.appendChild(attEl);
        });
    }
    // Add Create Deck listener
    const createDeckBtn = cardEl.querySelector('.create-deck-btn');
    createDeckBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent drag
        handleCreateDeck(cardEl, card);
        autoSave();
    });

    // Context Menu Flip (Right Click)
    cardEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        flipCard(cardEl);
        // autoSave handled by flipCard
    });

    tableContent.appendChild(cardEl);

    return cardEl;
}

function processVariables(text, context, depth = 0) {
    if (!text) return { text: '', attachments: [] };
    if (depth > 5) return { text, attachments: [] }; // Prevent infinite recursion

    // Regex to match {NAME} or {NAME:INDEX}
    // Captures: 1=Name, 2=Index (optional)
    const processedText = text.replace(/{([A-Z0-9_]+)(?::(\d+))?}/g, (match, variableName, index) => {
        const varKey = `${variableName}:${index || 0}`;

        // Check context first
        if (context.has(varKey)) {
            const card = context.get(varKey).card;
            return `<span class="ref-link" data-card-id="${card.id}" style="text-decoration:underline; font-weight:bold; color:#f1c40f; cursor:pointer;" title="Click to spawn ${card.name}">${card.name}</span>`;
        }

        // Find deck with this variable name
        const deckInstance = activeDecks.find(d => d.deck.variableName === variableName);

        if (deckInstance && deckInstance.deck.cardIds.length > 0) {
            // Draw card
            const cardId = deckInstance.deck.cardIds.shift();
            updateDeckCount(deckInstance.element, deckInstance.deck); // Update UI for the source deck

            const allCards = StorageManager.getCards();
            const card = allCards.find(c => c.id === cardId);

            if (card) {
                // Store in context
                context.set(varKey, { card });

                return `<span class="ref-link" data-card-id="${card.id}" style="text-decoration:underline; font-weight:bold; color:#f1c40f; cursor:pointer;" title="Click to spawn ${card.name}">${card.name}</span>`;
            }
        }
        return match; // Return original if no match or empty
    });

    return { text: processedText };
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

    // Snap it? Dragging likely snapped it already, but good to ensure.
    const snap = 15;
    const snappedX = Math.round(x / snap) * snap;
    const snappedY = Math.round(y / snap) * snap;

    renderDeckOnTable(newDeck, snappedX, snappedY);
    autoSave();
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
    activePawns = [];
    setupConnectionLayer(); // Re-create layer
    autoSave();
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
            let finalId = id;
            if (el.classList.contains('starred')) {
                finalId += ':STARRED';
            }
            deck.addCard(finalId);
            el.remove();
        }
    });

    // Update Deck UI
    updateDeckCount(deckElement, deck);
}

function handleExportTable() {
    const exportData = captureFullState();
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
                const deck = new Deck(dState.deckId, dState.name, dState.remainingCardIds, dState.color, dState.variableName);
                // Restore format if saved (legacy saves might not have it)
                if (dState.format) deck.format = dState.format;
                renderDeckOnTable(deck, dState.x, dState.y, dState.isFaceDownDefault, dState.isSideDeck);
            });

            // Restore Cards
            const allCards = StorageManager.getCards();
            data.tableState.cards.forEach(cState => {
                const card = allCards.find(c => c.id === cState.cardId);
                if (card) {
                    renderCardOnTable(card, cState.x, cState.y, cState.color, cState.isFaceDown, cState.isStarred, cState.deckName, null, cState.format);
                    // Force zIndex
                    const cardsOnTable = document.querySelectorAll('.card.draggable');
                    const restoredCard = cardsOnTable[cardsOnTable.length - 1];
                    if (restoredCard && cState.zIndex) {
                        restoredCard.style.zIndex = cState.zIndex;
                    }
                }
            });
        }

        alert('Table state imported successfully!');
        autoSave();

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
                <li><strong>Selection:</strong> Drag on empty background to select multiple cards.</li>
                <li><strong>Zoom:</strong> Mouse wheel to zoom (0.2x - 3x).</li>
                <li><strong>Flip Card:</strong> Right-Click a card to flip it face-down.</li>
                <li><strong>Draw:</strong> Click "Draw" on a deck. Cards fly out to the right.</li>
                <li><strong>Star Card:</strong> Click the Star icon on a card to mark it (yellow border). This state is preserved even if the card is shuffled into a deck.</li>
                <li><strong>Rename Deck:</strong> Click the deck name on the table to edit.</li>
                <li><strong>Shuffle:</strong> Click "Shuffle" to randomize a deck.</li>
                <li><strong>Random Cards:</strong> Finite/Infinite modes supported.</li>
                <li><strong>Variables:</strong> Cards with {ITEM} placeholders draw automatically. Underlying decks must be on table.</li>
                <li><strong>Pawns:</strong> Click "Add Pawn" to place a token. Drag to move. Double-click to toggle shape. Right-click to change color. Pawns are always on top.</li>
                <li><strong>Resources:</strong> Click "Add Resource" to create a tracker (e.g. HP). Use +/- to change value. Trackers appear at the top of the screen.</li>
            </ul>
            <h3>Interactions</h3>
            <ul>
                <li><strong>Stacking:</strong> Drag a card over another to stack them.</li>
                <li><strong>Moving Stacks:</strong> Drag the bottom card to move the stack.</li>
                <li><strong>Separating:</strong> Drag the top card to separate it.</li>
                <li><strong>Spawn from Reference:</strong> Click on valid referenced text (e.g. {ITEM}) or attached mini-cards to spawn a copy of that card on the table.</li>
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

function flipCard(cardEl) {
    cardEl.classList.add('is-flipping');

    setTimeout(() => {
        cardEl.classList.toggle('face-down');
        cardEl.classList.remove('is-flipping');
        autoSave();
    }, 100); // Wait half of transition
}

function cycleFormat(element, deckObj = null) {
    // Cycles: vertical -> horizontal -> square -> vertical
    const formats = ['vertical', 'horizontal', 'square'];

    // Determine current format
    let current = 'vertical';
    if (element.classList.contains('horizontal')) current = 'horizontal';
    if (element.classList.contains('square')) current = 'square';

    const nextIndex = (formats.indexOf(current) + 1) % formats.length;
    const nextFormat = formats[nextIndex];

    // Remove all
    formats.forEach(f => element.classList.remove(f));

    // Add new (if not vertical default)
    if (nextFormat !== 'vertical') {
        element.classList.add(nextFormat);
    }

    // Update state
    if (deckObj) {
        deckObj.format = nextFormat;
    } else {
        // Card
        element.dataset.format = nextFormat;
    }
}

init();
function startSelection(e) {
    isSelecting = true;

    // Calculate start position relative to table-content (scaled world)
    // We attach transparent box to tableContent so it scales with everything
    const rect = tableContent.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    selectionStart = { x, y };

    // Create box
    selectionBox = document.createElement('div');
    selectionBox.className = 'selection-box';
    selectionBox.style.left = `${x}px`;
    selectionBox.style.top = `${y}px`;
    selectionBox.style.width = '0px';
    selectionBox.style.height = '0px';
    tableContent.appendChild(selectionBox);

    // Clear previous selection unless Shift held?
    if (!e.shiftKey) {
        clearSelection();
    }
}

function updateSelection(e) {
    if (!selectionBox) return;

    const rect = tableContent.getBoundingClientRect();
    const currentX = (e.clientX - rect.left) / scale;
    const currentY = (e.clientY - rect.top) / scale;

    const startX = selectionStart.x;
    const startY = selectionStart.y;

    const minX = Math.min(startX, currentX);
    const minY = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    selectionBox.style.left = `${minX}px`;
    selectionBox.style.top = `${minY}px`;
    selectionBox.style.width = `${width}px`;
    selectionBox.style.height = `${height}px`;
}

function endSelection(e) {
    if (!selectionBox) return;

    const draggables = tableContent.querySelectorAll('.draggable');
    draggables.forEach(el => {
        if (isIntersecting(selectionBox, el)) {
            el.classList.add('selected');
        }
    });

    // Cleanup
    selectionBox.remove();
    selectionBox = null;
    isSelecting = false;
}

function clearSelection() {
    const selected = tableContent.querySelectorAll('.selected');
    selected.forEach(el => el.classList.remove('selected'));
}

function isIntersecting(el1, el2) {
    const rect1 = el1.getBoundingClientRect();
    const rect2 = el2.getBoundingClientRect();

    return !(rect2.left > rect1.right ||
        rect2.right < rect1.left ||
        rect2.top > rect1.bottom ||
        rect2.bottom < rect1.top);
}
