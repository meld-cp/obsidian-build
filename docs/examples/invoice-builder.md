# A Simple Invoice Builder

Copy and paste the codeblock below into a new note to try it out.


````md
# A Simple Invoice Builder

This example will produce and open an `HTML` file representing a simple invoice.
From your default web browser, it can then be saved as a PDF.

## Choose the invoice to build
```js meld-build
const invNumber = '22001';
```
```meld-build-toolbar
run = Build the Invoice
help =
```

## The Data defined as JavaScript
```js meld-build
// Define the customers
const customers = [
	{ id: 100, name: 'Some Co', address: ['123 Some Rd', 'Some City'] },
	{ id: 101, name: 'Some Other Co', address: ['123 Some Other Rd', 'Some City'] },
]

// Define the invoices and their lines
const invoices = [
	{
		id: '22001', customer:100, date: '2022-12-01', status: 'open',
		work: [
			{ date: '2022-11-13', start: 7.00, end: 16.50, rate: 25.45, desc: 'I did the thing' },
			{ date: '2022-11-16', start: 10.75, end: 12.00, rate: 25.45, desc: 'I did the other thing' },
		]
	},
]

```

## The invoice template
```html
<html>
	<head>
		<style>
			body{ font-family: 'Verdana'; }
			.logo { position: absolute; top: 0; right: 0; font-size: 6em; }
			table { width: 100%; }
			th,td { text-align: start; }
			.end{ text-align: end; }
			p.compact { margin:0; }
			#address > p{ margin:0 0 0 2em; }
		</style>
	</head>
	<body>
		<h1>My Co</h1>
		<div class="logo">🏢</div>
		<p>Invoice: {{inv.id}} </p>
		<p>Date: {{inv.date}}</p>
		<p class="compact">To: {{customer.name}}</p>
		<section id="address">
		{{#customer.address}}
		<p>{{.}}</p>
		{{/customer.address}}
		</section>
		<hr/>
		<table>
			<tr>
				<th>Description</th>
				<th class="end">Quantity</th>
				<th class="end">Unit Price</th>
				<th class="end">Amount</th>
			</tr>
			{{#inv.work}}
			<tr>
				<td>{{date}} - {{desc}}</td>
				<td class="end">{{duration}} hrs</td>
				<td class="end">$ {{format_number rate}}</td>
				<td class="end">$ {{format_number total}}</td>
			</tr>
			{{/inv.work}}
			<tr>
				<th></th>
				<th></th>
				<th class="end">Total:</th>
				<th class="end">$ {{format_number inv.total}}</th>
			</tr>
		</table>
	  </body>
</html>
```

## The code to build the invoice
```js meld-build
// get invoice to generate
const inv = invoices.filter( e => e.id==invNumber ).at(0);
// add line calculated fields
inv.work.forEach( e => {
	e.duration = e.end - e.start;
	e.total = e.duration * e.rate;
});
// calculate inv total
inv.total = inv.work.reduce( (a,c) => a + c.total, 0 );
// get invoice customer
const customer = customers.filter( e => e.id==inv.customer ).at(0);

// get the invoice template
const template = $.blocks.at(0);

// render the template passing in the customer and invoice
const html = await $.render( template, { customer, inv } );

// create an html invoice file and open it in the default browser, from there it can be saved as a PDF
await $.io.output( `inv ${inv.id}.html`, html, true );
```
````
