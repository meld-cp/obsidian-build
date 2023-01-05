# User Guide

The Meld-Build plugin can be used to turn a note into a small, simple, application.

For example, here is a JavaScript codeblock which will display a message box with the result of a simple calculation:
````
```js meld-build
await $.ui.message( 56 / 5 );
```
````
To run it, select the `Meld-Build: Run` command from the command pallette.

Notice that the `JavaScript` codeblock above is accompanied with the text `meld-build`. This allows the plugin to sandbox and run the code within.

The `$` accessor provides a way to use the meld-build API (See below).

## What happens when a note is run?

Within the current note:
- All tables are parsed and added to the `$.data` array.
- All non-`meld-build` blocks are added to the `$.blocks` array.
- All `JavaScript` blocks with `meld-build` are concatenated, sandboxes and executed.

## Toolbar

To make running meld-build codeblocks easier you can add the following codeblock to show a toolbar.

````
```meld-build-toolbar
```
````

_TODO: add screenshot_

## Templating

One of the main features of meld-build is the built in templating (provided by [Handlebars](https://handlebarsjs.com/)).

_TODO_

## Accessing DataView

_TODO_

## API

_TODO_

### Logging

_TODO_

#### Examples
````
```js
console.log('test logging to console');
await $.logger.set_file('Run Log.md');
await $.log('test logging via $.log');
await $.logger.info('1','2',[3,4], 5);
```
````

### UI

_TODO_

#### Examples
````
```js
// Notice
$.ui.notice('test notice');
$.ui.notice('test notice for 2s', 2);

// ask
const ans1 = await $.ui.ask( 'question 1' );
const ans2 = await $.ui.ask( 'question 2', ['1', '2', '3'] );
const ans3 = await $.ui.ask( 'Title', 'question 3' );
const ans4 = await $.ui.ask( 'Title', 'question 4', ['1', '2', '3'] );

// message
await $.ui.message( `Your answers were:\n\n${ans1}, ${ans2}, ${ans3}, ${ans4}` );
// message with title
await $.ui.message( 'A Title', 'A titled <b>message</b>' );
// number message
$.ui.message('Math', 13 * 67 );

// reload view
await $.ui.rebuild();
```
````

### IO

_TODO_

#### Examples
````
```js
await $.io.import('some other file.md')
const dataurl = await $.io.load_data_url('logo.png');
$.log(dataurl.length);
```
````