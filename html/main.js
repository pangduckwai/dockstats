
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

const getValue = (input) => {
	const regex = /([0-9]+[.]?[0-9]*)([a-zA-Z%]*)/;
	const groups = regex.exec(input);
	const v = Number(groups[1]);
	if (!groups[2])
		return { v };
	else {
		switch (groups[2]) {
			case '%':
				return { v, m: 0.01, u: groups[2] };
			case 'GiB':
			case 'GB':
				return { v, m: 1000000000, u: groups[2] };
			case 'MiB':
			case 'MB':
				return { v, m: 1000000, u: groups[2] };
			case 'KiB':
			case 'kB':
				return { v, m: 1000, u: groups[2] };
			default:
				return { v, u: groups[2] };
		}
	}
};

/* Transformed structure:
{
	cpu: {
		[Container #1 Name]: [["2020-09-28 18:05:39", "0.00%"], ["2020-09-28 18:07:39", "0.00%"], ["2020-09-28 18:09:39", "0.01%"], ...],
		[Container #2 Name]: [["2020-09-28 18:05:39", "5.84%"], ["2020-09-28 18:07:39", "7.03%"], ["2020-09-28 18:09:39", "1.85%"], ...],
		...
	},
	mem: {
		[Container #1 Name]: [["2020-09-28 18:05:39", "50.18MiB", "7.779GiB"], ["2020-09-28 18:07:39", "53.55MiB", "7.779GiB"], ...],
		[Container #2 Name]: [["2020-09-28 18:05:39", "291.2MiB", "7.779GiB"], ["2020-09-28 18:07:39", "292.8MiB", "7.779GiB"], ...],
		...
	},
	net: {
		[Container #1 Name]: [["2020-09-28 18:05:39", "4.49MB", "3.88MB"], ["2020-09-28 18:07:39", "7.25MB", "6.13MB"], ...],
		[Container #2 Name]: [["2020-09-28 18:05:39", "16kB", "12.4kB"], ["2020-09-28 18:07:39", "16.3kB", "12.6kB"], ...],
		...
	},
	blk: {
		[Container #1 Name]: [["2020-09-28 18:05:39", "0B", "0B"], ["2020-09-28 18:07:39", "0B", "0B"], ...],
		[Container #2 Name]: [["2020-09-28 18:05:39", "0B", "0B"], ["2020-09-28 18:07:39", "0B", "0B"], ...],
		...
	},
	pids: {
		[Container #1 Name]: [["2020-09-28 18:05:39", "22"], ["2020-09-28 18:07:39", "22"], ["2020-09-28 18:09:39", "22"]],
		[Container #2 Name]: [["2020-09-28 18:05:39", "42"], ["2020-09-28 18:07:39", "42"], ["2020-09-28 18:09:39", "42"]],
		...
	}
}
*/
const analyzer = (data) => {
	// let temp = 0;
	let min = Number.MAX_VALUE;
	let max = Number.MIN_VALUE;
	const from = (data.length > 0) ? data[0].date : undefined;
	const to = (data.length > 0) ? data[data.length - 1].date : undefined;
	const result = {};
	for (const datum of data) {
		// temp ++;
		const { date, ...stats } = datum;
		const dat0 = {};
		for (const stat of Object.entries(stats)) { // stat[0] container name, e.g. redis01, peer0-org2, ...
			for (const val of Object.entries(stat[1])) { // val[0] measurement name, e.g. cpu, mem, ...
				const value = getValue(val[1]);
				if (value.v < min)
					min = value.v;
				else if (value.v > max)
					max = value.v;
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
		// if (temp > 2) break;
	}
	return {min, max, from, to, ...result };
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
