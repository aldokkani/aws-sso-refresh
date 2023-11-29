import puppeteer from 'puppeteer';
import { fromSSO } from '@aws-sdk/credential-provider-sso';
import { writeFileSync } from 'fs';
import { spawn } from 'child_process';
import { CronJob } from 'cron';
import options from './options.js';

const { refreshEvery, profileSso, profileCredentials, userDataDir, awsCredentialsFile } = options;
let { headless, timeout } = options;
timeout *= 60000;
headless = headless ? 'new' : false;

function getCronExpression(input) {
  const regex = /(\d+)\s*([a-zA-Z]+)/;
  const matches = input.match(regex);

  if (matches?.length !== 3) throw new Error(`Invalid refreshEvery: ${input}`);

  const frequency = parseInt(matches[1], 10);
  if (Number.isNaN(frequency)) throw new Error(`Invalid refreshEvery: ${input}`);

  const unit = matches[2][0];

  switch (unit) {
    case 's':
      return `*/${frequency} * * * * *`;
    case 'm':
      return `0 */${frequency} * * * *`;
    case 'h':
      return `0 0 */${frequency} * * *`;
    default:
      throw new Error(`Invalid refreshEvery: ${input}`);
  }
}

const cronTime = getCronExpression(refreshEvery);

function refreshAwsCredentials() {
  const child = spawn('aws', ['sso', 'login', '--no-browser', '--profile', profileSso]);

  child.stdout.on('data', async (data) => {
    const output = data.toString().trim();
    const url = output.match(/(https?:\/\/[^\s]+)/g)[1];
    if (!url) {
      console.info(output);
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
      profile: profileSso,
    })();

    const config = `[${profileCredentials}]
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
    if (code !== 0) {
      return console.error(
        'AWS credentials were NOT refreshed because SSO login has failed! Exit code:',
        code,
      );
    }
    return console.info('AWS credentials were refreshed successfully!');
  });
}

let job;
// eslint-disable-next-line prefer-const
job = CronJob.from({
  cronTime,
  onTick: () => {
    console.info(
      `AWS credentials are being refreshed...${
        job ? ` [Next refresh => ${job.nextDate().toHTTP()}]` : ''
      }`,
    );
    refreshAwsCredentials();
  },
  start: true,
  runOnInit: true,
});
