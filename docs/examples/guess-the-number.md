
# Guess The Number Game

````md
# Guess The Number Game
```meld-build-toolbar
run = Let The Games Begin
help =
```

```js meld-build
const min = 1;
const max = 100;

// choose a rundom number between min and max
const number = min + Math.round( Math.random() * (max-min) );

let guessCount = 0;
let prevGuessMsg = '';
let done = false;
// main game loop
while ( !done ){
	
	guessCount++;
	
	// ask the user for a guess
	const input = await $.ui.ask(
		`Guess ${guessCount}`,
		`${prevGuessMsg}Guess the number between ${min} and ${max} (0 to stop)`
	);
	const guessNum = parseInt( input );
	
	if ( isNaN(guessNum) ){
		// user input wasn't a number
		await $.ui.message(`Please enter a whole number between ${min} and ${max}`);
		
	} else if ( guessNum === 0 ){
		// stop playing
		done = true; 
		
	} else if( guessNum < number ){
		// guess was too low
		prevGuessMsg = `${guessNum} was too low.  `;
	
	} else if( guessNum > number ){
		// guess was too high
		prevGuessMsg = `${guessNum} was too high.  `;
		
	}else{
		// guess was correct
		await $.ui.message(
			'🥳 YUS!',
			`You guessed the number was ${number} (in ${guessCount} tries)`
		);
		done = true;
		
	}
}
```
````
