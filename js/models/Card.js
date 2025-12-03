export class Card {
    constructor(id, name, mechanicalText, flavorText, tags = [], displayId = null) {
        this.id = id || crypto.randomUUID();
        this.displayId = displayId;
        this.name = name;
        this.mechanicalText = mechanicalText;
        this.flavorText = flavorText;
        this.tags = tags;
    }

    static fromJSON(json) {
        return new Card(json.id, json.name, json.mechanicalText, json.flavorText, json.tags, json.displayId);
    }
}
