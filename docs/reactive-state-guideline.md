# Reactive State Guideline

Regola unica per il progetto:

1. Usa `signal/computed/effect` per stato UI e stato locale dei service.
2. Usa `Observable` per stream esterni (HTTP, Firebase listeners, interop RxJS).
3. Quando serve compatibilita con API RxJS, esporta un bridge con `toObservable(...)`.
4. Evita nuovi `BehaviorSubject` per stato applicativo interno, salvo casi legacy non migrati.
