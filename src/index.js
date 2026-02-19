import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getConfig, setConfig, isConfigured, getAllConfig } from './config.js';
import {
  listQuantumTasks, getQuantumTask, createQuantumTask, cancelQuantumTask,
  listDevices, getDevice,
  createJob, getJob, listJobs, cancelJob
} from './api.js';

const program = new Command();

// ============================================================
// Helpers
// ============================================================

function printSuccess(message) {
  console.log(chalk.green('✓') + ' ' + message);
}

function printError(message) {
  console.error(chalk.red('✗') + ' ' + message);
}

function printTable(data, columns) {
  if (!data || data.length === 0) {
    console.log(chalk.yellow('No results found.'));
    return;
  }

  const widths = {};
  columns.forEach(col => {
    widths[col.key] = col.label.length;
    data.forEach(row => {
      const val = String(col.format ? col.format(row[col.key], row) : (row[col.key] ?? ''));
      if (val.length > widths[col.key]) widths[col.key] = val.length;
    });
    widths[col.key] = Math.min(widths[col.key], 50);
  });

  const header = columns.map(col => col.label.padEnd(widths[col.key])).join('  ');
  console.log(chalk.bold(chalk.cyan(header)));
  console.log(chalk.dim('─'.repeat(header.length)));

  data.forEach(row => {
    const line = columns.map(col => {
      const val = String(col.format ? col.format(row[col.key], row) : (row[col.key] ?? ''));
      return val.substring(0, widths[col.key]).padEnd(widths[col.key]);
    }).join('  ');
    console.log(line);
  });

  console.log(chalk.dim(`\n${data.length} result(s)`));
}

function printJson(data) {
  console.log(JSON.stringify(data, null, 2));
}

async function withSpinner(message, fn) {
  const spinner = ora(message).start();
  try {
    const result = await fn();
    spinner.stop();
    return result;
  } catch (error) {
    spinner.stop();
    throw error;
  }
}

function requireAuth() {
  if (!isConfigured()) {
    printError('AWS credentials not configured.');
    console.log('\nRun the following to configure:');
    console.log(chalk.cyan('  awsbraket config set --access-key-id <id> --secret-access-key <secret> --region <region>'));
    process.exit(1);
  }
}

// ============================================================
// Program metadata
// ============================================================

program
  .name('awsbraket')
  .description(chalk.bold('Amazon Braket CLI') + ' - Quantum computing from your terminal')
  .version('1.0.0');

// ============================================================
// CONFIG
// ============================================================

const configCmd = program.command('config').description('Manage CLI configuration');

configCmd
  .command('set')
  .description('Set configuration values')
  .option('--access-key-id <id>', 'AWS Access Key ID')
  .option('--secret-access-key <secret>', 'AWS Secret Access Key')
  .option('--session-token <token>', 'AWS Session Token (for temporary credentials)')
  .option('--region <region>', 'AWS Region (e.g. us-east-1)')
  .action((options) => {
    if (options.accessKeyId) { setConfig('accessKeyId', options.accessKeyId); printSuccess('Access Key ID set'); }
    if (options.secretAccessKey) { setConfig('secretAccessKey', options.secretAccessKey); printSuccess('Secret Access Key set'); }
    if (options.sessionToken) { setConfig('sessionToken', options.sessionToken); printSuccess('Session Token set'); }
    if (options.region) { setConfig('region', options.region); printSuccess(`Region set to ${options.region}`); }
    if (!options.accessKeyId && !options.secretAccessKey && !options.sessionToken && !options.region) {
      printError('No options provided. Use --access-key-id, --secret-access-key, --region, or --session-token');
    }
  });

configCmd
  .command('get')
  .description('Get a configuration value')
  .argument('<key>', 'Configuration key')
  .action((key) => {
    const value = getConfig(key);
    if (value === undefined) {
      printError(`Key '${key}' not found`);
    } else {
      console.log(value);
    }
  });

