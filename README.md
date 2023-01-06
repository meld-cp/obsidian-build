# Meld Build - An Obsidian Plugin

Write and execute (sandboxed) JavaScript to render templates, query DataView and create dynamic notes.

Basically, turn a note into a small, simple, runnable thing.

## Quick Start
- Install and enable the plugin
- Paste the Markdown below into a new note.
- If you are in Reading or Live Preview modes, click the 'Hi' button.  If you are in Source mode, choose `Meld Build: Run` from the command pallette.
````md

```meld-build-toolbar
run = Hi
```

```js meld-build
const ans = await $.ui.ask('What should I call you?');
await $.ui.message( `From this day forth you shall be known as ${ans}` );
```
````

## Documentation

- [User Guide](/docs/user-guide.md)
- [API](/docs/api.md)

### Examples

- [Guess The Number Game](/docs/examples/guess-the-number.md)
- [Simple Invoice Builder](/docs/examples/invoice-builder.md)

## Known Issues
- If you quickly try to run a note just after some changes, there's a chance that the Obsidian cache hasn't been updated yet.  The workaround for now is to wait a second or two before running a changed note.

## Manually installing the plugin

- Copy over `main.js`, `styles.css`, `manifest.json` to your vault `VaultFolder/.obsidian/plugins/meld-build/`.
