# Lessons learned

## 2024-06 Initial build
- Pacman uses raw canvas (not Phaser) — keep it that way, Phaser adds ~1MB to bundle
- walletStore.connect must stay `() => Promise<void>` even though ConnectButton doesn't await it — zustand handles the async internally
- Chat is currently Zustand-local; wiring to WS requires subscribing in a useEffect and calling ws.send('chat:message') — don't merge until server is running
