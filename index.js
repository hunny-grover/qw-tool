#! /usr/bin/env node
const { program } = require('commander');
const cwd = __dirname;
const axios = require('axios');
const xss = require("xss");

let branchName;

// Starts user app
const start = (args, b) => {
	branchName = b[b.length - 1].split('=')[1];
	// FixMe: start V8 profiling to remove nyc dependency.
	require('child_process').exec('nyc ' + args.join(' '));
}


// Initializes cli
program
	.action(function (a, b, c) {
		start(this.args, b.rawArgs)
	})
program.parse()

// Store Tset Coverage
const storeTestCoverage = async (branch, coverage) => {
	try {
		await axios.get(`http://3.239.214.43:4000/updateCoverage/${branch}/${coverage}`);
		return;
	} catch (err) {
		console.log(err);
	}
}

// Generates Test Coverage
const generateTestCoverage = async () => {
	const reportDir = './.qualitywatch';
	const resultDir = './public/build/coverage';

	try { require('fs').mkdirSync(reportDir) } catch (err) { }
	// FixMe: following line of code is not working as expected
	try { require('fs').mkdirSync(resultDir) } catch (err) { }

	const reportPath = reportDir + '/out.json';
	const resultPath = resultDir + '/index.html';

	const viewerTemplatePath = cwd + '/sideBySideView.html';
	const viewerPath = resultDir + '/sideBySideView.html';

	const viewer = require('fs').readFileSync(viewerTemplatePath);
	require('fs').writeFileSync(viewerPath, viewer);

	require('fs').writeFileSync(reportPath, Buffer(JSON.stringify(__coverage__)));

	await extractUnTestedFunctions({ reportPath, resultPath });
	return;
}


// Extracts only untested code
const extractUnTestedFunctions = async ({ reportPath, resultPath }) => {
	let report = require('fs').readFileSync(reportPath, 'utf8');
	report = JSON.parse(report);

	let unTestedFunctions = [];
	let unTestedLines = [];

	let fileLineCount = 0;
	let unTestedLineCount = 0;

	const files = Object.entries(report);
	for (let i = 0; i < files.length; i++) {
		const [fileName, fileReport] = files[i];
		const FnExTimes = fileReport["f"];

		const fileLines = [];
		const file = require('readline').createInterface({
			input: require('fs').createReadStream(fileName),
			output: process.stdout,
			terminal: false
		});
		for await (const line of file) {
			fileLines.push(line);
			fileLineCount++;
		}

		unTestedLines.push(fileName);
		unTestedLines.push(''); // For Formatting

		// Extracts untested functions's declaration
		Object.entries(fileReport["fnMap"]).map(([fnKey, fnDetails]) => {
			if (FnExTimes[fnKey] === 0) { // Checks for tested or not
				for (let l = fnDetails.loc.start.line; l <= fnDetails.loc.end.line; l++) {
					let untestedLine = fileLines[l - 1]; // checkMe
					unTestedLines.push(untestedLine);
					unTestedLineCount++;
				}
				unTestedLines.push(''); // For Formatting
				unTestedFunctions.push(fnDetails.name);
			}
		});

		unTestedLines.push('-----------'); // For Formatting
		unTestedLines.push(''); // For Formatting
		unTestedLines.push(''); // For Formatting
	};

	unTestedLines = unTestedLines.map((line) => xss.escapeHtml(line));
	require('fs').writeFileSync(resultPath, '<pre>' + unTestedLines.join('<br>') + '<pre>');

	await storeTestCoverage(branchName, Math.round(100 - ((unTestedLineCount / fileLineCount) * 100)));
	return { unTestedFunctions, unTestedLines };
}


module.exports = { start, generateTestCoverage };