import { StorageManager } from './utils/StorageManager.js';
import { DragManager } from './ui/DragManager.js';
import { Card } from './models/Card.js';
import { Deck } from './models/Deck.js';

// DOM Elements
const table = document.getElementById('table');
const tableContent = document.getElementById('table-content'); // New container
const deckSelect = document.getElementById('deck-select');
const addDeckBtn = document.getElementById('add-deck-btn');
const resetTableBtn = document.getElementById('reset-table');

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

init();
