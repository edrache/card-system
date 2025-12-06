# Card System

A web-based tabletop card system that allows you to create cards and play with them on a virtual table.

## Features

### 1. Card Builder
-   **Multi-View Interface**: Separate views for Creating cards, managing your Library, and Building Decks.
-   **Create Custom Cards**: Define card name, mechanical text, flavor text, and tags.
-   **Advanced Editing**:
    -   **Overwrite**: Update existing cards directly.
    -   **Save as New**: Create variations of cards easily.
-   **Library Management**:
    -   **Grid View**: Visual grid display of all cards.
    -   **Filtering**: Search by name and filter by tags (with autocomplete).
    -   **Bulk Actions**: Select multiple cards to delete, add to decks, or tag in bulk.
-   **Deck Builder**:
    -   **Accordion Layout**: Manage multiple decks easily.
    -   **Customization**: Set deck names and colors.
    -   **Import/Export**: Save and load your library, decks, and table state.

## Special Cards

- **Random Card:** You can add a "Random Card" to a deck in the Deck Builder. When drawn during a game, this card will be replaced by a random card from a specified source deck.
    -   **Infinite Mode (Default):** Draws a random copy from the source deck definition. The source deck is not affected.
    -   **Finite Mode:** Spawns a physical side deck on the table. Cards are drawn from this specific instance and can run out.

- **Variable Substitution:**
    -   Assign a **Variable Name** (e.g., `ITEM`) to a deck in the Deck Builder.
    -   Use placeholders like `{ITEM}` in card text. When the card is drawn, a card from the `ITEM` deck is drawn and substituted into the text.
    -   **Indexing:** Use `{ITEM:1}`, `{ITEM:2}` to draw multiple distinct cards. Using `{ITEM}` or `{ITEM:1}` multiple times refers to the same drawn card.
    -   drawn cards appear attached to the right side of the main card.
    -   **Interactivity:** Click on the underlined variable text or the attached mini-card to spawn a full copy of the referenced card on the table.

### 2. Tabletop Interface
-   **Visual Style**: "Blueprint Theme" - High-contrast, dark mode, technical aesthetic with monochromatic elements.
-   **Drag & Drop**: Freely move cards and decks around the table.
-   **Box Selection**: Click and drag on the empty table background to select multiple cards. Move them all at once!
-   **Card Actions**:
    -   **Flip**: Right-click a card to flip it face-down/face-up.
    -   **Zoom/Details**: Click a variable link to spawn referenced cards.
-   **Smart Stacking**:
    -   Drag a card over another (>50% overlap) to snap them together.
    -   Drag the bottom card to move the entire stack.
    -   Cards in a stack automatically offset for visibility.
-   **Deck Controls**:
    -   **Draw**: Click "Draw" (or the deck body) to reveal a card. Cards animatedly "fly out" to the right.
    -   **Shuffle**: Click "Shuffle" to randomize.
    -   **Rename**: Click the deck name on the table to rename it on the fly.
    -   **Color**: Decks inherit their color from the Builder (displayed as a border/accent).
-   **Table Management**:
    -   **Infinite Canvas**: A massive 3000x3000px workspace.
    -   **Zoomable Table**: Use **Mouse Wheel** to zoom from 0.2x (bird's eye view) to 3x (close up).
    -   **Import/Export**: Save/Load table state (JSON).

## How to Run

1.  **Start a Local Server**:
    You need a local web server to run the application (due to ES6 modules).
    ```bash
    python3 -m http.server 8081
    ```

2.  **Open in Browser**:
    -   **Tabletop**: Navigate to `http://localhost:8081/index.html`
    -   **Builder**: Navigate to `http://localhost:8081/builder.html`

## Customization

-   **Theme**: The visuals are controlled by CSS variables in `css/style.css` (Look for Blueprint Palette).