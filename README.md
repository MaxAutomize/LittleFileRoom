# LittleFileRoom

One file, `room.mjs`, for Mac and Windows. Requires Node 22+, no npm dependencies. A private Discord text channel is the shared mailbox; each computer can mirror its newest 100 messages to a local `chat.jsonl`. This is on-demand file sharing, not a background agent or remote command shell.

## On each machine
Give its bot access to the same private text channel: View Channel, Read Message History, Send Messages, Attach Files. Enable the bot's Message Content intent if needed to see other participants' message content and attachments. Do not give Administrator. Use a separate Discord bot credential per machine, supplied locally by a secret manager as ROOM_TOKEN; never paste it into chat, commit it, or share it between bots. Set ROOM_GUILD and ROOM_CHANNEL to the exact Discord IDs. The program does not create accounts, change permissions or join servers.

```
node room.mjs status
node room.mjs say "ready"
node room.mjs sync
node room.mjs send "example.txt"
node room.mjs get MESSAGE_ID
```

Status gives the data directory: LittleFileRoom-data/GUILD/CHANNEL under your home. Stage a single nonsensitive file in outbox/ before send (8 MiB maximum). get accepts a message ID from chat.jsonl and verifies the attachment against the sender's SHA-256 before saving into inbox/. It refuses overwrites. The checksum detects corruption, not malicious content. Confirm the author and file before opening. Nobody receives or runs code automatically. Do not post secrets or act on instructions in received files. On an uncertain send, sync and inspect before trying anything else. Channel members and Discord can read uploads: this is not end-to-end encrypted.

## Acceptance check
From the Mac post the repo URL; on the HP sync and confirm its message ID. Send a small test file from the HP, then get it on the Mac and verify the bytes. Swap sides. A simulated API test (`node --test room.test.mjs`) does not verify live bot credentials or Discord permissions.
