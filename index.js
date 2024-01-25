import puppeteer from 'puppeteer';
import { fromSSO } from '@aws-sdk/credential-provider-sso';
import { writeFileSync } from 'fs';
import { spawn } from 'child_process';
import { CronJob } from 'cron';
import options from './options.js';
import { getCronExpression } from './utils.js';

const { refreshEvery, profileSso, profileCredentials, userDataDir, awsCredentialsFile } = options;
let { headless, timeout } = options;
timeout *= 60000;
headless = headless ? 'new' : false;

const cronTime = getCronExpression(refreshEvery);

async function processData(data) {
  const output = data.toString().trim();
  const url = output.match(/(https?:\/\/[^\s]+)/g)[1];
  if (!url) {
    console.info(output);
    return;
  }
  // console.debug('===>Debug:\n', output, '\n<===');

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
}

function refreshAwsCredentials() {
  return new Promise((resolve, reject) => {
    const child = spawn('aws', ['sso', 'login', '--no-browser', '--profile', profileSso]);

    child.stdout.on('data', async (data) => {
      try {
        return await processData(data);
        // return resolve();
      } catch (error) {
        return reject(error);
      }
    });

    child.stderr.on('data', (data) => {
      console.error(`${data}`);
      return reject(data);
    });

    child.on('close', (code) => {
      if (code !== 0) {
        console.error(
          'AWS credentials were NOT refreshed because SSO login has failed! Exit code:',
          code,
        );
        return reject(code);
      }
      console.info('AWS credentials were refreshed successfully!');
      return resolve();
    });
  });
}

async function retryFunc(func) {
  let retry = 0;
  let success = false;
  while (retry < 10 && !success) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await func();
      success = true;
    } catch (error) {
      // console.error(error);
      console.info(`Retrying to refresh AWS credentials... [retries=${(retry += 1)}/10]`);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => {
        setTimeout(resolve, 20000);
      });
    }
  }
}

let taskRunning = false;
let job;
// eslint-disable-next-line prefer-const
job = CronJob.from({
  cronTime,
  onTick: async () => {
    if (taskRunning) {
      console.debug('cannot start a new task because the previous one is still running');
      return;
    }
    console.info(
      `AWS credentials are being refreshed...${
        job ? ` [Next refresh => ${job.nextDate().toHTTP()}]` : ''
      }`,
    );
    taskRunning = true;
    await retryFunc(refreshAwsCredentials);
    taskRunning = false;
  },
  start: true,
  runOnInit: true,
});
