# Equipment Loan System — Engineering Lab

Custom **LinkedList**, **Queue**, and **Stack** data structures (built from
scratch, no arrays for storage) power an equipment loan system with a
browser-based UI, in TypeScript.

## Project layout

```
src/
  tda/
    LinkedList.ts   Custom singly linked list (used for the inventory)
    Queue.ts        Custom FIFO queue, O(1) enqueue/dequeue (wait lists, review, storage)
    Stack.ts        Custom LIFO stack, O(1) push/pop (equipment carts)
  models/
    Models.ts       Shared types: Equipment, WaitRequest, ActiveLoan, etc.
  core/
    LabSystem.ts    All business rules (R1-R8) and operations (RF-01 to RF-09).
                     The UI never touches the TDAs directly — only these public methods.
  ui/
    App.ts          DOM-based UI: 4 screens (Inventory, Loan Desk, Carts, Review & Reports)
index.html           Page shell; loads dist/bundle.js (built from src/)
tsconfig.json         Compiles all src/*.ts files into a single dist/bundle.js
```

## Build and run

1. Install dependencies:
   ```
   npm install
   ```
2. Compile the TypeScript into `dist/bundle.js`:
   ```
   npm run build
   ```
3. Open `index.html` directly in your browser (double-click it, or
   right-click → Open with → your browser). No server is required.

Every time you change a `.ts` file, run `npm run build` again and refresh
the page.

## Notes

- `index.html` only contains markup/CSS and a `<script src="dist/bundle.js">`
  tag — it never implements logic itself (RFE-01).
- The three data structures are implemented as TypeScript namespaces
  (`TDA`, `Models`, `Core`, `UI`) and compiled together with `tsc`'s
  `outFile` option into one bundle, so the page can load a single script
  with no bundler.
