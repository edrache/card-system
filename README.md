# Card System

A web-based tabletop card system that allows you to create cards and play with them on a virtual table.

## Features

### 1. Card Builder
-   **Create Custom Cards**: Define card name, mechanical text, flavor text, and tags.
-   **Manage Decks**: Create new decks and add your custom cards to them.
-   **Local Storage**: All data is saved locally in your browser.

### 2. Tabletop Interface
-   **Drag & Drop**: Freely move cards and decks around the table.
-   **Smart Stacking**:
    -   Drag a card over another (>50% overlap) to snap them together.
    -   Drag the bottom card to move the entire stack.
    -   Drag the top card to separate it.
-   **Deck Controls**:
    -   **Draw**: Click the "Draw" button on the deck to reveal a card.
    -   **Shuffle**: Click the "Shuffle" button to randomize the deck.
-   **Zoomable Table**:
    -   Use the **Mouse Wheel** to zoom in and out.
    -   The background pattern scales dynamically with the zoom level.
-   **Layering**: Newly drawn cards and moved stacks always appear on top of other elements.

## How to Run

1.  **Start a Local Server**:
    You need a local web server to run the application (due to ES6 modules).
    ```bash
    python3 -m http.server 8081
    ```

2.  **Open in Browser**:
    Navigate to `http://localhost:8081/index.html`

## Customization

-   **Background Pattern**: You can adjust the base size of the background pattern in `css/style.css` (look for `#table` styles).