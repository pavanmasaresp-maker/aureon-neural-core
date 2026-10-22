# Aureon Neural Core

Local, offline-first AI server: your own chat UI + API in front of Ollama. No paid API key.

## Run (Codespace or laptop)

1. Copy `.env.example` to `.env` and set `NEURAL_CORE_KEY` to a long random string.
2. `docker compose up -d --build`
3. Pull the models (needs internet once):
   `docker compose exec ollama ollama pull qwen2.5-coder:7b`
   `docker compose exec ollama ollama pull qwen2.5:7b`
4. Open port 3000, enter your key, and chat.

## API for Aureon (OpenAI-style)

POST /v1/chat/completions
Header: Authorization: Bearer <NEURAL_CORE_KEY>
Body: { "model": "auto", "messages": [{ "role": "user", "content": "hi" }] }

"model": "auto" picks the coder model for code questions and the chat model otherwise.

## Upgrade models later

Pull a bigger model, then change CHAT_MODEL / CODER_MODEL in `.env` and run `docker compose up -d`.

## Offline

After the images and models are downloaded, everything works without internet.
The UI uses no CDN, fonts or external scripts.
