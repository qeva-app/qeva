# Qeva agent clients

Humans (browser extension) and AI agents share **`/api/v1`** and the same access-token model. Create a token in Settings with **AI agent** selected.

## CLI

```bash
node agents/qeva.mjs config set --base http://localhost:3100 --token qeva_...
node agents/qeva.mjs me
node agents/qeva.mjs list --host github.com
node agents/qeva.mjs get <password-id>
node agents/qeva.mjs create --title GitHub --username you --password secret --website https://github.com
```

## MCP (Cursor / Claude Desktop)

```json
{
  "mcpServers": {
    "qeva": {
      "command": "node",
      "args": ["E:/AIProjects/QEVA/agents/mcp-server.mjs"],
      "env": {
        "QEVA_BASE_URL": "http://localhost:3100",
        "QEVA_TOKEN": "qeva_..."
      }
    }
  }
}
```

Tools: `qeva_me`, `qeva_list_passwords`, `qeva_get_password`, `qeva_create_password`, `qeva_update_password`, `qeva_delete_password`.

## DB

After pulling, apply the `AccessToken.clientKind` column:

```bash
npx prisma db push
```
