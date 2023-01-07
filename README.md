# Meld Build - An Obsidian Plugin

Write and execute (sandboxed) JavaScript to render templates, query DataView and create dynamic notes.

Basically, turn a note into a small, simple, runnable thing.

<a href="https://www.buymeacoffee.com/cleon"><img src="https://img.buymeacoffee.com/button-api/?text=&emoji=&slug=meld-build&button_colour=FFDD00&font_colour=000000&font_family=Arial&outline_colour=000000&coffee_colour=ffffff"></a>

## Quick Start
- Install and enable the plugin
- Paste the Markdown below into a new note.
- If you are in Reading or Live Preview modes, click the 'Run' button.  If you are in Source mode, choose `Meld Build: Run` from the command pallette.
````md

```meld-build-toolbar
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
- [Guess The Number Game (Using Markers)](/docs/examples/guess-the-number-marker.md)
- [Simple Invoice Builder](/docs/examples/invoice-builder.md)

## Manually installing the plugin

- Copy over `main.js`, `styles.css`, `manifest.json` to your vault `VaultFolder/.obsidian/plugins/meld-build/`.
