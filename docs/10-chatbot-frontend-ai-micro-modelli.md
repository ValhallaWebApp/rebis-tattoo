# 10 - Chatbot Frontend AI e Micro Modelli

## Implementazione corrente
Chat locale 100% frontend con persistenza browser e inference client-side.

### Modello attuale
`LocalLlmService` usa:
- model id: `onnx-community/Qwen2.5-0.5B-Instruct`
- runtime: `@huggingface/transformers` + `onnxruntime-web`
- strategia device:
  - `wasm` su Windows
  - `webgpu` quando disponibile (altrimenti `wasm`)

### Modalita esecuzione
1. tenta worker dedicato (`local-llm.worker`)
2. se worker non disponibile, prova main thread
3. su timeout/error, ritorna fallback controllato (no crash UI)

Parametri principali:
- timeout generazione: `25s`
- timeout primo warmup worker: `180s`
- max prompt chars: `2200`

## Vantaggi
- nessun backend AI obbligatorio
- dati chat guest restano locali al browser
- esperienza immediata per FAQ/supporto base

## Limiti
- latenza alta al primo caricamento modello
- dipendenza forte da risorse client
- qualita risposta inferiore a modelli server-side piu grandi

## Best practice operative
- usare chatbot per supporto guidato e pre-qualifica, non per decisioni critiche
- mantenere prompt corto e contesto limitato (gia implementato)
- monitorare fallback rate e timeout in ambienti reali

## Evoluzioni consigliate
1. caching e warmup progressivo modello
2. telemetria minima (status loading/generating/error)
3. routing ibrido: locale di default, server opzionale per casi complessi
