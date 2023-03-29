# User Guide

The Meld-Build plugin can be used to turn a note into a small, simple, runnable thing.

For example, here's a JavaScript codeblock which will display a message box with the result of a simple calculation:
````md
```js meld-build
await $.ui.message( 56 / 5 );
```
````
To run it, select the `Meld-Build: Run` command from the command pallette.

Notice that the `JavaScript` codeblock above is accompanied with the text `meld-build`. This tells the plugin to sandbox and run the code within.

The `$` accessor provides a way to use the `meld-build` [API](api.md).

---

## What happens when a note is run?

Within the current note:
- All tables are parsed and added to the `$.data` array.
- All non-`meld-build` blocks are added to the `$.blocks` array.
- `JavaScript` blocks with `meld-build` are concatenated, sandboxed and executed.

---

## Tagging and Grouping `meld-build` codeblocks

It is possible to tag codeblocks for targeted runs using the `meld-build-toolbar`.

For instance, the following codeblock is tagged with `init`
````md
```js meld-build init
await $.ui.message('This is the init codeblock');
```
````

Multiple codeblocks with the same tag will be concatenated together before running.

To skip a codeblock all together, use the `skip` tag like this:
````md
```js meld-build skip
await $.ui.message("This won't run");
```
````
---

## Toolbar

To make running `meld-build` codeblocks easier you can add the following codeblock to show a toolbar.

````md
```meld-build-toolbar
```
````

By default you will see a `Run` and a `Help` button.

You can configure the labels of buttons like this:
````md
```meld-build-toolbar
run = Run Me!
help = SOS
```
````

To define run buttons which target codeblock tags you can do something like:
````md
```meld-build-toolbar
run|init = Run the Init Code
run|main = Run Code tagged with main
run = Run the Non-tagged Code
```
````


---

## Templating

One of the main features of `meld-build` is the built-in templating (provided by [Handlebars](https://handlebarsjs.com/)).

Here's an example:
````md
```js meld-build
const mytemplate = 'Hello {{name}}';
const mydata = { name:'World' };

const result = $.render( mytemplate, mydata );

await $.ui.message( result );
```
````

There are other ways to load templates too, for example, using the content of codeblocks.

Say your note looks like this:
````md
# My Runnable Note

The template codeblock:
```
Greetings {{name}}, {{message}}
```

The meld-build block to run:
```js meld-build
const template = $.blocks.at(0); // gets the first non-meld-build block in the note
const data = { name:'John', message:'How are you?' };

const result = $.render( template, data );

await $.ui.message( result );
```

````

Running this note will show a message with the following text: 'Greetings John, How are you?'

See the `$.io.import` and `$.io.load` [API](api.md) functions for other ways to load templates.

---

## Markers

It is possible to mark sections of a note with start and end markers.  These sections can then be targeted and their contents replaced with values you specify in a `meld-build` codeblock.

For example, when the following note is run, the `replace me` will be replaced with a random number.

````md
%%my marker=%%replace me%%=my marker%%

```js meld-build
$.markers.set( 'my marker', Math.random() );
await $.markers.apply();
```
````

See the [API](api.md) or another [example](examples/guess-the-number-marker.md) here.

---

## Accessing the DataView plugin API

If you are familiar with the [DataView](https://github.com/blacksmithgu/obsidian-dataview) plugin and have it installed, you can access it's [js api](https://blacksmithgu.github.io/obsidian-dataview/api/code-reference/) via the `$.dv.` interface.

For example:
````md
```js meld-build
// use DataView to fetch all notes within the vault
const pages = await $.dv.pages();
```
````

Note that the DataView rendering functions aren't supported, but you can still generate lists and tables using it's [Markdown Dataviews](https://blacksmithgu.github.io/obsidian-dataview/api/code-reference/#markdown-dataviews)


For example, running the following codeblock will create (or overwrite) a file named 'My List.md' with a list containing 3 items.

````md
```js meld-build
const md = $.dv.markdownList( [1, 2, 3] );
await $.io.output( 'My List.md', md );
```
````

---

## Other
- It's recommended to turn `on` the `Files & Links > Detect all file extensions` option in Obsidian.  This will make working with files for templating easier.
- Hint: add `//@hide_when_reading` to a `JavaScript` codeblock to hide it in Reading mode.
---

## More Information

- [API](api.md)
- Examples
	- [Guess The Number Game](/docs/examples/guess-the-number.md)
	- [Guess The Number Game (Using Markers)](/docs/examples/guess-the-number-marker.md)
	- [Simple Invoice Builder](/docs/examples/invoice-builder.md)

