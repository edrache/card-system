import { Card } from '../models/Card.js';
import { Deck } from '../models/Deck.js';

const CARDS_KEY = 'card_system_cards';
const DECKS_KEY = 'card_system_decks';

export class StorageManager {
    static getCards() {
        const cardsJson = localStorage.getItem(CARDS_KEY);
        if (!cardsJson) return [];
        return JSON.parse(cardsJson).map(Card.fromJSON);
    }

    static saveCard(card) {
        const cards = this.getCards();
        const existingIndex = cards.findIndex(c => c.id === card.id);

        if (existingIndex >= 0) {
            // Preserve existing displayId if not set on the incoming object (though it should be)
            if (!card.displayId) {
                card.displayId = cards[existingIndex].displayId;
            }
            cards[existingIndex] = card;
        } else {
            // Assign new displayId
            const maxId = cards.reduce((max, c) => Math.max(max, c.displayId || 0), 0);
            card.displayId = maxId + 1;
            cards.push(card);
        }
        localStorage.setItem(CARDS_KEY, JSON.stringify(cards));
    }

    static deleteCard(cardId) {
        const cards = this.getCards().filter(c => c.id !== cardId);
        localStorage.setItem(CARDS_KEY, JSON.stringify(cards));
    }

    static getDecks() {
        const decksJson = localStorage.getItem(DECKS_KEY);
        if (!decksJson) return [];
        return JSON.parse(decksJson).map(Deck.fromJSON);
    }

    static saveDeck(deck) {
        const decks = this.getDecks();
        const existingIndex = decks.findIndex(d => d.id === deck.id);
        if (existingIndex >= 0) {
            decks[existingIndex] = deck;
        } else {
            decks.push(deck);
        }
        localStorage.setItem(DECKS_KEY, JSON.stringify(decks));
    }

    static deleteDeck(deckId) {
        const decks = this.getDecks().filter(d => d.id !== deckId);
        localStorage.setItem(DECKS_KEY, JSON.stringify(decks));
    }

    static clearAll() {
        localStorage.removeItem(CARDS_KEY);
        localStorage.removeItem(DECKS_KEY);
    }
}
