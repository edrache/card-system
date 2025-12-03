export class Deck {
    constructor(id, name, cardIds = [], color = '#34495e') {
        this.id = id || crypto.randomUUID();
        this.name = name;
        this.cardIds = cardIds;
        this.color = color;
    }

    static fromJSON(json) {
        return new Deck(json.id, json.name, json.cardIds, json.color);
    }

    addCard(cardId) {
        this.cardIds.push(cardId);
    }

    removeCard(cardId) {
        const index = this.cardIds.indexOf(cardId);
        if (index > -1) {
            this.cardIds.splice(index, 1);
        }
    }

    shuffle() {
        for (let i = this.cardIds.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cardIds[i], this.cardIds[j]] = [this.cardIds[j], this.cardIds[i]];
        }
    }
}
