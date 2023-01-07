# Meld-Build API

## The Context Object (`$`)
- `$.data[<name>]`
	- Used to access imported Markdown table data.
	- The `<name>` will be the previous header to the table in the note.
	- Use `await $.log($.data);` to discover the data object.
	- e.g. if you had a header `# My Customers` before a markdown table, `$.data.my_customers` would return an array of that table.
- `$.blocks[]`
	- An array of non-`meld-build` codeblocks
	- Can be used as templates
	- e.g. `$.blocks.at(0)` would return the first non-`meld-build` codeblock.
- `await $.log(...params)`
	- Along with the standard `console` functions, you can use the `$.log()` function to log things.
- `await $.logger.set_file(filepath)`
	- To send log messages to a file, you can first use `$.logger.set_file('Log.md');`.
	- Note: The file will be overwritten.
- `await $.logger.info(...params)`
	- logs an `info` message to the console and to a file if set.
- `await $.logger.error(...params)`
	- logs an `error` message to the console and to a file if set.
- `$.render( template, data )`
	- Uses Handlebars to render the given template with the given data object.
	- e.g. `const result = $.render( 'Hello {{name}}', {name:'World'} );`

### Examples
```js meld-build
// console log, info, debug, error etc (ctrl + shift + i in windows to open dev tools)
console.log('standard logging to console');

// also logs to the console
await $.log('this is $.log logging');

// you can set a file to send log messages to
await $.logger.set_file('Run Log.md');

// now these log messages will be sent to the console and to 'Run log.md'
await $.log('test logging via $.log');
await $.log('1','2',[3,4], 5);
```

## User Interaction (`$.ui`)

- `$.ui.notice( msg, seconds? )`
	- Show a notice for x seconds (defaults to 5s)
- `await $.ui.ask( question, option_list[]? )`
	- Ask the user a question and return the result
	- If `option_list` is provided then a dropdown is used otherwise the user can enter a short text answer
- `await $.ui.ask( title, question, option_list[]? )`
	- Ask a question with a title
- `await $.ui.message( msg )`
	- Show a message box
- `await $.ui.message( title, msg )`
	- Show a message box with a title
- `await $.ui.rebuild()`
	- Rebuild the current view, may be needed if you have an embedded note which was modified

### Examples
```js meld-build
// Show a notice
$.ui.notice('test notice');
// Show a notice for 2 seconds
$.ui.notice('test notice for 2s', 2);

// ask for a simple text answer
const ans1 = await $.ui.ask( "What's your age?" );

// ask for an answer from a set list of options
const ans2 = await $.ui.ask( 'Please select a number', ['1', '2', '3'] );

// Titled questions
const ans3 = await $.ui.ask( 'Title', 'question 3' );
const ans4 = await $.ui.ask( 'Title', 'question 4', ['1', '2', '3'] );

// show a message
await $.ui.message( `Your answers were:\n\n${ans1}, ${ans2}, ${ans3}, ${ans4}` );

// show a message with title
await $.ui.message( 'A Title', 'A titled <b>message</b>' );
await $.ui.message( 'Math', 13 * 67 );

// rebuild the current view, may be needed if you have an embedded note which was modified
await $.ui.rebuild();
```

## Input/Output (`$.io`)

Read and write vault files.

- `const success = await $.io.import( path )`
	- Import data and blocks from another file
- `const content = await $.io.load( path )`
	- Return the contents of a file
- `const data = await $.io.load_data( path, name? )`
	- Load any tables from another file and add it to `$.data[]`
	- The loaded data is also returned
- `const dataurl = await $.io.load_data_url( path, mimetype? )`
	- Encode the contents of a file into a dataurl for use in a template
	- Optionaly specify the mime type.
	- Auto mime type mappings are available for the following file extensions: `.jpg`, `.png`, `.gif`, `.svg`, `.css`
- `await $.io.output( file, content, open? )`
	- (Over)Writes the `file` with given `content`
	- Tries to open the `file` if `open` is true (false by default)
	> WARNING: be careful with `$.io.output` which will overwrite your files.
- `await $.io.open( linktext )`
	- Tries to open `linktext`
- `await $.io.delete( file )`
	- Sends the `file` to the trash
	> WARNING: be careful with `$.io.delete`, although the deleted file is sent to the trash so it _might_ be recoverable.


### Examples
```js meld-build
// import data and blocks from another file
const success = await $.io.import('some other file.md');

// load the contents of a file into a variable
const fileContents = await $.load('my-template.html');

// encode the contents of a file to a dataurl for use in a template
const logo_dataurl = await $.io.load_data_url('logo.png');
const css_dataurl = await $.io.load_data_url('styles.css');

// save data to a file
await $.io.output( 'My Dynamic Note.md', '# Title\n- 1\n- 2\n- 3\n' );
// save data to a file and open it
await $.io.output( 'My Basic Note.md', '# Title\nHello there', true );

// open a file
await $.io.open( 'output/index.html' );

// send a file to the trash
await $.io.delete( 'output/index.html' );
```

## Markers (`$.markers`)

Markers can be used to replace sections of a note with dynamic values.  Sections to be replaced are marked with start and end tokens.

- `$.markers.define_mark_start( prefix, suffix )`
	- Configures the starting marker
	- By default this is set to `%%` and `=%%` which will match markers starting with `%%my marker=%%`
- `$.markers.define_mark_end( prefix, suffix )`
	- Configures the ending marker
	- By default this is set to `=%%` and `%%` which will match markers ending with `%%=my marker%%`
- `$.markers.target_file( file? )`
	- Sets the target file to `file`
	- `file` is optional and defaults to the current note
- `$.markers.set( name, value )`
	- Sets the marker value named `name` in memory
- `$.markers.clear()`
	- Clears any in memory values
- `markers = await $.markers.fetch()`
	- Returns the markers found in the target file
- `changes = await $.markers.apply( clearUnknownMarkerValues? )`
	- Applys set marker values to the target file
	- `clearUnknownMarkerValues` is optional, set it to `false` if you want to prevent unset markers being blanked out.

### Examples
````md

%%marker1=%% replace this %%=marker1%% 

```js meld-build
//$.markers.define_mark_start( '%%', '=%%' );
//$.markers.define_mark_end ( '%%=', '%%' );

// target current note
//$.markers.target_file();

// target some other file
//$.markers.target_file( 'Marker Target.md' );

// returns list of markers found in the target file
const markers = await $.markers.fetch();
//console.log({markers});

// removes marker values from memory
//$.markers.clear();

// sets a marker value in memory
$.markers.set( 'marker1', Math.random() );

// apply the new marker values to the target file
const result = await $.markers.apply(); 
//console.log({result});
```
````

## Assert (`$.assert`)

You can use `$.assert` to stop the run and show a message if a test fails.

- `await $.assert.isDefined( value, label? )`;
	- Stop the run and show a message if value is `undefined` or `null`
	- Label is an optional short label to include with a fail message
- `await $.assert.isTrue( value, label? )`;
	- Stop the run and show a message if value is `falsy`
- `await $.assert.isFalse( value, label? )`;
	- Stop the run and show a message if value is `truthy`
- `await $.assert.eq( expected, actual, label? )`;
	- Stop the run and show a message if `expected` is not equal to `actual`
- `await $.assert.neq( expected, actual, label? )`;
	- Stop the run and show a message if `expected` is equal to `actual`

### Examples
```js meld-build
const template = $.blocks.at(1);
// will stop with a message if there's no 2nd block
await $.assert.isDefined( template, 'template' );

```