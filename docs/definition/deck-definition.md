# Deck Definition

## Title
Building an x402-Powered AI Agent: Autonomous Micropayments with Cloudflare Workers

## Context
- Devcon 8 workshop (2026-11-03..06, Mumbai), 50 minutes total
- Speaker: Japanese engineer, UNCHAIN community lead, AWS Community Builder
- Language: draft in Japanese first, translate to English later (keep text short)
- Style: dark theme (案A)

## Core message
Attendees build the payment mechanism with a CLI, observe 402 -> sign -> verify -> settle, and verify three guardrail cases. They then connect a prepared MCP server to Claude Code or follow the instructor demo. No API-discovery implementation is promised.

## Audience
Web3 / backend engineers; hands-on via README with shared checkpoints.

## Time / Ratio
- Introduction and payment concepts: 0–10 min (includes prepared demo)
- CLI hands-on: 10–35 min
- MCP integration and instructor demo: 35–45 min
- Questions and next step: 45–50 min
- 22 main slides + 3 appendix slides. Slides support instructions; detailed setup lives in README.

## Learning checks
- Free /weather response: HTTP 200, no payment.
- Paid /weather response: observe 402 first, then successful receipt and tx hash.
- upto scenarios: 0.3 USDC settled; 1.0 USDC above signed 0.5 cap rejected; client cap rejection before signing; three PASS in summary.
- Permit2 allowance limits /usage cumulative settlements, excludes /weather and gas. Allowance exhaustion is a separate optional exercise.
- CLI private-key wallet and user-owned Privy wallet are separate; fund both for MCP integration.

## Constraints
- Local run is the main path; Workers deployment and EVM migration are after-session exercises.
- Keys, payee, URLs and faucet funding are prepared before the session; setup preserves existing files.
- Claude Code model access and Privy credentials/origins are prepared before attendee MCP integration. Otherwise, follow the instructor demo.
- Explicit user budget approval is guided by MCP instructions and confirm input; the demo does not independently verify proof of human approval.
- Industry map is appendix material. Recheck official sources before the talk.
