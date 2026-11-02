# usage-monitor

A Claude Code mod that draws a USAGE MONITOR band above the chat input. It shows the account's 5h and 7d rate-limit usage as bars (account usage in cyan, this session's share in magenta, free capacity hatched) with the time until reset, plus this session's token totals (in / out / cache), cost and the model in use.

The 5h and 7d bars appear on subscription accounts after the first model response. The session share counts from the moment the mod loaded.

## Install

At the prompt of a terminal session:

```
/plugin install usage-monitor --marketplace sengokusal2025/usage-monitor
```

From a shell:

```
claude plugin install usage-monitor --marketplace sengokusal2025/usage-monitor
```

Answer `y` to add the marketplace, then choose a scope (user scope loads it in every session).

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `sengokusal2025/usage-monitor`, then Add plugin.