configCmd
  .command('list')
  .description('List all configuration values')
  .action(() => {
    const all = getAllConfig();
    console.log(chalk.bold('\nAmazon Braket CLI Configuration\n'));
    console.log('Access Key ID:     ', all.accessKeyId ? chalk.green(all.accessKeyId) : chalk.red('not set'));
    console.log('Secret Access Key: ', all.secretAccessKey ? chalk.green('*'.repeat(8)) : chalk.red('not set'));
    console.log('Session Token:     ', all.sessionToken ? chalk.green('set') : chalk.dim('not set'));
    console.log('Region:            ', all.region ? chalk.green(all.region) : chalk.yellow('not set (default: us-east-1)'));
    console.log('');
  });

// ============================================================
// TASKS
// ============================================================

const tasksCmd = program.command('tasks').description('Manage quantum tasks');

tasksCmd
  .command('list')
  .description('List quantum tasks')
  .option('--device-arn <arn>', 'Filter by device ARN')
  .option('--status <status>', 'Filter by status (CREATED|QUEUED|RUNNING|COMPLETED|FAILED|CANCELLING|CANCELLED)')
  .option('--max-results <n>', 'Maximum results to return', '10')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    requireAuth();
    try {
      const tasks = await withSpinner('Fetching quantum tasks...', () =>
        listQuantumTasks({ deviceArn: options.deviceArn, status: options.status, maxResults: parseInt(options.maxResults) })
      );

      if (options.json) { printJson(tasks); return; }

      printTable(tasks, [
        { key: 'quantumTaskArn', label: 'Task ARN', format: (v) => v ? v.split('/').pop() : '' },
        { key: 'status', label: 'Status' },
        { key: 'deviceArn', label: 'Device', format: (v) => v ? v.split('/').pop() : '' },
        { key: 'shots', label: 'Shots' },
        { key: 'createdAt', label: 'Created', format: (v) => v ? new Date(v).toLocaleString() : '' }
      ]);
    } catch (error) {
      printError(error.message);
      process.exit(1);
    }
  });

tasksCmd
  .command('get <task-arn>')
  .description('Get details of a specific quantum task')
  .option('--json', 'Output as JSON')
  .action(async (taskArn, options) => {
    requireAuth();
    try {
      const task = await withSpinner('Fetching quantum task...', () => getQuantumTask(taskArn));

      if (options.json) { printJson(task); return; }

      console.log(chalk.bold('\nQuantum Task Details\n'));
      console.log('Task ARN:   ', chalk.cyan(task.quantumTaskArn));
      console.log('Status:     ', chalk.bold(task.status));
      console.log('Device:     ', task.deviceArn?.split('/').pop() || 'N/A');
      console.log('Shots:      ', task.shots);
      console.log('Created:    ', task.createdAt ? new Date(task.createdAt).toLocaleString() : 'N/A');
      console.log('Ended:      ', task.endedAt ? new Date(task.endedAt).toLocaleString() : 'N/A');
      if (task.outputS3Bucket) console.log('S3 Output:  ', `s3://${task.outputS3Bucket}/${task.outputS3Directory}`);
    } catch (error) {
      printError(error.message);
      process.exit(1);
    }
  });

tasksCmd
  .command('create')
  .description('Create a new quantum task')
  .requiredOption('--device-arn <arn>', 'Device ARN to run the task on')
  .requiredOption('--shots <n>', 'Number of shots (circuit executions)')
  .requiredOption('--s3-bucket <bucket>', 'S3 bucket for output results')
  .option('--s3-prefix <prefix>', 'S3 key prefix for output', 'braket-results')
  .option('--action <json>', 'Circuit action as JSON string (OpenQASM or ANSI C)')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    requireAuth();
    try {
      let action = options.action;
      if (!action) {
        // Default: simple Bell state circuit in OpenQASM 3
        action = JSON.stringify({
          braketSchemaHeader: { name: 'braket.ir.openqasm.program', version: '1' },
          source: 'OPENQASM 3.0;\nqubit[2] q;\nh q[0];\ncnot q[0], q[1];\n#pragma braket result probability q[0], q[1]',
          inputs: {}
        });
      }

      const task = await withSpinner('Creating quantum task...', () =>
        createQuantumTask({
          deviceArn: options.deviceArn,
          shots: parseInt(options.shots),
          outputS3Bucket: options.s3Bucket,
          outputS3KeyPrefix: options.s3Prefix,
          action
        })
      );

      if (options.json) { printJson(task); return; }

      printSuccess(`Quantum task created`);
      console.log('Task ARN: ', chalk.cyan(task.quantumTaskArn));
      console.log('Status:   ', task.status);
    } catch (error) {
      printError(error.message);
      process.exit(1);
    }
  });

