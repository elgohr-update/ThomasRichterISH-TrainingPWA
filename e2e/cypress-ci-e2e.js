/*
 * adapted from https://gist.github.com/Bkucera/4ffd05f67034176a00518df251e19f58
 *
 * referenced by open cypress issue https://github.com/cypress-io/cypress/issues/1313
 */

const _ = require('lodash');
const fs = require('fs');
const cypress = require('cypress');

const MAX_NUM_RUNS = 5;
const STATUS_FILE = 'cypress.status';
const BROWSER = process.env.BROWSER || 'chrome';
const TEST_FILES = process.argv.length > 2 ? process.argv[2].split(',') : undefined;

if (!process.env.PWA_BASE_URL) {
  console.error('PWA_BASE_URL is not set');
  process.exit(1);
}

if (!process.env.ICM_BASE_URL) {
  console.error('ICM_BASE_URL is not set');
  process.exit(1);
}

const DEFAULT_CONFIG = {
  browser: BROWSER,
  defaultCommandTimeout: 15000,
  reporter: 'junit',
  reporterOptions: 'mochaFile=reports/e2e-remote-[hash]-report.xml,includePending=true',
  spec: TEST_FILES,
  numTestsKeptInMemory: 1,
  watchForFileChanges: false,
  config: {
    ...JSON.parse(fs.readFileSync('cypress.json')),
    baseUrl: process.env.PWA_BASE_URL,
    pageLoadTimeout: 180000,
    trashAssetsBeforeRuns: false,
    video: false,
  },
  env: { ICM_BASE_URL: process.env.ICM_BASE_URL },
};

let totalFailuresIncludingRetries = 0;

const run = (num, spec, retryGroup) => {
  num += 1;
  let config = _.cloneDeep(DEFAULT_CONFIG);
  config = { ...config, env: { ...config.env, numRuns: num } };

  // activate video only for last run
  if (num >= MAX_NUM_RUNS) {
    config.config.video = true;
  }

  if (spec) config.spec = spec;
  if (retryGroup) config.group = retryGroup;

  console.log(config);

  try {
    return cypress
      .run(config)
      .then(results => {
        if (results.totalFailed) {
          totalFailuresIncludingRetries += results.totalFailed;

          // rerun again with only the failed tests
          const specs = _(results.runs)
            .filter('stats.failures')
            .map('spec.relative')
            .value();

          console.log(`Run #${num} failed.`);
          _(results.runs)
            .filter('stats.failures')
            .map('tests')
            .flatten()
            .filter('error')
            .value()
            .map(result => ({ title: result.title.join(' > '), error: result.error }))
            .forEach(result => console.warn(result.title, '\n', result.error, '\n'));

          // if this is the 3rd total run (2nd retry)
          // and we've still got failures then just exit
          if (num >= MAX_NUM_RUNS) {
            console.log(`Ran a total of '${MAX_NUM_RUNS}' times but still have failures. Exiting...`);
            fs.writeFileSync(STATUS_FILE, 'FAILURE');
            return process.exit(1);
          }

          console.log(`Retrying '${specs.length}' specs...`);
          console.log(specs);

          // If we're using parallelization, set a new group name
          let retryGroupName;
          if (DEFAULT_CONFIG.group) {
            retryGroupName = `${DEFAULT_CONFIG.group}: retry #${num}  (${specs.length} spec${
              specs.length === 1 ? '' : 's'
            } on ${uniqueId})`;
          }

          // kick off a new suite run
          return run(num, specs, retryGroupName);
        } else {
          console.log('finished successful');
          fs.writeFileSync(STATUS_FILE, 'SUCCESS');
        }
      })
      .catch(err => {
        console.error(err);
        return run(num);
      });
  } catch (err) {
    console.error(err);
    return run(num);
  }
};

// remove status file
if (fs.existsSync(STATUS_FILE)) {
  fs.unlinkSync(STATUS_FILE);
}

// kick off the run with the default specs
run(0);
