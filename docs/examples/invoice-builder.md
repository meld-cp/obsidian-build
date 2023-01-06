# A Simple Invoice Builder

````md
# A Simple Invoice Builder
```meld-build-toolbar
run = Build the Invoice
help =
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

## The code to run
```js meld-build
const invNumber = '22001';

const customers = [
	{ id: 100, name: 'Some Co', address: ['123 Some Rd', 'Some City'] },
	{ id: 101, name: 'Some Other Co', address: ['123 Some Other Rd', 'Some City'] },
]

const invoices = [
	{
		id: '22001', customer:100, date: '2022-12-01', status: 'open',
		work: [
			{ inv: '22001', date: '2022-11-13', start: 7.00, end: 16.50, rate: 25.45, desc: 'I did the thing' },
			{ inv: '22001', date: '2022-11-16', start: 10.75, end: 12.00, rate: 25.45, desc: 'I did the other thing' },
		]
	},
]

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

// renter the template passing in the customer and invoice
const html = await $.render( template, { customer, inv } );

// create an html invoice file and open it in the default browser, from there it can be saved as a PDF
await $.io.output( `inv ${inv.id}.html`, html, true );
```
````