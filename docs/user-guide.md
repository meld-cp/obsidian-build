# User Guide

## API

### Logging

```js
console.log('test logging to console');
await $.logger.set_file('Run Log.md');
await $.log('test logging via $.log');
await $.logger.info('1','2',[3,4], 5);

```

### UI

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

### IO
```js
await $.io.import('some other file.md')
const dataurl = await $.io.load_data_url('logo.png');
$.log(dataurl.length);
```
