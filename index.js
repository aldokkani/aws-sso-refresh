import puppeteer from 'puppeteer';
import { fromSSO } from '@aws-sdk/credential-provider-sso';
import { writeFileSync } from 'fs';
import { spawn } from 'child_process';
import { CronJob } from 'cron';
import { program } from 'commander';

program
  .option(
    '--refresh-every <refresh-every>',
    'Refresh every [frequency][unit] e.g. 5s, 1 minute, 2h',
    '55m'
  )
  .option('-p, --profile <profile>', 'AWS profile name', 'default')
  .option('--headless', 'Start in headless mode', false)
  .option(
    '-t, --timeout <timeout>',
    'Timeout in minutes for puppeteer browser to wait',
    3
  )
  .option(
    '--user-data-dir <user-data-dir>',
    'User data directory (browser profile) for puppeteer',
    '/tmp/puppeteer'
  )
  .option(
    '--aws-credentials-file <aws-credentials-file>',
    'AWS credentials file path',
    `${process.env.HOME}/.aws/credentials`
  );

program.parse();

const { refreshEvery, profile, userDataDir, awsCredentialsFile } =
  program.opts();
let { headless, timeout } = program.opts();
timeout = timeout * 60000;
headless = headless ? 'new' : false;

function getCronExpression(input) {
  const regex = /(\d+)\s*([a-zA-Z]+)/;
  const matches = input.match(regex);

  if (matches?.length !== 3) throw new Error(`Invalid refreshEvery: ${input}`);

  const frequency = parseInt(matches[1]);
  if (isNaN(frequency)) throw new Error(`Invalid refreshEvery: ${input}`);

  const unit = matches[2][0];
  if (!['s', 'm', 'h'].includes(unit))
    throw new Error(`Invalid refreshEvery: ${input}`);

  switch (unit) {
    case 's':
      return `*/${frequency} * * * * *`;
    case 'm':
      return `0 */${frequency} * * * *`;
    case 'h':
      return `0 0 */${frequency} * * *`;
  }
}

const cronTime = getCronExpression(refreshEvery);

let job;
job = CronJob.from({
  cronTime,
  onTick: () => {
    console.log(
      `AWS credentials are being refreshed...${
        job ? ` [Next refresh => ${job.nextDate().toHTTP()}]` : ''
      }`
    );
    refreshAwsCredentials();
  },
  start: true,
  runOnInit: true,
});

function refreshAwsCredentials() {
  const child = spawn('aws', [
    'sso',
    'login',
    '--no-browser',
    '--profile',
    profile,
  ]);

  child.stdout.on('data', async (data) => {
    const output = data.toString().trim();
    const url = output.match(/(https?:\/\/[^\s]+)/g)[1];
    if (!url) {
      console.log(output);
      return;
    }

    const browser = await puppeteer.launch({
      headless,
      userDataDir,
    });
    // Set headless to 'new' after the first run
    headless = 'new';

    const page = await browser.newPage();
    await page.goto(url);

    const verifyBtn = '#cli_verification_btn';
    await page.waitForSelector(verifyBtn, {
      visible: true,
      timeout,
    });
    await page.click(verifyBtn);

    const loginBtn = '#cli_login_button';
    await page.waitForSelector(loginBtn, {
      visible: true,
      timeout,
    });
    await page.click(loginBtn);

    await page.close();

    const { accessKeyId, secretAccessKey, sessionToken } = await fromSSO({
      profile,
    })();

    const config = `[${profile}]
  aws_access_key_id = ${accessKeyId}
  aws_secret_access_key = ${secretAccessKey}
  aws_session_token = ${sessionToken}
`;

    writeFileSync(awsCredentialsFile, config);

    await browser.close();
  });

  child.stderr.on('data', (data) => {
    console.error(`${data}`);
  });

  child.on('close', (code) => {
    if (code === 0) {
      console.log(`AWS credentials were refreshed successfully!`);
    } else {
      console.error('AWS credentials were NOT refreshed! Exit code:', code);
    }
  });
}