tasksCmd
  .command('cancel <task-arn>')
  .description('Cancel a running quantum task')
  .option('--json', 'Output as JSON')
  .action(async (taskArn, options) => {
    requireAuth();
    try {
      const result = await withSpinner('Cancelling quantum task...', () => cancelQuantumTask(taskArn));

      if (options.json) { printJson(result); return; }

      printSuccess(`Quantum task cancellation requested`);
      console.log('Task ARN:      ', chalk.cyan(taskArn));
      console.log('Cancel Status: ', result.cancellationStatus);
    } catch (error) {
      printError(error.message);
      process.exit(1);
    }
  });

// ============================================================
// DEVICES
// ============================================================

const devicesCmd = program.command('devices').description('Browse quantum devices');

devicesCmd
  .command('list')
  .description('List available quantum devices')
  .option('--type <type>', 'Filter by type (QPU|SIMULATOR)')
  .option('--provider <name>', 'Filter by provider name (e.g. IonQ, Rigetti, OQC)')
  .option('--status <status>', 'Filter by status (ONLINE|OFFLINE|RETIRED)')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    requireAuth();
    try {
      const devices = await withSpinner('Fetching quantum devices...', () =>
        listDevices({ type: options.type, provider: options.provider, status: options.status })
      );

      if (options.json) { printJson(devices); return; }

      printTable(devices, [
        { key: 'deviceArn', label: 'Device ARN', format: (v) => v ? v.split('/').pop() : '' },
        { key: 'deviceName', label: 'Name' },
        { key: 'providerName', label: 'Provider' },
        { key: 'deviceType', label: 'Type' },
        { key: 'deviceStatus', label: 'Status' },
        { key: 'deviceCapabilities', label: 'Qubits', format: (v) => {
          try { const c = typeof v === 'string' ? JSON.parse(v) : v; return c?.paradigm?.qubitCount?.toString() || 'N/A'; } catch { return 'N/A'; }
        }}
      ]);
    } catch (error) {
      printError(error.message);
      process.exit(1);
    }
  });

devicesCmd
  .command('get <device-arn>')
  .description('Get details of a specific quantum device')
  .option('--json', 'Output as JSON')
  .action(async (deviceArn, options) => {
    requireAuth();
    try {
      const device = await withSpinner('Fetching device...', () => getDevice(deviceArn));

      if (options.json) { printJson(device); return; }

      console.log(chalk.bold('\nDevice Details\n'));
      console.log('Name:         ', chalk.bold(device.deviceName));
      console.log('ARN:          ', chalk.cyan(device.deviceArn));
      console.log('Provider:     ', device.providerName);
      console.log('Type:         ', device.deviceType);
      console.log('Status:       ', device.deviceStatus === 'ONLINE' ? chalk.green(device.deviceStatus) : chalk.red(device.deviceStatus));
      if (device.deviceCapabilities) {
        try {
          const caps = typeof device.deviceCapabilities === 'string'
            ? JSON.parse(device.deviceCapabilities) : device.deviceCapabilities;
          if (caps?.paradigm?.qubitCount) console.log('Qubits:       ', caps.paradigm.qubitCount);
        } catch {}
      }
    } catch (error) {
      printError(error.message);
      process.exit(1);
    }
  });

