# Feature: Self-hosted AI mode (Ollama / LM Studio)

## Summary

Allow ALMA instances to use locally-hosted AI models via Ollama or LM Studio instead of (or alongside) the Anthropic Claude API. This enables fully private, offline-capable deployments where memories never leave the user's machine.

## Motivation

ALMA stores deeply personal content — a father's mistakes, fears, love letters to his children. Some users will want **zero cloud dependency** for the AI responses. Others may not have budget for API keys. A self-hosted model option solves both.

## Proposed Architecture

### Config-driven model provider

Add to `alma_config`:

```json
{
  "model_provider": "anthropic",
  "model_endpoint": "https://api.anthropic.com/v1/messages",
  "model_name": "claude-sonnet-4-20250514",
  "model_api_key_env": "ANTHROPIC_API_KEY"
}
```

For Ollama/LM Studio:

```json
{
  "model_provider": "ollama",
  "model_endpoint": "http://localhost:11434/v1/chat/completions",
  "model_name": "llama3.1:8b",
  "model_api_key_env": ""
}
```

### Abstract the model call in chat.mjs

Replace `callAnthropic()` with `callModel(provider, endpoint, model, apiKey, systemPrompt, history, message)` that formats the request based on provider:

- **anthropic**: Current format (system field separate, x-api-key header)
- **openai-compatible**: OpenAI chat completions format (system as first message, Bearer token)

### Tunnel for remote deployments (optional)

For Netlify-hosted ALMA calling a local model:
- ngrok / Cloudflare Tunnel exposes localhost
- `model_endpoint` in config points to the tunnel URL
- User starts tunnel before using ALMA

### Admin UI

Add "AI Model" section to admin panel:
- Dropdown: Anthropic Claude / Ollama / LM Studio / Custom
- Endpoint URL field
- Model name field
- "Test connection" button
- Warning: "Local models require your computer to be running"

## What stays the same

- System prompt construction (buildSystemPrompt)
- Memory search and reranking (searchMemories)
- Corrections and directives injection
- Age-aware tone adaptation
- Content moderation (runs independently)
- i18n language instruction

## Recommended models for self-hosting

| Model | Size | Speed (CPU) | Quality | Best for |
|-------|------|-------------|---------|----------|
| Llama 3.1 8B Q4_K_M | 4.9 GB | 3-6 tok/s | Good | General use, 16GB+ RAM |
| Mistral 7B Q4_K_M | 4.4 GB | 4-7 tok/s | Good | Faster, slightly less nuanced |
| Llama 3.1 70B Q4_K_M | 40 GB | <1 tok/s | Excellent | Server/GPU only |

## Priority

**Low** — Claude Sonnet is the recommended model for ALMA. This feature targets users who prioritize privacy over quality/speed, or who want to run ALMA without internet.

## Labels

`enhancement` `architecture` `self-hosted`
