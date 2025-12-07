export class Pawn {
    constructor(id, x, y, color = '#e74c3c', shape = 'square') {
        this.id = id || crypto.randomUUID();
        this.x = x;
        this.y = y;
        this.color = color;
        this.shape = shape; // 'square' or 'circle'
        this.type = 'pawn';
    }

    static fromJSON(json) {
        return new Pawn(json.id, json.x, json.y, json.color, json.shape);
    }
}
