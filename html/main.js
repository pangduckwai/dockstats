
const fetch = (url, callback) => {
	const xmlhttp = new XMLHttpRequest();

	xmlhttp.onreadystatechange = () => {
		if ((xmlhttp.readyState === 4) && (xmlhttp.status === 200)) {
			try {
				callback(JSON.parse(xmlhttp.responseText));
			} catch (err) {
				console.log(err);
			}
		}
	};
	xmlhttp.ontimeout = () => {
		console.log(`Request to ${url} timed out`);
	};
	xmlhttp.open('GET', url, true);
	xmlhttp.timeout = 3000;
	xmlhttp.send();
}

/*
Target structure:
{
	cpu: {
		tester: [{ date: '2020-11-22 22:33', '0%' }, ...],
		rl-org1 ...
		...
	},
	mem: {
		tester...
	}
}
*/
const analyzer = (data) => {
	let temp = 0;
	const result = {};
	for (const datum of data) {
		temp ++;
		const { date, ...stats } = datum;
		const dat0 = {};
		for (const stat of Object.entries(stats)) { // stat[0] container name, e.g. redis01, peer0-org2, ...
			for (const val of Object.entries(stat[1])) { // val[0] measurement name, e.g. cpu, mem, ...
				switch (val[0]) {
					case 'memu':
						if (!result['mem']) result['mem'] = {};
						if (!result['mem'][stat[0]]) result['mem'][stat[0]] = [];
						result['mem'][stat[0]].push([date, val[1], stat[1]['memt']]);
						break;
					case 'memt':
						break;
					case 'neti':
						if (!result['net']) result['net'] = {};
						if (!result['net'][stat[0]]) result['net'][stat[0]] = [];
						result['net'][stat[0]].push([date, val[1], stat[1]['neto']]);
						break;
					case 'neto':
						break;
					case 'blki':
						if (!result['blk']) result['blk'] = {};
						if (!result['blk'][stat[0]]) result['blk'][stat[0]] = [];
						result['blk'][stat[0]].push([date, val[1], stat[1]['blko']]);
						break;
					case 'blko':
						break;
					default:
						if (!result[val[0]]) result[val[0]] = {};
						if (!result[val[0]][stat[0]]) result[val[0]][stat[0]] = [];
						result[val[0]][stat[0]].push([date, val[1]]);
						break;
				}
			}
		}
		if (temp > 2) break;
	}
	return result;
};

const render = (data) => {
	// const len = data.length;
	// const time = Date.parse(data[len - 1].date);
	// console.log(`Rendering data with ${len} data points, last updated at ${time}`);

	const numbFormat = d3.format('.2s');
	const timeFormat = d3.timeFormat('%Y-%m-%d %H:%M');

	const container = d3.select('.cntr'); // container
	const grpah = d3.select('.vlzr'); // visualizer
	const width = container.node().offsetWidth;
	const height = container.node().offsetHeight;
	console.log(`Chart size: ${width} x ${height}`);

	const x = d3.scaleTime().rangeRound([50, width - 20]);
	const y = d3.scaleLinear().rangeRound([20, height - 50]);
	console.log(data);
}

addEventListener('load', () => {
	console.log(new Date(), 'dockstats starting...');
	fetch('/stats', (response) => render(analyzer(response)));
});
