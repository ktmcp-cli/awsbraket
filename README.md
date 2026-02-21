> "Six months ago, everyone was talking about MCPs. And I was like, screw MCPs. Every MCP would be better as a CLI."
>
> — [Peter Steinberger](https://twitter.com/steipete), Founder of OpenClaw
> [Watch on YouTube (~2:39:00)](https://www.youtube.com/@lexfridman) | [Lex Fridman Podcast #491](https://lexfridman.com/peter-steinberger/)

# Amazon Braket CLI

Production-ready CLI for the Amazon Braket Quantum Computing API. Run quantum circuits, manage tasks, and browse QPU devices directly from your terminal.

## Installation

```bash
npm install -g @ktmcp-cli/awsbraket
```

## Configuration

```bash
awsbraket config set --access-key-id YOUR_ACCESS_KEY_ID \
  --secret-access-key YOUR_SECRET_ACCESS_KEY \
  --region us-east-1
```

## Usage

### Config

```bash
# Set AWS credentials
awsbraket config set --access-key-id <id> --secret-access-key <secret> --region us-east-1

# Get a config value
awsbraket config get region

# List all config
awsbraket config list
```

### Quantum Tasks

```bash
# List quantum tasks
awsbraket tasks list
awsbraket tasks list --status COMPLETED
awsbraket tasks list --device-arn arn:aws:braket:::device/qpu/ionq/ionQdevice

# Get task details
awsbraket tasks get arn:aws:braket:us-east-1:123456789012:quantum-task/abc123

# Create a quantum task (Bell state circuit)
awsbraket tasks create \
  --device-arn arn:aws:braket:::device/quantum-simulator/amazon/sv1 \
  --shots 1000 \
  --s3-bucket my-braket-bucket

# Cancel a task
awsbraket tasks cancel arn:aws:braket:us-east-1:123456789012:quantum-task/abc123

# JSON output
awsbraket tasks list --json
```

### Devices

```bash
# List all quantum devices
awsbraket devices list

# Filter by type
awsbraket devices list --type QPU
awsbraket devices list --type SIMULATOR

# Filter by provider
awsbraket devices list --provider IonQ
awsbraket devices list --provider Rigetti

# Get device details
awsbraket devices get arn:aws:braket:::device/qpu/ionq/ionQdevice
```

### Circuit Jobs

```bash
# List circuit jobs
awsbraket circuits list
awsbraket circuits list --state COMPLETED

# Get job details
awsbraket circuits get my-quantum-job

# Create a circuit job
awsbraket circuits create \
  --job-name my-quantum-job \
  --role-arn arn:aws:iam::123456789012:role/BraketJobRole \
  --output-bucket my-braket-bucket

# Cancel a job
awsbraket circuits cancel my-quantum-job
```

## Available Devices

Amazon Braket provides access to:

- **IonQ** — Trapped ion QPU (11+ qubits)
- **Rigetti** — Superconducting QPU
- **OQC** — Oxford Quantum Circuits
- **IQM** — Finnish QPU
- **Amazon SV1** — State vector simulator (34 qubits)
- **Amazon DM1** — Density matrix simulator (17 qubits)
- **Amazon TN1** — Tensor network simulator

## JSON Output

All commands support `--json` for scripting:

```bash
# Get all completed tasks as JSON
awsbraket tasks list --status COMPLETED --json

# Pipe to jq
awsbraket devices list --json | jq '.[] | select(.deviceStatus == "ONLINE") | .deviceName'
```

## License

MIT


---

## Support KTMCP

If you find this CLI useful, we'd greatly appreciate your support! Share your experience on:
- Reddit
- Twitter/X
- Hacker News

**Incentive:** Users who can demonstrate that their support/advocacy helped advance KTMCP will have their feature requests and issues prioritized.

Just be mindful - these are real accounts and real communities. Authentic mentions and genuine recommendations go a long way!

## Support This Project

If you find this CLI useful, we'd appreciate support across Reddit, Twitter, Hacker News, or Moltbook. Please be mindful - these are real community accounts. Contributors who can demonstrate their support helped advance KTMCP will have their PRs and feature requests prioritized.
