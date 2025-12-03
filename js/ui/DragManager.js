export class DragManager {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.draggedElements = []; // Changed from single element to array
        this.offsetY = 0;
        this.startX = 0;
        this.startY = 0;
        this.scale = 1; // Default scale

        // Initialize global Z-index if not set
        if (!DragManager.globalZIndex) {
            DragManager.globalZIndex = 1000;
        }

        this.setupEventListeners();
    }

    static getNextZIndex() {
        if (!DragManager.globalZIndex) {
            DragManager.globalZIndex = 1000;
        }
        DragManager.globalZIndex++;
        return DragManager.globalZIndex;
    }

    setScale(scale) {
        this.scale = scale;
    }

    setupEventListeners() {
        this.container.addEventListener('mousedown', this.handleMouseDown.bind(this));
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
    }

    handleMouseDown(e) {
        const target = e.target.closest('.draggable');
        if (!target) return;

        // Prevent dragging if clicking on a button inside the draggable
        if (e.target.tagName === 'BUTTON') return;

        this.potentialDragTarget = target;
        this.startX = e.clientX;
        this.startY = e.clientY;
        this.isDragging = false;
    }

    handleMouseMove(e) {
        if (!this.potentialDragTarget && this.draggedElements.length === 0) return;

        // If not yet dragging, check threshold
        if (!this.isDragging && this.potentialDragTarget) {
            const dx = e.clientX - this.startX;
            const dy = e.clientY - this.startY;
            if (Math.sqrt(dx * dx + dy * dy) > 5) {
                this.startDrag(this.potentialDragTarget, e);
            }
        }

        if (this.isDragging) {
            e.preventDefault();
            const containerRect = this.container.getBoundingClientRect();

            this.draggedElements.forEach(el => {
                const offsetX = parseFloat(el.dataset.offsetX);
                const offsetY = parseFloat(el.dataset.offsetY);

                // Adjust for scale
                // The mouse movement needs to be divided by scale to match the transformed coordinate system
                // BUT, the offsetX/Y were calculated based on screen coordinates.
                // Let's rethink.

                // When we set left/top, we are setting them in the CSS coordinate system of the parent (#table-content).
                // e.clientX is screen coordinate.
                // containerRect.left is screen coordinate of the container.

                // The formula:
                // (ScreenMouse - ScreenContainerOffset) / Scale = CSSPosition

                // We also need to account for the initial offset within the element.
                // initialOffset = (ScreenMouseStart - ScreenElementStart)
                // This offset is in "screen pixels" but effectively represents a distance *inside* the element.
                // Since the element is scaled, this distance is also scaled.

                // Let's simplify:
                // We want the element to stay under the mouse.
                // NewCSSPos = (e.clientX - containerRect.left) / this.scale - (offsetX / this.scale)
                // Wait, offsetX was calculated as (e.clientX - rect.left).
                // If we divide everything by scale, it should work.

                const x = (e.clientX - containerRect.left - offsetX) / this.scale;
                const y = (e.clientY - containerRect.top - offsetY) / this.scale;

                el.style.left = `${x}px`;
                el.style.top = `${y}px`;
            });
        }
    }

    startDrag(target, e) {
        this.isDragging = true;
        this.potentialDragTarget = null;

        // Identify the stack
        this.draggedElements = this.getStack(target);

        // Bring stack to front, preserving order
        this.draggedElements.forEach(el => {
            el.style.zIndex = DragManager.getNextZIndex();
            el.classList.add('dragging');

            // Store initial offsets for each element relative to mouse
            // We store the raw screen pixel difference
            const rect = el.getBoundingClientRect();
            el.dataset.offsetX = e.clientX - rect.left;
            el.dataset.offsetY = e.clientY - rect.top;
        });
    }

    handleMouseUp(e) {
        this.potentialDragTarget = null;

        if (this.draggedElements.length === 0) return;

        // Check for snapping only for the bottom-most card in the dragged stack
        // The bottom-most card is the first one in the stack array (the one clicked or lowest in hierarchy)
        // Actually, let's snap the "primary" dragged element (the one we clicked)
        // But if we are dragging a stack, we usually want the *bottom* of our stack to snap to something *below* it.
        // The getStack method returns [target, ...cardsOnTop]. So index 0 is the bottom of the moving stack.

        const bottomCard = this.draggedElements[0];
        this.handleSnapping(bottomCard);

        this.draggedElements.forEach(el => {
            el.classList.remove('dragging');
            delete el.dataset.offsetX;
            delete el.dataset.offsetY;
        });

        this.draggedElements = [];
        this.isDragging = false;
    }

    getStack(baseCard) {
        const stack = [baseCard];
        const allCards = Array.from(this.container.querySelectorAll('.draggable'));

        // Find cards that are visually "above" the base card and overlapping it
        // We'll do a simple recursive check or just check all cards
        // A card is "above" if it has a higher z-index (or comes later in DOM if z-index is same, but we use z-index)
        // AND it overlaps the base card (or a card already in the stack)

        // For simplicity, let's just find everything directly on top of the base card, 
        // and then things on top of those, etc.

        // Sort all cards by Z-index to process bottom-up
        allCards.sort((a, b) => parseInt(a.style.zIndex || 0) - parseInt(b.style.zIndex || 0));

        const baseZ = parseInt(baseCard.style.zIndex || 0);
        const candidates = allCards.filter(c => parseInt(c.style.zIndex || 0) > baseZ);

        // We need to iteratively add cards that overlap with ANY card currently in the stack
        let added;
        do {
            added = false;
            candidates.forEach((c, index) => {
                if (stack.includes(c)) return; // Already in stack

                // Check overlap with any card in stack
                // USE STRICT OVERLAP HERE
                const overlaps = stack.some(stackCard => this.isSignificantOverlap(stackCard, c));

                if (overlaps) {
                    stack.push(c);
                    added = true;
                }
            });
        } while (added);

        return stack;
    }

    isOverlapping(cardA, cardB) {
        const rectA = cardA.getBoundingClientRect();
        const rectB = cardB.getBoundingClientRect();

        return !(rectA.right < rectB.left ||
            rectA.left > rectB.right ||
            rectA.bottom < rectB.top ||
            rectA.top > rectB.bottom);
    }

    isSignificantOverlap(cardA, cardB) {
        const rectA = cardA.getBoundingClientRect();
        const rectB = cardB.getBoundingClientRect();

        // Calculate intersection area
        const x_overlap = Math.max(0, Math.min(rectA.right, rectB.right) - Math.max(rectA.left, rectB.left));
        const y_overlap = Math.max(0, Math.min(rectA.bottom, rectB.bottom) - Math.max(rectA.top, rectB.top));
        const overlapArea = x_overlap * y_overlap;

        // We check if cardB (the one on top) overlaps cardA (the one below) significantly
        // The user said: "dopiero jak 50% pokrywa kartę wyżej to się grupują"
        // This usually means the intersection area should be > 50% of the *smaller* card's area, 
        // or specifically the card being dragged on top.
        // Since cards are usually same size, we can just use cardB's area.

        const cardBArea = rectB.width * rectB.height;
        return (overlapArea / cardBArea) > 0.5;
    }

    handleSnapping(card) {
        const allCards = Array.from(this.container.querySelectorAll('.draggable'));
        const cardRect = card.getBoundingClientRect();
        const cardArea = cardRect.width * cardRect.height;

        let bestTarget = null;
        let maxOverlap = 0;

        allCards.forEach(target => {
            if (this.draggedElements.includes(target)) return; // Don't snap to self or stack

            const targetRect = target.getBoundingClientRect();

            // Calculate intersection area
            const x_overlap = Math.max(0, Math.min(cardRect.right, targetRect.right) - Math.max(cardRect.left, targetRect.left));
            const y_overlap = Math.max(0, Math.min(cardRect.bottom, targetRect.bottom) - Math.max(cardRect.top, targetRect.top));
            const overlapArea = x_overlap * y_overlap;

            const overlapRatio = overlapArea / cardArea;

            if (overlapRatio > 0.5 && overlapRatio > maxOverlap) {
                maxOverlap = overlapRatio;
                bestTarget = target;
            }
        });

        if (bestTarget) {
            // Snap X to target's X
            // We need to calculate the relative position
            const containerRect = this.container.getBoundingClientRect();
            const targetRect = bestTarget.getBoundingClientRect();

            // Calculate the delta needed to align Lefts
            const currentLeft = parseFloat(card.style.left);
            const targetLeft = (targetRect.left - containerRect.left) / this.scale;
            const deltaX = targetLeft - currentLeft;

            // Apply delta to ALL dragged elements to keep them relative to each other
            this.draggedElements.forEach(el => {
                const elLeft = parseFloat(el.style.left);
                el.style.left = `${elLeft + deltaX}px`;
            });
        }
    }
}
