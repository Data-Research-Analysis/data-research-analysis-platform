# Plan decks

Place the PDF deck(s) shown in the homepage "See the full plan deck" section here.

Files in this folder are served at `/plan-decks/<filename>`.

To use a deck, update the `pdfs` array in `frontend/pages/index.vue`:

```vue
<plan-deck :pdfs="[
  { label: 'DRA plan deck', src: '/plan-decks/dra-plan-deck.pdf' }
]" />
```

For multiple decks, add one entry per file (they render as tabs).
