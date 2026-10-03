# Deck Plan (25 slides: 22 main + 3 appendix, JA first)

## 0–10 min: show the outcome, then explain the payment
1. Title
2. Prepared live demo: /usage success and over-cap refusal (recording fallback)
3. Speaker and contract: CLI hands-on, then Claude Code integration
4. Why pay per request?
5. /weather exact sequence diagram (x402 v2 headers)
6. Components and the two client wallets
7. exact vs upto (0.5 authorization, 0.3 settlement)
8. Three limits and their scope (/weather and gas excluded from allowance)
9. Local Node first; Workers optional

## 10–35 min: CLI hands-on
10. README link and checkpoint schedule
11. Step 0 readiness: settings, payer and facilitator funding
12. Step 1 free /weather: terminal A server, B curl; expect 200
13. Step 2 start facilitator in C, restore middleware, restart A
14. Observe 402 and payment conditions, run client; expect successful receipt
15. Step 3 approve 2 USDC of /usage allowance
16. Three guardrail cases: all three PASS; allowance exhaustion is separate
17. Troubleshooting by failed stage

## 35–50 min: integration, questions, next action
18. 35-minute checkpoint: MCP or instructor demo
19. Register MCP in Claude Code; separate Privy wallet and funding
20. Human approval vs agent execution; compare success and refusal
21. Add payment to your own API; questions at 45–50 minutes
22. Repository link (end of main presentation)

## Appendix (only for questions / after-session exercises)
23. AP2 / x402 / MPP scopes and interoperability
24. Supported EVM migration requirements
25. Zero-allowance rejection and restoration (not a three-PASS run)

## Instructor preparation
- Preflight CLI and Privy wallets, funding, Claude Code and origins before the session.
- Have successful-payment and rejected-payment recordings ready.
- Checkpoint at 15 min (free data), 25 min (paid data), 35 min (three PASS).
- Have helpers take unresolved setup issues so the group can observe the MCP demo.
- Stop integration at 45 min; do not run optional deployment during the core session.