// ============================================================
// CIRCUITS (Jobs)
// ============================================================

const circuitsCmd = program.command('circuits').description('Manage quantum circuit jobs');

circuitsCmd
  .command('list')
  .description('List quantum circuit jobs')
  .option('--state <state>', 'Filter by state (RUNNING|COMPLETED|FAILED|CANCELLED)')
  .option('--max-results <n>', 'Maximum results', '10')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    requireAuth();
    try {
      const jobs = await withSpinner('Fetching circuit jobs...', () =>
        listJobs({ maxResults: parseInt(options.maxResults), state: options.state })
      );

      if (options.json) { printJson(jobs); return; }

      printTable(jobs, [
        { key: 'jobName', label: 'Job Name' },
        { key: 'jobArn', label: 'ARN', format: (v) => v ? v.split('/').pop() : '' },
        { key: 'status', label: 'Status' },
        { key: 'createdAt', label: 'Created', format: (v) => v ? new Date(v).toLocaleString() : '' }
      ]);
    } catch (error) {
      printError(error.message);
      process.exit(1);
    }
  });

circuitsCmd
  .command('get <job-name>')
  .description('Get details of a specific circuit job')
  .option('--json', 'Output as JSON')
  .action(async (jobName, options) => {
    requireAuth();
    try {
      const job = await withSpinner('Fetching circuit job...', () => getJob(jobName));

      if (options.json) { printJson(job); return; }

      console.log(chalk.bold('\nCircuit Job Details\n'));
      console.log('Job Name:   ', chalk.bold(job.jobName));
      console.log('Job ARN:    ', chalk.cyan(job.jobArn));
      console.log('Status:     ', chalk.bold(job.status));
      console.log('Role ARN:   ', job.roleArn || 'N/A');
      console.log('Created:    ', job.createdAt ? new Date(job.createdAt).toLocaleString() : 'N/A');
      console.log('Ended:      ', job.endedAt ? new Date(job.endedAt).toLocaleString() : 'N/A');
    } catch (error) {
      printError(error.message);
      process.exit(1);
    }
  });

circuitsCmd
  .command('create')
  .description('Create a new quantum circuit job')
  .requiredOption('--job-name <name>', 'Unique name for the job')
  .requiredOption('--role-arn <arn>', 'IAM role ARN with Braket permissions')
  .requiredOption('--output-bucket <bucket>', 'S3 bucket for output data')
  .option('--instance-type <type>', 'Instance type for the job', 'ml.m5.large')
  .option('--script-uri <uri>', 'S3 URI of the algorithm script')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    requireAuth();
    try {
      const job = await withSpinner('Creating circuit job...', () =>
        createJob({
          jobName: options.jobName,
          roleArn: options.roleArn,
          outputDataConfig: { s3Path: `s3://${options.outputBucket}/jobs/${options.jobName}` },
          algorithmSpecification: {
            scriptModeConfig: {
              entryPoint: 'algorithm:main',
              s3Uri: options.scriptUri || `s3://${options.outputBucket}/scripts/algorithm.py`
            }
          },
          instanceConfig: {
            instanceType: options.instanceType,
            volumeSizeInGb: 1
          }
        })
      );

      if (options.json) { printJson(job); return; }

      printSuccess(`Circuit job created`);
      console.log('Job ARN:  ', chalk.cyan(job.jobArn));
      console.log('Status:   ', job.status);
    } catch (error) {
      printError(error.message);
      process.exit(1);
    }
  });

circuitsCmd
  .command('cancel <job-name>')
  .description('Cancel a running circuit job')
  .action(async (jobName) => {
    requireAuth();
    try {
      await withSpinner('Cancelling circuit job...', () => cancelJob(jobName));
      printSuccess(`Circuit job '${jobName}' cancellation requested`);
    } catch (error) {
      printError(error.message);
      process.exit(1);
    }
  });

// ============================================================
// Parse
// ============================================================

program.parse(process.argv);

if (process.argv.length <= 2) {
  program.help();
}
