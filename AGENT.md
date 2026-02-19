# AGENT.md — Amazon Braket CLI for AI Agents

## Overview

The `awsbraket` CLI provides access to the Amazon Braket Quantum Computing API. Use it to run quantum circuits, manage tasks, and explore available QPU devices.

## Prerequisites

Configure AWS credentials before use:

```bash
awsbraket config set --access-key-id <id> --secret-access-key <secret> --region us-east-1
awsbraket config list
```

## All Commands

### Config

```bash
awsbraket config set --access-key-id <id> --secret-access-key <secret> --region us-east-1
awsbraket config get region
awsbraket config list
```

### Tasks

```bash
awsbraket tasks list
awsbraket tasks list --status COMPLETED
awsbraket tasks list --status RUNNING
awsbraket tasks list --device-arn <arn>
awsbraket tasks get <task-arn>
awsbraket tasks create --device-arn <arn> --shots 1000 --s3-bucket <bucket>
awsbraket tasks cancel <task-arn>
```

Task statuses: CREATED, QUEUED, RUNNING, COMPLETED, FAILED, CANCELLING, CANCELLED

### Devices

```bash
awsbraket devices list
awsbraket devices list --type QPU
awsbraket devices list --type SIMULATOR
awsbraket devices list --provider IonQ
awsbraket devices list --status ONLINE
awsbraket devices get <device-arn>
```

### Circuits (Jobs)

```bash
awsbraket circuits list
awsbraket circuits list --state COMPLETED
awsbraket circuits get <job-name>
awsbraket circuits create --job-name <name> --role-arn <arn> --output-bucket <bucket>
awsbraket circuits cancel <job-name>
```

## JSON Output

Always use `--json` when parsing results:

```bash
awsbraket tasks list --json
awsbraket devices list --json
awsbraket circuits list --json
```

## Common Device ARNs

- `arn:aws:braket:::device/quantum-simulator/amazon/sv1` — State vector simulator
- `arn:aws:braket:::device/quantum-simulator/amazon/dm1` — Density matrix simulator
- `arn:aws:braket:::device/quantum-simulator/amazon/tn1` — Tensor network simulator
- `arn:aws:braket:::device/qpu/ionq/ionQdevice` — IonQ QPU
- `arn:aws:braket:::device/qpu/rigetti/Ankaa-2` — Rigetti Ankaa-2

## Error Handling

CLI exits with code 1 on error. Common errors:
- `Authentication failed` — Check your AWS credentials
- `Resource not found` — Verify the task ARN or device ARN
- `Rate limit exceeded` — Wait before retrying
