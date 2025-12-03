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
    -   **Import/Export**: Export your Library and Decks to JSON for backup or sharing.

### 2. Tabletop Interface
-   **Drag & Drop**: Freely move cards and decks around the table.
-   **Smart Stacking**:
    -   Drag a card over another (>50% overlap) to snap them together.
    -   Drag the bottom card to move the entire stack.
    -   Drag the top card to separate it.
-   **Deck Controls**:
    -   **Draw**: Click the "Draw" button on the deck to reveal a card.
    -   **Shuffle**: Click the "Shuffle" button to randomize the deck.
    -   **Visuals**: Decks display their assigned color from the builder.
-   **Table Management**:
    -   **Zoomable Table**: Use the **Mouse Wheel** to zoom in and out.
    -   **Import/Export**: Save the entire table state (including card definitions) to a file and restore it later. Perfect for saving games or sharing setups.

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

-   **Background Pattern**: You can adjust the base size of the background pattern in `css/style.css` (look for `#table` styles).