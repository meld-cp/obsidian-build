# Guess The Number Game (Marker Version)

````md
# Guess The Number Game (Marker Version)

This example plays the classic guess the number game.  You are told if your guess is too high, too low, or just right.

```meld-build-toolbar
run = Let The Games Begin
help =
```

Guess Number: %%round=%%%%=round%%
Your last guess was: %%last=%%%%=last%%, **%%msg=%%%%=msg%%**

```js meld-build
const min = 1;
const max = 100;

// choose a random number between min and max
const number = min + Math.round( Math.random() * (max-min) );

let guessCount = 0;
let done = false;

// main game loop
while ( !done ){
	guessCount++;
	$.markers.set('round', guessCount );
	await $.markers.apply();

	try{
	
		// ask the user for a guess
		const input = await $.ui.ask(
			`Guess ${guessCount}`,
			`Guess the number between ${min} and ${max} (0 to stop)`
		);
		const guessNum = parseInt( input );
		
		
		if ( isNaN(guessNum) ){
			// user input wasn't a number
			await $.ui.message(`Please enter a whole number between ${min} and ${max}`);
			continue;
		}
		
		if ( guessNum === 0 ){
			// stop playing
			done = true; 
			continue;	
		}
		
		$.markers.set('last', guessNum );

		if( guessNum < number ){
			// guess was too low
			$.markers.set('msg', `Too low` );
			continue;
		}
	
		if( guessNum > number ){
			// guess was too high
			$.markers.set('msg', `Too high` );
			continue;
		}
		
		// guess was correct
		$.markers.set('msg', `🥳 YUS! You win!` );
		done = true;

	} finally {
		await $.markers.apply();
	}
}
```
````