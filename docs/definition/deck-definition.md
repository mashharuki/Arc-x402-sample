# Deck Definition

## Title
Building an x402-Powered AI Agent: Autonomous Micropayments with Cloudflare Workers

## Context
- Devcon 8 workshop (2026-11-03..06, Mumbai), 50 minutes total
- Speaker: Japanese engineer, UNCHAIN community lead, AWS Community Builder
- Language: draft in Japanese first, translate to English later (keep text short)
- Style: dark theme (案A)

## Core message
AI agents can autonomously discover, pay for and consume paywalled APIs with x402, within spending guardrails. Attendees verify 402 -> sign -> verify -> settle and over-cap rejection by hand.

## Audience
Web3 / backend engineers building agentic apps; hands-on, self-paced via README.

## Time / Ratio
- Lecture 20% (10 min, ~10 slides), Hands-on 70% (35 min, ~6 slides), Wrap-up 10% (5 min, ~3 slides)
- Hands-on details live in README; hands-on slides have only: what to do now / command / expected output / when stuck

## Sections
1. Lecture: intro, why x402, ONE flow diagram, components, Workers, guardrails, industry map (x402/AP2/MPP as one diagram), what we build
2. Hands-on: Step 0 setup, Step 1 no x402, Step 2 enable middleware, Step 3 guardrails, troubleshooting, focus time
3. Wrap-up: completed demo (MCP via Claude Code; recorded backup), summary, thanks/links

## Constraints
- Prerequisites (Privy, Cloudflare, faucet) done before the session; local run is the main path, Workers deploy optional
- Industry map: 1 diagram slide, instantly readable
